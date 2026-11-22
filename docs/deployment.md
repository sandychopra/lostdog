# Deploying to Railway

Production runs as **one Railway service** built from the root `Dockerfile`, plus Railway's managed **Postgres**. The Express backend serves the built frontend from the same origin as `/api`, so session cookies are first-party and CORS never comes into play. It works on Railway's default `*.up.railway.app` URL and on a custom domain alike. Photos go to **Cloudflare R2**, email to **SendGrid**, and errors to **Sentry**, all configured by env vars.

## What's in the repo

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage: full install → `prisma generate` + `vite build` (with `PUBLIC_API_URL` blank = same origin) → slim runtime with production deps only, running as the non-root `bun` user. |
| `.dockerignore` | Keeps local `.env` files out of the image. Otherwise Vite would inline `frontend/.env`'s localhost values into the bundle. |
| `Dockerfile` `CMD` | Runs `prisma migrate deploy` and then starts the server, so every deploy applies its own migrations before it takes traffic. A failed migration exits the container, the health check never passes, and the previous deploy keeps serving. There's no `railway.json`: Railway deprecated that "Config as Code" file, and services created after 2026-08-28 can't use it. The only Railway-side settings are the dashboard ones in step 4b. |
| `backend/src/lib/frontendHosting.ts` | Serves `FRONTEND_DIST_DIR` (set by the Dockerfile) with an SPA fallback, `immutable` caching for fingerprinted `assets/`, `no-cache` for `index.html`/`sw.js`/manifest so installed PWAs pick up deploys, and the Content-Security-Policy. |
| `backend/src/scripts/createAdmin.ts` | `bun run create-admin`: bootstraps the first Admin on an empty database. |

## One-time setup

1. **Create the project.** In Railway: *New Project → Deploy from GitHub repo →* this repo. Railway first needs its GitHub App installed with access to the repo; see [`external-services.md`](external-services.md#railway-production-hosting) (and don't confuse it with the "Deploy to Railway" GitHub Action). Railway finds the root `Dockerfile` and builds it. The first deploy will fail until the variables below are set; that's expected.
2. **Add Postgres.** *+ Create → Database → PostgreSQL* in the same project.
3. **Generate a domain.** On the app service: *Settings → Networking → Generate Domain*. A box asks for the port the app listens on; the button stays greyed out until it has a value. Enter **`8080`**, the `PORT` Railway injects (the deploy log shows `Backend listening on http://localhost:8080`). That gives the `*.up.railway.app` URL (ours: `lostdog-production.up.railway.app`) for getting the first deploy working. The real address, `app.7cornerscats.com`, comes in step 7.

   **Do this before the first deploy.** Until the service has a domain, `${{RAILWAY_PUBLIC_DOMAIN}}` in step 4 is empty, so `BETTER_AUTH_URL` comes out as just `https://` and Better Auth throws `Invalid base URL: https://` on every request. Railway's log only shows a bare "promise rejected" header for this; the full error is in Sentry.
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
   **4b. Deploy settings** (app service → *Settings → Deploy*), set by hand because they can't live in the repo any more:
   - **Healthcheck Path:** `/api/health`. Without it, Railway sends traffic as soon as the container starts, even if migrations or startup failed.
   - **Restart Policy:** On Failure
   - **Pre-deploy Command:** leave **empty**. The container runs migrations itself; a pre-deploy command would only run them twice.
5. **Deploy.** The build runs, then the container applies migrations (`All migrations have been successfully applied.` in the deploy log) and starts, then the health check gates the switch-over.
6. **Create the first Admin.** Install the [Railway CLI](https://docs.railway.com/guides/cli) (`brew install railway`), then `railway login` and `railway link` (pick the project and the app service), and open a shell inside the running container:

   ```bash
   railway ssh
   bun run create-admin --email you@example.org --name "Your Name"
   ```

   It prints a one-time random password (or uses `ADMIN_PASSWORD` if set). Sign in, change the password from the Users page, and add everyone else there. The script refuses to run once an active Admin exists. Never run `bun run seed` against production: it creates demo cats and `changeme` accounts.
7. **Move to `app.7cornerscats.com`.** Follow [`external-services.md`](external-services.md#the-apps-address-app7cornerscatscom) to add the domain in Railway and its two records in GoDaddy. Once Railway shows the green check, change both `BETTER_AUTH_URL` and `FRONTEND_URL` to `https://app.7cornerscats.com`, written out literally. `${{RAILWAY_PUBLIC_DOMAIN}}` keeps resolving to the railway.app domain even after a custom domain is added, so leaving the reference in place makes sign-in on `app.7cornerscats.com` fail with `403 Invalid origin`, while the railway.app address still works. Saving them redeploys. From then on, signing in only works on `app.7cornerscats.com`, which is intended. Install the app on phones only after this step: an installed PWA is tied to the address it was installed from.

## Every deploy

Push to `main`. Railway auto-deploys from the connected branch: it builds, starts the new container (which migrates, then listens), runs the health check, switches traffic over, and sends SIGTERM to the old container. Deploys only need checking in the dashboard when one fails: build logs for the Dockerfile stages, deploy logs for the migration output and the app's own startup.

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

## Troubleshooting a deploy

| Symptom | Cause / fix |
|---|---|
| Deploy log: `NODE_ENV=production needs all four S3_* vars` | An `S3_*` variable is missing, misnamed, on the wrong service, or not yet deployed (click **Deploy** on Railway's staged-changes banner after editing variables) |
| Deploy log: `table public.… does not exist` | Migrations didn't run. The `Dockerfile` `CMD` runs them; check the deploy log starts with `prisma migrate deploy`. (Railway ignores `railway.json` for new services, which is what caused this on the first deploy.) |
| Deploy log ends with `The promise rejected with the reason:` and nothing after | Railway drops the reason. Look it up in Sentry: `sentry issue list foglight-innovations/lostdog-server --period 1h`, then `sentry issue view <ID>` |
| `healthcheck failed … connection refused`, followed by `healthcheck succeeded` | Normal: Railway probes before migrations and startup finish |
| Sign-in fails with `403 Invalid origin` | The browser's address isn't `FRONTEND_URL`. Set it (and `BETTER_AUTH_URL`) to the address people use, written out literally, and deploy |
| **Generate Domain** button greyed out | Enter the port (`8080`) in the box first. Otherwise: a TCP proxy on the service, a limited trial account (verify at railway.com/verify), or a workspace policy |

To check the live site from a terminal: `curl -s https://app.7cornerscats.com/api/health` should print `{"status":"ok","database":"connected"}`. A sign-in probe with a made-up email should return `401 Invalid email or password` (not `403 Invalid origin`): `curl -s -H "Origin: https://app.7cornerscats.com" -H "Content-Type: application/json" -d '{"email":"nobody@example.invalid","password":"x-not-real"}' https://app.7cornerscats.com/api/auth/sign-in/email`.

## Still to do (Phase 9)

- Verify Railway Postgres backups: enable them on the database service, then do a test restore into a scratch database.
- Smoke-test the full user flows on `app.7cornerscats.com`: add a volunteer, submit a shift report with a photo (original plus `.thumb.jpg` in the R2 bucket), and check the notification email arrives with `app.7cornerscats.com` links.
- At launch: switch `NOTIFICATION_TO` to the Google Group, then have volunteers install the app from `app.7cornerscats.com`.
