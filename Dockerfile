# Production image: one container that runs the Express API and serves the built
# frontend from the same origin (so session cookies are first-party and no CORS is
# involved). Railway builds it automatically from the repo root; see docs/deployment.md.
#
# Stages: `deps` installs everything needed to build, `build` generates the Prisma
# client and bundles the frontend, `release` is the slim runtime with production
# dependencies only. Build-time secrets (SENTRY_AUTH_TOKEN) live only in `build`,
# whose layers are never shipped.

ARG BUN_VERSION=1.4.2

FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# ---- deps: full install (dev deps included) for building ----
FROM base AS deps
COPY package.json bun.lock ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN bun install --frozen-lockfile

# ---- build: Prisma client + frontend bundle ----
FROM deps AS build
COPY . .

RUN cd backend && bunx --bun prisma generate

# Railway passes service variables to a Dockerfile build only when they're declared
# with ARG. PUBLIC_* values are inlined into the browser bundle (never secrets);
# SENTRY_AUTH_TOKEN only uploads source maps and stays in this stage.
ARG PUBLIC_SENTRY_DSN=""
ARG PUBLIC_SENTRY_ENVIRONMENT=""
ARG SENTRY_AUTH_TOKEN=""
ARG RAILWAY_GIT_COMMIT_SHA=""
# Blank API URL = same origin: the backend below serves the frontend.
RUN cd frontend \
  && PUBLIC_API_URL="" \
     PUBLIC_SENTRY_DSN="$PUBLIC_SENTRY_DSN" \
     PUBLIC_SENTRY_ENVIRONMENT="$PUBLIC_SENTRY_ENVIRONMENT" \
     PUBLIC_SENTRY_RELEASE="$RAILWAY_GIT_COMMIT_SHA" \
     SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" \
     bun run build

# ---- release: production deps + sources + build output ----
FROM base AS release
ENV NODE_ENV=production \
    FRONTEND_DIST_DIR=/app/frontend/dist

COPY package.json bun.lock ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN bun install --frozen-lockfile --production

COPY shared shared
COPY backend backend
COPY --from=build /app/backend/src/generated backend/src/generated
COPY --from=build /app/frontend/dist frontend/dist

USER bun
WORKDIR /app/backend
EXPOSE 4000
# Apply pending migrations, then start the server (the same command as the `start`
# script). Doing it here rather than in a host's pre-deploy hook keeps it working on
# any platform: if a migration fails, the container exits before listening, never
# passes the health check, and the previous deploy keeps serving. `exec` makes the
# server PID 1 so it receives the platform's SIGTERM directly. Railway injects PORT;
# index.ts falls back to 4000.
CMD ["sh", "-c", "bun run --bun migrate:deploy && exec bun --preload ./src/instrument.ts src/index.ts"]
