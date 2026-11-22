import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buffer } from "node:stream/consumers";
import { LocalDiskStorage, S3Storage, createStorage, type StoredObject } from "./storage.ts";

const rootDir = await mkdtemp(join(tmpdir(), "lostdog-storage-"));
afterAll(() => rm(rootDir, { recursive: true, force: true }));

async function collect(iterable: AsyncIterable<StoredObject>): Promise<string[]> {
  const keys: string[] = [];
  for await (const object of iterable) keys.push(object.key);
  return keys.sort();
}

describe("LocalDiskStorage", () => {
  const storage = new LocalDiskStorage(rootDir);

  test("round-trips bytes and content type, lists keys, and deletes", async () => {
    await storage.put("shift-reports/1/a.jpg", Buffer.from("original"), "image/jpeg");
    await storage.put("shift-reports/1/a.jpg.thumb.jpg", Buffer.from("thumb"), "image/jpeg");
    await storage.put("shift-reports/2/b.png", Buffer.from("png"), "image/png");

    const file = await storage.get("shift-reports/2/b.png");
    expect(file?.contentType).toBe("image/png");
    expect((await buffer(file!.stream)).toString()).toBe("png");

    expect(await collect(storage.list("shift-reports/"))).toEqual([
      "shift-reports/1/a.jpg",
      "shift-reports/1/a.jpg.thumb.jpg",
      "shift-reports/2/b.png",
    ]);

    await storage.delete("shift-reports/1/a.jpg");
    expect(await storage.get("shift-reports/1/a.jpg")).toBeNull();
    expect(await collect(storage.list("shift-reports/1/"))).toEqual([
      "shift-reports/1/a.jpg.thumb.jpg",
    ]);
  });

  test("can't sign URLs, and lists nothing under a missing prefix", async () => {
    expect(await storage.signedUrl()).toBeNull();
    expect(await collect(storage.list("nope/"))).toEqual([]);
  });
});

describe("createStorage", () => {
  const s3Env = {
    S3_ENDPOINT: "http://localhost:9000",
    S3_BUCKET: "lostdog-photos",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
  };

  test("uses S3 only when fully configured outside tests", () => {
    expect(createStorage({ ...s3Env, NODE_ENV: "production" })).toBeInstanceOf(S3Storage);
    expect(createStorage({ ...s3Env, NODE_ENV: "test", UPLOADS_DIR: rootDir })).toBeInstanceOf(
      LocalDiskStorage,
    );
    expect(
      createStorage({ ...s3Env, S3_BUCKET: "", NODE_ENV: "production", UPLOADS_DIR: rootDir }),
    ).toBeInstanceOf(LocalDiskStorage);
  });

  test("refuses the container's ephemeral disk in production", () => {
    expect(() => createStorage({ ...s3Env, S3_BUCKET: "", NODE_ENV: "production" })).toThrow(
      /S3_\*/,
    );
  });

  test("signs a path-style GET URL for the bucket", async () => {
    const storage = createStorage({ ...s3Env, NODE_ENV: "production" });
    const url = new URL((await storage.signedUrl("shift-reports/1/a.jpg", 900))!);

    expect(url.origin).toBe("http://localhost:9000");
    expect(url.pathname).toBe("/lostdog-photos/shift-reports/1/a.jpg");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
  });
});
