import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { rasterizePdf } from "@/lib/pdf-raster";
import { documentParts } from "@/lib/providers/extract";

const PNG = [0x89, 0x50, 0x4e, 0x47];

async function twoPagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const label of ["Page one", "Page two"]) doc.addPage([595, 842]).drawText(label, { x: 50, y: 780, size: 24, font });
  return doc.save();
}

describe("rasterizePdf", () => {
  it("renders every page to a PNG, long edge ~1600 px", async () => {
    const pages = await rasterizePdf(await twoPagePdf());
    expect(pages).toHaveLength(2);
    for (const p of pages) {
      expect([...p.slice(0, 4)]).toEqual(PNG);
      const height = new DataView(p.buffer, p.byteOffset).getUint32(20);
      expect(height).toBe(1600);
    }
  }, 30_000);
});

describe("documentParts", () => {
  const pdf = { data: new Uint8Array([1, 2, 3]), mediaType: "application/pdf" as const, pageCount: 2 };
  const pages = [new Uint8Array([9]), new Uint8Array([8])];

  it("sends PDF-capable models the PDF itself", () => {
    const parts = documentParts({ provider: "anthropic", model: "m" }, pdf, "Extract.");
    expect(parts).toEqual([{ type: "text", text: "Extract." }, { type: "file", data: pdf.data, mediaType: "application/pdf" }]);
  });

  it("sends image-only models one labelled base64 PNG per page", () => {
    const parts = documentParts({ provider: "ollama", model: "m" }, { ...pdf, pageImages: pages }, "Extract.");
    expect(parts.filter((p) => p.type === "file")).toEqual([
      { type: "file", data: "CQ==", mediaType: "image/png" },
      { type: "file", data: "CA==", mediaType: "image/png" },
    ]);
    expect(parts.map((p) => (p.type === "text" ? p.text : "<img>"))).toEqual([
      "Extract.\nThe document has 2 page(s), given below as images in order.",
      "Page 1 of 2:", "<img>", "Page 2 of 2:", "<img>",
    ]);
  });

  it("refuses to send a PDF to an image-only model without rendered pages", () => {
    expect(() => documentParts({ provider: "ollama", model: "m" }, pdf, "x")).toThrow(/not rendered/);
  });
});
