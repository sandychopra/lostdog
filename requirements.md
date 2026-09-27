# Requirements Specification — Shift Report App

This document restates `project-scope.md` in standard requirements-specification language: numbered, atomic, testable "shall" statements, organized by feature area. It is the formal spec derived from that doc's narrative description; it does not replace it.

## 1. Introduction

### 1.1 Purpose
Define what the Lost Dog and Cat Rescue Foundation shift-report app must do, in a form suitable for tracking implementation status, writing test cases, and reviewing scope decisions — independent of the "why" narrative.

### 1.2 Scope
Covers the MVP as described in `project-scope.md`: shift reporting, the cat/kennel roster, status & announcements, reporting/lookup, and email notifications, for a single PetSmart adoption site.

### 1.3 References
- `project-scope.md` — problem statement, solution rationale, and full narrative feature description. Read this for *why* a requirement exists or how it was arrived at; this document only states *what* the system must do.
- `implementation-plan.md` — phased build order and per-item checkbox status; the source for this document's status tags.
- `Tech-Stack.md` — the technology choices referenced in the Non-Functional Requirements section.
- `CLAUDE.md` — current phase status and codebase orientation.

### 1.4 Status Legend
Each requirement is tagged with its current implementation status, as of 2026-09-27 (Phases 0–4 of `implementation-plan.md` complete):
- ✅ **Implemented**
- 🟡 **Partially implemented** — see the inline note
- ⬜ **Not yet implemented**

Status tags are a point-in-time snapshot, not part of the requirement itself, and will drift out of date as later phases land — re-check against `implementation-plan.md` before relying on one.

### 1.5 Glossary
- **Cat** — a persistent roster record for one animal at this site.
- **Group** — two or more Cats housed/fostered together in one Kennel, reported on jointly (with per-cat detail where needed).
- **Litter** — two or more Cats tagged as siblings; independent of Group/Kennel, purely informational.
- **Kennel** — a numbered physical enclosure; tracks its occupant and state.
- **ShiftReport** — one Volunteer's structured report for one shift (Morning/Mid-day/Evening) on one date.
- **CatEntry** — a per-cat (or per-group) record within a ShiftReport.
- **Sign Task / Kennel Move Request / Kennel Prep Checklist** — system- or Admin-created action items that surface in later shift reports until completed.
- **Announcement** — a structured, in-app notice of a roster/status event, replacing an ad hoc email thread.
- **RCC** — the organization's facility a cat is transferred to when it can no longer stay at this site (e.g. for observation); returning a cat to the RCC removes it from this site's active roster.
- **Overdue** — a derived roster indicator (dewormer or probiotic) shown once a due date or 24-hour dosing window has passed without the corresponding action being logged.

## 2. Actors

| Actor | Description |
|---|---|
| **Volunteer** | Logs shift reports; the primary day-to-day user. |
| **Admin** | Everything a Volunteer can do, plus roster management, status/announcement changes, user management, and audit history. |

There are no actors beyond these two in MVP; people who need read-only visibility outside the app (fosters, front-desk staff) are reached via the existing Google Group email, not an in-app account.

## 3. Functional Requirements

### 3.1 Roles & Permissions

| ID | Requirement | Status |
|---|---|---|
| FR-1 | The system shall support exactly two user roles: Volunteer and Admin. | ✅ |
| FR-2 | A Volunteer shall be able to create and edit shift reports they authored. | ✅ |
| FR-3 | A Volunteer shall not be able to delete any shift report, including their own. | ✅ |
| FR-4 | An Admin shall be able to edit or delete any shift report, regardless of author. | ✅ |
| FR-5 | A Volunteer shall be able to add, change, or remove cat tags only on photos they uploaded. | ✅ |
| FR-6 | An Admin shall be able to add, change, or remove cat tags on any photo. | ✅ |
| FR-7 | A Volunteer shall be able to view photos in the app but shall not be able to download them. | ⬜ |
| FR-8 | An Admin shall be able to download any single photo at full resolution, or a bulk zip of a filtered set of photos. | ⬜ |
| FR-9 | A Volunteer shall be able to check off any open Sign Task from their own shift report. | ⬜ |
| FR-10 | A Volunteer shall be able to confirm a cat's pickup (the `adopted` → `picked up` transition) — the one status transition a Volunteer may trigger. | ⬜ |
| FR-11 | An Admin shall be able to manage the Cat/Kennel roster, including adding cats, assigning kennels, and recording intake. | ✅ |
| FR-12 | An Admin shall be able to post status changes and announcements. | ⬜ |
| FR-13 | An Admin shall be able to create, list, edit, and soft-delete Volunteer and Admin user accounts. | ✅ |
| FR-14 | An Admin shall be able to view the Cat and Kennel activity history. | ⬜ |
| FR-15 | The system shall not provide public self-registration; every account shall be created by an Admin. | ✅ |
| FR-16 | The system shall support no user roles beyond Volunteer and Admin in MVP. | ✅ |

### 3.2 Authentication & User Management

| ID | Requirement | Status |
|---|---|---|
| FR-17 | The system shall authenticate users via email and password credentials. | ✅ |
| FR-18 | The system shall maintain authentication state via database-backed sessions, not client-only tokens. | ✅ |
| FR-19 | A user shall be able to log out, invalidating their current session. | ✅ |
| FR-20 | The system shall gate every route/action by the authenticated user's role. | ✅ |
| FR-21 | Deleting a user account shall be a soft delete: the account is marked deleted, blocking further login, while the account record and all past shift reports remain intact and attributed to that user. | ✅ |
| FR-22 | A soft-deleted user's existing sessions shall be invalidated immediately. | ✅ |

### 3.3 Cat & Kennel Roster

| ID | Requirement | Status |
|---|---|---|
| FR-23 | The system shall maintain a persistent Cat profile referenced by shift reports, rather than free-typed cat names. | ✅ |
| FR-24 | New-cat intake shall capture: name, age (years and months), sex, color/pattern (picklist plus "Other" free text), collar color, microchip number (optional), kennel assignment, and dewormer-due status with a due date. | ✅ |
| FR-25 | The system shall support intake of two cats arriving together into the same kennel, modeled as a Group. | ✅ |
| FR-26 | A Kennel shall track its current occupant (a Cat, a Group, or none) and one of four states: `ready`, `occupied`, `needs reset`, or `planned`. | 🟡 — `ready`/`occupied`/`needs reset` ✅; `planned` ⬜ |
| FR-27 | The `planned` Kennel state shall be a plain, Admin-settable label with no linked data (not tied to a specific cat or date). | ⬜ |
| FR-28 | A Cat's dewormer status shall be visible on its roster entry, showing `Overdue` instead of `Due` once its due date has passed. | ✅ |
| FR-29 | Marking a Cat's dewormer as given shall permanently clear the due flag; the due date shall remain as a historical record. | ✅ |
| FR-30 | An Admin shall be able to manually set a Cat's "needs probiotic" flag (not set at intake). | ✅ |
| FR-31 | While a Cat's "needs probiotic" flag is set, every shift report's cat entry for that Cat shall present a "probiotic given" checkbox, on any shift type. | ✅ |
| FR-32 | Checking "probiotic given" shall log that dose but shall not clear the "needs probiotic" flag; only an Admin shall be able to clear it. | ✅ |
| FR-33 | A Cat's roster entry shall show an `Overdue` indicator for "needs probiotic" once 24 hours have passed since its most recently logged dose (or since the flag was set, if no dose has been logged), derived from shift-report entry history. | ✅ |
| FR-34 | An Admin shall be able to flag a Group of exactly two Cats as a `bonded` pair; this flag shall be informational only and shall not block splitting the pair across kennels. | ✅ |
| FR-35 | The `bonded` flag shall be automatically cleared when its Group dissolves or is resized. | ✅ |
| FR-36 | An Admin shall be able to tag two or more Cats as siblings (a Litter), independent of their current Group or Kennel assignment; this tag shall be purely informational. | ✅ |

### 3.4 Shift Reports

| ID | Requirement | Status |
|---|---|---|
| FR-37 | The system shall allow at most one shift report per Volunteer per (shift type, date) combination, tagged with shift type (`Morning`/`Mid-day`/`Evening`) and date. | ✅ |
| FR-38 | A shift report shall support a split-shift flag, available only for `Morning` and `Evening` shift types. | ✅ |
| FR-39 | When flagged as a split shift, a report shall log cat entries only for the cats that volunteer personally cared for; the system shall not formally link the two volunteers' reports and shall not prevent the same cat appearing in both. | ✅ |
| FR-40 | Shift-level fields (kennels reset, kennels flagged, cleaning, supplies, play, other notes) shall be loggable by either volunteer on a split shift, without per-cat restriction. | ✅ |
| FR-41 | A shift report shall display a read-only summary of every Kennel's current state as reference while reporting. | ✅ |
| FR-42 | A shift report shall present a "kennels ready" multi-select; checking a kennel and submitting the report shall set that Kennel's state to `ready`. | ✅ |
| FR-43 | A shift report shall present a "kennels flagged" multi-select (the reverse of ready); checking a kennel and submitting the report shall set that Kennel's state to `needs reset`. | ✅ |
| FR-44 | A shift report shall support zero or more repeatable cat entries, each either an Individual entry or a Group entry. | ✅ |
| FR-45 | An Individual cat entry shall capture: fecal score, pee flag, pee/poo notes, dry food amount with a free-fed flag, wet food amount with brand (defaulting to Hill's, prompting only when different), snack/treat selection with note, food notes, a medical section (general notes, a dewormer-given action when due, a probiotic-given checkbox when flagged), behavior notes, other notes, a nail-trim flag, and zero or more photos. | ✅ |
| FR-46 | A Group cat entry shall capture group-shared fields (fecal score, pee flag, pee/poo notes, dry food amount, water, food notes, other notes) and, per cat in the group, individual fields (wet food amount with brand, snack/treat, food notes, medical section, behavior notes, other notes, nail-trim flag, photos). | ✅ |
| FR-47 | Marking dewormer-given in a cat entry shall clear that Cat's dewormer-due flag. | ✅ |
| FR-48 | A photo uploaded within a cat entry (individual, or per-cat within a group) shall be automatically tagged with that cat. | ✅ |
| FR-49 | A shift report shall provide a report-level Photos section for photos not tied to a specific cat entry; each such photo shall be taggable with zero or more cats, or left unassigned. | ✅ |
| FR-50 | A photo's cat tags shall be editable after upload — by the uploader or by an Admin — for both report-level and cat-entry photos, including after submission. | ✅ |
| FR-51 | Fecal score shall be captured via a structured picker: a 1–7 scale plus a "none" option. | ✅ |
| FR-52 | Food amount shall be captured via a structured picker: none/some/all, plus a free-fed flag. | ✅ |
| FR-53 | Pee shall be captured as a simple yes/none flag, with no quality scale. | ✅ |
| FR-54 | A shift report shall support shift-level fields not tied to any single cat: cleaning performed, supplies restocked, and general other notes. | ✅ |
| FR-55 | A shift report shall support a Play section: free-text play notes optionally tagged with one or more cats from the active roster; a tagged note shall surface in each tagged cat's report history. | ✅ |
| FR-56 | A shift report shall support one or more repeatable meet-and-greet entries, each referencing one or more cats plus a free-text context/outcome note. | ✅ |
| FR-57 | A shift report shall display a "Signs to post" section listing every open Sign Task, hidden when none are open; checking one off shall record who/when/on which report and shall close the task. | ⬜ |
| FR-58 | An open Sign Task not checked off shall carry over into every later shift report until it is checked off. | ⬜ |
| FR-59 | A shift report shall display a "Kennel moves" section listing every open Kennel Move Request, hidden when none are open; checking one off shall move the referenced Cat/Group, mark the vacated Kennel `needs reset`, and close the request. | ⬜ |
| FR-60 | An open Kennel Move Request not checked off shall carry over into every later shift report until it is checked off. | ⬜ |
| FR-61 | A shift report shall display a "Confirm pickup" section listing every Cat that is `adopted` with a scheduled pickup date/time, hidden when none are scheduled; checking one off shall mark the Cat `picked up`, reset its Kennel, and resolve the related Announcement. | ⬜ |
| FR-62 | A shift report shall be editable only by its author or by an Admin. | ✅ |

### 3.5 Status & Announcements

| ID | Requirement | Status |
|---|---|---|
| FR-63 | A Cat's status shall follow the sequence `available` → `pending adoption` → `adopted` → `picked up`, with `pending adoption` able to fall through back to `available`. | ⬜ |
| FR-64 | A Cat shall be `available` immediately upon being added to the roster; there shall be no separate "new arrival" status. | 🟡 — cats are created as active roster entries today ✅; the formal status field/lifecycle is not yet implemented ⬜ |
| FR-65 | Status changes shall be Admin-only, except the `adopted` → `picked up` transition, which a Volunteer may also trigger via Confirm pickup. | ⬜ |
| FR-66 | A `pending adoption`/`adopted` Cat may carry an optional scheduled pickup date/time. | 🟡 — field exists on the Cat record ✅; gating by status transitions not yet implemented ⬜ |
| FR-67 | The `adopted` → `picked up` transition shall mark the Cat's Kennel `needs reset` and shall resolve the related pending-adoption/adopted Announcement. | ⬜ |
| FR-68 | A meet-and-greet outcome shall never automatically change a Cat's status; it shall only be logged as a note. | ✅ |
| FR-69 | The system shall automatically create a Sign Task on a Cat status change: post the Adoption Pending sign on `→ pending adoption`; post the Adopted sign on `→ adopted`; remove the Adoption Pending sign on a fallthrough `→ available`. | ⬜ |
| FR-70 | A new status change, or a Returned-to-RCC action, shall cancel any still-open Sign Task for that Cat. | ⬜ |
| FR-71 | A "remove sign" Sign Task shall be created only if the corresponding sign had actually been posted. | ⬜ |
| FR-72 | There shall be no separate Sign Task for removing the Adopted sign; its removal shall be part of resetting the Kennel after pickup. | ⬜ |
| FR-73 | Sign Tasks shall be system-created only; a Volunteer or Admin shall not be able to create one directly. | ⬜ |
| FR-74 | The system shall support a "Returned to RCC" action that deactivates the Cat (removes it from the active roster) and marks its Kennel `needs reset`. | ⬜ |
| FR-75 | The "Returned to RCC" action shall support an optional Admin-only free-text reason, which shall not be shown to Volunteers. | ⬜ |
| FR-76 | A cat re-admitted after Returned-to-RCC shall be entered as a new Cat record rather than reactivating the prior one. | ⬜ |
| FR-77 | The system shall support six Announcement types, visible to all Volunteers, separate from shift reports: new cat arrival; pending adoption/adopted/back available; returned to RCC; kennel prep checklist assigned; kennel move requested. | ⬜ |
| FR-78 | An Admin shall be able to create a Kennel Prep Checklist tied to an expected arrival or pickup, composed of an ordered list of actions (`reset kennel` \| `move cat to kennel`). | ⬜ |
| FR-79 | A Volunteer shall be able to check off Checklist Actions only in order; only the next incomplete action shall be eligible to be marked done. | ⬜ |
| FR-80 | A "move cat to kennel" Checklist Action shall move only that cat/group; it shall not automatically flag the vacated kennel as needing reset unless that is added as its own explicit step. | ⬜ |
| FR-81 | An Admin shall be able to create a Kennel Move Request, independent of any Checklist, referencing one Cat or Group, a source Kennel, and a destination Kennel. | ⬜ |
| FR-82 | Checking off a Kennel Move Request shall automatically mark its source Kennel `needs reset` (unlike a Checklist, which requires an explicit reset step). | ⬜ |
| FR-83 | The default Announcement view shall show only announcements from the last 24 hours for purely informational types (new cat arrival, returned to RCC). | ⬜ |
| FR-84 | An Announcement with an open action shall remain in the default view regardless of age, until it is resolved. | ⬜ |
| FR-85 | A pending-adoption/adopted Announcement shall remain open until its Cat is marked `picked up`, its Kennel is marked reset, and it has no open Sign Task — all three conditions required. | ⬜ |
| FR-86 | A Kennel Prep Checklist Announcement shall remain open until every Checklist Action on it is checked off. | ⬜ |
| FR-87 | A Kennel Move Request Announcement shall remain open until the request is completed or cancelled. | ⬜ |
| FR-88 | A "back available" Announcement shall remain open until its remove-sign Sign Task (if any) is checked off; otherwise it shall follow the 24-hour default rule. | ⬜ |
| FR-89 | The system shall not automatically expire or purge Announcements in MVP; a "view all" option shall always show every Announcement regardless of the default-view filter. | ⬜ |

### 3.6 Reporting & Lookup

| ID | Requirement | Status |
|---|---|---|
| FR-90 | The system shall support viewing and searching past shift reports by cat, date, or kennel. | ⬜ |
| FR-91 | The system shall provide a single view of one Cat's report history, aggregating fecal/pee/food data and notes, behavior notes, medical notes, other notes, meet-and-greets, tagged play notes, and tagged photos over time. | ⬜ |
| FR-92 | The system shall provide a Photo Browse view across all shift reports, newest first, filterable by cat or by "unassigned" (no tags). | ⬜ |
| FR-93 | An inactive (returned-to-RCC) Cat shall remain selectable in the Photo Browse and report-history cat filters. | ⬜ |
| FR-94 | Each photo in Photo Browse shall link back to its source shift report (date, shift type, uploader), and shall support inline tag editing by its uploader or an Admin. | ⬜ |
| FR-95 | An Admin shall be able to download any single photo at original full resolution, or a bulk zip of every photo matching the current Photo Browse filter. | ⬜ |
| FR-96 | Downloaded photo filenames shall include date, shift type, and tagged cat name(s), or "unassigned" if untagged. | ⬜ |
| FR-97 | The system shall record every create, edit, and delete on a Cat or a Kennel as an ActivityLog entry (entity type, entity id, action, actor, timestamp, description). | ⬜ |
| FR-98 | An Admin shall be able to view a per-Cat or per-Kennel activity history as an audit trail. | ⬜ |

### 3.7 Email Notifications

| ID | Requirement | Status |
|---|---|---|
| FR-99 | The system shall send an individual (non-batched) email per event, to a single existing Google Group address, for each of: new cat arrival; status change to pending adoption/adopted (including scheduled pickup date/time, when set); back available; returned to RCC; new kennel prep checklist assigned; new kennel move requested; shift report submitted. | ⬜ |
| FR-100 | A "shift report submitted" email shall contain a full outline of the report's fields (all cat/group entries, shift-level fields, meet-and-greets), mirroring the in-app content in plain text, excluding photos. | ⬜ |
| FR-101 | A split-shift report shall trigger its own separate email, covering only the cats that volunteer logged. | ⬜ |
| FR-102 | The system shall not support per-user notification opt-in/opt-out, nor push notifications, in MVP. | ⬜ |

## 4. Data Requirements

Each entity's required attributes and key constraints. See `project-scope.md`'s Data model section for the full rationale behind each field.

| ID | Entity | Required attributes | Key constraints |
|---|---|---|---|
| DR-1 | **User** | name, email, role (`Volunteer`\|`Admin`), password, soft-delete timestamp | Created only by an Admin; soft-deleted user cannot log in but record/reports persist. |
| DR-2 | **Cat** | name, age at intake (years+months), sex, color/pattern (+ "Other"), collar color, microchip number (optional), current kennel/group, status, scheduled pickup date/time (optional), dewormer status + due date, needs-probiotic flag, litter reference (optional), active flag | Microchip number not unique (re-admitted cats are new records). Inactive Cats keep all past report history viewable. |
| DR-3 | **Group** | member Cats, shared kennel, bonded flag | Bonded settable only on a Group of exactly two Cats. Dissolves to an Individual when only one Cat remains; bonded flag clears on dissolve/resize. |
| DR-4 | **Litter** | two or more member Cats | Independent of Group/Kennel; purely informational. |
| DR-5 | **Kennel** | number, current occupant (Cat, Group, or none), state (`occupied`\|`needs reset`\|`ready`\|`planned`) | State driven by roster events, Admin edit, or a volunteer's shift-report action; `planned` has no linked data and no automatic transition. |
| DR-6 | **ShiftReport** | author, shift type, date, split-shift flag, kennels reset/flagged lists, cleaning/supplies/other notes, play notes + tagged Cats, report-level Photos, checked-off Sign Tasks, confirmed-pickup Cats, created/edited timestamps | Editable only by its author or an Admin. |
| DR-7 | **CatEntry** | reference to one Cat (individual) or one Group; per-type field set (see FR-45/FR-46) | Belongs to exactly one ShiftReport. |
| DR-8 | **Photo** | storage reference (S3-compatible object key), uploader, uploaded-at timestamp, optional CatEntry reference, tagged Cats (zero or more) | Belongs to a ShiftReport. Original full-resolution file always retained. Untagged photo is "unassigned." |
| DR-9 | **MeetAndGreet** | one or more referenced Cats, free-text note | Belongs to a ShiftReport; surfaces on each referenced Cat's history. |
| DR-10 | **KennelPrepChecklist** | ordered list of ChecklistActions | Created by an Admin; tied to an expected arrival or pickup. |
| DR-11 | **ChecklistAction** | type (`reset kennel`\|`move cat to kennel`), target Kennel, target Cat/Group (when moving), completed flag, completed by/at | Belongs to a KennelPrepChecklist; only the next incomplete action may be completed. |
| DR-12 | **Announcement** | type, reference to related Cat/Kennel/Checklist, timestamp, resolved flag, notification-sent flag | Resolution rules per FR-83–FR-89. |
| DR-13 | **SignTask** | Cat, Kennel at creation time, action (`post pending`\|`post adopted`\|`remove pending`), triggering Announcement, state (`open`\|`done`\|`cancelled`), completed by/at, ShiftReport it was closed on | System-created only. |
| DR-14 | **KennelMoveRequest** | referenced Cat/Group, source Kennel, destination Kennel, optional reason note, state (`open`\|`done`\|`cancelled`), completed by/at, ShiftReport it was closed on, triggering Announcement | Created by an Admin only. |
| DR-15 | **ActivityLog** | entity type, entity id, action (`create`\|`update`\|`delete`), actor, timestamp, description | Written automatically by Cat and Kennel routes; extensible to future entities; Admin-viewable only. |

## 5. Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-1 | The system shall be a mobile-first, installable Progressive Web App, usable in a phone browser without an app-store submission. | 🟡 — manifest/service worker scaffolded ✅; real icons and install verification on real devices pending ⬜ |
| NFR-2 | The system shall be fully usable in a desktop/laptop web browser, with the same features at every screen size and a responsive layout that makes use of a wider screen where it helps (e.g. roster grid, report search, photo browse). | 🟡 — core screens responsive today ✅; a dedicated cross-screen-size polish pass is planned but not yet done ⬜ |
| NFR-3 | On a computer, photo upload shall use a standard file picker rather than a phone camera capture flow. | ✅ |
| NFR-4 | The system shall be scoped to a single site (one kennel-numbering scheme) in MVP, with no Site entity. | ✅ (true by omission — no multi-site concept exists) |
| NFR-5 | The system shall authenticate via hashed credentials with database-backed sessions (via Better Auth's Prisma adapter), not JWTs or a separate session store. | ✅ |
| NFR-6 | The system shall enforce role-based access control (Volunteer vs. Admin) server-side on every relevant route, not only in the UI. | ✅ |
| NFR-7 | Photo binaries shall be stored in S3-compatible object storage (Cloudflare R2 in production), with Postgres holding only metadata/references; the original full-resolution file shall always be retained. | ✅ (local-disk storage in dev behind a swappable `PhotoStorage` interface, per `Tech-Stack.md`) |
| NFR-8 | The application's visual design shall reflect the Lost Dog & Cat Rescue Foundation's brand (color palette, typography, button styling, logo), per `project-scope.md`'s Design/Branding section. | ⬜ — a design decision only so far; no feature UI has been themed yet, and real logo assets are still pending from the organization |
| NFR-9 | The system shall be deployed via Docker to a managed container platform, backed by managed Postgres and an S3-compatible bucket. | ⬜ — deferred to `implementation-plan.md` Phase 9 by design; only a local Postgres container is used in development today |

## 6. Explicitly Out of Scope (MVP)

The following are deliberately excluded from MVP and are not tracked as requirements above. Carried forward from `project-scope.md` so scope decisions aren't silently lost:

- Native iOS/Android apps
- Full adoption application intake/CRM (meet-and-greets stay a simple cats + note entry)
- Push notifications (email is used instead)
- Per-user notification preferences (opt-in/opt-out)
- Per-shift-targeted notifications (e.g. only notify the next shift)
- Digest/batched emails
- Long-term announcement expiration/purging (beyond the 24-hour default / unresolved-item filtering)
- Advanced analytics/dashboards beyond basic report lookup and per-cat history
- Offline mode
- A structured end-of-shift checklist (cleaning stays a free-text field)
- A standing list of reminders/guidelines shown to volunteers
- Ad-hoc, free-form announcements with a creator-set expiration date
- Multi-site support (Site entity, per-site kennel numbering)
- A fallback shift-report path for volunteers without a smartphone

## 7. Document Maintenance

This document should be updated whenever `project-scope.md` changes in a way that adds, removes, or alters a requirement, and its status tags should be refreshed as `implementation-plan.md` checkboxes are completed. If the two documents disagree, `project-scope.md` is authoritative for intent; this document should be corrected to match.
