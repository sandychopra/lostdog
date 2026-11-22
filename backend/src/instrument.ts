import * as Sentry from "@sentry/bun";

// Preloaded (`bun --preload`) so Sentry.init runs before any other module.
// Only when SENTRY_DSN is set, and never under `bun test` (which sets
// NODE_ENV=test), so tests can't report to the real project.
// RAILWAY_GIT_COMMIT_SHA is set by Railway on deploys from GitHub, matching the
// frontend's release (see the Dockerfile).
const { SENTRY_DSN, NODE_ENV, SENTRY_ENVIRONMENT, RAILWAY_GIT_COMMIT_SHA } = process.env;
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || RAILWAY_GIT_COMMIT_SHA;

if (SENTRY_DSN && NODE_ENV !== "test") {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT || (NODE_ENV === "production" ? "production" : "development"),
    release: SENTRY_RELEASE || undefined,
    // Every trace locally; a sample in production.
    tracesSampleRate: NODE_ENV === "production" ? 0.1 : 1.0,
  });
}
