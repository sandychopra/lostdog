# Database setup for a new developer

Each developer runs their own local Postgres. Follow these steps to get your database in sync with the latest schema and migrations.

## 1. Pull the latest changes

Make sure you have the branch/commits containing the migration(s) you need, in particular anything under `backend/prisma/migrations/`.

## 2. Point your `.env` at your own database

Copy `backend/.env.example` to `backend/.env` and fill in your own values:

```
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<your-db-name>?schema=public"
BETTER_AUTH_SECRET=      # generate with: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:4000"
FRONTEND_URL="http://localhost:3000"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="changeme"
```

`backend/.env` is untracked/local, so each developer's credentials stay separate.

## 3. Install dependencies

From the repo root:

```bash
bun install
```

This installs all workspace dependencies, including the shared `shared` workspace.

## 4. Apply migrations

From `backend/`:

```bash
bunx prisma migrate deploy
```

This applies every migration in `prisma/migrations/` in order against your database, non-interactively. Use this whenever you've pulled new migrations and just need your database to catch up.

## 5. Regenerate the Prisma client

```bash
bunx prisma generate
```

Bun doesn't automatically run package postinstall scripts, so this step doesn't happen for you automatically — run it manually after every `migrate deploy` or schema change.

## 6. Seed your local admin user

```bash
bun run seed
```

Creates (or updates) an admin user using the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` values from your own `.env`.

---

After these steps, start the dev servers as usual from the repo root:

```bash
bun run dev:backend &
bun run dev:frontend &
```
