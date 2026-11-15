# Lost Dog and Cat Rescue Foundation — Shift Report App

A shift-report and roster-tracking app for Lost Dog and Cat Rescue Foundation's PetSmart adoption-site operations. It replaces the fragmented email threads volunteers currently use for shift reports, new-arrival announcements, adoption status updates, and kennel-prep instructions with a single source of truth for the current state of every cat and kennel.

## Tech stack

Bun workspace monorepo — Express + Prisma + Postgres on the backend, React + Vite + Tailwind on the frontend. See [`docs/tech-stack.md`](docs/tech-stack.md) for the full rationale.

## Quickstart

```bash
bun install                # install all workspace deps, from repo root

bun run dev:backend &      # start the Express API with watch mode (http://localhost:4000)
bun run dev:frontend &     # start the React dev server with HMR (http://localhost:3000)
```

- Frontend: http://localhost:3000
- Backend healthcheck: http://localhost:4000/api/health

First-time setup: install the tools in [`docs/dev-machine-setup.md`](docs/dev-machine-setup.md), then follow [`docs/post-pull-checklist.md`](docs/post-pull-checklist.md) (env vars, database migrations) before running the commands above for the first time.

## Further documentation

- [`docs/project-scope.md`](docs/project-scope.md) — full product scope, data model, and feature list
- [`docs/tech-stack.md`](docs/tech-stack.md) — tech stack and the reasoning behind each choice
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — build order, phased, with current status
- [`docs/post-pull-checklist.md`](docs/post-pull-checklist.md) — steps to run after pulling changes (or for first-time setup)
- [`docs/dev-machine-setup.md`](docs/dev-machine-setup.md) — setting up a Mac: Homebrew, Bun, Postgres, VS Code, Claude Code, DataGrip
- [`docs/external-services.md`](docs/external-services.md) — setup and troubleshooting for the domain, Cloudflare R2, SendGrid, ngrok, and Better Auth
- [`docs/cheat-sheet.md`](docs/cheat-sheet.md) — quick reference for common tasks

`CLAUDE.md` holds operating instructions for Claude Code specifically, not general project documentation.
