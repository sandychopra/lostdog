# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Lost Dog and Cat Rescue Foundation shift-report app. Full product scope, data model, and feature list live in `project-scope.md` — read it before implementing any feature-level work, since the domain rules (cat/kennel/group state transitions, announcement resolution rules, checklist ordering, etc.) are detailed and easy to get subtly wrong from guessing.

The intended tech stack is documented in `Tech-Stack.md` (Postgres + Prisma, database-backed sessions for auth, S3-compatible photo storage, SendGrid/Mailgun for email, Docker deployment) and the build order is documented in `implementation-plan.md`, organized into phases with the reasoning for why phases are sequenced that way. **The current code is only the Phase 0 skeleton** (a wired-up but empty full-stack scaffold) — none of the data model, auth, roster, shift-report, or announcement features are implemented yet.

## Documentation lookups

Use the Context7 MCP server by default when working with any library, framework, SDK, API, CLI tool, or cloud service used in this repo (Bun, Express, React, Prisma, etc.) — for API syntax, configuration, version migration, setup instructions, and library-specific debugging. Prefer it over relying on training data or web search for this kind of question, since library APIs and CLI behavior change between versions. Resolve the library ID first, then query the docs scoped to one concept at a time.

## Commands

This is a Bun workspace monorepo (`backend/`, `frontend/`), not npm/yarn/pnpm.

```bash
bun install                # install all workspace deps, from repo root

bun run dev:backend        # start the Express API with watch mode (http://localhost:4000)
bun run dev:frontend       # start the React dev server with HMR (http://localhost:3000)
```

Each can also be run directly from its own directory: `cd backend && bun run dev`.

- Health status: frontend at `http://localhost:3000`, backend healthcheck at `http://localhost:4000/api/health`.

- `frontend` has a `build` script (`bun build ./src/index.html --outdir ./dist`) that produces static output; `backend` has no build step since Bun runs the TypeScript directly (`bun src/index.ts`).
- No lint, typecheck, or test scripts are configured yet in either workspace.

## Architecture

- **Monorepo**: Bun workspaces defined in the root `package.json` (`backend`, `frontend`). A shared `tsconfig.base.json` at the root holds Bun's recommended compiler options; each workspace's `tsconfig.json` extends it.
- **Backend** (`backend/src/index.ts`): a plain Express app run directly by the Bun runtime — no transpile/build step, no nodemon (Bun's own `--watch` flag handles reload). CORS is enabled since the frontend calls it from a different origin/port in dev.
- **Frontend** (`frontend/src/`): React + TypeScript, but bundled and hot-reloaded natively by Bun rather than Vite/webpack. The entrypoint is `index.ts`, a small `Bun.serve()` script whose `routes` map `"/"` to an imported `index.html` file — Bun's bundler transforms the `<script src="./frontend.tsx">` tag referenced from that HTML on the fly, with HMR built in via `development: true`. There is no separate bundler config to look for.
- The frontend currently calls the backend via an absolute `http://localhost:4000` URL in `App.tsx` (see `API_BASE`) — there's no dev proxy configured, so CORS on the backend is what makes this work locally.
- Nothing is containerized yet; `Tech-Stack.md` specifies Docker + a managed container platform for eventual deployment.
