import { PDFDocument } from "pdf-lib";

export const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export type PreparedDocument = {
  data: Uint8Array;
  mediaType: SupportedMediaType;
  /** Page count for PDFs; every page is sent to the models. */
  pageCount?: number;
  /**
   * PDF pages rendered to PNG, for image-only models (e.g. Ollama) that cannot
   * read PDF input. Filled in by the route only when such a model is configured.
   */
  pageImages?: Uint8Array[];
};

export const DEFAULT_MAX_PDF_PAGES = 10;

export class DocumentError extends Error {
  constructor(
    public readonly code: "unsupported_type" | "pdf_unreadable" | "pdf_empty" | "pdf_too_many_pages",
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

async function countPdfPages(bytes: Uint8Array): Promise<number> {
  // pdf-lib can "load" a file with a valid header but no page tree and only
  // fail later, so the page count is read inside the same guard.
  try {
    const pdf = await PDFDocument.load(bytes);
    return pdf.getPageCount();
  } catch {
    throw new DocumentError("pdf_unreadable", "PDF could not be read (corrupt or password-protected).");
  }
}

/**
 * Validates the upload. Multi-page PDFs are kept whole (up to `maxPdfPages`):
 * line items often continue across pages and totals sit on the last one.
 * Nothing is persisted.
 */
export async function prepareDocument(
  bytes: Uint8Array,
  { maxPdfPages = DEFAULT_MAX_PDF_PAGES }: { maxPdfPages?: number } = {},
): Promise<PreparedDocument> {
  const mediaType = sniffMediaType(bytes);
  if (!mediaType) throw new DocumentError("unsupported_type", "Unsupported file type. Use JPG, PNG, WebP or PDF.");
  if (mediaType !== "application/pdf") return { data: bytes, mediaType };

  const pageCount = await countPdfPages(bytes);
  if (pageCount === 0) throw new DocumentError("pdf_empty", "PDF has no pages.");
  if (pageCount > maxPdfPages) {
    throw new DocumentError("pdf_too_many_pages", `PDF has ${pageCount} pages; the limit is ${maxPdfPages}.`);
  }
  return { data: bytes, mediaType, pageCount };
}
