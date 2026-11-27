import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { fitWithin, prepareImageForUpload } from "./prepareImage";

// happy-dom has no image decoder or canvas encoder, so the encode path is
// exercised with a stub bitmap and a stub canvas.
interface CanvasStub {
  width: number;
  height: number;
  getContext: () => { drawImage: ReturnType<typeof mock> } | null;
  toBlob: (cb: (blob: Blob | null) => void, type: string, quality: number) => void;
}

const realCreateImageBitmap = (globalThis as { createImageBitmap?: unknown }).createImageBitmap;

function stubDecoder(bitmap: { width: number; height: number }) {
  const close = mock(() => {});
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = mock(async () => ({
    ...bitmap,
    close,
  }));
  return close;
}

function stubCanvas(overrides: Partial<CanvasStub> = {}) {
  const drawImage = mock(() => {});
  const toBlob = mock((cb: (blob: Blob | null) => void, type: string) =>
    cb(new Blob(["jpeg-bytes"], { type })),
  );
  const canvas: CanvasStub = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toBlob,
    ...overrides,
  };
  const realCreateElement = document.createElement.bind(document);
  spyOn(document, "createElement").mockImplementation(((tag: string) =>
    tag === "canvas" ? canvas : realCreateElement(tag)) as typeof document.createElement);
  return { canvas, drawImage, toBlob };
}

afterEach(() => {
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = realCreateImageBitmap;
  mock.restore();
});

describe("fitWithin", () => {
  test("scales the long edge of a landscape photo down to the max", () => {
    expect(fitWithin(4032, 3024, 2560)).toEqual({ width: 2560, height: 1920 });
  });

  test("scales the long edge of a portrait photo down to the max", () => {
    expect(fitWithin(3024, 4032, 2560)).toEqual({ width: 1920, height: 2560 });
  });

  test("never scales a small image up", () => {
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 });
  });
});

describe("prepareImageForUpload", () => {
  test("returns the original file when it can't be decoded here", async () => {
    const file = new File(["not really an image"], "IMG_0001.HEIC", { type: "image/heic" });
    expect(await prepareImageForUpload(file)).toBe(file);
  });

  test("passes GIFs through untouched", async () => {
    const file = new File(["GIF89a"], "funny.gif", { type: "image/gif" });
    expect(await prepareImageForUpload(file)).toBe(file);
  });
});

describe("prepareImageForUpload encoding", () => {
  const heic = () => new File(["raw"], "IMG_0001.HEIC", { type: "image/heic" });

  test("re-encodes a large photo as a JPEG that fits the max dimension", async () => {
    const close = stubDecoder({ width: 4032, height: 3024 });
    const { canvas, drawImage, toBlob } = stubCanvas();

    const result = await prepareImageForUpload(heic());

    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("IMG_0001.jpg");
    expect([canvas.width, canvas.height]).toEqual([2560, 1920]);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1920);
    expect(toBlob.mock.calls[0]?.[1]).toBe("image/jpeg");
    expect(close).toHaveBeenCalled();
  });

  test("names a file with no base name 'photo.jpg'", async () => {
    stubDecoder({ width: 100, height: 100 });
    stubCanvas();

    const result = await prepareImageForUpload(new File(["raw"], ".heic", { type: "image/heic" }));

    expect(result.name).toBe("photo.jpg");
  });

  test("keeps the original when there's no 2D context", async () => {
    const close = stubDecoder({ width: 100, height: 100 });
    stubCanvas({ getContext: () => null });
    const file = heic();

    expect(await prepareImageForUpload(file)).toBe(file);
    expect(close).toHaveBeenCalled();
  });

  test("keeps the original when the encoder produces nothing", async () => {
    stubDecoder({ width: 100, height: 100 });
    stubCanvas({ toBlob: (cb) => cb(null) });
    const file = heic();

    expect(await prepareImageForUpload(file)).toBe(file);
  });

  test("keeps the original when decoding throws", async () => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = mock(async () => {
      throw new Error("unsupported format");
    });
    const file = heic();

    expect(await prepareImageForUpload(file)).toBe(file);
  });
});
