# External Services & Tools

Setup, configuration, and troubleshooting for the third-party services this app depends on: the `7cornerscats.com` domain (GoDaddy), Cloudflare R2 (photo storage), SendGrid (email), ngrok (testing from a phone), and Better Auth (sign-in and sessions). R2, SendGrid, and ngrok are optional in local development. With their settings blank, the app falls back to local disk, logs emails to the console, and runs only on `localhost`. Tools installed on your own Mac (VS Code, Claude Code, DataGrip) are in [`dev-machine-setup.md`](dev-machine-setup.md). For everyday commands, see [`cheat-sheet.md`](cheat-sheet.md). For the full list of env vars, see [`post-pull-checklist.md`](post-pull-checklist.md).

| Service | Used for | Needed in dev? | Settings (`backend/.env` unless noted) |
|---|---|---|---|
| [Domain & DNS](#domain--dns-7cornerscatscom-on-godaddy) | `7cornerscats.com`: email sender now, app address later | No — only for real email and production | DNS records at GoDaddy (no `.env` settings) |
| [Cloudflare R2](#cloudflare-r2-photo-storage) | Photo storage | No — local disk by default | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (optional) |
| [SendGrid](#sendgrid-email-notifications) | Notification emails | No — printed to the log by default | `SENDGRID_API_KEY`, `EMAIL_FROM`, `NOTIFICATION_TO` |
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

### Later: the app's address (Phase 9)

- Point a subdomain (e.g. `app.7cornerscats.com`) at the container host. This is usually a `CNAME` the host gives you, and the host issues the HTTPS certificate.
- Then update `FRONTEND_URL` and `BETTER_AUTH_URL` in the production env (and the frontend's `PUBLIC_API_URL`). Links in notification emails use `FRONTEND_URL`.
- R2 doesn't need a domain: photo links are signed `*.r2.cloudflarestorage.com` URLs.

### Checking & troubleshooting

- `dig +short CNAME s1._domainkey.7cornerscats.com` — should print a `sendgrid.net` target (same for `s2`)
- `dig +short TXT _dmarc.7cornerscats.com` / `dig +short MX 7cornerscats.com` / `dig +short NS 7cornerscats.com`
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
- R2 has no object versioning, so a deleted file is gone for good. For backups, use a scheduled `rclone sync` to a second bucket or provider (not set up yet; see Phase 9 in [`implementation-plan.md`](implementation-plan.md)).

### How it was set up on this machine (Sandy, Nov 2026)

1. Created a personal Cloudflare account and enabled R2, which meant adding a payment method. Usage stays within the free tier.
2. Created the bucket `lostdog-photos-dev`, with public access left off and no CORS policy. The production bucket (`lostdog-photos`) hasn't been created yet; that's part of Phase 9 deployment.
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
- `BETTER_AUTH_URL=http://localhost:4000` — the backend's own public URL (the production API URL once deployed)
- `FRONTEND_URL=http://localhost:3000` — sign-in requests are only accepted from this origin (plus `TUNNEL_URL`)
- Seeded accounts: `bun run seed` creates the admin and volunteer from `SEED_ADMIN_*` / `SEED_VOLUNTEER_*`

### Troubleshooting

- "Invalid origin" / `403` on sign-in — the page's origin isn't `FRONTEND_URL` or `TUNNEL_URL`. Restart the backend after changing either.
- Signed in but every API call returns `401` — the session cookie isn't being sent. Usually the frontend and backend are on different sites (e.g. the tunnel without a blank `PUBLIC_API_URL`); see the ngrok gotchas above.
- `429 Too Many Requests` on sign-in — the sign-in rate limit (20 attempts per 15 minutes, `signInLimiter` in `index.ts`). It only applies in production; in dev it's skipped.
- "This account has been deactivated." — the user is soft-deleted (`user.deleted_at` is set). An Admin can't undo this from the UI yet.
- Locked out of every Admin account in dev — `bun run seed` resets the seeded admin from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`
- Docs: [better-auth.com/docs](https://www.better-auth.com/docs). Check the docs for the version in `package.json` before changing config, since options move between releases.
