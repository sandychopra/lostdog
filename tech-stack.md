# Tech Stack

## Frontend
- **React** with **TypeScript**
- **Tailwind CSS** for styling
- **React Router** for client-side routing
- Bundled/hot-reloaded by **Vite** (`@vitejs/plugin-react`, `@tailwindcss/vite`) — dev/build/test commands still run through Bun, but Vite owns the bundling
- PWA support (installable to home screen) via **`vite-plugin-pwa`** — manifest/service worker wired up; icon assets still pending from the org (see project-scope.md's Design/Branding section)

## Backend
- **Node.js** with **Express**
- REST (or similar) API consumed by the React frontend

## Database
- **PostgreSQL**
- **Prisma** as ORM
- Authentication via **database-backed sessions** (session records stored in Postgres rather than JWTs) — implemented via **Better Auth**'s Prisma adapter; no separate session store (e.g. Redis) needed
- Photo/file storage: **Cloudflare R2** (S3-compatible) — chosen over AWS S3 to avoid egress fees on photo downloads/bulk zip exports; Postgres stores metadata/references only, not the binary files

## Deployment
- **Docker** for containerized deployment
- Hosted on a **managed container platform** (e.g., Fly.io, Railway, or Render) — handles scaling/SSL/deploys around the Docker containers

## AI
- Not needed for MVP — no AI feature is currently in scope (project-scope.md doesn't call for one). Revisit if/when a concrete use case comes up.

## Email
- **SendGrid** for transactional email (sent to the existing Google Group per project-scope.md) — chosen for its free tier

## Open Questions
None currently — see `implementation-plan.md` Phase 8 for remaining PWA polish (icons, install verification on real devices) once brand assets are available.
