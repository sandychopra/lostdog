import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { contentSecurityPolicyDirectives, serveFrontend } from "./frontendHosting.ts";

describe("contentSecurityPolicyDirectives", () => {
  test("allows the bucket host and its subdomains for images", () => {
    const directives = contentSecurityPolicyDirectives({
      S3_ENDPOINT: "https://abc123.r2.cloudflarestorage.com",
      FRONTEND_URL: "https://app.example.org",
    });
    expect(directives["img-src"]).toEqual([
      "'self'",
      "data:",
      "blob:",
      "https://abc123.r2.cloudflarestorage.com",
      "https://*.abc123.r2.cloudflarestorage.com",
    ]);
    expect(directives["upgrade-insecure-requests"]).toEqual([]);
  });

  test("skips the bucket and the https upgrade when not configured", () => {
    const directives = contentSecurityPolicyDirectives({ FRONTEND_URL: "http://localhost:4000" });
    expect(directives["img-src"]).toEqual(["'self'", "data:", "blob:"]);
    expect(directives["upgrade-insecure-requests"]).toBeNull();
  });
});

describe("serveFrontend", () => {
  let distDir: string;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    distDir = await mkdtemp(join(tmpdir(), "lostdog-dist-"));
    await mkdir(join(distDir, "assets"));
    await writeFile(join(distDir, "index.html"), "<!doctype html><title>app</title>");
    await writeFile(join(distDir, "assets", "index-abc.js"), "console.log(1)");
    await writeFile(join(distDir, "sw.js"), "// sw");

    const app = express();
    app.get("/api/health", (_req, res) => {
      res.json({ status: "ok" });
    });
    serveFrontend(app, distDir);
    server = app.listen(0);
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    await rm(distDir, { recursive: true, force: true });
  });

  test("caches fingerprinted assets forever and revalidates everything else", async () => {
    const asset = await fetch(`${base}/assets/index-abc.js`);
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    const sw = await fetch(`${base}/sw.js`);
    expect(sw.headers.get("cache-control")).toBe("no-cache");
  });

  test("answers client routes with index.html", async () => {
    const res = await fetch(`${base}/cats/12`, { headers: { accept: "text/html" } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>app</title>");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  test("leaves API routes, including unknown ones, to the API", async () => {
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ status: "ok" });
    const missing = await fetch(`${base}/api/nope`, { headers: { accept: "text/html" } });
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain("<title>app</title>");
  });

  test("refuses a directory without a build", () => {
    expect(() => serveFrontend(express(), join(distDir, "assets"))).toThrow(/index\.html/);
  });
});
