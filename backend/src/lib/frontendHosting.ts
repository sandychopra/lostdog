import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import express, { type Express } from "express";

// In production one container serves both the API and the built frontend
// (FRONTEND_DIST_DIR, set by the Dockerfile), so the app and /api share an
// origin: session cookies are first-party and CORS never comes into play. In
// dev FRONTEND_DIST_DIR is unset and Vite serves the frontend instead.

type Env = Record<string, string | undefined>;

/**
 * CSP directives layered over helmet's defaults (default-src/script-src 'self',
 * etc.) for what the built frontend actually loads: signed photo-thumbnail URLs
 * from the bucket, blob: object URLs (local-disk thumbnails and pre-upload
 * previews), Sentry's ingest endpoint and its session-replay worker.
 */
export function contentSecurityPolicyDirectives(env: Env = process.env) {
  const bucketOrigins: string[] = [];
  if (env.S3_ENDPOINT) {
    try {
      const { protocol, host } = new URL(env.S3_ENDPOINT);
      // R2 may sign path-style (<endpoint>/<bucket>/key) or virtual-host-style
      // (<bucket>.<endpoint>/key) URLs; allow both.
      bucketOrigins.push(`${protocol}//${host}`, `${protocol}//*.${host}`);
    } catch {
      // A malformed endpoint fails loudly in createStorage; nothing to allow here.
    }
  }
  const https = env.FRONTEND_URL?.startsWith("https://") ?? false;

  return {
    "img-src": ["'self'", "data:", "blob:", ...bucketOrigins],
    "connect-src": ["'self'", "https://*.sentry.io"],
    "worker-src": ["'self'", "blob:"],
    // Upgrading would break a local production build served over plain http.
    "upgrade-insecure-requests": https ? [] : null,
  };
}

/** Serves the Vite build, with an SPA fallback to index.html for client routes. */
export function serveFrontend(app: Express, distDir: string): void {
  const root = resolve(distDir);
  const indexHtml = join(root, "index.html");
  if (!existsSync(indexHtml)) {
    throw new Error(`FRONTEND_DIST_DIR (${root}) has no index.html; run the frontend build`);
  }
  const assetsDir = join(root, "assets") + sep;

  app.use(
    express.static(root, {
      index: false,
      setHeaders(res, filePath) {
        // Vite fingerprints everything under assets/, so it can be cached forever.
        // Everything else (sw.js, manifest, icons) must revalidate so a deploy
        // reaches installed PWAs.
        res.setHeader(
          "Cache-Control",
          filePath.startsWith(assetsDir) ? "public, max-age=31536000, immutable" : "no-cache",
        );
      },
    }),
  );

  app.get("/{*splat}", (req, res, next) => {
    // Unknown /api paths stay JSON-ish 404s rather than getting the app shell.
    if (req.path === "/api" || req.path.startsWith("/api/") || !req.accepts("html")) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });
}
