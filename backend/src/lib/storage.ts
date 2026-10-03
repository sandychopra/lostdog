import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Readable } from "node:stream";

export interface PhotoStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ stream: Readable; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

// Dev-only implementation matching S3/R2's key-based put/get/delete semantics
// closely enough to swap in a real R2 client later without touching callers.
// A real object store keeps content-type as object metadata alongside the
// bytes, not in the app DB (Photo has no content-type column on purpose) — the
// sidecar `<key>.meta.json` file reproduces that here; it's invisible to callers.
class LocalDiskStorage implements PhotoStorage {
  constructor(private readonly rootDir: string) {}

  private filePath(key: string): string {
    return join(this.rootDir, key);
  }

  private metaPath(key: string): string {
    return `${this.filePath(key)}.meta.json`;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const filePath = this.filePath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    await writeFile(this.metaPath(key), JSON.stringify({ contentType }));
  }

  async get(key: string): Promise<{ stream: Readable; contentType: string } | null> {
    try {
      const meta = JSON.parse(await readFile(this.metaPath(key), "utf-8")) as {
        contentType: string;
      };
      return { stream: createReadStream(this.filePath(key)), contentType: meta.contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await Promise.all([
      rm(this.filePath(key), { force: true }),
      rm(this.metaPath(key), { force: true }),
    ]);
  }
}

export const storage: PhotoStorage = new LocalDiskStorage(
  process.env.UPLOADS_DIR || join(process.cwd(), "uploads"),
);
