# Tech Stack

## Frontend
- **React** with **TypeScript**
- **Tailwind CSS** for styling
- **React Router** for client-side routing
- Bundled/hot-reloaded by **Vite** (`@vitejs/plugin-react`, `@tailwindcss/vite`) — dev/build/test commands still run through Bun, but Vite owns the bundling
- PWA support (installable to home screen) via **`vite-plugin-pwa`** — manifest, service worker (update prompt, not auto-reload) and icons. Icons are generated from `frontend/public/logo.png` (the org's site icon) by `@vite-pwa/assets-generator` via `bun run generate-pwa-assets`

## Backend
- **Node.js** with **Express**
- REST (or similar) API consumed by the React frontend

## Database
- **PostgreSQL**
- **Prisma** as ORM
- Authentication via **database-backed sessions** (session records stored in Postgres rather than JWTs) — implemented via **Better Auth**'s Prisma adapter; no separate session store (e.g. Redis) needed
- Photo/file storage: **Cloudflare R2** (S3-compatible) — chosen over AWS S3 to avoid egress fees on photo downloads/bulk zip exports; Postgres stores metadata/references only, not the binary files. Accessed through a generic S3 client (`@aws-sdk/client-s3`, `S3Storage` in `backend/src/lib/storage.ts`), so any S3-compatible store works by config alone; local disk is used when the `S3_*` env vars are unset. Grid views load ~480px thumbnails (generated at upload by **sharp**) straight from the bucket via 15-minute presigned URLs; Admin original/zip downloads still stream through the API

## Deployment
- **Docker** for containerized deployment
- Hosted on **Railway** (managed container platform) — one service built from the root `Dockerfile` (Express serves the built frontend same-origin with `/api`) plus Railway Postgres; handles SSL/deploys. See `deployment.md`

## AI
- Not needed for MVP — no AI feature is currently in scope (project-scope.md doesn't call for one). Revisit if/when a concrete use case comes up.

## Email
- **SendGrid** for transactional email (sent to the existing Google Group per project-scope.md) — chosen for its free tier

## Open Questions
None currently — see `implementation-plan.md` Phase 8 for the remaining real-device install checks.
