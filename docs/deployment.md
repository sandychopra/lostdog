# Deploying to Railway

Production runs as **one Railway service** built from the root `Dockerfile`, plus Railway's managed **Postgres**. The Express backend serves the built frontend from the same origin as `/api`, so session cookies are first-party and CORS never comes into play. It works on Railway's default `*.up.railway.app` URL and on a custom domain alike. Photos go to **Cloudflare R2**, email to **SendGrid**, and errors to **Sentry**, all configured by env vars.

## What's in the repo

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage: full install → `prisma generate` + `vite build` (with `PUBLIC_API_URL` blank = same origin) → slim runtime with production deps only, running as the non-root `bun` user. |
| `.dockerignore` | Keeps local `.env` files out of the image. Otherwise Vite would inline `frontend/.env`'s localhost values into the bundle. |
| `railway.json` | Config as code: Dockerfile builder, `prisma migrate deploy` as the **pre-deploy command** (runs before each new deploy goes live; a failed migration stops the deploy), `/api/health` health check (it also pings the database), restart on failure. |
| `backend/src/lib/frontendHosting.ts` | Serves `FRONTEND_DIST_DIR` (set by the Dockerfile) with an SPA fallback, `immutable` caching for fingerprinted `assets/`, `no-cache` for `index.html`/`sw.js`/manifest so installed PWAs pick up deploys, and the Content-Security-Policy. |
| `backend/src/scripts/createAdmin.ts` | `bun run create-admin`: bootstraps the first Admin on an empty database. |

## One-time setup

1. **Create the project.** In Railway: *New Project → Deploy from GitHub repo →* this repo. Railway first needs its GitHub App installed with access to the repo; see [`external-services.md`](external-services.md#railway-production-hosting) (and don't confuse it with the "Deploy to Railway" GitHub Action). Railway finds `railway.json` and builds the `Dockerfile`. The first deploy will fail until the variables below are set; that's expected.
2. **Add Postgres.** *+ Create → Database → PostgreSQL* in the same project.
3. **Generate a domain.** On the app service: *Settings → Networking → Generate Domain*. That gives a `*.up.railway.app` URL to get the first deploy working. The real address, `app.7cornerscats.com`, comes in step 7.
4. **Set the service variables** (*Variables → Raw Editor*). Type these in fresh rather than pasting `backend/.env`/`frontend/.env`: the dev files hold localhost URLs, the dev auth secret, demo seed passwords, and the ngrok origin, none of which belong in production.

   ```bash
   DATABASE_URL=${{Postgres.DATABASE_URL}}        # private network; no egress fees
   BETTER_AUTH_SECRET=                             # openssl rand -base64 32 (a new one, not your dev secret)
   BETTER_AUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
   FRONTEND_URL=https://${{RAILWAY_PUBLIC_DOMAIN}} # also the link in notification emails
   CLIENT_IP_HEADER=X-Real-IP                      # Railway's edge sends the client IP here, not X-Forwarded-For
   RAILWAY_DEPLOYMENT_DRAINING_SECONDS=15          # lets in-flight uploads finish on redeploy (default is 0)

   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_BUCKET=lostdog-photos                        # the production bucket
   S3_ACCESS_KEY_ID=
   S3_SECRET_ACCESS_KEY=

   SENDGRID_API_KEY=
   EMAIL_FROM=
   NOTIFICATION_TO=                                # a personal address while testing; the Google Group at launch

   SENTRY_DSN=                                     # lostdog-server
   PUBLIC_SENTRY_DSN=                              # lostdog-frontend (build-time; inlined into the bundle)
   SENTRY_AUTH_TOKEN=                              # build-time only; uploads source maps, never shipped
   ```

   | Don't set these | Why |
   |---|---|
   | `NODE_ENV`, `FRONTEND_DIST_DIR`, `PORT` | The Dockerfile sets the first two and Railway injects `PORT`. A Railway variable **overrides** the image's `ENV`, so even a blank `NODE_ENV=` would switch off production mode and a blank `FRONTEND_DIST_DIR=` would stop the frontend being served. |
   | `SEED_ADMIN_*`, `SEED_VOLUNTEER_*` | Demo accounts; production uses `create-admin` (step 6) |
   | `TUNNEL_URL`, `TUNNEL_HOST` | Dev-only ngrok settings; `TUNNEL_URL` would make the backend accept sign-ins from that origin |
   | `UPLOADS_DIR` | A non-empty value bypasses the "photos must go to the bucket" guard, so photos would vanish on the next deploy |
   | `PUBLIC_API_URL` | Ignored (the Dockerfile builds with it blank), but misleading if set |
   | `TRUST_PROXY_HOPS` | Replaced by `CLIENT_IP_HEADER` on Railway |

   Reuse from dev: `SENDGRID_API_KEY`, `EMAIL_FROM`, the Sentry DSNs and `SENTRY_AUTH_TOKEN`. Create new for production: `BETTER_AUTH_SECRET`, the R2 bucket and its token (see [`external-services.md`](external-services.md#cloudflare-r2-photo-storage)). Sentry releases default to `RAILWAY_GIT_COMMIT_SHA` on both sides.
5. **Deploy.** The build runs, then the pre-deploy step applies migrations, then the health check gates the switch-over.
6. **Create the first Admin.** Install the [Railway CLI](https://docs.railway.com/guides/cli) (`brew install railway`), then `railway login` and `railway link` (pick the project and the app service), and open a shell inside the running container:

   ```bash
   railway ssh
   bun run create-admin --email you@example.org --name "Your Name"
   ```

   It prints a one-time random password (or uses `ADMIN_PASSWORD` if set). Sign in, change the password from the Users page, and add everyone else there. The script refuses to run once an active Admin exists. Never run `bun run seed` against production: it creates demo cats and `changeme` accounts.
7. **Move to `app.7cornerscats.com`.** Follow [`external-services.md`](external-services.md#the-apps-address-app7cornerscatscom) to add the domain in Railway and its two records in GoDaddy. Once Railway shows the green check, change both `BETTER_AUTH_URL` and `FRONTEND_URL` to `https://app.7cornerscats.com`, written out literally. With two domains on the service, `${{RAILWAY_PUBLIC_DOMAIN}}` could still resolve to the railway.app one. Saving them redeploys. From then on, signing in only works on `app.7cornerscats.com`, which is intended. Install the app on phones only after this step: an installed PWA is tied to the address it was installed from.

## Every deploy

Push to `main`. Railway auto-deploys from the connected branch: it builds, migrates, runs the health check, sends SIGTERM to the old container, and switches traffic over. Deploys only need checking in the dashboard when one fails: build logs for the Dockerfile stages, deploy logs for the pre-deploy migration and the app's own output.

Migrations run before the new code takes traffic while the old version is still serving, so keep them backward compatible (add a column, deploy, then drop the old one in a later deploy).

## Guards and gotchas

- **Photos must not land on the container disk.** It's wiped on every deploy, so `createStorage` refuses to start in production unless all four `S3_*` vars are set (or `UPLOADS_DIR` points at a mounted Railway volume). The startup log line `[storage] using S3-compatible bucket …` confirms the bucket.
- **CSP.** `helmet` sends a Content-Security-Policy allowing only same-origin scripts, plus images from the `S3_ENDPOINT` host (signed thumbnail URLs), `blob:`/`data:` images, and Sentry's `*.sentry.io` ingest. If the frontend starts loading something from a new origin, add it in `contentSecurityPolicyDirectives`, or the browser will block it (check the console for "Refused to …").
- **Rate limiting** (Express's sign-in limiter and Better Auth's own limiter) keys on `CLIENT_IP_HEADER`. Without it, every visitor would share Railway's proxy IP and one person's typos could lock everyone out of sign-in.
- **`PUBLIC_*` vars are build-time.** Changing `PUBLIC_SENTRY_DSN` needs a redeploy, not a restart. The Dockerfile pins `PUBLIC_API_URL` to blank, so the browser always calls its own origin.
- **Bun version** is pinned by `BUN_VERSION` in the `Dockerfile`; bump it alongside your local Bun.

## Rehearsing locally (no Docker needed)

```bash
cd frontend && PUBLIC_API_URL= bun run build && cd ../backend
NODE_ENV=production FRONTEND_DIST_DIR=../frontend/dist PORT=4100 \
  FRONTEND_URL=http://localhost:4100 BETTER_AUTH_URL=http://localhost:4100 \
  UPLOADS_DIR=./uploads bun run start
```

Then open `http://localhost:4100`. Bun also loads `backend/.env`, so this uses your dev database. With Docker installed, `docker build -t lostdog . && docker run --env-file backend/.env -e PORT=4000 -p 4000:4000 lostdog` exercises the real image. In that case, point `DATABASE_URL` at `host.docker.internal` instead of `localhost`.

## Still to do (Phase 9)

- Verify Railway Postgres backups: enable them on the database service, then do a test restore into a scratch database.
- Smoke-test the full user flows against production, including photo upload to the production R2 bucket and a real notification email.
