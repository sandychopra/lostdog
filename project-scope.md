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
- **Split shift** — Morning and Evening shifts are sometimes split between two volunteers, who divide up the cats between them (the first volunteer picks which kitties they'll cover; the second covers the rest). A volunteer flags their report as a split shift and then only logs cat entries for the kitties they personally cared for. The two volunteers' reports aren't formally linked — each is just its own report for the same shift type + date, and a reader sees both were part of a split shift from the flag. There's no enforcement preventing the same cat from appearing in both reports; volunteers self-coordinate on who covers which cats. Shift-level fields (kennels reset, cleaning, supplies, other notes) aren't split by cat — either volunteer can log any of them in their own report.
- Kennels ready/reset for a new occupant — list of kennel numbers.
- Repeatable cat entry within the report, one of two types:
  - **Individual entry** — fecal score, pee, food (dry amount + free-fed flag; wet amount + wet food brand, defaulting to Hill's and only requiring a pick when it's different), snack/treat (Churu, Greenies, other + note), medical section (general medical notes, plus a "dewormer given" action when one is due, and a "proviable given" checkbox on Evening-shift entries when the cat needs proviable), play/behavior notes, nail trim flag, photo(s).
  - **Group entry** — for cats housed/fostered together (e.g. "Sprite/Pepsi/Nehi"), since some things can't be attributed to one cat in the group:
    - Shared across the group: fecal score, pee, dry food amount, water. (Dry food is always the same brand, so brand isn't tracked for dry.)
    - Individual per cat in the group: wet food amount + brand (default Hill's), snack/treat, medical section (notes + dewormer given + proviable given on Evening shifts), behavior/play notes, nail trim flag, photo(s).
- A cat entry's medical section flags when a dewormer is due (see Cat & kennel roster below); marking it "given" during a shift clears the flag. Dewormer is a one-time treatment — once given, there's no future due date to track.
- A cat entry's medical section also shows a "proviable given" checkbox when the cat has an Admin-set "needs proviable" flag (see Cat & kennel roster below) — but only on Evening-shift entries, since proviable is only given during the evening shift; Morning and Mid-day entries don't show it even if the flag is set. Checking it just logs that day's dose — unlike dewormer, it does not clear the flag, since a cat with diarrhea typically needs proviable for several consecutive evenings. Only an Admin clears "needs proviable," once the diarrhea has resolved.
- Shift-level fields (not tied to one cat): cleaning performed, supplies restocked, general "other" notes.
- Repeatable meet-and-greet entry: one or more cats (a family may meet more than one cat in a visit) + a free-text note on context/outcome. Multiple meet-and-greets can be logged in one shift.
- Fecal score and food amount use structured pickers (fecal score: 1–7 scale, plus a "none" option for when there was no bowel movement to score during the shift; food amount: none/some/all + free-fed flag), plus an optional free-text note for anything unusual — keeps data consistent while still allowing detail.
- Pee is a simple yes/none flag — whether the cat (or, for a group entry, the group) was seen to urinate during the shift. No quality scale like fecal score, just presence.
- Photo upload attached to a cat entry (individual or per-cat within a group).

### Roles & permissions
- **Volunteer**: create/edit own reports only — cannot delete their own reports; only an Admin can delete a report.
- **Admin**: edit/delete any report; manage the cat/kennel roster (add cats, assign kennels, intake); post status changes and announcements; create and manage volunteer/admin user accounts.
- Self-registration is disabled — an Admin creates every user account (Volunteer or Admin) directly; there is no public sign-up flow.
- Deleting a user is a soft delete: an Admin can delete a Volunteer or Admin who has left, which blocks that user from logging in but keeps their account and past shift reports intact (still fully viewable/attributed to them). It is not a destructive/permanent delete.
- No roles beyond Volunteer/Admin in MVP — anyone with in-app access is one or the other; people outside those roles (e.g. fosters, front-desk staff) who need visibility are reached via the existing Google Group email notifications, not in-app accounts.

### Cat & kennel roster
- Persistent cat profile that shift reports reference, instead of free-typing a cat's name each time — avoids inconsistency (e.g. name spelling/aliases) and enables per-cat history and reporting.
- New-arrival intake captures: name, age, sex, color/pattern, collar color, kennel assignment, and whether a dewormer is due (known at intake from the cat's existing paper notebook). Two cats can arrive together into the same kennel (modeled the same way as a shift-report group).
- Kennel tracks its current occupant(s) (single cat or group) and ready/reset state.
- A cat's dewormer-due status is visible on its profile/roster entry, replacing the current binder lookup volunteers do before each shift. Marking it given (from a shift report or the cat's profile) clears the flag for good — it's a one-time treatment, not a recurring schedule.
- A cat's "needs proviable" status is also visible on its profile/roster entry, but unlike dewormer it isn't set at intake: an Admin manually flags a cat as needing proviable after a volunteer reports diarrhea (via a shift report's fecal score or medical notes). Once flagged, Evening-shift reports show a "proviable given" checkbox for that cat until an Admin manually clears the flag — checking the box logs a dose but doesn't end the need, since proviable is typically given over several consecutive evenings while the diarrhea resolves.
- **Bonded pair** — an Admin can flag a Group as `bonded`, meaning the two cats in it are a bonded pair that should always be kept together in the same kennel (as opposed to a Group that's just co-housed for other reasons, e.g. temporary fostering). Bonded is always pairwise — it can only be set on a Group of exactly two Cats — and is informational only in MVP: the app doesn't block an Admin from splitting a bonded Group across kennels, it's just a visible note on the roster (e.g. so an Admin knows to re-pair them, or knows not to split them, when reassigning kennels).
- **Siblings** — an Admin can tag two or more Cats as siblings (litter-mates) at or after intake. Unlike a bonded pair, siblings don't necessarily share a kennel or a Group — it's purely informational, shown on each sibling's profile/roster entry regardless of their current kennel assignment, so volunteers/Admins know cats in different kennels are related (e.g. for meet-and-greet or adoption conversations). A cat can be both part of a bonded Group and tagged with siblings at the same time — the two are independent.

### Status & announcements
Replaces the other ad hoc email threads (new-cat, adoption, sick-return, kennel-prep) with structured, in-app notifications tied to the cat/kennel roster.
- Cat status field (`available` → `pending adoption` → `adopted`), updated by Admins. A cat is `available` as soon as it's added to the roster — there's no separate "new arrival" status, just an announcement posted at intake. `pending adoption` can revert back to `available` if an application falls through (e.g. it doesn't work out) — this posts a new "back available" announcement and resolves the earlier pending-adoption one. Status changes are always a manual Admin action — a meet-and-greet outcome is logged as a note only and never automatically changes a cat's status.
- **Returned to RCC** is an action, not an ongoing status: it removes the cat from the active roster entirely (no further tracking at this location — if it comes back later it's re-entered like a new arrival) and marks its kennel `needs reset`. An optional free-text reason (e.g. "for observation") can be logged for the record, but volunteers only see that the kennel needs a reset, not the reason.
- Announcement types, visible to all volunteers, separate from a shift report:
  - New cat arrival
  - Pending adoption / adopted (with pickup date/time when scheduled) / back available (after a fallthrough)
  - Cat returned to RCC (kennel-needs-reset notice only; no reason shown)
  - Kennel prep checklist assigned
- **Kennel prep checklist** — an Admin creates a short ordered list of kennel actions (reset a kennel, move a cat into a kennel) tied to an expected arrival or pickup, e.g. "reset kennel 5 → move Pepsi to kennel 5 → reset kennel 6." Checklist creation is Admin-only in MVP — a Volunteer cannot create or flag one themselves, only check off actions during their shift; the roster updates as actions are completed. Order is enforced — a Volunteer can only check off the next incomplete action in sequence, so a cat can't be moved into a kennel before its reset step is checked off.
- **Default announcement view** shows only the last 24 hours, with a "view all" option to see everything. That 24-hour default only applies to purely informational announcements — new cat arrival and returned-to-RCC. Anything with an open action stays in the default view regardless of age until it's resolved:
  - Pending adoption / adopted: stays visible until the cat is marked adopted **and** its kennel is marked reset — both conditions required.
  - Kennel prep checklist: stays visible until every action on it is checked off.
  - Back-available and new-arrival-style announcements without an open action just follow the 24-hour rule.
- No automatic long-term expiration/purging of announcements in MVP (deferred — see Out of scope).

### Reporting / lookup
- View/search past shift reports by cat, date, or kennel, so the next shift can catch up without reading an email chain.
- View a single cat's report history in one place (fecal/food/behavior/medical/meet-and-greets over recent shifts).

### Email notifications
Sent to the existing Google Group already used for these communications today (not per-user addresses), individually per event (not batched), for:
- New cat arrival
- Status change to pending adoption / adopted (including a scheduled pickup date/time, when set)
- Back available (after a pending adoption falls through)
- Returned to RCC (surfaces as a "kennel needs reset" notification)
- A new kennel prep checklist assigned
- Shift report submitted — a full outline of the completed report (all cat/group entries with their fields, shift-level fields, and any meet-and-greets), mirroring the in-app report's content in plain text. Uploaded photos are not included in the email; viewing them requires opening the app.

All six notification types go to the same single existing Google Group. Whoever is a member of the Google Group receives these — membership, not an in-app preference, is what controls who gets notified for MVP. Group membership is managed entirely outside the app (in Google Groups/Workspace admin); the app just sends to the group address and doesn't need to read or display who's in it. The email contains the full detail of the event — for the five announcement types, same as the in-app announcement; for a submitted shift report, a full outline of the report as described above. A split-shift report triggers its own email covering just the cats that volunteer logged. No push notifications, and no per-user opt-in/opt-out, in MVP.

## Data model / entities

- **User** — name, email, role (`Volunteer` | `Admin`), password (credential-based auth), soft-delete timestamp (a deleted user cannot log in, but their account and past reports remain intact). Created only by an Admin — no self-registration.

- **Cat** — name, age (at intake), sex, color/pattern, collar color, current kennel or group, status (`available` | `pending adoption` | `adopted` — `pending adoption` can revert to `available` on a fallthrough; a cat is `available` as soon as it's added to the roster, no separate "new arrival" status), scheduled pickup date/time (optional, set when pending adoption), dewormer status (`due` | `given`, set at intake from the cat's existing paper notebook; one-time, no recurring date), needs-proviable flag (boolean, set manually by an Admin after diarrhea is reported — not tied to intake — and cleared manually by an Admin once resolved; unlike dewormer it is not cleared by logging a dose), litter reference (optional, see Litter below), active flag. Set inactive (not deleted) when returned to RCC, with an optional Admin-only reason note; a re-admitted cat is entered again like a new arrival rather than reactivated. Past shift reports referencing an inactive cat remain fully viewable in history/search — going inactive removes it from the active roster, not from the record.

- **Group** — a set of Cats housed/fostered together (e.g. "Sprite/Pepsi/Nehi"); shares one kennel and is the target of shared fields on a shift report entry. Used both for arrivals (a pair intake into one kennel) and shift reporting. Bonded flag (boolean, Admin-set) — true means the two Cats in this Group are a bonded pair that should always stay in the same kennel; only settable when the Group has exactly two Cats, since bonded is always pairwise. Bonded is informational only in MVP — not enforced against kennel/Group reassignment. When a Cat leaves a Group (adopted or returned to RCC), it's removed from the Group; if only one Cat remains, the Group dissolves and that Cat becomes an Individual in the shared kennel, otherwise the remaining Cats stay a (smaller) Group — a dissolved/resized Group that was bonded loses the bonded flag, since bonded no longer applies once the pair is broken up.

- **Litter** — a set of two or more Cats tagged by an Admin as siblings, at or after intake. Independent of Group/kennel — sibling Cats may or may not currently share a kennel or Group, and moving a Cat between kennels/Groups doesn't affect its Litter membership. Purely informational: shown on each member Cat's profile/roster entry so volunteers/Admins can see who's related regardless of current housing.

- **Kennel** — number, current occupant (a Cat, a Group, or empty), state (`occupied` | `needs reset` | `ready`).

- **ShiftReport** — author (User), shift type (`Morning` | `Mid-day` | `Evening`), date, split-shift flag (boolean; Morning/Evening only — no formal link to the other volunteer's report, just a marker that this report only covers a subset of the shift's cats), kennels reset list, cleaning notes, supplies notes, other notes, created/edited timestamps. Editable only by its author, or by an Admin.

- **CatEntry** — belongs to a ShiftReport; references either one Cat (individual) or one Group.
  - Individual: fecal score, pee flag, dry food amount + free-fed flag, wet food amount + brand (default Hill's), snack/treat, medical notes, dewormer-given flag (only relevant while the Cat's dewormer status is `due`), proviable-given flag (only shown on Evening-shift entries, while the Cat's needs-proviable flag is set — logging it does not clear that flag), behavior/play notes, nail trim flag, photo(s).
  - Group: fecal score, pee flag, dry food amount, and water logged once for the group (dry food brand is not tracked — always the same); wet food amount + brand, snack/treat, medical notes, dewormer-given flag, proviable-given flag (Evening-shift entries only, per Cat in the group), behavior/play notes, nail trim flag, and photo(s) logged per Cat within the group.

- **MeetAndGreet** — belongs to a ShiftReport; references one or more Cats, plus a free-text note on context/outcome. Surfaces on each referenced Cat's report history.

- **KennelPrepChecklist** — created by an Admin, tied to an expected arrival or pickup; an ordered list of **ChecklistAction**s (`reset kennel` | `move cat to kennel`, target Kennel, target Cat/Group when moving, completed flag, completed by/at). Volunteers check actions off during a shift, strictly in order — only the next incomplete action can be marked done.

- **Announcement** — type (`new arrival` | `pending adoption` | `adopted` | `back available` | `returned to RCC` | `checklist assigned`), reference to the related Cat/Kennel/Checklist, timestamp, resolved flag, and whether a notification email was sent for it. `new arrival` and `returned to RCC` age out of the default view after 24 hours regardless of the resolved flag; `pending adoption`/`adopted` and `checklist assigned` stay in the default view until resolved (adopted + kennel reset, or all checklist actions complete) no matter how old they are. All types remain available via "view all."

## Platform

Mobile-first web app (PWA) — installable to the home screen, works in the phone browser, no app-store submission required. Fastest path to MVP and easiest to iterate on; a native app can be revisited later if offline support or app-store presence becomes a priority.

Scoped to a single site (one PetSmart location) for MVP — one kennel-numbering scheme, no Site entity. Multi-site support is a backlog item if the rescue expands to satellite locations.

## Design / Branding

The app's visual design mirrors the Lost Dog & Cat Rescue Foundation website (lostdogrescue.org) for brand consistency. This means adopting the site's color palette, typography, and button styling in the app's own mobile-first UI — not a literal clone of the marketing site's layout or imagery, since the app is a utilitarian internal tool (shift reports, roster, checklists) rather than a public-facing page.

- **Colors**: navy (`#001F70`, headings/nav), blue (`#0C4AC5`, primary buttons/links), cream/off-white (`#F6F5F4`, background), gray (`#62646A`, body text), plus the site's gold/yellow as an accent color (underlines, highlights, badges).
- **Typography**: League Spartan (Google Font), matching the site's font throughout.
- **Buttons**: fully rounded pill shape, matching the site's button style.
- **Logo**: the app header reuses the organization's actual logo/wordmark (the navy shield mark) rather than a generic app icon. This needs the source logo asset from the organization, using their standard mark rather than the site's "25 years" anniversary ribbon variant, since that's tied to a specific anniversary and not evergreen.

This is a design decision only for now — actual theme/CSS implementation happens once feature UI work begins; the current code is still the Phase 0 skeleton with no feature UI built yet (see `CLAUDE.md`).

## Out of scope for MVP (backlog)

- Native iOS/Android apps
- Full adoption application intake/CRM (meet-and-greets are logged as a simple cats + note entry, not a full workflow)
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
- Multi-site support (Site entity, per-site kennel numbering) — MVP assumes a single location
- A fallback shift-report path for volunteers without a smartphone — MVP assumes all active volunteers can access the PWA on a phone browser
