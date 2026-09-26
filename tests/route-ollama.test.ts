import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

// Live mode on local Ollama, pointed at an unroutable address: these tests check
// what happens before and around the model call, never a real Ollama server.
vi.stubEnv("DEMO_MODE", "false");
vi.stubEnv("EXTRACTOR_A_PROVIDER", "ollama");
vi.stubEnv("EXTRACTOR_A_MODEL", "vision-a");
vi.stubEnv("EXTRACTOR_B_PROVIDER", "ollama");
vi.stubEnv("EXTRACTOR_B_MODEL", "vision-b");
vi.stubEnv("ARBITER_PROVIDER", "ollama");
vi.stubEnv("ARBITER_MODEL", "vision-c");
vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:9/api");
vi.stubEnv("MAX_PDF_PAGES", "3");
vi.stubEnv("MODEL_TIMEOUT_SECONDS", "5");

const { POST } = await import("@/app/api/extract/route");

async function pdf(pages: number) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([200, 300]);
  return new File([Buffer.from(await d.save())], "invoice.pdf", { type: "application/pdf" });
}
const post = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return POST(new Request("http://localhost/api/extract", { method: "POST", body: form }));
};

describe("POST /api/extract with Ollama roles", () => {
  it("accepts multi-page PDFs (rendered to images) instead of rejecting them", async () => {
    const res = await post(await pdf(2));
    // The PDF is rendered and sent on; only the unroutable model call fails.
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("extraction_failed");
  }, 30_000);

  it("rejects PDFs over MAX_PDF_PAGES", async () => {
    const res = await post(await pdf(4));
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("pdf_too_many_pages");
  });
});
