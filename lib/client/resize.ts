/**
 * Downscales large photos in the browser before upload: vision models do not
 * need 12 MP images, and smaller uploads mean fewer tokens and faster calls.
 * PDFs and already-small images are sent unchanged.
 */
const MAX_EDGE = 1600;
const SMALL_ENOUGH_BYTES = 1.5 * 1024 * 1024;

export async function prepareUpload(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // Formats the browser cannot decode (e.g. some HEIC) go through as-is.
    return file;
  }
}
