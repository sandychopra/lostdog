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

- [ ] Scaffold repo structure (`/frontend`, `/backend` or equivalent)
- [ ] Initialize React + TypeScript app (Vite) with Tailwind CSS and React Router
- [ ] Initialize Node.js + Express backend project
- [ ] Set up local `docker-compose` (Postgres + backend + frontend) for development
- [ ] Initialize Prisma, connect to local Postgres
- [ ] Set up environment variable handling (`.env`, `.env.example`) for both apps
- [ ] Basic health-check endpoint (backend) and confirm frontend can call it
- [ ] Linting/formatting config (ESLint, Prettier) for both apps

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
Goal: users can register, log in, and are gated by role and active status.

- [ ] Password hashing + credentials login endpoint
- [ ] Database-backed session creation/validation/expiry middleware
- [ ] Logout (session invalidation)
- [ ] Self-registration flow — new accounts default to `inactive`
- [ ] Admin: list users, approve/activate pending volunteers, deactivate users
- [ ] Role-based route/middleware guards (Volunteer vs Admin)
- [ ] Inactive-user login rejection
- [ ] Frontend: login, register, and "pending approval" screens
- [ ] Frontend: route guarding by auth state and role

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

- [ ] Backend: ShiftReport CRUD (author, shift type, date, shift-level fields: cleaning, supplies, other notes)
- [ ] Backend: CatEntry — individual variant (fecal score, dry/wet food + brand default, snack/treat, medical notes, dewormer-given, behavior notes, nail trim flag)
- [ ] Backend: CatEntry — group variant (shared fields vs. per-cat fields per the scope doc)
- [ ] Backend: photo upload to S3-compatible storage, attached to a CatEntry
- [ ] Backend: MeetAndGreet CRUD (multi-cat reference + note), repeatable within a report
- [ ] Backend: edit/delete permissions (author-only edit, Admin-only delete)
- [ ] Frontend: shift report creation flow — shift-level fields, repeatable cat entry, repeatable meet-and-greet
- [ ] Frontend: structured pickers for fecal score (1–7) and food amount (none/some/all + free-fed)
- [ ] Frontend: photo capture/upload UI (mobile camera-friendly)
- [ ] Frontend: "kennels reset" multi-select tied to Kennel state
- [ ] Wire dewormer-given in a CatEntry to clear the Cat's dewormer-due flag

## Phase 5 — Status & announcements
Goal: cat/kennel state transitions are structured, not free text, and surface as announcements.

- [ ] Backend: Cat status transitions (`available` → `pending adoption` → `adopted`, fallthrough back to `available`)
- [ ] Backend: pickup date/time field on pending adoption
- [ ] Backend: "Returned to RCC" action (deactivate cat, mark kennel `needs reset`, optional Admin-only reason)
- [ ] Backend: Announcement creation on each triggering event (new arrival, pending/adopted, back available, returned to RCC)
- [ ] Backend: KennelPrepChecklist + ordered ChecklistAction creation (Admin-only)
- [ ] Backend: checklist action check-off enforcing in-order completion, updating roster state as actions complete
- [ ] Backend: announcement resolution rules (24h default for informational types; open-until-resolved for pending adoption/adopted and checklists)
- [ ] Frontend: Admin controls for status changes, return-to-RCC, and checklist creation
- [ ] Frontend: Volunteer checklist check-off UI (next-action-only enabled)
- [ ] Frontend: announcement feed — default (24h/unresolved) view + "view all"

## Phase 6 — Reporting & lookup
Goal: past data is easy to find without reading an inbox.

- [ ] Backend: search/filter shift reports by cat, date, kennel
- [ ] Backend: per-cat aggregated history endpoint (fecal/food/behavior/medical/meet-and-greets over time)
- [ ] Frontend: shift report search/browse UI
- [ ] Frontend: cat history/profile view combining roster info + report history

## Phase 7 — Email notifications
Goal: the Google Group keeps receiving what it receives today, without anyone re-typing it.

- [ ] Integrate chosen provider (SendGrid or Mailgun) in backend
- [ ] Email templates for the five event types (new arrival, pending/adopted incl. pickup time, back available, returned to RCC, checklist assigned)
- [ ] Hook email send into the same Announcement-creation events from Phase 5 (single trigger point)
- [ ] Send-failure handling/logging (so a bounced email doesn't silently fail)

## Phase 8 — PWA & mobile polish
Goal: it works like an app on a volunteer's phone.

- [ ] Web app manifest + icons
- [ ] Service worker for installability (e.g., `vite-plugin-pwa`)
- [ ] "Add to home screen" verified on iOS and Android browsers
- [ ] Mobile-first responsive pass across all screens built so far
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
