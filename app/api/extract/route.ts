import type { ExtractErrorCode, ExtractFailure, ExtractSuccess } from "@/lib/api-types";
import { getConfig } from "@/lib/config";
import { DEMO_SAMPLES, demoReaders, getFixture } from "@/lib/demo";
import { DocumentError, prepareDocument } from "@/lib/document";
import { PipelineError, runPipeline, type Notice, type Readers } from "@/lib/pipeline";
import { arbitrateFields, extractReceipt } from "@/lib/providers/extract";
import { rasterizePdf } from "@/lib/pdf-raster";
import { modelLabel, supportsPdf } from "@/lib/providers";
import { clientKey, rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/extract (multipart/form-data)
 *   - `sampleId`: replay a bundled demo sample (free, works in any mode)
 *   - `file`:     live extraction of an uploaded JPG/PNG/WebP/PDF (all pages, up to MAX_PDF_PAGES)
 *
 * Privacy: uploads are processed in memory and never written to disk or
 * storage; only the two/three model providers receive the document.
 */

const NO_STORE = { "Cache-Control": "no-store" };

function fail(status: number, code: ExtractErrorCode, message: string, extra: Partial<ExtractFailure["error"]> = {}, headers: HeadersInit = {}) {
  return Response.json({ error: { code, message, ...extra } } satisfies ExtractFailure, {
    status,
    headers: { ...NO_STORE, ...headers },
  });
}

const DOCUMENT_ERROR_STATUS: Record<DocumentError["code"], number> = {
  unsupported_type: 415,
  pdf_unreadable: 422,
  pdf_empty: 422,
  pdf_too_many_pages: 413,
};

export async function POST(request: Request) {
  const config = getConfig();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "bad_request", "Expected multipart/form-data.");
  }

  // ── Demo sample replay ─────────────────────────────────────
  const sampleId = form.get("sampleId");
  if (typeof sampleId === "string") {
    const sample = DEMO_SAMPLES.find((s) => s.id === sampleId);
    const fixture = sample && getFixture(sample.id);
    if (!sample || !fixture) return fail(404, "unknown_sample", `Unknown sample "${sampleId}".`);

    const notices: Notice[] = [];
    const result = await runPipeline(demoReaders(fixture, 450), notices);
    return Response.json(
      {
        ...result,
        id: crypto.randomUUID(),
        fileName: sample.fileName,
        mediaType: sample.file.endsWith(".pdf") ? "application/pdf" : "image/png",
        source: "replay",
        // Real recordings name the models that produced them; illustrative fixtures don't.
        models: fixture.recorded
          ? {
              a: modelLabel(fixture.recorded.models.a),
              b: modelLabel(fixture.recorded.models.b),
              arbiter: modelLabel(fixture.recorded.models.arbiter),
            }
          : null,
        ...(fixture.recorded ? { recordedAt: fixture.recorded.at } : {}),
      } satisfies ExtractSuccess,
      { headers: NO_STORE },
    );
  }

  // ── Live upload ────────────────────────────────────────────
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "bad_request", "Provide a `file` or a `sampleId`.");

  if (config.mode === "demo") {
    return fail(403, "demo_upload_disabled", "Live extraction is disabled in demo mode. Try the sample receipts.");
  }

  const limit = await rateLimit(clientKey(request.headers), { ...config.rateLimit, upstash: config.upstash });
  const limitHeaders = {
    "X-RateLimit-Limit": String(limit.limit),
    "X-RateLimit-Remaining": String(limit.remaining),
  };
  if (!limit.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return fail(429, "rate_limited", "Too many requests. Please try again later.", { retryAfterSeconds }, {
      ...limitHeaders,
      "Retry-After": String(retryAfterSeconds),
    });
  }

  if (file.size > config.maxFileBytes) {
    return fail(413, "file_too_large", `File exceeds ${Math.round(config.maxFileBytes / 1024 / 1024)} MB.`, {}, limitHeaders);
  }

  let doc;
  try {
    doc = await prepareDocument(new Uint8Array(await file.arrayBuffer()), { maxPdfPages: config.maxPdfPages });
  } catch (err) {
    if (err instanceof DocumentError) return fail(DOCUMENT_ERROR_STATUS[err.code], err.code, err.message, {}, limitHeaders);
    throw err;
  }

  const { extractorA, extractorB, arbiter } = config as Required<typeof config>;
  // Image-only models (Ollama) get the PDF's pages rendered to PNG; the others read the PDF itself.
  const needsImages = doc.mediaType === "application/pdf" && [extractorA, extractorB, arbiter].some((s) => !supportsPdf(s));
  if (needsImages) {
    try {
      doc = { ...doc, pageImages: await rasterizePdf(doc.data) };
    } catch {
      return fail(422, "pdf_unreadable", "PDF pages could not be rendered.", {}, limitHeaders);
    }
  }
  const call = { config, abortSignal: request.signal };
  const readers: Readers = {
    extractA: () => extractReceipt(extractorA, doc, call),
    extractB: () => extractReceipt(extractorB, doc, call),
    arbitrate: (fields) => arbitrateFields(arbiter, doc, fields, call),
    substitute: () => extractReceipt(arbiter, doc, call),
  };

  const notices: Notice[] = [];
  if (doc.pageCount) notices.push({ code: "pdf_pages", pageCount: doc.pageCount, rendered: needsImages });

  try {
    const result = await runPipeline(readers, notices);
    return Response.json(
      {
        ...result,
        id: crypto.randomUUID(),
        fileName: file.name.slice(0, 200),
        mediaType: doc.mediaType,
        source: "live",
        models: { a: modelLabel(extractorA), b: modelLabel(extractorB), arbiter: modelLabel(arbiter) },
      } satisfies ExtractSuccess,
      { headers: { ...NO_STORE, ...limitHeaders } },
    );
  } catch (err) {
    if (err instanceof PipelineError) {
      // Log provider errors (never the document) for operators.
      console.error("[extract] pipeline failed", err.errors);
      return fail(502, "extraction_failed", "The models could not read this document. Please try again.", {}, limitHeaders);
    }
    throw err;
  }
}
