# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Lost Dog and Cat Rescue Foundation shift-report app. Full product scope, data model, and feature list live in `project-scope.md` — read it before implementing any feature-level work, since the domain rules (cat/kennel/group state transitions, announcement resolution rules, checklist ordering, etc.) are detailed and easy to get subtly wrong from guessing.

The intended tech stack is documented in `Tech-Stack.md` (Postgres + Prisma, database-backed sessions for auth, S3-compatible photo storage, SendGrid/Mailgun for email, Docker deployment) and the build order is documented in `implementation-plan.md`, organized into phases with the reasoning for why phases are sequenced that way. **Phase 0 (foundations) and Phase 2 (auth & user management) are largely done** via Better Auth — login, database-backed sessions, role-gated routes, and full admin user CRUD (create/list/edit/soft-delete) all work end to end. The Prisma schema so far only covers the auth-related tables (`User`, `Session`, `Account`, `Verification`); the roster, shift-report, and announcement data model (`Cat`, `Group`, `Kennel`, `ShiftReport`, `CatEntry`, `MeetAndGreet`, `KennelPrepChecklist`, `ChecklistAction`, `Announcement`) from Phase 1/3+ is not implemented yet. Check `implementation-plan.md`'s checkboxes for current per-item status rather than assuming phase boundaries are clean.

## Documentation lookups

Use the Context7 MCP server by default when working with any library, framework, SDK, API, CLI tool, or cloud service used in this repo (Bun, Express, React, Prisma, etc.) — for API syntax, configuration, version migration, setup instructions, and library-specific debugging. Prefer it over relying on training data or web search for this kind of question, since library APIs and CLI behavior change between versions. Resolve the library ID first, then query the docs scoped to one concept at a time.

## Commands

This is a Bun workspace monorepo (`backend/`, `frontend/`), not npm/yarn/pnpm.

```bash
bun install                # install all workspace deps, from repo root

bun run dev:backend &       # start the Express API with watch mode (http://localhost:4000)
bun run dev:frontend &      # start the React dev server with HMR (http://localhost:3000)


kill $(lsof -t -i :4000)   # backend
kill $(lsof -t -i :3000)   # frontend
```

Each can also be run directly from its own directory: `cd backend && bun run dev`.

- Health status: frontend at `http://localhost:3000`, backend healthcheck at `http://localhost:4000/api/health`.

- `frontend` has a `build` script (`bun build ./src/index.html --outdir ./dist`) that produces static output; `backend` has no build step since Bun runs the TypeScript directly (`bun src/index.ts`).
- `bun run lint` / `bun run format` / `bun run format:check` (from repo root) run ESLint/Prettier across both workspaces via the root `eslint.config.mjs` and `.prettierrc.json`. No typecheck script is configured yet.
- `frontend` has Bun-native tests (`*.test.tsx`, using `@testing-library/react`) but no `test` script wired up yet — run with `cd frontend && bun test`.

### Syncing your local database

Each developer runs their own local Postgres, so after pulling changes that include new Prisma migrations, sync your database with:

```bash
cd backend
bunx prisma migrate deploy   # apply any pending migrations from prisma/migrations/
bunx prisma generate         # regenerate the Prisma client (Bun doesn't auto-run postinstall scripts)
bun run seed                 # create/update your local admin user from .env's SEED_ADMIN_EMAIL/PASSWORD
```

First-time setup also needs a `backend/.env` (copy `backend/.env.example` and fill in your own `DATABASE_URL`, `BETTER_AUTH_SECRET`, etc.) before running the above.

## Architecture

- **Monorepo**: Bun workspaces defined in the root `package.json` (`backend`, `frontend`). A shared `tsconfig.base.json` at the root holds Bun's recommended compiler options; each workspace's `tsconfig.json` extends it.
- **Backend** (`backend/src/index.ts`): a plain Express app run directly by the Bun runtime — no transpile/build step, no nodemon (Bun's own `--watch` flag handles reload). CORS is enabled since the frontend calls it from a different origin/port in dev.
- **Frontend** (`frontend/src/`): React + TypeScript, but bundled and hot-reloaded natively by Bun rather than Vite/webpack. The entrypoint is `index.ts`, a small `Bun.serve()` script whose `routes` map `"/"` to an imported `index.html` file — Bun's bundler transforms the `<script src="./frontend.tsx">` tag referenced from that HTML on the fly, with HMR built in via `development: true`. There is no separate bundler config to look for.
- The frontend currently calls the backend via an absolute `http://localhost:4000` URL in `App.tsx` (see `API_BASE`) — there's no dev proxy configured, so CORS on the backend is what makes this work locally.
- The backend and frontend aren't containerized; only Postgres is, via the root `docker-compose.yml` (`docker compose up -d postgres`), as an opt-in alternative to installing Postgres natively — see `DATABASE_SETUP.md`. `Tech-Stack.md` specifies Docker + a managed container platform for eventual production deployment, which is separate, later work (Phase 9).
