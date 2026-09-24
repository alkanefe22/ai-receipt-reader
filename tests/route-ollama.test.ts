import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

// Live mode on local Ollama. The guard under test runs before any model call,
// so no request ever reaches an Ollama server.
vi.stubEnv("DEMO_MODE", "false");
vi.stubEnv("EXTRACTOR_A_PROVIDER", "ollama");
vi.stubEnv("EXTRACTOR_A_MODEL", "vision-a");
vi.stubEnv("EXTRACTOR_B_PROVIDER", "ollama");
vi.stubEnv("EXTRACTOR_B_MODEL", "vision-b");
vi.stubEnv("ARBITER_PROVIDER", "ollama");
vi.stubEnv("ARBITER_MODEL", "vision-c");
vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:9/api"); // unroutable on purpose

const { POST } = await import("@/app/api/extract/route");

describe("POST /api/extract with Ollama roles", () => {
  it("rejects PDFs instead of letting Ollama silently drop them", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const form = new FormData();
    form.append("file", new File([await pdf.save()], "invoice.pdf", { type: "application/pdf" }));
    const res = await POST(new Request("http://localhost/api/extract", { method: "POST", body: form }));
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error.code).toBe("pdf_not_supported_by_model");
    expect(body.error.message).toContain("ollama/vision-a");
  });
});
