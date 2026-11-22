import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import type { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StoredObject {
  key: string;
  lastModified: Date;
}

export interface PhotoStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ stream: Readable; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /**
   * A short-lived URL the browser can load directly, or null when this backend
   * can't sign one (local disk) — callers then stream the file through the API.
   */
  signedUrl(key: string, expiresInSeconds: number): Promise<string | null>;
  list(prefix: string): AsyncIterable<StoredObject>;
}

// Dev-only implementation matching S3/R2's key-based put/get/delete semantics.
// A real object store keeps content-type as object metadata alongside the
// bytes, not in the app DB (Photo has no content-type column on purpose) — the
// sidecar `<key>.meta.json` file reproduces that here; it's invisible to callers.
export class LocalDiskStorage implements PhotoStorage {
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

  async signedUrl(): Promise<string | null> {
    return null;
  }

  async *list(prefix: string): AsyncIterable<StoredObject> {
    let entries;
    try {
      entries = await readdir(this.filePath(prefix), { recursive: true, withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.endsWith(".meta.json")) continue;
      const path = join(entry.parentPath, entry.name);
      const key = relative(this.rootDir, path).split(sep).join("/");
      yield { key, lastModified: (await stat(path)).mtime };
    }
  }
}

// Any S3-compatible store — Cloudflare R2 in production (endpoint
// `https://<account>.r2.cloudflarestorage.com`, region "auto"), MinIO locally.
export class S3Storage implements PhotoStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    config: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string },
  ) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // MinIO serves buckets by path, not subdomain; R2 accepts either.
      forcePathStyle: true,
      // Newer SDKs send CRC checksums on every request by default, which
      // S3-compatible stores don't all accept.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<{ stream: Readable; contentType: string } | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        stream: result.Body as Readable,
        contentType: result.ContentType ?? "application/octet-stream",
      };
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string | null> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async *list(prefix: string): AsyncIterable<StoredObject> {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key) yield { key: object.Key, lastModified: object.LastModified ?? new Date() };
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}

/**
 * S3 only when fully configured and never under `bun test`, so tests can't
 * write to (or delete from) a real bucket. Anything else falls back to disk.
 */
export function createStorage(env: NodeJS.ProcessEnv = process.env): PhotoStorage {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, NODE_ENV } = env;
  if (NODE_ENV !== "test" && S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
    console.log(`[storage] using S3-compatible bucket "${S3_BUCKET}" at ${S3_ENDPOINT}`);
    return new S3Storage(S3_BUCKET, {
      endpoint: S3_ENDPOINT,
      region: env.S3_REGION || "auto",
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    });
  }
  // A container's own disk is wiped on every deploy, so production must name its
  // storage explicitly: a bucket, or UPLOADS_DIR on a persistent volume.
  if (NODE_ENV === "production" && !env.UPLOADS_DIR) {
    throw new Error(
      "[storage] NODE_ENV=production needs all four S3_* vars (or UPLOADS_DIR on a persistent volume); refusing to store photos on the container's ephemeral disk",
    );
  }
  const rootDir = env.UPLOADS_DIR || join(process.cwd(), "uploads");
  if (NODE_ENV !== "test") console.log(`[storage] using local disk at ${rootDir}`);
  return new LocalDiskStorage(rootDir);
}

export const storage: PhotoStorage = createStorage();
