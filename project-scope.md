## Problem

Lost Dog and Cat Rescue Foundation runs its day-to-day PetSmart adoption-site operations almost entirely over email. Shift reports, new-cat arrival announcements, adoption status updates, return-to-RCC notices, and kennel-prep instructions all arrive as separate, ad hoc email threads. There's no single place to check "what's the current state of this cat / this kennel" — the truth is scattered across whichever inbox happened to receive the most recent relevant email, formatted a little differently each time, and easy to lose track of as threads pile up. That fragmentation and lack of a central source of truth is the real problem; the shift report is just its biggest, most frequent example.

Volunteers work two-hour shifts (Morning, Mid-day, Evening) and currently submit a shift report by email at the end of each shift. A typical report covers:

- Kennels ready/reset for a new occupant
- Fecal scores
- Food intake (dry/wet, amount eaten)
- Medical notes
- Play group behavior/temperament notes
- Cleaning performed
- Nail trims
- Meet-and-greets
- Supplies used/restocked
- Other notes (e.g. adoption signage posted)
- Photos, attached to the email

Even though volunteers try to follow a shared format, every report ends up structured a little differently. This makes it cumbersome for the next shift, other volunteers, and staff to quickly find the information they need (open kennels, a specific cat's condition, what happened during a meet-and-greet). There is also no structured history of a given cat's condition or behavior over time — it's scattered across individual emails. Status changes (new arrivals, pending adoption, adopted, kennel resets) live inside free-text notes instead of being tracked as real state.

The same fragmentation shows up in the other email threads this project needs to address:

- New cat arrival announcements (name, age, sex, color/pattern, collar color, kennel — sometimes a pair arriving into the same kennel)
- Pending adoption / adopted announcements, sometimes including a scheduled pickup time
- Notifications that a cat is returning to the RCC (e.g. for observation) and is no longer at this location
- Kennel prep instructions ahead of an arrival or pickup, often chaining several actions together (e.g. "reset kennel 5, move Pepsi to kennel 5, then reset kennel 6")

Individually each of these threads is small, but together they add up to real operational cost: information that should be centralized and quickly scannable is instead spread across an inbox, inconsistently formatted, and easy to miss. They also all revolve around the same underlying state — a cat's status and a kennel's occupancy — which today lives only inside prose, nowhere structured.

## Solution

A mobile-first web app (PWA) that centralizes this operational information in one place instead of an inbox, starting with the shift report — the largest and most frequent source of email — and the related cat/kennel status threads, since they share the same underlying data. Volunteers use it on their phone to log a structured shift report in place of the email; volunteers and staff use it to look up recent reports and current cat/kennel status without searching through email threads and attachments.

This is the first iteration toward centralizing rescue-operations communication generally; MVP scope is deliberately limited to what's detailed in Features below, with the shift report as close to a 1:1 structured replacement of the email as possible, so the format is consistent and the data becomes usable (searchable, reportable, attributable to a specific cat over time) instead of just readable.

Two roles for MVP:
- **Volunteer** — create and edit their own shift reports.
- **Admin** — everything a Volunteer can do, plus edit/delete any report, manage the cat/kennel roster, post status changes and announcements, and manage user accounts.

## Features

### Shift reports
- One report per volunteer per shift, tagged with shift type (Morning / Mid-day / Evening) and date.
- Kennels ready/reset for a new occupant — list of kennel numbers.
- Repeatable cat entry within the report, one of two types:
  - **Individual entry** — fecal score, food (dry amount + free-fed flag; wet amount + wet food brand, defaulting to Hill's and only requiring a pick when it's different), snack/treat (Churu, Greenies, other + note), medical section (general medical notes, plus a "dewormer given" action when one is due), play/behavior notes, nail trim flag, photo(s).
  - **Group entry** — for cats housed/fostered together (e.g. "Sprite/Pepsi/Nehi"), since some things can't be attributed to one cat in the group:
    - Shared across the group: fecal score, dry food amount, water. (Dry food is always the same brand, so brand isn't tracked for dry.)
    - Individual per cat in the group: wet food amount + brand (default Hill's), snack/treat, medical section (notes + dewormer given), behavior/play notes, photo(s).
- A cat entry's medical section flags when a dewormer is due (see Cat & kennel roster below); marking it "given" during a shift clears the flag. Dewormer is a one-time treatment — once given, there's no future due date to track.
- Shift-level fields (not tied to one cat): cleaning performed, supplies restocked, meet-and-greets (which cat, context), general "other" notes.
- Fecal score and food amount use structured pickers (e.g. a scale for fecal score; none/some/most/all + free-fed flag for food) with an optional free-text note for anything unusual — keeps data consistent while still allowing detail.
- Photo upload attached to a cat entry (individual or per-cat within a group).

### Roles & permissions
- **Volunteer**: create/edit own reports only.
- **Admin**: edit/delete any report; manage the cat/kennel roster (add cats, assign/retire kennels, intake); post status changes and announcements; manage volunteer/admin user accounts.
- Each user has an active/inactive status, set by an Admin. An inactive user cannot log in — used for volunteers who have left, without deleting their account or their past reports.

### Cat & kennel roster
- Persistent cat profile that shift reports reference, instead of free-typing a cat's name each time — avoids inconsistency (e.g. name spelling/aliases) and enables per-cat history and reporting.
- New-arrival intake captures: name, age, sex, color/pattern, collar color, kennel assignment, and whether a dewormer is due (known at intake from the cat's existing paper notebook). Two cats can arrive together into the same kennel (modeled the same way as a shift-report group).
- Kennel tracks its current occupant(s) (single cat or group) and ready/reset state.
- A cat's dewormer-due status is visible on its profile/roster entry, replacing the current binder lookup volunteers do before each shift. Marking it given (from a shift report or the cat's profile) clears the flag for good — it's a one-time treatment, not a recurring schedule.

### Status & announcements
Replaces the other ad hoc email threads (new-cat, adoption, sick-return, kennel-prep) with structured, in-app notifications tied to the cat/kennel roster.
- Cat status field (`available` → `pending adoption` → `adopted`), updated by Admins. A cat is `available` as soon as it's added to the roster — there's no separate "new arrival" status, just an announcement posted at intake. `pending adoption` can revert back to `available` if an application falls through (e.g. it doesn't work out) — this posts a new "back available" announcement and resolves the earlier pending-adoption one.
- **Returned to RCC** is an action, not an ongoing status: it removes the cat from the active roster entirely (no further tracking at this location — if it comes back later it's re-entered like a new arrival) and marks its kennel `needs reset`. An optional free-text reason (e.g. "for observation") can be logged for the record, but volunteers only see that the kennel needs a reset, not the reason.
- Announcement types, visible to all volunteers, separate from a shift report:
  - New cat arrival
  - Pending adoption / adopted (with pickup date/time when scheduled) / back available (after a fallthrough)
  - Cat returned to RCC (kennel-needs-reset notice only; no reason shown)
- **Kennel prep checklist** — an Admin creates a short ordered list of kennel actions (reset a kennel, move a cat into a kennel) tied to an expected arrival or pickup, e.g. "reset kennel 5 → move Pepsi to kennel 5 → reset kennel 6." Volunteers see the checklist during their shift and check off each action as completed; the roster updates as actions are completed.
- **Default announcement view** shows only the last 24 hours, with a "view all" option to see everything. That 24-hour default only applies to purely informational announcements — new cat arrival and returned-to-RCC. Anything with an open action stays in the default view regardless of age until it's resolved:
  - Pending adoption / adopted: stays visible until the cat is marked adopted **and** its kennel is marked reset — both conditions required.
  - Kennel prep checklist: stays visible until every action on it is checked off.
  - Back-available and new-arrival-style announcements without an open action just follow the 24-hour rule.
- No automatic long-term expiration/purging of announcements in MVP (deferred — see Out of scope).

### Reporting / lookup
- View/search past shift reports by cat, date, or kennel, so the next shift can catch up without reading an email chain.
- View a single cat's report history in one place (fecal/food/behavior/medical over recent shifts).

### Email notifications
Sent to the existing Google Group already used for these communications today (not per-user addresses), individually per event (not batched), for:
- New cat arrival
- Status change to pending adoption / adopted (including a scheduled pickup date/time, when set)
- Returned to RCC (surfaces as a "kennel needs reset" notification)
- A new kennel prep checklist assigned

Whoever is a member of the Google Group receives these — membership, not an in-app preference, is what controls who gets notified for MVP. The email contains the full detail of the event, same as the in-app announcement. No push notifications, and no per-user opt-in/opt-out, in MVP.

## Data model / entities

- **User** — name, role (`Volunteer` | `Admin`), active/inactive status (inactive users cannot log in).

- **Cat** — name, age (at intake), sex, color/pattern, collar color, current kennel or group, status (`available` | `pending adoption` | `adopted` — `pending adoption` can revert to `available` on a fallthrough; a cat is `available` as soon as it's added to the roster, no separate "new arrival" status), scheduled pickup date/time (optional, set when pending adoption), dewormer status (`due` | `given`, set at intake from the cat's existing paper notebook; one-time, no recurring date), active flag. Set inactive (not deleted) when returned to RCC, with an optional Admin-only reason note; a re-admitted cat is entered again like a new arrival rather than reactivated.

- **Group** — a set of Cats housed/fostered together (e.g. "Sprite/Pepsi/Nehi"); shares one kennel and is the target of shared fields on a shift report entry. Used both for arrivals (a pair intake into one kennel) and shift reporting.

- **Kennel** — number, current occupant (a Cat, a Group, or empty), state (`occupied` | `needs reset` | `ready`).

- **ShiftReport** — author (User), shift type (`Morning` | `Mid-day` | `Evening`), date, kennels reset list, cleaning notes, supplies notes, meet-and-greet notes, other notes, created/edited timestamps. Editable only by its author, or by an Admin.

- **CatEntry** — belongs to a ShiftReport; references either one Cat (individual) or one Group.
  - Individual: fecal score, dry food amount + free-fed flag, wet food amount + brand (default Hill's), snack/treat, medical notes, dewormer-given flag (only relevant while the Cat's dewormer status is `due`), behavior/play notes, nail trim flag, photo(s).
  - Group: fecal score, dry food amount, and water logged once for the group (dry food brand is not tracked — always the same); wet food amount + brand, snack/treat, medical notes, dewormer-given flag, and behavior/play notes and photo(s) logged per Cat within the group.

- **KennelPrepChecklist** — created by an Admin, tied to an expected arrival or pickup; an ordered list of **ChecklistAction**s (`reset kennel` | `move cat to kennel`, target Kennel, target Cat/Group when moving, completed flag, completed by/at). Volunteers check actions off during a shift.

- **Announcement** — type (`new arrival` | `pending adoption` | `adopted` | `back available` | `returned to RCC` | `checklist assigned`), reference to the related Cat/Kennel/Checklist, timestamp, resolved flag, and whether a notification email was sent for it. `new arrival` and `returned to RCC` age out of the default view after 24 hours regardless of the resolved flag; `pending adoption`/`adopted` and `checklist assigned` stay in the default view until resolved (adopted + kennel reset, or all checklist actions complete) no matter how old they are. All types remain available via "view all."

## Platform

Mobile-first web app (PWA) — installable to the home screen, works in the phone browser, no app-store submission required. Fastest path to MVP and easiest to iterate on; a native app can be revisited later if offline support or app-store presence becomes a priority.

## Out of scope for MVP (backlog)

- Native iOS/Android apps
- Full adoption application intake/CRM (meet-and-greets are logged as a note, not a full workflow)
- Push notifications (MVP uses email instead)
- Per-user notification preferences (opt-in/opt-out) — MVP sends to the existing Google Group for everyone; individual control is a future enhancement
- Per-shift-targeted notifications (e.g. only notify the next shift) — MVP notifies the whole Google Group
- Digest/batched emails — MVP sends one email per event
- Long-term announcement expiration/purging (e.g. a hard 3-week cutoff) — MVP just filters the default view to 24 hours / unresolved items, with "view all" for everything else
- Advanced analytics/dashboards beyond basic report lookup and per-cat history
- Offline mode
- Structured end-of-shift checklist (e.g. cleaning tasks, "check locks before leaving") — MVP keeps cleaning as a free-text field on the shift report
- A standing list of reminders/guidelines shown to volunteers (e.g. "no toys in the kennel") — not part of MVP's shift-report flow
- Ad-hoc announcements — a free-form announcement an Admin (or volunteer) posts outside the fixed MVP types, with an expiration date the creator sets themselves, after which it drops out of the default view like the other announcement types

## Open questions

- Exact scale/values for fecal score and food-amount pickers (need real examples from more reports to nail down the options).
- Should meet-and-greet outcomes ever feed into adoption status automatically, or always stay a manual Admin update?
- Is this scoped to a single site's kennels (e.g. one PetSmart location), or does it need to support multiple satellite sites each with their own kennel numbering?
- Any volunteers without smartphones who still need a way to submit a report?
- Can a Volunteer flag a kennel-move need themselves, or is the kennel prep checklist always created by an Admin?
- Once a cat is returned to RCC and removed from the roster, should past shift reports that mention it remain viewable, or does it disappear from history too?
- Are there people outside the Volunteer/Admin roles (e.g. fosters, front-desk staff) who need to see these announcements/status changes?
- Does every notification type (new arrival, status change, RCC return, checklist assigned) go to the same Google Group, or do some already use a different list today?
- Who manages membership of the Google Group, and does the app need to know/display that list, or is it entirely external to the app?
