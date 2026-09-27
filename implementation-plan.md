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
- [x] Initialize React + TypeScript app (Vite) with Tailwind CSS and React Router — bundled/hot-reloaded by Vite (`@vitejs/plugin-react`), Tailwind v4 via `@tailwindcss/vite`, React Router v7; dev/build/test commands still run through Bun.
- [x] Initialize Node.js + Express backend project — Express 5 run directly by the Bun runtime (no build step).
- [x] Set up local `docker-compose` (Postgres + backend + frontend) for development — scoped to Postgres only; backend/frontend keep running natively via `bun run dev:*`, per `post-pull-checklist.md`. Full containerization is deferred to Phase 9 per the ordering rationale.
- [x] Initialize Prisma, connect to local Postgres — Prisma 7 with `@prisma/adapter-pg`; migrations in `backend/prisma/migrations/`.
- [x] Set up environment variable handling (`.env`, `.env.example`) for both apps — backend: `backend/.env.example`; frontend: `frontend/.env.example` with `PUBLIC_API_URL`, inlined into the bundle by Vite (`envPrefix: "PUBLIC_"` in `vite.config.ts`) and read via `frontend/src/lib/config.ts`.
- [x] Basic health-check endpoint (backend) and confirm frontend can call it — `GET /api/health` (checks DB), called from `HomePage.tsx`.
- [x] Linting/formatting config (ESLint, Prettier) for both apps

## Phase 1 — Data model
Goal: the full schema exists and is migratable; no UI yet.

- [x] Naming convention fix: existing Better-Auth tables (`User`, `Session`, `Account`, `Verification`) retrofitted with explicit `@map` for `snake_case` columns (native Postgres convention), keeping `camelCase` in the Prisma schema/client (Prisma/JS convention) — table names were already lowercase. Applied via a migration-history reset (`prisma migrate reset` + a fresh `init` migration), since the project is pre-launch with only local dev/seed data. All new Phase 1 tables below follow the same convention from the start.
- [x] Prisma schema: `User`, `Cat`, `Group`, `Kennel`, `Litter`
- [x] Prisma schema: `ShiftReport`, `CatEntry`, `Photo`
- [x] Prisma schema: `MeetAndGreet`
- [x] Prisma schema: `KennelPrepChecklist`, `ChecklistAction`
- [x] Prisma schema: `Announcement`, `SignTask`, `KennelMoveRequest`
- [x] Prisma schema: `Session` table (for database-backed auth sessions) — done in Phase 2 via Better Auth.
- [x] Write and run initial migration
- [x] Seed script with representative dev data (a few cats, a group, kennels, one admin/one volunteer user)

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

- [x] Backend: Kennel CRUD + state (`ready` / `occupied` / `needs reset`) — `backend/src/routes/kennels.ts`; Volunteer-readable, Admin-only writes; assigning/vacating a Cat auto-transitions state (`Occupied`/`NeedsReset`).
- [x] Backend: Cat CRUD (intake fields: name, age in years+months, sex, color/pattern (picklist + free-text "Other"), collar color, microchip number (optional), kennel, dewormer due + due date, needs-probiotic, pickup date/time) — `backend/src/routes/cats.ts`; a Cat with a `groupId` can't be edited/deleted here (409).
- [x] Backend: Group creation (paired/multi-cat intake into one kennel) — `backend/src/routes/groups.ts`; destination Kennel must be unoccupied or already one of the selected Cats' own kennel; every other vacated Kennel flips to `NeedsReset`.
- [x] Backend: Group dissolve logic (cat leaves group → remaining cat becomes Individual if only one left) — `DELETE /api/groups/:id/cats/:catId`; the removed Cat comes out with no Group/Kennel (an Admin gives it a new one via Cat edit); no Kennel-state changes either way, since the shared Kennel stays occupied throughout.
- [x] Backend: Group bonded-pair flag (Admin-set, only settable on a Group of exactly two Cats, informational only; cleared automatically when the Group dissolves or resizes) — `PUT /api/groups/:id`; "cleared on resize" turned out to need no extra code, since dissolving is the only way a bonded Group's membership ever changes, and that deletes the Group entirely.
- [x] Backend: Litter/siblings tagging (Admin tags two or more Cats as siblings, independent of Group/kennel) — `backend/src/routes/litters.ts`; same create/add/remove-with-dissolve shape as Group, minus any Kennel interaction.
- [x] Backend: dewormer due/given toggle on Cat, from the roster — Admin sets due date at intake/edit; any user can mark "given" via `PATCH /api/cats/:id/dewormer`, matching the scope doc's "from a shift report or the cat's profile."
- [x] Frontend: Admin roster views — cat list, kennel list/grid, intake form — `CatsPage`/`CatsTable`/`CatForm`, `KennelsPage`/`KennelsTable`/`KennelForm`, plus `CreateGroupForm`/`SiblingsForm` for Group/Litter management.
- [x] Frontend: cat/kennel detail views (current state, dewormer flag) — surfaced inline on each roster table row (kennel/dewormer/probiotic/pickup/siblings columns) rather than a separate per-cat page.

## Phase 4 — Shift reports (core feature)
Goal: volunteers can fully replace the shift-report email.

- [x] Backend: ShiftReport CRUD (author, shift type, date, split-shift flag (Morning/Evening only), shift-level fields: cleaning, supplies, other notes, play notes with optional cat tags) — `backend/src/routes/shiftReports.ts`; a small additive migration (`ShiftReportKennelFlag`) was needed to mirror `ShiftReportKennelReset`, since Phase 1's schema only built the "reset" half of the reset/flagged pair.
- [x] Backend: CatEntry — individual variant (fecal score, pee, pee/poo notes, dry/wet food + brand default, snack/treat, food notes, medical notes, dewormer-given, probiotic-given (any shift, while the Cat's needs-probiotic flag is set), behavior notes, other notes, nail trim flag)
- [x] Backend: CatEntry — group variant (shared fields incl. shared pee/poo, food + other notes vs. per-cat fields incl. per-cat food + other notes and probiotic-given (any shift), per the scope doc)
- [x] Backend: probiotic "last given" derived from the most recent CatEntry/GroupEntryCatDetail with probiotic-given checked for that Cat (no separate dose-log entity) — feeds the roster's 24h Overdue indicator — raw-SQL `UNION ALL` merge in `GET /api/cats`, `lastProbioticGivenAt` per cat.
- [x] Backend: Photo upload to S3-compatible storage, attached to a ShiftReport (optionally a CatEntry, auto-tagged with that entry's cat), with zero-or-more cat tags; always keep the original full-resolution file (for Admin download) — `backend/src/lib/storage.ts` defines a small `PhotoStorage` interface backed by local disk for dev (`backend/uploads/`, gitignored); swapping in real Cloudflare R2 later is a drop-in behind the same interface, no calling-code changes.
- [x] Backend: edit a Photo's cat tags (uploader or Admin only)
- [x] Backend: MeetAndGreet CRUD (multi-cat reference + note), repeatable within a report
- [x] Backend: edit/delete permissions (author-only edit, Admin-only delete)
- [x] Backend: kennels-reset list on ShiftReport submit → sets each listed Kennel to `ready`
- [x] Backend: kennels-flagged list on ShiftReport submit (the reverse of reset) → sets each listed Kennel to `needs reset`; open to Volunteers, not Admin-gated, same as the reset list
- [x] Frontend: shift report creation flow — shift-level fields, repeatable cat entry, repeatable meet-and-greet — dedicated pages (`/shift-reports`, `/new`, `/:id`, `/:id/edit`) rather than a modal, given the form's size.
- [x] Frontend: structured pickers for fecal score (1–7) and food amount (none/some/all + free-fed) — `FecalScorePicker.tsx`, `FoodAmountPicker.tsx`.
- [x] Frontend: photo capture/upload UI (mobile camera-friendly; file picker on desktop) — inside cat entries and in the report-level Photos section, with an optional multi-cat tag picker — `PhotoUploadSection.tsx`; two-phase submit (JSON save, then per-file multipart upload) since photos need a real `shiftReportId`/`catEntryId` to attach to.
- [x] Frontend: read-only kennel-status summary shown in the report (all kennels, current state)
- [x] Frontend: "kennels reset" multi-select tied to Kennel state
- [x] Frontend: "kennels flagged" multi-select (reverse of reset) tied to Kennel state
- [x] Frontend: Play section — evolved from a single free-text note into repeatable "Play Groups" (cats + a note per group, ≥1 cat required), per a post-launch UI refinement request; `CatMultiSelect.tsx` extracted from `CreateGroupForm.tsx`'s inline pattern, and `CatNoteGroupList.tsx` extracted to drive both Play Groups and Meet & Greets from one component once their shapes matched exactly.
- [x] Wire dewormer-given in a CatEntry to clear the Cat's dewormer-due flag
- [x] Frontend: roster "Overdue" indicator on the Probiotic column once 24h pass since the last logged probiotic-given entry (same pattern as Phase 3's dewormer Overdue badge, now backed by real CatEntry data)

## Phase 5 — Status & announcements
Goal: cat/kennel state transitions are structured, not free text, and surface as announcements.

- [ ] Backend: Cat status transitions (`available` → `pending adoption` → `adopted` → `picked up`, fallthrough `pending adoption` → back to `available`)
- [ ] Backend: pickup date/time field on pending adoption — the raw `pickupAt` field itself was exposed early, in Phase 3's `CatForm`/`CatsTable` (editable regardless of status, since status transitions don't exist yet); this bullet is about gating/using it properly once they do
- [ ] Backend: `adopted` → `picked up` transition — the one status change a Volunteer can also make (not just Admin), via Confirm pickup below; marks the cat's kennel `needs reset` and resolves the pending-adoption/adopted Announcement
- [ ] Backend: Confirm pickup — a SignTask-like open/done/cancelled record (exact shape TBD; likely extends SignTask or mirrors KennelMoveRequest) surfaced per shift report for every `adopted` cat with a scheduled pickup; completing it performs the `picked up` transition above
- [ ] Backend: Kennel `planned` state — a 4th, plain Admin-settable `KennelState` value (no linked data), alongside the existing Ready/Occupied/NeedsReset CRUD from Phase 3
- [ ] Backend: SignTask auto-created on status change (pending → post pending, adopted → post adopted, back available → remove pending), with superseding/cancel rules (incl. Returned to RCC)
- [ ] Backend: check off a SignTask from a shift report (records user/time/report)
- [ ] Backend: "Returned to RCC" action (deactivate cat, mark kennel `needs reset`, optional Admin-only reason)
- [x] Backend: Admin sets/clears a Cat's `needs-probiotic` flag (set manually after diarrhea is reported; only an Admin clears it, once resolved — not cleared by logging a dose) — built ahead of schedule as a plain checkbox in Phase 3's Cat CRUD form (`CatForm.tsx`), since there was no other Admin-facing control for it; the "triggered by a shift report" input path still arrives with Phase 4/5.
- [ ] Backend: Announcement creation on each triggering event (new arrival, pending/adopted, back available, returned to RCC)
- [ ] Backend: KennelPrepChecklist + ordered ChecklistAction creation (Admin-only)
- [ ] Backend: checklist action check-off enforcing in-order completion, updating roster state as actions complete
- [ ] Backend: announcement resolution rules (24h default for informational types; open-until-resolved for pending adoption/adopted, back available with a remove-sign task, checklists, and kennel move requests; includes SignTask completion)
- [ ] Backend: KennelMoveRequest creation (Admin-only, independent of a checklist) + triggering Announcement
- [ ] Backend: check off a KennelMoveRequest from a shift report (performs the move — updates the Cat/Group's kennel — marks the vacated kennel `needs reset`, and resolves the announcement)
- [ ] Frontend: Admin controls for status changes, return-to-RCC, checklist creation, and kennel move requests
- [ ] Frontend: Volunteer checklist check-off UI (next-action-only enabled)
- [ ] Frontend: "Signs to post" section in the shift report form — open sign tasks with checkboxes; hidden when none
- [ ] Frontend: "Kennel moves" section in the shift report form — open move requests with checkboxes; hidden when none
- [ ] Frontend: "Confirm pickup" section in the shift report form — scheduled pickups with checkboxes; hidden when none
- [ ] Frontend: `planned` as a selectable Kennel state in `KennelForm`
- [ ] Frontend: announcement feed — default (24h/unresolved) view + "view all"

## Phase 6 — Reporting & lookup
Goal: past data is easy to find without reading an inbox.

- [ ] Backend: search/filter shift reports by cat, date, kennel
- [ ] Backend: per-cat aggregated history endpoint (fecal/pee/food + their notes, behavior, medical, other notes, meet-and-greets, tagged play notes, tagged photos over time)
- [ ] Backend: photo query endpoint — filter by cat or unassigned (no tags), newest first
- [ ] Backend: Admin-only photo download — single original file (named by date, shift type, and tagged cat name(s) or "unassigned"), and bulk zip of a filtered set (by cat / unassigned)
- [ ] Backend: `ActivityLog` model (entity type, entity id, action, actor, timestamp, description) + write hooks in the Cat and Kennel routes (`backend/src/routes/cats.ts`, `kennels.ts`) so every create/edit/delete on those two gets recorded going forward (mutations made before this lands aren't backfilled — there's nothing to reconstruct them from beyond each row's own `updatedAt`)
- [ ] Backend: Admin-only per-cat / per-kennel activity-history endpoint
- [ ] Frontend: shift report search/browse UI
- [ ] Frontend: cat history/profile view combining roster info (incl. bonded-pair and sibling/Litter info) + report history
- [ ] Frontend: photo browse view — cat filter + unassigned filter, link to source report, inline tag editing
- [ ] Frontend: Admin download controls in photo browse — per-photo download + "download all (zip)" for the current filter
- [ ] Frontend: Admin-only activity-history view on the cat/kennel detail views (from Phase 3)

## Phase 7 — Email notifications
Goal: the Google Group keeps receiving what it receives today, without anyone re-typing it.

- [ ] Integrate SendGrid in backend
- [ ] Email templates for the six Announcement-triggered event types (new arrival, pending/adopted incl. pickup time, back available, returned to RCC, checklist assigned, kennel move requested)
- [ ] Hook email send into the same Announcement-creation events from Phase 5 (single trigger point)
- [ ] Email template + trigger for the seventh type, "shift report submitted" (full outline of the report's fields, mirroring the in-app content in plain text, no photos) — sent directly on ShiftReport creation rather than via Announcement, since submitting a report doesn't create one; for a split-shift report, this email covers only the cats that volunteer logged
- [ ] Send-failure handling/logging (so a bounced email doesn't silently fail)

## Phase 8 — PWA, mobile & desktop polish
Goal: it works like an app on a volunteer's phone, and is equally usable in a desktop browser.

- [x] Service worker + manifest scaffolding via `vite-plugin-pwa` (Phase 0) — `registerType: "autoUpdate"`, theme/background colors set per the Design/Branding section
- [ ] Real manifest icons, once brand assets are available from the org
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
