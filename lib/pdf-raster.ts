import "server-only";
import path from "node:path";

/**
 * Renders PDF pages to PNG for image-only models (e.g. Ollama), which cannot
 * read PDF input. PDF-capable providers get the original file instead.
 */

/** Long edge of a rendered page; matches the client-side photo downscale. */
const TARGET_LONG_EDGE = 1600;

/**
 * Standard 14 fonts (Helvetica, Times…) are not embedded in most PDFs; pdf.js
 * needs its own copies to draw them, and reads them with fs in Node. So these
 * are plain directory paths (a file:// URL breaks on spaces or "&"), with the
 * trailing "/" pdf.js insists on. Resolved from the project root at call time:
 * the bundler rewrites require.resolve() into a module id. next.config traces
 * these folders into the deployed function.
 */
function pdfjsAssetDirs() {
  const root = path.join(process.cwd(), "node_modules", "pdfjs-dist").replaceAll("\\", "/");
  return { standardFontDataUrl: `${root}/standard_fonts/`, cMapUrl: `${root}/cmaps/` };
}

export async function rasterizePdf(data: Uint8Array): Promise<Uint8Array[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    // pdf.js may detach the buffer it is given, so it gets its own copy.
    data: new Uint8Array(data),
    ...pdfjsAssetDirs(),
    cMapPacked: true,
    disableFontFace: true,
  });
  const pdf = await task.promise;

  try {
    const pages: Uint8Array[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: TARGET_LONG_EDGE / Math.max(base.width, base.height) });
      // In Node, pdf.js's canvas factory is backed by @napi-rs/canvas.
      const factory = pdf.canvasFactory as {
        create(w: number, h: number): { canvas: { toBuffer(mime: "image/png"): Buffer }; context: CanvasRenderingContext2D };
      };
      const { canvas, context } = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas: null, canvasContext: context, viewport, background: "#ffffff" }).promise;
      pages.push(new Uint8Array(canvas.toBuffer("image/png")));
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
