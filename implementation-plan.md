# Implementation Plan

Based on `project-scope.md` and `Tech-Stack.md`. Tasks are grouped into phases; each phase should leave the app in a working, demoable state.

## Ordering rationale

The phases follow the dependency chain in the data model, not the feature list order in the scope doc:

1. **Foundations and auth come first** because every other feature needs a working dev environment, a database connection, and a logged-in user with a role before it can be built or tested.
2. **Cat & Kennel roster comes before Shift Reports**, even though the scope doc calls the shift report "the largest and most frequent" feature, because a ShiftReport's CatEntry references a persistent Cat or Group — there's nothing to reference until the roster exists. Building reports first would mean building throwaway cat/kennel stand-ins twice.
3. **Shift Reports come before Status & Announcements** because announcements are largely side effects of roster state changes (adoption, return-to-RCC, checklist completion) — it's easier to build and test those transitions once the roster has real reports and history behind it, and because shift reports are the primary volunteer-facing win to validate early.
4. **Reporting/lookup comes after both** because it's a read layer over ShiftReport + Announcement data — there's nothing meaningful to search or view per-cat until that data exists.
5. **Email notifications come after Announcements**, since each email is triggered by the same events that create an announcement — building the trigger logic once, in one place, avoids duplicating the "what happened" logic between the in-app and email paths.
6. **PWA polish and Deployment are pushed later on purpose**, aside from a minimal local Docker setup in Phase 0 needed for day-to-day development — no point tuning installability, offline-tolerant UI, or production infra until the features it needs to serve exist.
7. **QA/launch is last** and deliberately includes a pilot run with real volunteers before fully retiring the email-based workflow.

---

## Phase 0 — Project foundations
Goal: a running local dev environment, empty but wired end-to-end.

- [x] Scaffold repo structure (`/frontend`, `/backend` or equivalent) — Bun workspace monorepo with `backend/`, `frontend/`, `shared/`.
- [x] Initialize React + TypeScript app (Vite) with Tailwind CSS and React Router — bundled/served by Bun's native bundler (`Bun.serve()` + HMR) instead of Vite; Tailwind v4 via `bun-plugin-tailwind`, React Router v7.
- [x] Initialize Node.js + Express backend project — Express 5 run directly by the Bun runtime (no build step).
- [x] Set up local `docker-compose` (Postgres + backend + frontend) for development — scoped to Postgres only; backend/frontend keep running natively via `bun run dev:*`, per `DATABASE_SETUP.md`. Full containerization is deferred to Phase 9 per the ordering rationale.
- [x] Initialize Prisma, connect to local Postgres — Prisma 7 with `@prisma/adapter-pg`; migrations in `backend/prisma/migrations/`.
- [x] Set up environment variable handling (`.env`, `.env.example`) for both apps — backend: `backend/.env.example`; frontend: `frontend/.env.example` with `PUBLIC_API_URL`, inlined into the bundle by Bun (`bunfig.toml` `env = "PUBLIC_*"` for dev, `frontend/build.ts` for production) and read via `frontend/src/lib/config.ts`.
- [x] Basic health-check endpoint (backend) and confirm frontend can call it — `GET /api/health` (checks DB), called from `HomePage.tsx`.
- [x] Linting/formatting config (ESLint, Prettier) for both apps

## Phase 1 — Data model
Goal: the full schema exists and is migratable; no UI yet.

- [ ] Prisma schema: `User`, `Cat`, `Group`, `Kennel`
- [ ] Prisma schema: `ShiftReport`, `CatEntry`
- [ ] Prisma schema: `MeetAndGreet`
- [ ] Prisma schema: `KennelPrepChecklist`, `ChecklistAction`
- [ ] Prisma schema: `Announcement`
- [ ] Prisma schema: `Session` table (for database-backed auth sessions)
- [ ] Write and run initial migration
- [ ] Seed script with representative dev data (a few cats, a group, kennels, one admin/one volunteer user)

## Phase 2 — Authentication & user management
Goal: users can log in, are gated by role, and Admins manage the full user lifecycle.

- [x] Password hashing + credentials login endpoint — Better Auth email/password (`backend/src/lib/auth.ts`), sign-up disabled; mounted at `/api/auth/*` with rate limiting in production.
- [x] Database-backed session creation/validation/expiry middleware — Better Auth sessions stored in Postgres via the Prisma adapter; validated per request in `middleware/requireAuth.ts`.
- [x] Logout (session invalidation) — `authClient.signOut()` from the Navbar.
- [x] Admin: create user (Volunteer or Admin), list users, edit user, soft-delete user — `backend/src/routes/users.ts`; soft delete sets `deletedAt` and clears the user's sessions. An Admin can delete Volunteers and other Admins, but not their own account.
- [x] Role-based route/middleware guards (Volunteer vs Admin) — `requireAuth` + `requireAdmin` middleware.
- [x] Deleted-user login rejection — a Better Auth `session.create.before` hook in `backend/src/lib/auth.ts` refuses to create a session for a user with `deletedAt` set (403 "This account has been deactivated."); deleting also clears existing sessions, and `requireAuth` rejects any that remain.
- [x] Frontend: login screen — `LoginPage.tsx`.
- [x] Frontend: Admin user-management screens (list, create, edit, delete) — `UsersPage`, `UsersTable`, `UserForm`, with tests.
- [x] Frontend: route guarding by auth state and role — `RequireAuth` / `RequireAdmin` wrappers in `App.tsx`.

## Phase 3 — Cat & Kennel roster
Goal: Admins can manage the roster that everything else references.

- [ ] Backend: Kennel CRUD + state (`ready` / `occupied` / `needs reset`)
- [ ] Backend: Cat CRUD (intake fields: name, age, sex, color/pattern, collar color, kennel, dewormer due)
- [ ] Backend: Group creation (paired/multi-cat intake into one kennel)
- [ ] Backend: Group dissolve logic (cat leaves group → remaining cat becomes Individual if only one left)
- [ ] Backend: dewormer due/given toggle on Cat, from the roster
- [ ] Frontend: Admin roster views — cat list, kennel list/grid, intake form
- [ ] Frontend: cat/kennel detail views (current state, dewormer flag)

## Phase 4 — Shift reports (core feature)
Goal: volunteers can fully replace the shift-report email.

- [ ] Backend: ShiftReport CRUD (author, shift type, date, shift-level fields: cleaning, supplies, other notes, play notes with optional cat tags)
- [ ] Backend: CatEntry — individual variant (fecal score, pee, pee/poo notes, dry/wet food + brand default, snack/treat, food notes, medical notes, dewormer-given, behavior notes, other notes, nail trim flag)
- [ ] Backend: CatEntry — group variant (shared fields incl. shared pee/poo, food + other notes vs. per-cat fields incl. per-cat food + other notes, per the scope doc)
- [ ] Backend: Photo upload to S3-compatible storage, attached to a ShiftReport (optionally a CatEntry, auto-tagged with that entry's cat), with zero-or-more cat tags; always keep the original full-resolution file (for Admin download)
- [ ] Backend: edit a Photo's cat tags (uploader or Admin only)
- [ ] Backend: MeetAndGreet CRUD (multi-cat reference + note), repeatable within a report
- [ ] Backend: edit/delete permissions (author-only edit, Admin-only delete)
- [ ] Frontend: shift report creation flow — shift-level fields, repeatable cat entry, repeatable meet-and-greet
- [ ] Frontend: structured pickers for fecal score (1–7) and food amount (none/some/all + free-fed)
- [ ] Frontend: photo capture/upload UI (mobile camera-friendly; file picker on desktop) — inside cat entries and in the report-level Photos section, with an optional multi-cat tag picker
- [ ] Frontend: "kennels reset" multi-select tied to Kennel state
- [ ] Frontend: Play section — free-text notes with optional multi-cat tag picker (same picker as photo tags / meet-and-greet)
- [ ] Wire dewormer-given in a CatEntry to clear the Cat's dewormer-due flag

## Phase 5 — Status & announcements
Goal: cat/kennel state transitions are structured, not free text, and surface as announcements.

- [ ] Backend: Cat status transitions (`available` → `pending adoption` → `adopted`, fallthrough back to `available`)
- [ ] Backend: pickup date/time field on pending adoption
- [ ] Backend: SignTask auto-created on status change (pending → post pending, adopted → post adopted, back available → remove pending), with superseding/cancel rules (incl. Returned to RCC)
- [ ] Backend: check off a SignTask from a shift report (records user/time/report)
- [ ] Backend: "Returned to RCC" action (deactivate cat, mark kennel `needs reset`, optional Admin-only reason)
- [ ] Backend: Announcement creation on each triggering event (new arrival, pending/adopted, back available, returned to RCC)
- [ ] Backend: KennelPrepChecklist + ordered ChecklistAction creation (Admin-only)
- [ ] Backend: checklist action check-off enforcing in-order completion, updating roster state as actions complete
- [ ] Backend: announcement resolution rules (24h default for informational types; open-until-resolved for pending adoption/adopted, back available with a remove-sign task, and checklists; includes SignTask completion)
- [ ] Frontend: Admin controls for status changes, return-to-RCC, and checklist creation
- [ ] Frontend: Volunteer checklist check-off UI (next-action-only enabled)
- [ ] Frontend: "Signs to post" section in the shift report form — open sign tasks with checkboxes; hidden when none
- [ ] Frontend: announcement feed — default (24h/unresolved) view + "view all"

## Phase 6 — Reporting & lookup
Goal: past data is easy to find without reading an inbox.

- [ ] Backend: search/filter shift reports by cat, date, kennel
- [ ] Backend: per-cat aggregated history endpoint (fecal/pee/food + their notes, behavior, medical, other notes, meet-and-greets, tagged play notes, tagged photos over time)
- [ ] Backend: photo query endpoint — filter by cat or unassigned (no tags), newest first
- [ ] Backend: Admin-only photo download — single original file, and bulk zip of a filtered set (by cat / unassigned)
- [ ] Frontend: shift report search/browse UI
- [ ] Frontend: cat history/profile view combining roster info + report history
- [ ] Frontend: photo browse view — cat filter + unassigned filter, link to source report, inline tag editing
- [ ] Frontend: Admin download controls in photo browse — per-photo download + "download all (zip)" for the current filter

## Phase 7 — Email notifications
Goal: the Google Group keeps receiving what it receives today, without anyone re-typing it.

- [ ] Integrate chosen provider (SendGrid or Mailgun) in backend
- [ ] Email templates for the five event types (new arrival, pending/adopted incl. pickup time, back available, returned to RCC, checklist assigned)
- [ ] Hook email send into the same Announcement-creation events from Phase 5 (single trigger point)
- [ ] Send-failure handling/logging (so a bounced email doesn't silently fail)

## Phase 8 — PWA, mobile & desktop polish
Goal: it works like an app on a volunteer's phone, and is equally usable in a desktop browser.

- [ ] Web app manifest + icons
- [ ] Service worker for installability (e.g., `vite-plugin-pwa`)
- [ ] "Add to home screen" verified on iOS and Android browsers
- [ ] Mobile-first responsive pass across all screens built so far — verified on phone and desktop/laptop browser widths
- [ ] Real-device test of photo capture/upload flow

## Phase 9 — Deployment & hardening
Goal: it runs in production, reliably, with backups.

- [ ] Production Dockerfiles for frontend and backend
- [ ] Provision managed Postgres, S3-compatible bucket, and container host (per `Tech-Stack.md`)
- [ ] Configure production secrets/env vars on the hosting platform
- [ ] Deploy pipeline (manual or CI-triggered) to the managed container platform
- [ ] Basic logging/error monitoring
- [ ] Database backup strategy (managed provider's automatic backups, verified)
- [ ] Smoke test full user flows against production

## Phase 10 — QA & launch
Goal: confident handoff to real volunteers.

- [ ] End-to-end pass through every flow in `project-scope.md` (shift report, roster, status/announcements, checklist, search)
- [ ] Admin walkthrough/training (roster management, approvals, checklists)
- [ ] Volunteer quick-start guide (mobile install + shift report basics)
- [ ] Pilot with a small group of volunteers for a few shifts alongside the existing email process
- [ ] Collect feedback, fix issues
- [ ] Full cutover from email-based shift reports to the app
