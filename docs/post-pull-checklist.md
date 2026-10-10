# Post-pull checklist

Run through these steps after pulling changes from `main` to keep your local setup in sync — new dependencies, environment variables, and database migrations don't apply themselves. The same steps also work for first-time setup.

**Quick reference** — on a routine pull you only need the "Every pull" rows; everything else is first-time setup or situational:

| Step | When |
|---|---|
| 1. Install dependencies | Every pull |
| 2. Backend environment variables | Check every pull; edit only if a new var appeared |
| 3. Frontend environment variables | Check every pull; edit only if a new var appeared |
| 4a. Create Postgres role/database | First-time only |
| 4b. Docker Postgres alternative | First-time only (alternative to 4a) |
| 4c. `prisma migrate deploy` | Every pull |
| 4d. One-time migration-history note | First-time only (delete once obsolete) |
| 4e. `prisma generate` | Every pull |
| 4f. `bun run seed` | First-time, or after a `migrate reset` |
| 5. Start the dev servers | Every time you work on the app |

## 1. Install dependencies `Every pull`

From the repo root:

```bash
bun install
```

This installs all workspace dependencies — `backend`, `frontend`, and the shared `shared` workspace — picking up anything newly added since your last pull.

## 2. Backend environment variables `Check every pull`

Copy `backend/.env.example` to `backend/.env` if you don't already have one, and fill in your own values (the defaults below already match the `docker-compose.yml` Postgres service):

```
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<your-db-name>?schema=public"
BETTER_AUTH_SECRET=      # generate with: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:4000"
FRONTEND_URL="http://localhost:3000"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="changeme"
SEED_VOLUNTEER_EMAIL="volunteer@example.com"
SEED_VOLUNTEER_PASSWORD="changeme"
```

`backend/.env` is untracked/local, so each developer's credentials stay separate. After a pull, diff your `.env` against `backend/.env.example` — a new variable can land there without an announcement, and a missing value fails silently or falls back to a default you didn't expect:

```bash
diff <(grep -oE '^[A-Z_]+=' backend/.env.example) <(grep -oE '^[A-Z_]+=' backend/.env)
```

No output means you're in sync. A `<` line is a variable in `.env.example` that's missing from your `.env` — add it. A `>` line is extra in your `.env` and usually just a harmless local leftover.

## 3. Frontend environment variables `Check every pull`

Copy `frontend/.env.example` to `frontend/.env` if you don't already have one:

```
PUBLIC_API_URL=http://localhost:4000
```

This step is optional for the default local setup — `frontend/src/lib/config.ts` already falls back to `http://localhost:4000` if `PUBLIC_API_URL` is unset — but is required if your backend runs on a different port/host. As with the backend, diff your `.env` against `frontend/.env.example` after a pull to catch newly added vars; only `PUBLIC_`-prefixed vars are ever exposed to the browser bundle (see `Tech-Stack.md` / `CLAUDE.md`):

```bash
diff <(grep -oE '^[A-Z_]+=' frontend/.env.example) <(grep -oE '^[A-Z_]+=' frontend/.env)
```

Same output rules as above: no output means in sync, `<` means add that var, `>` is usually a harmless local leftover.

## 4. Database sync

Each developer runs their own local Postgres — a native install (Postgres 17) is recommended over Docker, since you're already managing an isolated, per-developer database either way and a native install avoids an extra layer.

<details>
<summary><strong>First-time setup</strong> — create your local Postgres role/database (click to expand; skip if already done)</summary>

Create a role and database matching `backend/.env.example`'s defaults, so no `.env` changes are needed:

```bash
psql postgres -c "CREATE ROLE lostdog_app WITH LOGIN PASSWORD 'changeme';"
psql postgres -c "CREATE DATABASE lostdog OWNER lostdog_app;"
```

If you'd rather use your own role/database name or password, just point `DATABASE_URL` in `backend/.env` at them instead (see step 2) — nothing else in this checklist depends on the exact values.

<details>
<summary>Alternative: run Postgres via Docker instead</summary>

If you'd rather not install Postgres natively, `docker-compose.yml` at the repo root spins up a matching instance:

```bash
docker compose up -d postgres
```

This starts a Postgres 17 container on `localhost:5432` with a `lostdog_app` user, `changeme` password, and `lostdog` database — matching `backend/.env.example`'s defaults exactly, so no `.env` changes are needed if you use them as-is. Data persists in a named Docker volume (`postgres-data`) across restarts; `docker compose down -v` wipes it if you want a clean slate. Only Postgres is containerized — the backend and frontend still run natively via `bun run dev:backend`/`dev:frontend`, per the root `CLAUDE.md`.

</details>

</details>

### Every pull

From `backend/`, apply migrations and sync the schema (needed every time you pull new migrations, not just first-time):

```bash
bunx prisma migrate deploy
```

This applies every migration in `prisma/migrations/` in order against your database, non-interactively. Use this whenever you've pulled new migrations and just need your database to catch up.

<details>
<summary>Hit a history-mismatch error? (one-time, pre-2026-09-26 databases only)</summary>

The migration history was rewritten twice on 2026-09-26 — once to retrofit the Better Auth tables with `snake_case` columns, and again to convert the Phase 1 domain tables' IDs from `String`/cuid to `Int`/autoincrement (see `CLAUDE.md`) — in both cases via a migration-history reset rather than an additive migration. If your database was last synced before that and `migrate deploy` fails with a history-mismatch error, run `bunx prisma migrate reset --force` instead — **this drops your local database** — then continue with `prisma generate` and `bun run seed` below. This note only applies to that one sync; once everyone's past it, it can be deleted.

</details>

```bash
bunx prisma generate
```

Bun doesn't automatically run package postinstall scripts, so this step doesn't happen for you automatically — run it manually after every `migrate deploy` or schema change. This also regenerates `backend/prisma/ERD.md`, a Mermaid entity-relationship diagram of the full schema, kept in sync automatically via the `erd` generator in `schema.prisma`.

<details>
<summary><strong>First-time, or after a <code>migrate reset</code></strong> — seed dev data (click to expand; skip on a routine pull)</summary>

```bash
bun run seed
```

Creates (or updates) an admin user and a volunteer user (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` and `SEED_VOLUNTEER_EMAIL`/`SEED_VOLUNTEER_PASSWORD` from your own `.env`), plus representative roster dev data (a few cats, a kennel, a bonded group). Re-running it is safe (it won't duplicate existing data), but a routine pull doesn't need it — only first-time setup or after a `migrate reset` wipes your database.

</details>

## 5. Start the dev servers `Every time you work on the app`

Check that they aren't already running first — starting a second copy silently lands on the next free port instead of 4000/3000, which breaks CORS (`FRONTEND_URL`) and `PUBLIC_API_URL` matching:

```bash
lsof -nP -iTCP:4000 -iTCP:3000 -sTCP:LISTEN
```

If that prints any lines, the servers are already up — the `NAME` column shows which port, `COMMAND`/`PID` show what's listening on it; reuse that tab instead of starting another. Otherwise, start them:

```bash
bun run dev:backend &
bun run dev:frontend &
```

To shut one down (e.g. it's on the wrong port, or you need a clean restart):

```bash
kill $(lsof -t -i :4000)   # backend
kill $(lsof -t -i :3000)   # frontend
```
