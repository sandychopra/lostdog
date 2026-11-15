// Phone photos are re-encoded before upload: iPhone HEIC files only display in
// Safari, and full-size camera images are slow over cell data. Decoding
// happens in the browser that took the photo (iOS Safari can decode HEIC), so
// the server only ever stores a JPEG it and every other browser can show.

export const MAX_UPLOAD_DIMENSION = 2560;
const JPEG_QUALITY = 0.85;

/** Scales (width, height) down to fit within `max` on the long edge, never up. */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_UPLOAD_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]*$/, "") || "photo";
  return `${base}.jpg`;
}

/**
 * Returns a resized JPEG copy of `file`, or `file` itself if it can't be
 * converted here (no canvas/decoder support) — the server accepts the original.
 * GIFs pass through untouched so animation isn't lost.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;
    return new File([blob], jpegName(file.name), { type: "image/jpeg" });
  } catch {
    return file;
  }
}
