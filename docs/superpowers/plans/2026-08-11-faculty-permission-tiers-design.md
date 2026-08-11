# Faculty Permission Tiers — Design

**Date:** 2026-08-11
**Status:** Approved, ready for implementation plan

## Problem

Today there is exactly one authenticated account per school: the `role: "SCHOOL"` user created via `/hq`. Every `/school/*` page and API route (roster, campaigns, mentorship, etc.) is gated with `getSchoolSession()`, which requires `role === "SCHOOL"` (see `lib/school-auth.ts`). Staff added through the roster/CSV import (`app/api/school/roster/members/route.ts`) are created with `role: "STUDENT"` and a random, unusable password (`bcrypt.hash(randomUUID(), 10)`) — they exist as directory data only and cannot log in as themselves.

The school wants to give real logins to faculty, organized into permission tiers (high-level: principal, guidance counselors, IT managers; lower-level: teachers), customizable by the sole admin (the existing `SCHOOL` account).

## Scope (v1)

Two existing feature areas become tier-gated: **roster** (view / edit+import) and **campaigns/fundraising** (view / create+manage). Mentorship pairing and partnerships/connections approval are explicitly out of scope for v1 — they remain `SCHOOL`-only.

Notifying invited staff by email is **mocked** in v1 — the invite link is generated and displayed for the admin to send manually (Slack, text, etc.), not auto-emailed. This isolates the real send step behind one function so it can be swapped later without touching anything else.

## Roles

- `SCHOOL` (unchanged) — the sole admin per school, always full access to everything described below, plus the only role that can create/edit tier definitions or grant the `staff:manage` capability to someone else.
- `STAFF` (new) — an invited faculty member. Scoped to one school via `profile.schoolId`. Access is determined entirely by their assigned tier + any personal overrides.

`STAFF` is deliberately a new role, not reused `STUDENT`+`staffTitle` as today — this also incidentally fixes `isWalledStudent()` misclassifying staff as walled students (staff are no longer `role: STUDENT`), though fixing mentorship/messaging behavior for staff is not itself in scope for this feature.

## Data model

```prisma
enum UserRole {
  STUDENT
  ORG
  ADMIN
  SCHOOL
  STAFF   // new
}

model FacultyTier {
  id              String   @id @default(cuid())
  schoolId        String   // -> User.id where role = SCHOOL
  name            String
  permissions     String   @default("[]") // JSON array of capability strings
  isSystemDefault Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model StaffInvite {
  id         String    @id @default(cuid())
  email      String
  schoolId   String    // -> User.id where role = SCHOOL
  tierId     String    // -> FacultyTier.id
  token      String    @unique
  expiresAt  DateTime
  acceptedAt DateTime?
  createdAt  DateTime  @default(now())
}
```

`Profile` gains:
- `staffTierId String?` (→ `FacultyTier`)
- `staffPermissionOverrides String @default("[]")` — JSON array of extra capability strings granted to this one person on top of their tier. **Additive only** — v1 has no per-person revocation, only per-person grants. If someone needs less than their tier, change their tier or make a new one.

## Capabilities (v1 fixed list)

- `roster:view`
- `roster:edit` (add/edit/delete/import)
- `campaigns:view`
- `campaigns:edit` (create/manage)
- `staff:manage` (invite staff, assign existing tiers to people — does NOT include creating/editing tier definitions, which stays `SCHOOL`-only)

## Default tiers (seeded per school on first use, editable after)

| Tier | roster:view | roster:edit | campaigns:view | campaigns:edit | staff:manage |
|---|---|---|---|---|---|
| Principal | ✓ | ✓ | ✓ | ✓ | ✓ |
| Guidance Counselor | ✓ | ✓ | ✓ | | |
| IT Manager | ✓ | ✓ | | | ✓ |
| Teacher | ✓ | | | | |

## Delegation rule

`SCHOOL` is the only role that can create/edit `FacultyTier` definitions, or grant `staff:manage` to a `STAFF` user. A `STAFF` user who has `staff:manage` can invite new staff and assign/reassign any of the school's existing tiers to a person, but cannot create new tiers, edit tier permissions, or grant `staff:manage` to anyone else. This caps how far privilege can spread from the sole admin.

## Invite flow (v1, mocked notification)

1. Someone with `staff:manage` (the `SCHOOL` account, or a delegated `STAFF` user) goes to a new `/school/staff` page, enters an email + picks a tier, submits.
2. Server creates a `StaffInvite` row (token + 7-day expiry). If a prior unaccepted invite exists for that email at that school, it's superseded (old token invalidated, not left live).
3. Instead of emailing, the UI displays the invite link (`/staff/accept-invite?token=...`) for the inviter to copy and send manually. The send step lives in one small function (e.g. `lib/staffInvite.ts::notifyInvite()`) so real email can replace the mock later without touching the rest of the flow.
4. Recipient opens the link, lands on an accept-invite page, sets their own password (and confirms/fills name + staff title if not pre-set). The admin never sets or sees the teacher's password.
5. On submit, the server resolves by email:
   - **No existing `User`:** creates one with `role: "STAFF"`, the submitted `passwordHash`, and a `Profile` with `schoolId` + `staffTierId` set.
   - **Existing `User` with `role: "STUDENT"` and a `staffTitle` set** (an inert roster-imported "STAFF" directory row): flips `role` to `STAFF`, replaces the unusable random `passwordHash` with the real one, reuses the existing `Profile` (already has `staffTitle`/`schoolId`), attaches `staffTierId`. Same `User.id`, no data loss.
   - **Existing `User` with any other role** (already a `STUDENT`/`ALUMNI`/`ORG` account under that email): reject with an error — promoting an existing account to staff must be a deliberate separate admin action, not a side effect of accepting an invite.
6. `StaffInvite.acceptedAt` is stamped so the token can't be reused. Expired, unaccepted tokens show "this invite expired, ask your admin to resend."

## Permission enforcement

Replace the `role !== "SCHOOL"` checks in roster and campaigns routes with a `requireSchoolCapability(capability)` helper (new, in `lib/school-auth.ts`):
- `role === "SCHOOL"` or `role === "ADMIN"` → always authorized; effective `schoolId` = `session.user.id`.
- `role === "STAFF"` → load `profile.schoolId`, `staffTierId` → `FacultyTier.permissions`, plus `staffPermissionOverrides`; authorized if `capability` is in the union of the two. Effective `schoolId` = `profile.schoolId` (staff never own records themselves — roster entries and campaigns stay keyed to the root `SCHOOL` user's id, same as today).
- Anything else → 403.

## Staff management UI

New `/school/staff` page, visible to `SCHOOL` and any `STAFF` with `staff:manage`:
- List current staff with their tier and status (invited / active).
- Invite form (email + tier).
- Reassign tier per person (delegated managers can do this).
- Tier editor — create/edit/delete tiers, edit their permission checkboxes, toggle per-person overrides — **`SCHOOL`-only** section, hidden from delegated `STAFF` managers.

## Out of scope / explicitly deferred

- Real email delivery for invites (mocked in v1).
- Mentorship pairing and partnerships/connections tier-gating.
- Per-person permission *revocation* (overrides are additive only).
- Staff self-service password reset (not addressed by this design).
- Any change to how `isWalledStudent()`/messaging treats existing already-migrated staff beyond the role change itself.
