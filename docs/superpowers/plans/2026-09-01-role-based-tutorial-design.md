# Role-Based Tutorial Walkthrough — Design

Date: 2026-09-01
Status: Draft, awaiting user review

## Problem

Nivarro has no onboarding walkthrough. New STUDENT and STAFF (teacher/faculty)
accounts are dropped straight onto their dashboard with no guided introduction
to the surfaces most relevant to their role. Support tickets, mentorship
pairing, and the Faculty Permission Tiers system all shipped without any
"here's how this works" moment for first-time users.

## Goal

An interactive, in-app walkthrough (tooltip/spotlight tour over real UI, not a
static doc) that:
- Auto-shows once per user on first login after ship, tailored to their role
  (STUDENT vs STAFF)
- Can be replayed anytime via a "Take the tour" entry next to the existing
  Support button
- For STAFF, adapts its steps to the viewer's permission tier (Core Admin
  gets extra steps; regular faculty see only base steps)
- Is short: 4-6 stops per role, hitting only the highest-value surfaces
- Also handles **ongoing new-feature explanations**, not just one-time role
  onboarding (added 2026-09-01, see "New feature announcements" below)

Out of scope: ALUMNI/ORG/SCHOOL-account tours, admin-editable tour content,
tour analytics/funnels, a static help-page companion.

## Architecture

**`TutorialTour` component** (`components/tutorial/TutorialTour.tsx`) — a
single reusable client component that renders an overlay + spotlight +
Next/Back/Skip controls, driven entirely by a step-list passed in as props.
No new tour-content DB model: tours are short and code-defined, so step lists
live as plain TypeScript data:
- `lib/tutorials/studentTour.ts`
- `lib/tutorials/staffTour.ts`
- `lib/tutorials/announcements.ts` (new-feature callouts, see below)

Each step: `{ selector: string, title: string, body: string, route?: string }`.
`route` is set when the step lives on a different page than the previous one;
the tour component navigates there before rendering that step's spotlight.

**`TutorialLauncher`** — a small client component mounted once in
`app/(dashboard)/layout.tsx` (alongside the existing profile/myOrg fetch).
Reads the viewer's role and the relevant completion field
(`studentTourCompletedAt` / `staffTourCompletedAt`) already present in the
layout's profile fetch. Auto-fires the role-appropriate tour when that field
is null; otherwise checks for any unseen feature announcement (see below).

**Replay entry** — a "Take the tour" item placed in `Sidebar.tsx`'s existing
footer block, so it appears identically across every nav variant (walled
student, non-walled student, STAFF, SCHOOL). Correction (2026-09-01, caught
during plan-writing): the Support button this was meant to mirror does NOT
exist on `main` — the support-tickets plan shipped only to the separate,
still-unmerged `.worktrees/support-tickets` branch, not to production.
Firing "Take the tour" always starts the tour regardless of completion
state, and does not reset the stored completion field.

## Content per role

### Student tour (4 stops)

1. **Profile** — where to fill out bio, interests, and headline. (Note:
   this deliberately does NOT mention traits or animal-archetype content —
   both systems are being removed from the app entirely, see
   `docs/superpowers/plans/2026-09-01-remove-archetypes-and-traits.md` —
   and does NOT mention "achievements": correction, 2026-09-01, caught
   during plan-writing — no such `Profile` field or UI exists yet, it's an
   unscoped future idea only.)
2. **Mentorship or Messages (conditional)** — computed at render time from
   `isWalledStudent(userId)` (`lib/accountGate.ts`). Walled students (the
   common case — all current demo students are walled to Westside Academy)
   get a stop on `/mentorship`, since `/messages` redirects them straight
   back to `/dashboard`. Non-walled students get `/messages` instead, since
   `/mentorship` redirects *them* out. This mirrors the routing gotcha
   already documented in project memory — the tour must not hardcode one
   path.
3. **Messages/Mentorship inbox** — how to read/respond in an assigned
   thread.
4. **Dashboard nav overview** — a stop with no specific target element,
   just a general "here's what's in your sidebar" callout.

### Staff tour (4-6 stops, tier-aware)

Base steps (all STAFF):
1. Dashboard nav overview.
2. Roster view (read-only walkthrough of the school's roster).
3. Mentorship pairing tool (inside `/school/partnerships`,
   `SchoolPartnershipsClient.tsx`).

Core-Admin-only additional steps (gated on `profile.isCoreAdmin`, which
bypasses the tier system entirely per schema):
4. Permissions Switchboard — tier management, multi-admin capabilities.
5. Multi-admin management (promote/demote Core Admins).

Step filtering happens in the step-list builder function
(`buildStaffTourSteps(profile)`), not via CSS — a step whose target the
viewer can't reach is removed from the array entirely before the component
ever renders it, so no spotlight ever points at an inaccessible feature.

### New feature announcements (added 2026-09-01)

Reuses the same `TutorialTour` engine for single-step "what's new" callouts
when a feature ships, separate from the one-time role onboarding tours.
`lib/tutorials/announcements.ts` holds a list of
`{ id: string, selector: string, title: string, body: string, route?: string }`
entries, one per shipped feature worth calling out — same shape as a tour
step, but each one is independent (not a multi-step sequence).

A new nullable `Profile.seenAnnouncementIds` field (JSON string array,
following the same stringified-array pattern already used elsewhere in this
schema, e.g. `interests`) tracks which announcement `id`s a user has already
dismissed. `TutorialLauncher` checks this list on every dashboard mount —
after the role tour (if any) is done, any announcement whose `id` isn't yet
in the array is shown once (as a single-step spotlight, not a multi-step
tour), then its `id` is appended via the same completion endpoint pattern.
Shipping a new feature later is just "add one entry to the array" — no new
component, table, or admin UI required.

## Data model

Three new nullable/defaulted `Profile` fields, mirroring the existing
`onboardingComplete` pattern:

```prisma
studentTourCompletedAt DateTime?
staffTourCompletedAt   DateTime?
seenAnnouncementIds    String    @default("[]")
```

## API

- `PATCH /api/tutorial/complete` — body `{ tour: "student" | "staff" }`, sets
  the corresponding field to `now()` for the authenticated user. Called both
  on natural tour completion and on explicit "Skip" — both count as "seen
  it," so the user is never auto-shown the tour again uninvited.
- `PATCH /api/tutorial/announcement` — body `{ id: string }`, appends the id
  to `seenAnnouncementIds` (dedupes if already present) for the
  authenticated user.

## Trigger logic & error handling

- `TutorialLauncher` auto-fires the role tour only when the role-appropriate
  completion field is null on mount; once that's resolved (done or not
  applicable), it separately checks for any unseen announcement id.
- The "Take the tour" menu entry always fires the role tour on click,
  independent of completion state, and never mutates the completion field
  itself. Announcements are not manually replayable from this entry — once
  seen, they're seen.
- If a step's target selector isn't found in the DOM (slow render,
  unexpected layout), that step is skipped rather than rendering a spotlight
  pointing at nothing.
- If a completion/announcement PATCH fails, it fails silently and is
  retried next mount — it never blocks the UI or re-shows the tour
  insistently.

## Testing plan

Manual walkthrough (no existing automated UI test harness for this kind of
overlay interaction):
- Student tour as a walled demo student (`zoe@nivarro.io` or
  `priya@nivarro.io`) — confirm the mentorship-branch step resolves to
  `/mentorship`, not `/messages`.
- Staff tour as `teacher-staff@nivarro.demo` (STAFF, Core Admin, created
  2026-09-01 for this purpose) — confirm the Core-Admin-only steps appear.
- Staff tour as a non-Core-Admin STAFF account — confirm those steps are
  absent, not just hidden.
- A feature-announcement entry — confirm it fires once, after the role
  tour, and doesn't reappear on next login.
- `npx tsc --noEmit` and `npm run build`, per the project's existing
  verification pattern (see `docs/superpowers/plans/2026-08-13-support-tickets.md`
  task 9 for precedent).

## Open questions for user review

None outstanding — all prior questions (format, role scope, trigger/replay,
tier-awareness, stop count, student stops, persistence location, and the
2026-09-01 additions: dropping trait/archetype content, adding new-feature
announcements) were resolved during brainstorming.
