# Tech Stack

## Frontend
- **React** with **TypeScript**
- **Tailwind CSS** for styling
- **React Router** for client-side routing
- PWA support (installable to home screen) — *tooling TBD, see Open Questions*

## Backend
- **Node.js** with **Express**
- REST (or similar) API consumed by the React frontend

## Database
- **PostgreSQL**
- **Prisma** as ORM
- Authentication via **database-backed sessions** (session records stored in Postgres rather than JWTs)
- Photo/file storage: **S3-compatible cloud storage** (e.g., AWS S3 or Cloudflare R2) — Postgres stores metadata/references only, not the binary files

## Deployment
- **Docker** for containerized deployment
- Hosted on a **managed container platform** (e.g., Fly.io, Railway, or Render) — handles scaling/SSL/deploys around the Docker containers

## AI
- Not needed for MVP — no AI feature is currently in scope (project-scope.md doesn't call for one). Revisit if/when a concrete use case comes up.

## Email
- **SendGrid** or **Mailgun** for transactional email (sent to the existing Google Group per project-scope.md)

## Open Questions
1. **Email provider** — SendGrid vs. Mailgun: any existing preference/account, or should we pick one (e.g., SendGrid for its generous free tier)?
2. **Session store** — database sessions need a table/mechanism in Postgres (or a separate store like Redis) for session lookups and expiry. Confirm Postgres-only is fine, or if Redis should be added for session performance.
3. **PWA tooling** — a service worker/manifest approach is needed for installability (e.g., Workbox, `vite-plugin-pwa` if using Vite as the build tool). What's the intended build tool for the React app (Vite is the common pairing with React Router + Express)?
4. **S3-compatible provider** — AWS S3, Cloudflare R2, or another? (Affects cost and how it's wired up alongside the chosen container host.)
