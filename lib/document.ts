import { PDFDocument } from "pdf-lib";

export const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export type PreparedDocument = {
  data: Uint8Array;
  mediaType: SupportedMediaType;
  /** Original page count for PDFs; only the first page is sent to the models. */
  pageCount?: number;
};

export class DocumentError extends Error {
  constructor(
    public readonly code: "unsupported_type" | "pdf_unreadable" | "pdf_empty",
    message: string,
  ) {
    super(message);
  }
}

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Detects the real type from magic bytes — the client-declared MIME type is not trusted. */
export function sniffMediaType(bytes: Uint8Array): SupportedMediaType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  if (startsWith(bytes, ascii("%PDF-"))) return "application/pdf";
  return null;
}

async function firstPdfPage(bytes: Uint8Array): Promise<{ data: Uint8Array; pageCount: number }> {
  // pdf-lib can "load" a file with a valid header but no page tree and only
  // fail later, so every step is guarded, not just load().
  let pageCount: number;
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(bytes);
    pageCount = source.getPageCount();
  } catch {
    throw new DocumentError("pdf_unreadable", "PDF could not be read (corrupt or password-protected).");
  }
  if (pageCount === 0) throw new DocumentError("pdf_empty", "PDF has no pages.");
  if (pageCount === 1) return { data: bytes, pageCount };

  try {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(source, [0]);
    single.addPage(page);
    return { data: await single.save(), pageCount };
  } catch {
    throw new DocumentError("pdf_unreadable", "PDF could not be read (corrupt or password-protected).");
  }
}

/** Validates the upload and reduces PDFs to their first page (v1 scope). Nothing is persisted. */
export async function prepareDocument(bytes: Uint8Array): Promise<PreparedDocument> {
  const mediaType = sniffMediaType(bytes);
  if (!mediaType) throw new DocumentError("unsupported_type", "Unsupported file type. Use JPG, PNG, WebP or PDF.");
  if (mediaType !== "application/pdf") return { data: bytes, mediaType };
  const { data, pageCount } = await firstPdfPage(bytes);
  return { data, mediaType, pageCount };
}
