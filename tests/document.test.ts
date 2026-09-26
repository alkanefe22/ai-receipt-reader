import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { DocumentError, prepareDocument, sniffMediaType } from "@/lib/document";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 300]);
  return doc.save();
}

describe("sniffMediaType", () => {
  it("detects types from magic bytes", () => {
    expect(sniffMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMediaType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffMediaType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
  });

  it("rejects everything else, regardless of extension", () => {
    expect(sniffMediaType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(sniffMediaType(new Uint8Array())).toBeNull();
  });
});

describe("prepareDocument", () => {
  it("passes single-page PDFs through", async () => {
    const pdf = await makePdf(1);
    const doc = await prepareDocument(pdf);
    expect(doc).toMatchObject({ mediaType: "application/pdf", pageCount: 1 });
    expect(doc.data).toBe(pdf);
  });

  it("keeps every page of multi-page PDFs", async () => {
    const pdf = await makePdf(3);
    const doc = await prepareDocument(pdf);
    expect(doc.pageCount).toBe(3);
    expect(doc.data).toBe(pdf);
    expect((await PDFDocument.load(doc.data)).getPageCount()).toBe(3);
  });

  it("rejects PDFs over the page limit", async () => {
    await expect(prepareDocument(await makePdf(4), { maxPdfPages: 3 })).rejects.toMatchObject({ code: "pdf_too_many_pages" });
    await expect(prepareDocument(await makePdf(3), { maxPdfPages: 3 })).resolves.toMatchObject({ pageCount: 3 });
  });

  it.each(["%PDF-garbage", "%PDF-1.7 garbage"])("rejects corrupt PDF %j with a typed error", async (input) => {
    // The second one passes pdf-lib's load() and used to crash on getPageCount().
    const err = await prepareDocument(new TextEncoder().encode(input)).catch((e) => e);
    expect(err).toBeInstanceOf(DocumentError);
    expect(err.code).toBe("pdf_unreadable");
  });

  it("rejects unsupported types", async () => {
    await expect(prepareDocument(new TextEncoder().encode("GIF89a"))).rejects.toMatchObject({ code: "unsupported_type" });
  });
});
