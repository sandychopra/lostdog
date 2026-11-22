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
Status: Done

- Scaffold the Bun workspace monorepo (`backend/`, `frontend/`, `shared/`)
- Frontend: React + TypeScript with Vite, Tailwind CSS, and React Router
- Backend: Express app run directly by Bun
- Local Docker Compose for Postgres only (backend/frontend run natively)
- Prisma connected to local Postgres
- Environment variable handling (`.env`, `.env.example`) for both apps
- Health-check endpoint, called from the frontend
- ESLint and Prettier for both apps

## Phase 1 — Data model
Goal: the full schema exists and is migratable; no UI yet.
Status: Done

- `snake_case` column naming via `@map` on all tables, including the Better Auth ones
- Schema: `User`, `Cat`, `Group`, `Kennel`, `Litter`
- Schema: `ShiftReport`, `CatEntry`, `Photo`
- Schema: `MeetAndGreet`
- Schema: `KennelPrepChecklist`, `ChecklistAction`
- Schema: `Announcement`, `SignTask`, `KennelMoveRequest`
- Schema: `Session` (database-backed auth sessions)
- Initial migration
- Seed script with representative dev data

## Phase 2 — Authentication & user management
Goal: users can log in, are gated by role, and Admins manage the full user lifecycle.
Status: Done

- Email/password login via Better Auth (sign-up disabled)
- Database-backed sessions with validation middleware
- Logout
- Admin user CRUD: create (Volunteer or Admin), list, edit, soft-delete (not your own account)
- Role guards for Volunteer vs Admin routes
- Deleted users can't log in
- Frontend: login screen
- Frontend: Admin user-management screens
- Frontend: route guarding by auth state and role

## Phase 3 — Cat & Kennel roster
Goal: Admins can manage the roster that everything else references.
Status: Done

- Kennel CRUD with state (`ready` / `occupied` / `needs reset`); Volunteers read, Admins write
- Cat CRUD with all intake fields
- Group creation (paired/multi-cat intake into one kennel)
- Group dissolve (a Group left with one Cat becomes Individual)
- Group bonded-pair flag (Admin-set, two-Cat Groups only, informational)
- Litter/sibling tagging (Admin-set, independent of Group/kennel)
- Dewormer due/given toggle
- Frontend: cat list, kennel list, intake form, Group and Litter forms
- Frontend: kennel, dewormer, probiotic, pickup and sibling info shown inline on each roster row

## Phase 4 — Shift reports (core feature)
Goal: volunteers can fully replace the shift-report email.
Status: Done

- ShiftReport CRUD with shift-level fields (cleaning, supplies, notes, play notes with cat tags, split-shift flag)
- CatEntry, individual variant
- CatEntry, group variant (shared fields plus per-cat fields)
- Probiotic "last given" derived from CatEntry history
- Photo upload to S3-compatible storage (local disk in dev), with cat tags and original files kept
- Edit a Photo's cat tags (uploader or Admin)
- MeetAndGreet CRUD, repeatable within a report
- Permissions: author edits, Admin deletes
- Kennels-reset list on submit sets those Kennels to `ready`
- Kennels-flagged list on submit sets those Kennels to `needs reset`
- Dewormer-given in a CatEntry clears the Cat's dewormer-due flag
- Frontend: report creation flow with repeatable cat entries and meet-and-greets
- Frontend: fecal score and food amount pickers
- Frontend: photo capture/upload with optional cat tags
- Frontend: read-only kennel-status summary
- Frontend: kennels reset and kennels flagged multi-selects
- Frontend: repeatable Play Groups (cats plus a note)
- Frontend: roster "Overdue" indicator for probiotics after 24h

## Phase 5 — Status & announcements
Goal: cat/kennel state transitions are structured, not free text, and surface as announcements.
Status: Done

- Cat status transitions: `available` → `pending adoption` → `adopted` → `picked up`; `available` → `adopted` directly; pending or adopted can fall back to `available`
- Pickup date/time on pending adoption, reschedulable
- `adopted` → `picked up` is the one change a Volunteer can make, via Confirm pickup; it marks the kennel `needs reset`
- Confirm pickup from a shift report
- Kennel `planned` state (Admin-set)
- SignTask auto-created on status change, with superseding/cancel rules
- Check off a SignTask from a shift report
- "Returned to RCC" action (deactivates the cat, marks the kennel `needs reset`, optional Admin-only reason)
- Admin sets/clears a Cat's `needs-probiotic` flag
- Announcement created on each triggering event
- KennelPrepChecklist with ordered ChecklistActions (Admin-only)
- Checklist check-off from a shift report, enforced in order
- Announcement resolution rules per type
- KennelMoveRequest creation (Admin-only), with cancel
- Check off a KennelMoveRequest from a shift report (performs the move)
- Frontend: Admin status-change and return-to-RCC controls
- Frontend: checklist and kennel-move-request creation
- Frontend: shift report sections for signs to post, kennel moves, kennel prep and confirm pickup
- Frontend: `planned` selectable in the Kennel form
- Frontend: announcement feed (24h/unresolved default, plus "view all")

## Phase 6 — Reporting & lookup
Goal: past data is easy to find without reading an inbox.
Status: Done

- Backend: search/filter shift reports by cat, date, kennel
- Backend: per-cat history endpoint (fecal/pee/food, notes, meet-and-greets, play notes, photos)
- Backend: photo query by cat or unassigned, newest first
- Backend: Admin-only photo download, single or bulk zip, with descriptive filenames
- Backend: `ActivityLog` model, written on every Cat and Kennel create/edit/delete
- Backend: Admin-only per-cat / per-kennel activity-history endpoint
- Frontend: shift report search/browse
- Frontend: cat history/profile view
- Frontend: photo browse with filters, report links, and tag editing
- Frontend: Admin photo download controls
- Frontend: Admin activity-history view on cat/kennel detail

## Phase 7 — Email notifications
Goal: the Google Group keeps receiving what it receives today, without anyone re-typing it.
Status: Done (real SendGrid delivery verified to a personal address)

- SendGrid integration
- Templates for the seven emailed Announcement types (new arrival, pending/adopted, back available, returned to RCC, kennel needs reset, ad-hoc/manual including kennel-prep checklists, kennel move requested); dewormer due and probiotic needed stay in-app only
- Send emails from the same Announcement-creation events
- "Shift report submitted" email, sent on report creation (plain text, no photos)
- Send-failure handling and logging

## Phase 8 — PWA, mobile & desktop polish
Goal: it works like an app on a volunteer's phone, and is equally usable in a desktop browser.
Status: Code complete. Real-device checks on iPhone (install, camera/HEIC upload) still to do; Android install unverified (no test device).

- Service worker and manifest via `vite-plugin-pwa`, with a "new version — Reload" prompt instead of silent auto-update (done)
- Manifest/apple-touch icons and favicon generated from the org's site icon on lostdogrescue.org (done; swap in an official file by replacing `frontend/public/logo.png` and running `bun run generate-pwa-assets`)
- "Add to home screen" verified on iOS and Android
- Mobile-first responsive pass across all screens: hamburger nav, phone cards in place of wide tables, 16px inputs (no iOS focus zoom), safe-area padding, offline banner (done; checked at 390px and desktop widths in Chrome)
- Photos converted to JPEG (max 2560px) on the device before upload, so HEIC displays everywhere; the Admin "original" download is that JPEG (done)
- Real-device test of photo capture/upload

## Phase 9 — Deployment & hardening
Goal: it runs in production, reliably, with backups.
Status: In progress — Railway deployment is code complete (single-image `Dockerfile`, `railway.json`, `create-admin`; see `docs/deployment.md`) and rehearsed locally, but not yet provisioned; backups and the production smoke test not started.

- Production Dockerfile: one image in which Express serves the built frontend same-origin with `/api` (chosen over separate frontend/backend images so session cookies are first-party on Railway's `*.up.railway.app` domains, which are cross-site to each other)
- Provision managed Postgres, S3-compatible bucket, and container host — Railway (per `Tech-Stack.md`; steps in `docs/deployment.md`)
- Photo storage for production: S3-compatible `S3Storage` selected by `S3_*` env vars; thumbnails generated at upload (`bun run backfill-thumbnails` for older photos); presigned thumbnail URLs; storage deletes go through the `PendingStorageDelete` outbox; `bun run storage:reconcile` reports/deletes orphaned objects (code done; not yet run against a real R2 bucket)
- Production secrets/env vars
- Deploy pipeline — Railway auto-deploys `main`; `prisma migrate deploy` runs as the pre-deploy command, `/api/health` gates the switch-over
- Basic logging and error monitoring
- Verified database backups
- Smoke test of full user flows against production

## Phase 10 — QA & launch
Goal: confident handoff to real volunteers.
Status: Not started

- End-to-end pass through every flow in `project-scope.md`
- Admin walkthrough/training
- Volunteer quick-start guide
- Pilot with a few volunteers alongside the email process
- Collect feedback and fix issues
- Full cutover from email to the app
