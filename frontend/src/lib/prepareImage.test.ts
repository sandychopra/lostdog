import { describe, expect, test } from "bun:test";
import { fitWithin, prepareImageForUpload } from "./prepareImage";

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
