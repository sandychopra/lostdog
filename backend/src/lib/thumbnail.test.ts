import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { THUMBNAIL_MAX_DIMENSION, makeThumbnail, thumbnailKeyFor } from "./thumbnail.ts";

function solidImage(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#336699" } })
    .png()
    .toBuffer();
}

describe("makeThumbnail", () => {
  test("shrinks a large image to fit inside the max dimension, as JPEG", async () => {
    const thumbnail = await makeThumbnail(await solidImage(3000, 2000));
    const meta = await sharp(thumbnail).metadata();

    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(THUMBNAIL_MAX_DIMENSION);
    expect(meta.height).toBe(320);
  });

  test("never enlarges a small image", async () => {
    const meta = await sharp(await makeThumbnail(await solidImage(200, 100))).metadata();

    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });

  test("rejects bytes that aren't an image", async () => {
    expect(makeThumbnail(Buffer.from("not an image"))).rejects.toThrow();
  });
});

test("thumbnailKeyFor keeps the thumbnail next to its original", () => {
  expect(thumbnailKeyFor("shift-reports/3/abc-cat.jpg")).toBe(
    "shift-reports/3/abc-cat.jpg.thumb.jpg",
  );
});
