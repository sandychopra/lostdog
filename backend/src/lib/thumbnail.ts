import sharp from "sharp";

export const THUMBNAIL_MAX_DIMENSION = 480;

// Every in-app view is a grid tile (at most ~160px CSS, so 480px covers 3x
// screens); the original stays in storage for Admin downloads.
export async function makeThumbnail(data: Buffer): Promise<Buffer> {
  return sharp(data)
    .rotate()
    .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 75 })
    .toBuffer();
}

export function thumbnailKeyFor(storageKey: string): string {
  return `${storageKey}.thumb.jpg`;
}
