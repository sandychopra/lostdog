# External Services & Tools

Setup, configuration, and troubleshooting for the third-party services this app depends on: the `7cornerscats.com` domain (GoDaddy), Cloudflare R2 (photo storage), SendGrid (email), Sentry (error monitoring), Railway (production hosting), ngrok (testing from a phone), and Better Auth (sign-in and sessions). R2, SendGrid, Sentry, and ngrok are optional in local development. With their settings blank, the app falls back to local disk, logs emails to the console, reports errors only to the log, and runs only on `localhost`. Tools installed on your own Mac (VS Code, Claude Code, DataGrip) are in [`dev-machine-setup.md`](dev-machine-setup.md). For everyday commands, see [`cheat-sheet.md`](cheat-sheet.md). For the full list of env vars, see [`post-pull-checklist.md`](post-pull-checklist.md).

| Service | Used for | Needed in dev? | Settings (`backend/.env` unless noted) |
|---|---|---|---|
| [Domain & DNS](#domain--dns-7cornerscatscom-on-godaddy) | `7cornerscats.com`: email sender now, app address later | No — only for real email and production | DNS records at GoDaddy (no `.env` settings) |
| [Cloudflare R2](#cloudflare-r2-photo-storage) | Photo storage | No — local disk by default | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (optional) |
| [SendGrid](#sendgrid-email-notifications) | Notification emails | No — printed to the log by default | `SENDGRID_API_KEY`, `EMAIL_FROM`, `NOTIFICATION_TO` |
| [Sentry](#sentry-error-monitoring) | Errors, traces, logs, and Session Replay from the backend and the browser | No — off when the DSNs are blank | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`; `PUBLIC_SENTRY_DSN`, `PUBLIC_SENTRY_ENVIRONMENT`, `PUBLIC_SENTRY_RELEASE`, and `SENTRY_AUTH_TOKEN` (build only) in `frontend/.env` |
| [Railway](#railway-production-hosting) | Hosting the production app and its Postgres | No — production only | Set in the Railway dashboard, not in `.env` files (see [`deployment.md`](deployment.md#one-time-setup)) |
| [ngrok](#ngrok-phone--remote-testing) | Using the dev app from another device | No — only for phone testing | `TUNNEL_URL`, plus `PUBLIC_API_URL` and `TUNNEL_HOST` in `frontend/.env` |
| [Better Auth](#better-auth-sign-in--sessions) | Sign-in, sessions, roles | Yes — always on (a library, no account) | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_URL` |

## Domain & DNS (`7cornerscats.com` on GoDaddy)

The app's domain is **`7cornerscats.com`**, registered at **GoDaddy**, which also hosts its DNS (nameservers `ns19`/`ns20.domaincontrol.com`). Today it's used only to send email through SendGrid. Once deployed (Phase 9), it will also be the app's address. DNS changes are made in GoDaddy: **My Products → Domains → `7cornerscats.com` → DNS**.

> **Other developers:** the GoDaddy account is Sandy's. Ask before changing any record, since a wrong DNS edit can stop email for everyone.

### Allowing SendGrid to send as `@7cornerscats.com`

A mail server only accepts email "from" a domain if that domain's DNS says the sender is allowed. Otherwise the email lands in spam or is rejected. SendGrid gets that permission through **Domain Authentication** (SendGrid → Settings → Sender Authentication → Authenticate Your Domain):

- **Choose GoDaddy as the DNS host.** SendGrid can then add the records for you: you sign in to GoDaddy and **approve** SendGrid's request to change the domain's DNS. Or add the records by hand in GoDaddy's DNS page.
- **The records it adds** (all `CNAME`, pointing at `sendgrid.net`):
  - `em<NNNN>` — return path / SPF: lets SendGrid handle bounces and passes SPF for the domain
  - `s1._domainkey` and `s2._domainkey` — DKIM signing keys. SendGrid signs each email as `7cornerscats.com`, and receiving servers check the signature against these.
  - The exact names and targets are listed in SendGrid under Sender Authentication. Live now: `s1`/`s2._domainkey` → `s1`/`s2.domainkey.u117331245.wl246.sendgrid.net`.
- **Click Verify in SendGrid.** DNS changes at GoDaddy usually show up within minutes but can take up to 48h.
- **Don't delete or edit these records.** If DNS ever moves away from GoDaddy (e.g. to Cloudflare), copy them across first. Without them, email stops arriving in inboxes.

### What else is in DNS

- **DMARC** (`TXT` at `_dmarc`): `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;`
  - This is GoDaddy's default. It tells receivers to send email that fails authentication to spam.
  - SendGrid's DKIM signature matches the domain, so the app's emails pass.
  - Reports go to a GoDaddy address; change `rua` to your own address to see them.
- **No SPF record** at the root (`TXT v=spf1 …`). That's fine for SendGrid, since its SPF check runs on the `em<NNNN>` return-path domain. If anything else ever sends as `@7cornerscats.com` (e.g. Google Workspace or GoDaddy email), add a **single** SPF record covering all senders. Two SPF records break SPF.
- **No MX records** (as of Nov 2026): the domain can't **receive** email. Replies to `team@7cornerscats.com` bounce. See [Receiving email](#receiving-email-at-7cornerscatscom-mx-records) below to fix that.

### Receiving email at `@7cornerscats.com` (MX records)

**MX** ("mail exchanger") records tell the rest of the internet which server accepts email *for* a domain. They only affect **receiving**: SendGrid keeps sending the app's notifications whether or not MX records exist. Without them, anyone who replies to a notification, or emails `team@7cornerscats.com`, gets a bounce.

You don't pick MX values yourself. They come from whichever service will receive the mail, so the first step is choosing one:

| Option | Cost | Best if… | MX records to add (Name `@`) |
|---|---|---|---|
| **[ImprovMX](https://improvmx.com)** forwarding (recommended to start) | Free tier | You just want `team@7cornerscats.com` to land in an existing inbox (a personal Gmail, or the org's Google Group) | `mx1.improvmx.com` priority **10**, `mx2.improvmx.com` priority **20** |
| **Google Workspace** | Paid; free for eligible nonprofits via [Google for Nonprofits](https://www.google.com/nonprofits/) | The org wants real `@7cornerscats.com` mailboxes with Gmail | `smtp.google.com` priority **1** (one record) |
| **GoDaddy email** (Microsoft 365 from GoDaddy) | Paid | You'd rather keep everything in GoDaddy | Added automatically by GoDaddy when you buy it |

Always copy the exact values from the provider's own setup page at the time you do it; the ones above are current as of Nov 2026.

#### Adding the records in GoDaddy (step by step)

1. Sign up with the chosen provider and add `7cornerscats.com` as a domain there. For ImprovMX, enter the domain, set the inbox to forward to, then create the alias `team` → that inbox. The provider's dashboard then shows the records it expects.
2. Sign in at [godaddy.com](https://www.godaddy.com) → your name (top right) → **My Products** → **Domains** → `7cornerscats.com` → **DNS** (also labeled **Manage DNS**).
3. Look through the record list for existing `MX` rows. As of Nov 2026 there are none. If any exist, delete them (trash icon) unless you know they're in use, because records from two providers would split your mail.
4. Click **Add New Record** and fill it in:
   - **Type:** `MX` (it defaults to `A`, so check this)
   - **Name:** `@`, meaning the domain itself. Don't type `7cornerscats.com`.
   - **Value** (also called **Points to**): the server from the table, e.g. `mx1.improvmx.com`
   - **Priority:** the number from the table. When there are several records, the lower number is tried first.
   - **TTL:** leave the default (1 hour)
5. Click **Save**, then repeat step 4 for each additional MX record (e.g. `mx2.improvmx.com` at priority 20).
6. Add the provider's **SPF** record if it asks for one, e.g. ImprovMX's `TXT` with Name `@` and Value `v=spf1 include:spf.improvmx.com ~all`. There must be only **one** `v=spf1` TXT record at `@`. If a second provider later needs SPF too, merge both into one record (`v=spf1 include:a include:b ~all`) rather than adding another. This doesn't affect SendGrid, which passes SPF through its own `em<NNNN>` record.
7. **Don't touch** the SendGrid `CNAME`s (`em<NNNN>`, `s1`/`s2._domainkey`) or `_dmarc` while you're in there.
8. Wait: usually minutes, up to 48 hours. Then click **Verify** (or the equivalent) in the provider's dashboard.

#### Checking it works

- `dig +short MX 7cornerscats.com` — should list exactly the new servers, e.g. `10 mx1.improvmx.com.` and `20 mx2.improvmx.com.`
- From a *different* address (not the inbox it forwards to), send a test email to `team@7cornerscats.com` and confirm it arrives. Gmail sometimes hides a message you sent to yourself.
- Reply to an app notification email and check where the reply lands
- **It bounces with "domain not found" or "no MX":** DNS hasn't updated yet, or the record was saved as the wrong type (an `A` or `TXT` instead of `MX`).
- **It arrives in spam:** check the forwarding provider's SPF record from step 6 is in place.

### The app's address: `app.7cornerscats.com`

The app lives on the **`app.`** subdomain, not the bare `7cornerscats.com`. Railway connects a custom domain with a `CNAME` record, and DNS doesn't allow a `CNAME` on the bare domain unless the DNS host supports "CNAME flattening" or `ALIAS` records. GoDaddy doesn't. The workaround would be moving the domain's DNS to Cloudflare, but a subdomain avoids that and leaves the email records alone.

1. **Railway:** app service → **Settings → Networking → + Custom Domain** → `app.7cornerscats.com`. If it asks for a port, use `8080` (the `PORT` Railway gives the container). Railway then shows **two** records to add:
   - a `CNAME`: `app` → `<something>.up.railway.app`
   - a `TXT` that proves you own the domain. Both are required: without the `TXT`, the domain returns `404` even once the `CNAME` works.
2. **GoDaddy:** **My Products → Domains → `7cornerscats.com` → DNS → Add New Record**, once for each (TTL: leave GoDaddy's default of 1 hour; it only matters when a record is later changed):
   - **Type** `CNAME`, **Name** `app`, **Value** as Railway shows it
   - **Type** `TXT`, **Name** and **Value** exactly as Railway shows them. GoDaddy adds `.7cornerscats.com` to the Name itself, so leave that part off (the same trap as the SendGrid records below).
   - Leave the SendGrid `CNAME`s and `_dmarc` alone
3. **Wait** for Railway's green check next to the domain. It usually takes minutes, but DNS can take up to 72 hours. Railway then issues the HTTPS certificate on its own.
4. **Switch the app's URL settings** to `https://app.7cornerscats.com` (`BETTER_AUTH_URL` and `FRONTEND_URL`). That's step 7 in [`deployment.md`](deployment.md#one-time-setup). Links in notification emails use `FRONTEND_URL`. `PUBLIC_API_URL` stays blank, since the backend serves the frontend from the same origin.
5. **Optional, the bare domain:** GoDaddy **Domain → Forwarding** can send `7cornerscats.com` to `https://app.7cornerscats.com` (permanent 301). GoDaddy's forwarding is reliable for `http://` but may not work for `https://7cornerscats.com`, so share the `app.` link itself.

R2 doesn't need a domain: photo links are signed `*.r2.cloudflarestorage.com` URLs.

### Checking & troubleshooting

- `dig +short CNAME s1._domainkey.7cornerscats.com` — should print a `sendgrid.net` target (same for `s2`)
- `dig +short TXT _dmarc.7cornerscats.com` / `dig +short MX 7cornerscats.com` / `dig +short NS 7cornerscats.com`
- `dig +short CNAME app.7cornerscats.com` — should print the `*.up.railway.app` target Railway gave you. `curl -s https://app.7cornerscats.com/api/health` should print `{"status":"ok","database":"connected"}`.
- GoDaddy adds the domain to the **Name** field for you. Enter `s1._domainkey`, not `s1._domainkey.7cornerscats.com`, or the record ends up at `s1._domainkey.7cornerscats.com.7cornerscats.com` and SendGrid's Verify fails.
- To see whether an email passed: in Gmail, open it → ⋮ → **Show original**. `SPF`, `DKIM`, and `DMARC` should all say `PASS`.

## Cloudflare R2 (photo storage)

Stores uploaded photos and their thumbnails in a bucket. R2 is S3-compatible, and the app talks to it with the standard AWS S3 SDK, so any S3-compatible store works with the same settings. It was chosen over AWS S3 because downloads are free (see [`tech-stack.md`](tech-stack.md)). With the `S3_*` settings blank, photos are saved to `UPLOADS_DIR` (default `backend/uploads`), which is fine for most dev work. Nothing touches a bucket under `bun test`.

> **Other developers:** the Cloudflare account and `lostdog-photos-dev` bucket below are Sandy's personal setup, and the token can't be shared. Either leave the `S3_*` settings blank (local disk) or create your own free Cloudflare account, dev bucket, and token (steps below). Never point dev at the production bucket. Uploading or deleting reports in dev would change real photos.

### How it works

- Each upload stores the original (the JPEG made on the device, max 2560px) plus a ~480px thumbnail at `<key>.thumb.jpg`, both under `shift-reports/<reportId>/`
- Photo grids load the thumbnail straight from the bucket through a signed link that expires after 15 minutes (`GET /api/photos/:id/url`). Image data doesn't pass through the backend. The bucket stays private.
- Admin downloads (single photo and zip) still go through the backend, so files keep their descriptive names
- Deleting a report queues its files for deletion (the `pending_storage_delete` table). The backend deletes them right away and retries failures every 5 minutes, up to 10 attempts.

### Setting up (one-time)

- Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free). R2 asks for a payment method before you can use it, but the free tier (10 GB of storage plus a monthly allowance of operations, no download fees) covers this app.
- R2 → **Create bucket**:
  - `lostdog-photos` for production, plus `lostdog-photos-dev` for local testing
  - Leave **Public access** off
  - No CORS policy is needed: images load as plain `<img>` tags, which don't use CORS
- R2 → **Manage API tokens** → Create API token:
  - Permission: **Object Read & Write**
  - Scope: **Apply to specific buckets only**, picking just the bucket this token is for (one token per bucket/environment)
  - The **Access Key ID** and **Secret Access Key** are shown once, so copy them straight into `backend/.env`
- Note your **Account ID**, shown on the R2 overview page. It goes in the endpoint URL.

### `backend/.env`

- `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `S3_BUCKET=lostdog-photos-dev` — the dev bucket locally; `lostdog-photos` only in production
- `S3_ACCESS_KEY_ID=` / `S3_SECRET_ACCESS_KEY=` — from the API token
- `S3_REGION=` — leave blank (defaults to `auto`, which R2 expects)
- All four of the first settings must be set. If any is blank, the app quietly falls back to local disk.
- Restart after changing them: `bun run dev:restart` (storage is set up once at startup)

### Testing & troubleshooting

- `grep "\[storage\]" backend.log` — shows `using S3-compatible bucket "…"` or `using local disk at …`
- Upload a photo, then check the R2 dashboard for the bucket: you should see two objects under `shift-reports/<id>/`, the original and its `.thumb.jpg`
- In the browser's network panel, grid images should load from `<ACCOUNT_ID>.r2.cloudflarestorage.com`, not from `/api/photos/…/file`
- Photos from local disk don't move to R2 automatically. Switching storage leaves older photos showing as broken images; copy them with `rclone` or start from a fresh database.
- From `backend/`:
  - `bun run backfill-thumbnails` — makes thumbnails for photos uploaded before thumbnails existed. Safe to re-run; photos it can't decode keep showing the original.
  - `bun run storage:reconcile` — lists files in the bucket that no photo points to (skipping anything less than 24h old). Add `--apply` to delete them.
- `403 SignatureDoesNotMatch` / `InvalidAccessKeyId` — wrong key pair, or a token scoped to a different bucket
- Images go blank after a tab sits open for a long time — the signed links expired. The app re-signs once on error; a page refresh fixes anything left over.
- R2 has no object versioning, so a deleted file is gone for good. For backups, use a scheduled `rclone sync` to a second bucket or provider (deferred for now; see the Phase 9 next steps in [`implementation-plan.md`](implementation-plan.md)).

### How it was set up on this machine (Sandy, Nov 2026)

1. Created a personal Cloudflare account and enabled R2, which meant adding a payment method. Usage stays within the free tier.
2. Created the bucket `lostdog-photos-dev`, with public access left off and no CORS policy. (Production bucket: see step 8.)
3. Created an R2 API token with **Object Read & Write**, limited to `lostdog-photos-dev`, and put the Account ID (in `S3_ENDPOINT`), Access Key ID, and Secret Access Key into `backend/.env`
4. First restart: every request would have failed with a signature error, because the `.env` line read `S3_SECRET_ACCESS_KEY==…`. The extra `=` became part of the key, making it 65 characters instead of 64. Fixed by removing it. If R2 rejects requests, check that the secret is exactly 64 hex characters.
5. `bun run dev:restart` — `backend.log` shows `[storage] using S3-compatible bucket "lostdog-photos-dev"`
6. Verified end to end:
   - Upload stores the original plus a 480px thumbnail
   - Grid images load from `*.r2.cloudflarestorage.com` through signed URLs; the same URL unsigned is denied
   - Admin single and zip downloads work
   - Deleting a report or a single photo removes its objects
   - A failed photo insert leaves no objects behind
   - `storage:reconcile` reports 0 orphans
7. Photos uploaded before the switch are still in `backend/uploads` on local disk, so they show as broken images while R2 is on. They weren't copied over; it's dev data. Clearing the four `S3_*` lines in `backend/.env` and restarting switches back to local disk.
8. Production (Nov 22, 2026): created the bucket `lostdog-photos` (public access off, no CORS) and an **Account API token** `lostdog-prod` with **Object Read & Write** limited to that bucket, TTL Forever, no IP filter (Railway's outgoing IPs aren't fixed). R2's token page is under **R2 → Overview → Account Details → API Tokens → Manage**, not **My Profile → API Tokens** (that's Cloudflare's general API, which doesn't issue S3 keys); of the values it shows, the **Token value** isn't used. The Access Key ID, Secret Access Key, and default endpoint went straight into Railway's variables. The Railway deploy log confirmed `[storage] using S3-compatible bucket "lostdog-photos"`.

## ngrok (phone & remote testing)

Exposes the local frontend (`localhost:3000`) at a public HTTPS address so you can try the app from a phone or another computer. This machine's free ngrok domain is fixed: **https://gratify-polyester-talon.ngrok-free.dev**.

> **Other developers:** that address belongs to Sandy's ngrok account. Each developer who wants a tunnel needs their own free ngrok account (steps below), which comes with its own fixed domain — use that wherever this section shows `gratify-polyester-talon.ngrok-free.dev`, including in your own `.env` files. Sharing one free account isn't practical: it has a single domain that only one person can tunnel through at a time, and shared monthly quotas. Only needed for testing from another device — everyday work on `localhost:3000` doesn't use ngrok.

### Installing (one-time)

- Install Homebrew first if you don't have it — the install command is on [brew.sh](https://brew.sh)
- `brew install ngrok` — install the ngrok CLI
- Sign up at [ngrok.com](https://ngrok.com) (free), then copy your authtoken from the dashboard and run `ngrok config add-authtoken <token>` — links the CLI to your account, which is what gives you the fixed domain above
- `ngrok version` — confirm it's installed

### One-time setup (`.env` files)

- `frontend/.env`: `PUBLIC_API_URL=` (blank) — the app then calls the API through the frontend's own address instead of `localhost:4000`
- `frontend/.env`: `TUNNEL_HOST=gratify-polyester-talon.ngrok-free.dev` — no `https://`; lets the dev server accept requests for that hostname
- `backend/.env`: `TUNNEL_URL=https://gratify-polyester-talon.ngrok-free.dev` — lets you sign in through the tunnel
- Restart after changing any of them: `bun run dev:restart`

### Starting & stopping

- `bun run dev:restart --ngrok` — restart both dev servers and start the tunnel; prints the public URL
- `bun run dev:restart` — restart the servers only; leaves a running tunnel alone
- `bun run dev:stop` — stop both servers and the tunnel
- `pkill ngrok` — stop just ngrok (`pkill -9 ngrok` if it won't quit)
- `pgrep -fl ngrok` — check whether it's running (no output = stopped)
- `tail -f ngrok.log` — ngrok's log when started by the script

### Using it

- Use **https://gratify-polyester-talon.ngrok-free.dev** wherever you'd use `http://localhost:3000` (e.g. `…/login` instead of `localhost:3000/login`)
- Health check: open **https://gratify-polyester-talon.ngrok-free.dev/api/health** — expect `{"status":"ok","database":"connected"}`
- From the terminal: `curl -H "ngrok-skip-browser-warning: 1" https://gratify-polyester-talon.ngrok-free.dev/api/health`
- It's `https://`, not `http://` — ngrok serves the tunnel over HTTPS
- `http://localhost:3000` keeps working at the same time

### Gotchas

- First visit in a browser shows an ngrok warning page — click **Visit Site** (once per browser)
- "The endpoint … is offline" (`ERR_NGROK_3200`) — ngrok isn't running; start it with `bun run dev:restart --ngrok`
- "Can't reach server" on login — usually `PUBLIC_API_URL` isn't blank, or the frontend wasn't restarted after changing it; a hard refresh (`Cmd+Shift+R`) also clears the old cached app
- Links in notification emails still point at `FRONTEND_URL` (`http://localhost:3000`), so they only open on this Mac
- `kill $(lsof -t -i :3000)` also kills ngrok — use `kill $(lsof -t -iTCP:3000 -sTCP:LISTEN)` (only the listening server) or `bun run dev:stop`

### How it was set up on this machine (Sandy, Oct 2026)

1. Installed Homebrew (7.0.11) using the install command from [brew.sh](https://brew.sh)
2. `brew install ngrok` — installs ngrok 3.39.13 to `/opt/homebrew/bin/ngrok` (Homebrew installs it as a cask)
3. Created a free account at [ngrok.com](https://ngrok.com), then `ngrok config add-authtoken <token>` — saved to `~/Library/Application Support/ngrok/ngrok.yml`; the account's domain is `gratify-polyester-talon.ngrok-free.dev`
4. Ran `ngrok http 3000` and opened the tunnel URL — the page loaded, but login failed with "can't reach server" because the app was still calling the API at `localhost:4000`
5. Made the app work through the tunnel (code changes, now shared in the repo): the frontend dev server forwards `/api` to the backend, a blank `PUBLIC_API_URL` means "use the page's own address", and the backend accepts sign-ins from `TUNNEL_URL`
6. Set the three `.env` values from "One-time setup" above and restarted both servers — login then worked through the tunnel
7. Added `scripts/dev-servers.sh` (`bun run dev:restart --ngrok` / `dev:stop`) so the tunnel starts and stops with the dev servers

## SendGrid (email notifications)

The app emails every submitted shift report and these announcements — new arrival, pending adoption, adopted, back available, returned to RCC, kennel move requested, kennel needs reset, and manual posts — all to one address, `NOTIFICATION_TO`. With the email settings blank, emails are printed to the backend log instead of sent, which is fine for most dev work. Nothing is ever sent under `bun test`.

> **Other developers:** the SendGrid account and `team@7cornerscats.com` sender below are Sandy's personal setup. To get real emails, create your own free SendGrid account and verified sender (steps below) — or leave the settings blank. Outside production, always point `NOTIFICATION_TO` at your own address, never the org's Google Group.

### Setting up (one-time)

- Sign up at [sendgrid.com](https://sendgrid.com)
- Settings → Sender Authentication → **Domain Authentication** — adds DNS records that authorize SendGrid to send for the domain. Best for landing in the inbox, but needs access to the domain's DNS (for `7cornerscats.com`, GoDaddy; see [Domain & DNS](#domain--dns-7cornerscatscom-on-godaddy)).
- Settings → Sender Authentication → **Single Sender Verification** — verify one from-address by clicking a link emailed to it; quickest option
- Settings → API Keys → Create API Key → **Restricted Access** with only **Mail Send** turned on — the key is shown once, so copy it straight into `backend/.env`

### `backend/.env`

- `SENDGRID_API_KEY=SG.…` — the API key
- `EMAIL_FROM=` — a verified sender address (or any address on an authenticated domain)
- `NOTIFICATION_TO=` — where every notification goes; your own address in dev
- All three must be set — if any is blank, the app quietly falls back to printing emails to the log
- Restart after changing them: `bun run dev:restart` (the mailer is set up once at startup)

### Testing & troubleshooting

- **Submit** a shift report (saving a draft doesn't email) — the email goes out within seconds
- `tail -f backend.log` — watch for `[mailer] (not sent — console mailer)` (settings not loaded) or `[notifications] failed to send` (SendGrid rejected it)
- A failed send is saved on the report/announcement (`emailLastError`, `emailAttempts`) and retried every 5 minutes, up to 5 attempts
- Turning email on sends **every** submitted report and announcement that was never emailed — on a database with lots of old test data, that can be a burst of emails
- Links inside the emails use `FRONTEND_URL` (`http://localhost:3000` in dev), so they only open on this Mac

### How it was set up on this machine (Sandy, Oct 2026)

1. Created a personal SendGrid account
2. Authenticated the `7cornerscats.com` domain (Domain Authentication), choosing GoDaddy as the DNS host and approving SendGrid's permission to add its records there. All DNS records validate; see [Domain & DNS](#domain--dns-7cornerscatscom-on-godaddy) for what was added.
3. Verified the single sender `team@7cornerscats.com`, display name "Cat Team"
4. Created an API key — currently a full-access key; better to replace it with a **Mail Send**–only key (create it, paste it into `backend/.env`, `bun run dev:restart`, then delete the old key in SendGrid)
5. Set `backend/.env`: the API key, `EMAIL_FROM=team@7cornerscats.com`, `NOTIFICATION_TO=sandy.chopra@gmail.com`
6. Restarted the backend and submitted a shift report — the email arrived in the Gmail inbox (not spam)

## Sentry (error monitoring)

Collects errors, performance traces, and logs from the backend and the browser, plus Session Replay (a video-like recording of what the user did) for frontend sessions. Each error is linked to the request, route, and line that caused it. There are two Sentry projects, one per side: **`lostdog-server`** (Bun SDK) and **`lostdog-frontend`** (React SDK), in the `foglight-innovations` organization. With the DSNs blank, Sentry never starts and errors only go to the log. Nothing is reported under `bun test`.

> **Other developers:** the `foglight-innovations` organization is Sandy's. Either leave the Sentry settings blank, or ask Sandy for the two DSNs so your local errors show up in the shared projects (they'll be tagged `development`). DSNs only allow *sending* events, so they're safe to share. Auth tokens can read and change the account: make your own (steps below) and never share or commit one.

### How it works

- **Backend:** `backend/src/instrument.ts` calls `Sentry.init`. The `dev` and `start` scripts load it with `bun --preload ./src/instrument.ts` so it runs before any other module. `Sentry.setupExpressErrorHandler(app)` in `index.ts` reports unhandled route errors, then hands them to the existing last-resort handler, which still never sends stack traces to the client.
- **Frontend:** `frontend/src/instrument.ts` is the first import in `frontend.tsx`. It sets up:
  - Tracing named after the matched route (e.g. `/cats/:id`), via `withSentryReactRouterV7Routing` wrapping `<Routes>` in `App.tsx`
  - Session Replay for 10% of sessions, and for 100% of sessions that hit an error
  - React 19's `createRoot` error hooks (`onUncaughtError`, `onCaughtError`, `onRecoverableError`)
  - Trace headers on API requests (`tracePropagationTargets: [API_BASE]`), so a frontend action and the backend request it caused show up as one trace
- **Sampling:** every trace locally, 10% in production (`NODE_ENV=production` on the backend, a production `vite build` on the frontend). Logs are sent by default in SDK v11 (there's no `enableLogs` option).
- **Environment** defaults to `development`/`production` (backend, from `NODE_ENV`) and Vite's mode (frontend); the `*_ENVIRONMENT` settings override it.
- **Source maps:** production frontend code is minified, so without source maps a browser stack trace is unreadable. When `SENTRY_AUTH_TOKEN` is set at build time, `@sentry/bundler-plugins/vite` (last in `vite.config.ts`'s plugins) builds hidden source maps, uploads them to `lostdog-frontend`, and deletes the `.map` files from `dist/` so they never ship. The service worker's own maps are turned off (`workbox.sourcemap: false`), because it's written after that cleanup runs. Without the token the build emits no source maps at all. The backend needs none: Bun runs the TypeScript directly, so its stack traces already point at real `src/` lines.

### Setting up (one-time)

- Sign up at [sentry.io](https://sentry.io) and create an organization (the free Developer plan covers this app)
- Create two projects: one with platform **Bun** (`lostdog-server`), one with **React** (`lostdog-frontend`). Each project's DSN is under **Settings → Projects → [project] → Client Keys (DSN)**.
- For source map uploads, create a token at **Settings → Developer Settings → Organization Tokens → Create New Token** (for this org: [foglight-innovations.sentry.io/settings/auth-tokens](https://foglight-innovations.sentry.io/settings/auth-tokens/)). It's shown once, so copy it straight into `frontend/.env`. A personal token (**User Settings → Personal Tokens**) also works if it has **Project: Read & Write** and **Release: Admin**.
- Optional: the Sentry CLI (`curl -fsSL https://cli.sentry.dev/install | bash`, then `sentry auth login`) lets you list and view issues from the terminal. The app doesn't need it.

### `backend/.env`

- `SENTRY_DSN=` — the `lostdog-server` DSN. Blank turns backend reporting off.
- `SENTRY_ENVIRONMENT=` — optional override (e.g. `staging`)
- `SENTRY_RELEASE=` — optional; set it at deploy time (e.g. to the git SHA) so issues link to a release
- Restart after changing them: `bun run dev:restart` (Sentry starts once, at startup)

### `frontend/.env`

- `PUBLIC_SENTRY_DSN=` — the `lostdog-frontend` DSN. Built into the browser bundle, which is fine: DSNs are public by design.
- `PUBLIC_SENTRY_ENVIRONMENT=` / `PUBLIC_SENTRY_RELEASE=` — optional, as on the backend. The release also names the source map upload; when blank, the plugin uses the current git commit SHA.
- `SENTRY_AUTH_TOKEN=` — build-time only. It has no `PUBLIC_` prefix, so it never reaches the browser. In production, set it as a build secret on the CI/hosting platform rather than in a file.
- `PUBLIC_*` values are baked in at build time, so restart the dev server (`bun run dev:restart`) or rebuild after changing them

### Testing & troubleshooting

- **Backend:** temporarily add a route that throws, e.g. `app.get("/api/sentry-test-error", () => { throw new Error("Sentry test error " + Date.now()); });` above `setupExpressErrorHandler`, call it, then check the `lostdog-server` Issues page (usually under 30 seconds). Remove the route afterwards.
- **Frontend:** with the app open, run `setTimeout(() => { throw new Error("Sentry frontend test error") })` in the browser console, then check `lostdog-frontend`
- **From the terminal** (Sentry CLI): `sentry issue list foglight-innovations/lostdog-server --period 1h`, then `sentry issue view <SHORT-ID>`. The table cuts long titles off, so add `--json` before grepping for a message.
- **Source maps:** `cd frontend && bun run build` with the token set. The build output should show the Sentry plugin uploading, and `dist/` should have no `.map` files left. Uploads are listed in Sentry under **Settings → Projects → lostdog-frontend → Source Maps**. An uploaded map only affects errors from that build onward.
- **Nothing arrives:** check the DSN is in the right `.env` (server DSN in `backend/.env`, frontend DSN in `frontend/.env`) and that you restarted. A backend started without the `--preload` scripts (e.g. plain `bun src/index.ts`) never calls `Sentry.init`.
- **`[Sentry] No diagnostics-channel injection detected` warning:** harmless for errors. On Bun older than 1.4.6, Sentry can't record automatic Express/Prisma spans, but errors and the spans around `fetch`/HTTP still work. After upgrading Bun to 1.4.6+, adding `--preload @sentry/bun/import` to the scripts turns those spans on.
- **`Discarded session because of missing or non-string release`:** only release-health sessions are dropped while `SENTRY_RELEASE` is blank. Errors still send.

### How it was set up on this machine (Sandy, Nov 2026)

1. Started from Sentry's onboarding "hand off to an agent" flow. Claude Code installed the Sentry CLI (v0.50.0, to `~/.local/bin/sentry`; the installer also added zsh completions to `~/.zshrc` and agent skills to `~/.agents/skills/`) and signed it in with the one-time handoff code.
2. Created the projects `lostdog-server` (Bun) and `lostdog-frontend` (React) in `foglight-innovations`, and put their DSNs in `backend/.env` (`SENTRY_DSN`) and `frontend/.env` (`PUBLIC_SENTRY_DSN`)
3. Installed `@sentry/bun` and `@sentry/react` (both 11.16.0) and `@sentry/bundler-plugins` (frontend dev dependency), and wired them in as described in "How it works" (PR #43)
4. Verified end to end:
   - A temporary backend route that threw reached `lostdog-server` with readable `src/index.ts` frames. The route was then removed.
   - An uncaught error thrown in the running dev frontend reached `lostdog-frontend`
   - The test issues were resolved in Sentry
5. The diagnostics-channel warning showed up because this machine runs Bun 1.4.2. Errors were captured regardless.
6. Created an organization token and added it to `frontend/.env` as `SENTRY_AUTH_TOKEN`, then ran `bun run build` in `frontend/`. The plugin logged `Successfully uploaded source maps to Sentry`, and Sentry lists the bundle for `lostdog-frontend`. With `PUBLIC_SENTRY_RELEASE` blank, the plugin named the release after the current git commit SHA.
   - The first build left `sw.js.map` and `workbox-*.js.map` in `dist/`: the PWA plugin writes the service worker *after* the Sentry plugin has deleted the `.map` files. Fixed by setting `workbox.sourcemap: false` in `vite.config.ts`. Now no `.map` files remain after a build.
7. Still to do in Phase 9: set the DSNs, `NODE_ENV=production`, `SENTRY_RELEASE`/`PUBLIC_SENTRY_RELEASE`, and `SENTRY_AUTH_TOKEN` in the deployed environment and build

## Railway (production hosting)

Runs the production app: one service built from the root `Dockerfile`, where Express serves both `/api` and the built frontend, plus Railway's managed Postgres. Railway handles HTTPS, deploys, and restarts. It builds straight from GitHub: every push to `main` triggers a build, then the new container runs `prisma migrate deploy` before starting, and a health check gates the switch-over. The step-by-step deploy, the full variable list, and the gotchas are in [`deployment.md`](deployment.md). This section covers the account and its access to GitHub.

### How it works

- **Code access** goes through Railway's **GitHub App**, installed on the GitHub account that owns the repo. The app is what lets Railway read the code and receive push events for auto-deploys. If the app loses access, auto-deploy can't be enabled and the repo disappears from Railway's repo picker.
- **Settings** are Railway *service variables* set in the dashboard. Production has no `.env` files: `.dockerignore` keeps local ones out of the image. Variables can reference each other, e.g. `DATABASE_URL=${{Postgres.DATABASE_URL}}` or `https://${{RAILWAY_PUBLIC_DOMAIN}}`.
- **Build-time vs run-time:** a Dockerfile build only sees a variable if the `Dockerfile` declares it with `ARG`. Ours declares `PUBLIC_SENTRY_DSN`, `PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_AUTH_TOKEN`, and `RAILWAY_GIT_COMMIT_SHA`. Everything else is read when the app starts.
- **Billing** is usage-based (CPU, memory, storage, and egress) on top of the plan fee.

### Setting up (one-time)

1. Sign up at [railway.com](https://railway.com). Signing in with GitHub links the accounts in one step. Otherwise, connect GitHub under **Account Settings → Account Integrations → GitHub**.
2. Install the **Railway GitHub App** on the account that owns `lostdog`:
   - Open **[github.com/apps/railway-app/installations/new](https://github.com/apps/railway-app/installations/new)** directly. Railway's **New Project → Deploy from GitHub repo → Configure GitHub App** link goes to the same page.
   - Choose the owning account (or the organization, if the repo moves to one; an org owner must then approve the install)
   - Under **Repository access**, pick **Only select repositories → lostdog**, then **Install**
   - **Pick the right app:** it's **Railway App** by **`railwayapp`**, and its URL starts with `github.com/apps/`. Searching GitHub also turns up "Deploy to Railway" and similar **GitHub Actions** (`github.com/marketplace/actions/…`). Those are CI steps that push to Railway with an API token, often from third parties. They don't give Railway repo access, so don't install them.
3. Create the project from the repo and finish setup per [`deployment.md`](deployment.md#one-time-setup)
4. Optional: install the CLI (`brew install railway`, then `railway login` and `railway link` from the repo root). You need it for `railway ssh`, which is how `bun run create-admin` is run inside the container, and it's handy for `railway logs`.

- **No `railway.json`:** Railway deprecated "Config as Code" (`railway.json`/`railway.toml`). Services created after 2026-08-28 can't opt in, and existing files stop being read on 2026-12-01. Its replacement, "Infrastructure as Code" (`.railway/railway.ts`, applied with `railway config plan`/`apply` from the CLI), isn't used here. Migrations run inside the container instead, and the two remaining settings (health check path, restart policy) are set in the dashboard; see [`deployment.md`](deployment.md#one-time-setup) step 4b.

### Testing & troubleshooting

- **Repo missing from Railway's list:**
  - Check **GitHub → Settings → Applications → Installed GitHub Apps → Railway → Configure** and confirm `lostdog` is under Repository access with no pending permission requests
  - Then click **Refresh** in Railway's repo picker. Railway can take a few minutes to see changes.
- **Auto-deploy won't turn on:** a project member needs a connected GitHub account with write access to the repo, and the app needs access as above. As a last resort, disconnect and reconnect the repo in the service settings, or uninstall and reinstall the app.
- **A deploy failed:** the dashboard has separate logs for each stage:
  - **Build logs:** the `Dockerfile` stages
  - **Deploy logs:** the migration output, then the app's own startup, e.g. the `[storage] …` line
  - A failed health check means `/api/health` didn't return 200, usually because the database is unreachable
- **The first deploy fails:** that's expected until the service variables are set (see [`deployment.md`](deployment.md#one-time-setup))
- Docs: [docs.railway.com](https://docs.railway.com)

### How it was set up (Sandy, Nov 2026)

1. Connected GitHub to Railway via the **Railway App** (`github.com/apps/railway-app`), limited to `lostdog`. A GitHub search also surfaced the "Deploy to Railway" Action, which is the wrong one (see step 2 above).
2. Created the project from the repo plus a Postgres service. Decided on `app.7cornerscats.com` as the address; notifications go to a personal address until launch, then to the Google Group.
3. The variables were first copied from the dev `.env` files and had to be redone per [`deployment.md`](deployment.md#one-time-setup) step 4: localhost URLs, the dev auth secret, seed passwords, and `TUNNEL_URL` don't belong in production, and the `S3_*` vars were missing.
4. Created the production R2 bucket and token (R2 section, step 8). The first deploy then refused to start until all four `S3_*` vars were set, as designed.
5. **`railway.json` was ignored:** Railway had deprecated Config as Code, and a service created after 2026-08-28 can't opt in, so the pre-deploy migration never ran and the app started on an empty database (`table public.pending_storage_delete does not exist`). Fixed by having the container run `prisma migrate deploy` itself on startup and deleting `railway.json` (PR #47). The health check path (`/api/health`) and restart policy (On Failure) are set in the dashboard.
6. Next deploy: all 22 migrations applied, but every request failed with `Invalid base URL: https://`: the service had no public domain yet, so `${{RAILWAY_PUBLIC_DOMAIN}}` was empty. Railway's log only showed an empty "promise rejected" header; the actual error was found in Sentry (LOSTDOG-SERVER-4). **Generate Domain** was greyed out until the port box had `8080` in it. That produced `lostdog-production.up.railway.app`, and the deploy passed its health check.
7. Created the first Admin with `railway ssh` → `bun run create-admin` (run from the Mac's own Terminal, so the temporary password didn't end up in any chat or log).
8. Added `app.7cornerscats.com` as a custom domain (port 8080) with its `CNAME` (`app` → `lostdog-production.up.railway.app`) and `_railway-verify` `TXT` in GoDaddy, default TTL. Railway verified it and issued a Let's Encrypt certificate.
9. Sign-in on `app.7cornerscats.com` then failed with `403 Invalid origin` while the railway.app address worked: `BETTER_AUTH_URL`/`FRONTEND_URL` still used `${{RAILWAY_PUBLIC_DOMAIN}}`, which keeps resolving to the railway.app domain. Setting both to the literal `https://app.7cornerscats.com` fixed it, and the railway.app address now rejects sign-ins, as intended.
10. Enabled scheduled Postgres backups (Postgres service → **Backups** tab); see [`deployment.md`](deployment.md#database-backups) for the schedules, what a restore does, and the restore drill.
11. Still to do: the restore drill (dump → local scratch database), the production smoke test (photo upload to R2, notification email), and switching `NOTIFICATION_TO` to the Google Group at launch. Plan and region: record here.

## Better Auth (sign-in & sessions)

Handles email/password sign-in, sessions, and the user's role. Unlike everything else in this doc, it's an npm library (`better-auth`, in both `backend` and `frontend`), not a hosted service. There's no account to create, and all its data lives in our own Postgres.

### Where it lives

- `backend/src/lib/auth.ts` — server config:
  - Prisma adapter
  - Email/password with **sign-up disabled**: only an Admin creates accounts, from the Users page
  - The extra `role` (`Volunteer` | `Admin`) and `deletedAt` user fields
  - A hook that blocks sign-in for soft-deleted users
  - `trustedOrigins` (`FRONTEND_URL`, plus `TUNNEL_URL` for ngrok)
- `backend/src/index.ts` — mounts it at `/api/auth/*`. It must stay **before** `express.json()`, because Better Auth reads the raw request body itself.
- `backend/src/middleware/requireAuth.ts` / `requireAdmin.ts` — protect API routes using the session
- `frontend/src/lib/auth-client.ts` — the React client (`authClient.useSession()`, `signIn`, `signOut`). It types the extra user fields from the server config.
- Tables: `user`, `session`, `account` (holds the password hash), `verification`. They use `snake_case` columns like the rest of the schema, and keep Better Auth's `String` IDs (see `CLAUDE.md`). Sessions are stored in the database, not in JWTs, so deleting a `session` row signs that device out.

### `backend/.env`

- `BETTER_AUTH_SECRET=` — signs session cookies. Generate one with `openssl rand -base64 32`. Use a different value per environment and never commit it. Changing it signs everyone out.
- `BETTER_AUTH_URL=http://localhost:4000` — the backend's own public URL. In production it's the app's URL, since the backend serves the frontend from the same origin.
- `FRONTEND_URL=http://localhost:3000` — sign-in requests are only accepted from this origin (plus `TUNNEL_URL`)
- Seeded accounts: `bun run seed` creates the admin and volunteer from `SEED_ADMIN_*` / `SEED_VOLUNTEER_*`

### Troubleshooting

- "Invalid origin" / `403` on sign-in — the page's origin isn't `FRONTEND_URL` or `TUNNEL_URL`. Restart the backend after changing either.
- Signed in but every API call returns `401` — the session cookie isn't being sent. Usually the frontend and backend are on different sites (e.g. the tunnel without a blank `PUBLIC_API_URL`); see the ngrok gotchas above.
- `429 Too Many Requests` on sign-in — the sign-in rate limit (20 attempts per 15 minutes, `signInLimiter` in `index.ts`). It only applies in production; in dev it's skipped.
- "This account has been deactivated." — the user is soft-deleted (`user.deleted_at` is set). An Admin can't undo this from the UI yet.
- Locked out of every Admin account in dev — `bun run seed` resets the seeded admin from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`
- Docs: [better-auth.com/docs](https://www.better-auth.com/docs). Check the docs for the version in `package.json` before changing config, since options move between releases.
