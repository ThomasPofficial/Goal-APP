# Alumni Multi-School Support — Design

**Date:** 2026-08-11
**Status:** Approved, ready for implementation plan

## Problem

An alum's affiliation with a school is currently modeled as a single nullable
scalar, `Profile.schoolId`. In reality an alum may have attended more than one
school (transfer, multiple institutions) — the schema can't represent that, so
today linking a second school silently evicts them from the first.

## Scope

- **Alumni only** (`User.isAlumni === true`). Current Students keep the
  existing single-`schoolId` behavior — they're actively enrolled at exactly
  one school right now, so there's no real-world case to support yet.
- Cardinality for alumni is **0, 1, or many** — most alumni will still have
  exactly one school. Nothing here requires a minimum of two.
- All linked schools are **functionally equal** — an alum is a real member of
  every school they're linked to (roster, mentor pool, community room), not
  just a "primary" one with the rest as inert history.

## Schema

New join table; `Profile.schoolId` is untouched for non-alumni.

```prisma
model AlumniSchool {
  id        String   @id @default(cuid())
  profileId String
  schoolId  String   // User.id where role=SCHOOL
  createdAt DateTime @default(now())

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, schoolId])
  @@index([schoolId])
}
```

- Per-person fields already on `Profile` (`graduationYear`, `industry`,
  `isAvailableToMentor`, `intendedCollege`, etc.) stay as single values shared
  across all of an alum's linked schools — these describe the person, not the
  school relationship, so they are not duplicated per link.
- For alumni, `Profile.schoolId` stops being read or written by any code path
  going forward; `AlumniSchool` rows become the sole source of truth.

## Migration

1. Add the `AlumniSchool` table via Prisma migration.
2. Data migration: for every `Profile` where `user.isAlumni === true` and
   `schoolId` is non-null, create one corresponding `AlumniSchool` row.
3. Null out `Profile.schoolId` on those same alumni rows, so there is exactly
   one source of truth going forward (a stale scalar left in place would let
   an unmigrated code path silently keep reading old membership).

## Backend behavior changes

All changes below branch only on `isAlumni`; non-alumni Student logic is
unchanged.

**Enrollment stays invite-only** — this was already true for the existing
single-school model (students/alumni have no self-serve join mechanism) and
carries over unchanged: an alum can never search for and add a school
themselves. Every *link* is still created exclusively by a school admin via
the roster (add or CSV import). The only new self-service action is removal
— an alum may unlink themselves from a school they no longer want to be
associated with (see `/api/profile/schools/[schoolId]` below).

| Site | Change |
|---|---|
| `lib/accountGate.ts` (`isWalledStudent`) | For alumni, walled if `AlumniSchool` count ≥ 1, instead of checking `Profile.schoolId`. |
| `lib/school-auth.ts` (`getSchoolId`) | Becomes `getSchoolIds(userId): string[]` — `[userId]` for SCHOOL role, 0-or-1 entry for non-alumni students, all linked IDs for alumni. Callers that already pass an explicit `schoolId` (e.g. `createPrivateRoom`) are unaffected. |
| `/api/school/roster` (GET) | Alumni members resolved via `AlumniSchool.schoolId = schoolId`; students/staff still via `Profile.schoolId`. |
| `/api/school/roster/members` (POST), `/api/school/roster/import` | Adding an alumni row creates/links an `AlumniSchool` row (upsert on `[profileId, schoolId]`) instead of overwriting `schoolId` — linking School B no longer evicts them from School A. This remains the **only** way a link gets created — admin-driven, same as today. |
| `/api/school/roster/members/[userId]` (DELETE) | Admin-initiated removal. For alumni, deletes only the `AlumniSchool` row for that specific school. For non-alumni, unchanged (`schoolId: null`). |
| `/api/profile/schools/[schoolId]` (new, DELETE) | Self-service removal — lets the signed-in alum unlink themselves from one of their own linked schools. No corresponding POST/add route exists; adding a school is admin-only via the roster. |
| `/api/school/mentorship` (GET/POST) | Mentor pool / eligibility check switches from `Profile.schoolId` equality to "has an `AlumniSchool` link to this school" — one alum can be mentor-eligible at every school they're linked to. |
| `/api/connections/request` | "Same school" check becomes "school-ID sets intersect" instead of exact equality. If more than one school is common to both sides, the first match is used for the created request's `schoolId` (documented simplification, not solved). |
| `lib/communities.ts` (`ensureSchoolGeneralRoom`) | For alumni, called once per linked school so they land in every school's general community room, not just one. |

## UI changes

- **`AlumniProfileEditor.tsx`** — new "Schools" section: lists currently
  linked schools, each with a remove action (calls the new self-service
  DELETE route). **No add/search control** — schools can only be added by a
  school admin through the roster, matching the existing invite-only
  invariant. If an alum removes their only linked school, they simply fall
  back to being unwalled (same as a Student whose `schoolId` is null today).
- **`/my-school`** — currently renders one hub based on the single
  `schoolId`. For an alum linked to multiple schools, add a lightweight
  switcher (tabs or dropdown) defaulting to the first linked school.
  Single-school alumni and Students see no change — no switcher rendered.
- **`WalledDashboardClient.tsx` greeting** — "Your hub at {schoolName}"
  becomes "Your hub at {schoolName} and N more" when there's more than one,
  linking into `/my-school`.
- **`/school/roster` (admin view)** — no change needed. The API already
  returns correct membership per school, so an alum linked to two schools
  simply appears independently in both schools' roster lists.

## Explicitly out of scope

- Non-alumni Student multi-school support (mid-year transfers).
- A picker UI for which school a connection-request "belongs to" when more
  than one school is common to both parties.
- Per-school values for graduation year / industry / mentor availability —
  these remain single, person-level fields.
