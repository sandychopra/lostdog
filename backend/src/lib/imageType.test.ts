import { describe, expect, test } from "bun:test";
import { detectImageType, isAllowedImageType } from "./imageType.ts";

function bytes(...parts: (number[] | string)[]): Buffer {
  return Buffer.concat(
    parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p))),
  );
}

describe("detectImageType", () => {
  test("recognizes allowed raster formats by magic bytes", () => {
    expect(detectImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageType(bytes("GIF89a"))).toBe("image/gif");
    expect(detectImageType(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("image/webp");
    expect(detectImageType(bytes([0, 0, 0, 0x18], "ftypheic"))).toBe("image/heic");
    expect(detectImageType(bytes([0, 0, 0, 0x18], "ftypmif1"))).toBe("image/heif");
  });

  test("rejects SVG, HTML, and other ISO-BMFF brands", () => {
    expect(
      detectImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')),
    ).toBeNull();
    expect(detectImageType(bytes('<?xml version="1.0"?><svg/>'))).toBeNull();
    expect(detectImageType(bytes("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectImageType(bytes([0, 0, 0, 0x18], "ftypisom"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("isAllowedImageType", () => {
  test("allows only the raster allowlist", () => {
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
    expect(isAllowedImageType("text/html")).toBe(false);
  });
});
