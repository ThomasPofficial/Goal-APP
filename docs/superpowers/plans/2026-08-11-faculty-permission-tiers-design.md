# Faculty Permission Tiers — Design

**Date:** 2026-08-11
**Status:** Approved, ready for implementation plan (reconciled 2026-08-11 with a concurrent session's roster-activation spec)

## Problem

Today there is exactly one authenticated account per school: the `role: "SCHOOL"` user created via `/hq`. Every `/school/*` page and API route (roster, campaigns, mentorship, etc.) is gated with `getSchoolSession()`, which requires `role === "SCHOOL"` (see `lib/school-auth.ts`). Staff added through the roster/CSV import (`app/api/school/roster/members/route.ts`) are created with `role: "STUDENT"` and a random, unusable password (`bcrypt.hash(randomUUID(), 10)`) — they exist as directory data only and cannot log in as themselves.

The school wants to give real logins to faculty, organized into permission tiers (high-level: principal, guidance counselors, IT managers; lower-level: teachers), customizable by the sole admin (the existing `SCHOOL` account).

## Scope (v1)

Two existing feature areas become tier-gated: **roster** (view / edit+import) and **campaigns/fundraising** (view / create+manage). Mentorship pairing and partnerships/connections approval are explicitly out of scope for v1 — they remain `SCHOOL`-only.

Notifying invited staff by email is **mocked** in v1 — the invite link is generated and displayed for the admin to send manually (Slack, text, etc.), not auto-emailed. This isolates the real send step behind one function so it can be swapped later without touching anything else.

**Reconciliation note (2026-08-11, during planning):** a concurrent session's `docs/superpowers/plans/2026-08-11-roster-invite-activation-design.md` independently builds a generic "give any roster member a real login" mechanism, reusing the existing `PasswordResetToken` model and `resetPassword(token, password)` server action (`app/actions/auth.ts`) — both already exist in the codebase, confirmed present. Rather than build a second, parallel invite/token system for staff specifically, this design reuses that same primitive (see "Invite flow" below) instead of a dedicated `StaffInvite` table. The two efforts stay compatible: their spec adds an activation link to the generic `/school/roster` add-member/CSV-import flow for any member type; this design adds a separate, tier-aware invite path at `/school/staff` that only ever concerns staff, and never touches the roster add-member flow. The only shared file both efforts touch is `app/actions/auth.ts`, and this design's change to it is a single additive return field on `resetPassword` — safe to merge in either order.

## Roles

- `SCHOOL` (unchanged) — the sole admin per school, always full access to everything described below, plus the only role that can create/edit tier definitions or grant the `staff:manage` capability to someone else.
- `STAFF` (new) — an invited faculty member. Scoped to one school via `profile.schoolId`. Access is determined entirely by their assigned tier (plus personal overrides) or, if unassigned to any tier, a fully custom permission set.

`STAFF` is deliberately a new role, not reused `STUDENT`+`staffTitle` as today — this also incidentally fixes `isWalledStudent()` misclassifying staff as walled students (staff are no longer `role: STUDENT`), though fixing mentorship/messaging behavior for staff is not itself in scope for this feature. A person is `role: STUDENT` right up until they claim their staff invite (see below), at which point they become `role: STAFF`.

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
```

No `StaffInvite` table — invites are represented by ordinary `PasswordResetToken` rows (same model the existing "forgot password" flow uses) plus pending-assignment data already sitting on `Profile` (below). This is the reconciliation: one token mechanism for the whole app, not two.

`Profile` gains:
- `staffTierId String?` (→ `FacultyTier`) — null means this person isn't on a shared tier at all; their access comes entirely from `staffPermissionOverrides`.
- `staffPermissionOverrides String @default("[]")` — JSON array of capability strings for this specific person. Meaning depends on whether they have a tier:
  - **Has a tier:** overrides are *additive* — extra capabilities on top of the tier's permissions. **Additive only** — v1 has no per-person revocation below the tier. If someone needs less than their tier, change their tier or make a new one.
  - **No tier (`staffTierId` null):** overrides ARE the complete permission set — a fully custom, one-off grant scoped to just that person's email, independent of any tier. This is how the admin gives one specific person ("let this one teacher also handle campaigns") exactly the capabilities they want without creating or modifying a shared tier.
- `staffInvited Boolean @default(false)` — set true the moment an admin sends a staff invite for this profile (tier or custom), regardless of tier/override contents. Exists purely so "pending invite" can be shown in the staff UI even for the degenerate case of a Custom invite with zero permissions checked (`staffPermissionOverrides` would otherwise be indistinguishable from "never invited"). Once the person accepts and `role` flips to `STAFF`, this flag is irrelevant (the staff UI already splits by `role`) and is left `true` rather than cleared.

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

These are starting points, not fixed. `SCHOOL` can **rename** any tier (e.g. "Teacher" → "Classroom Staff"), edit its permission checkboxes, or delete/add tiers entirely — the four above are just what a school starts with, seeded once on first use.

## Delegation rule

`SCHOOL` is the only role that can create/edit `FacultyTier` definitions, or grant `staff:manage` to a `STAFF` user. A `STAFF` user who has `staff:manage` can invite new staff and assign/reassign any of the school's existing tiers to a person, but cannot create new tiers, edit tier permissions, or grant `staff:manage` to anyone else. This caps how far privilege can spread from the sole admin.

## Invite flow (v1, mocked notification, built on the existing password-reset primitive)

1. Someone with `staff:manage` (the `SCHOOL` account, or a delegated `STAFF` user) goes to a new `/school/staff` page, enters an email, and either **picks an existing tier** or chooses **Custom** and checks individual capability boxes for that one person, then submits.
2. The server resolves the email against existing users:
   - **No existing `User`:** creates one with `role: "STUDENT"` (same convention the roster add-member flow uses — role only becomes `STAFF` on claim) and a `Profile` with `schoolId`, `staffTitle` (if provided), `staffTierId`/`staffPermissionOverrides` from the chosen tier/custom set, and `staffInvited: true`.
   - **Existing `User` with `role: "STUDENT"`** (including an inert roster-imported row with `staffTitle` already set, or a plain student/alumni record — inviting a non-staff-titled student as staff is allowed; that's exactly how a school turns an existing community member into staff): updates their `Profile` with the new `staffTierId`/`staffPermissionOverrides`/`staffInvited: true` in place. Same `User.id`, no data loss.
   - **Existing `User` with `role: "STAFF"` already:** just updates their tier/overrides directly (they already have a working login) — no token is issued, nothing to "accept."
   - **Existing `User` with any other role** (`ORG`, `SCHOOL`, `ADMIN`): reject with an error — promoting an existing account to staff must be a deliberate separate admin action, not a side effect of an invite.
3. For the first two branches (no working login yet), the server creates a `PasswordResetToken` for that email — same raw-token/sha256-hash scheme as `requestPasswordReset`, but a **7-day** expiry instead of 1 hour (a "get around to it" invite, not an urgent security action). Any prior unclaimed token for that email is deleted first (same dedup behavior `requestPasswordReset` already has).
4. Instead of emailing, the UI displays the invite link (`/staff/accept-invite?token=<raw token>`) for the inviter to copy and send manually. The send step lives in one small function (`lib/staffInvite.ts::notifyInvite()`) so real email can replace the mock later without touching the rest of the flow.
5. Recipient opens the link, lands on an accept-invite page, sets their own password (and confirms/fills name + staff title if not pre-set). The admin never sets or sees the teacher's password.
6. On submit, the server calls the existing `resetPassword(token, password)` action to validate the token, set the password hash, and delete the token — unchanged logic, just reused. `resetPassword` gets one additive change: its success return grows a `userId` field (`{ success: true, userId }` instead of just `{ success: true }`) so callers that need to act on *which* account was just activated — like this flow — can, without it knowing anything about staff invites itself. Existing callers (`/reset-password`'s page) only check `"error" in result` and are unaffected.
7. After a successful `resetPassword`, the staff-invite accept handler loads that user's role + profile and, if `role === "STUDENT"` and the profile has a `staffTierId` or non-empty `staffPermissionOverrides` (i.e. this activation was a staff invite, not a plain password reset), flips `role` to `STAFF`. A normal "forgot my password" reset for an existing account never touches this — the check is driven entirely by pre-existing `Profile` data set at invite time in step 2, not by any property of the token itself, so `resetPassword` stays a fully generic, staff-agnostic action.

## Permission enforcement

Replace the `role !== "SCHOOL"` checks in roster and campaigns routes with a `requireSchoolCapability(capability)` helper (new, in `lib/school-auth.ts`):
- `role === "SCHOOL"` or `role === "ADMIN"` → always authorized; effective `schoolId` = `session.user.id`.
- `role === "STAFF"` → load `profile.schoolId` and `staffPermissionOverrides`; if `staffTierId` is set, also load `FacultyTier.permissions` and authorize on the union of tier permissions + overrides, otherwise authorize on `staffPermissionOverrides` alone (the custom, one-off case). Effective `schoolId` = `profile.schoolId` (staff never own records themselves — roster entries and campaigns stay keyed to the root `SCHOOL` user's id, same as today).
- Anything else → 403.

## Staff management UI

New `/school/staff` page, visible to `SCHOOL` and any `STAFF` with `staff:manage`:
- List current staff (`role: STAFF`) with their tier (or "Custom") and pending invites (`role: STUDENT` with `staffInvited: true`).
- Invite form: email, then either pick a tier or choose Custom and check individual capability boxes for that one person. Re-submitting the same email regenerates their invite link (acts as resend).
- Reassign tier per person, or switch a person to/from Custom (delegated managers can do this).
- Tier editor — create, **rename**, edit permission checkboxes, or delete tiers — **`SCHOOL`-only** section, hidden from delegated `STAFF` managers. Per-person Custom permission edits (not tier edits) remain available to delegated managers via the staff list, since that's scoped to one person rather than a shared tier.

## Out of scope / explicitly deferred

- Real email delivery for invites (mocked in v1).
- Mentorship pairing and partnerships/connections tier-gating.
- Per-person permission *revocation below a tier* (overrides on a tiered person are additive only — to grant less than a tier, use Custom or a different tier instead).
- Invite expiry surfaced in the staff UI (the `PasswordResetToken` still expires after 7 days server-side; the UI doesn't show a countdown — re-inviting regenerates it).
- The generic roster-activation system for students/alumni (owned by the concurrent `roster-invite-activation-design.md` effort) — this design's invite path is staff-only and separate from `/school/roster`'s add-member flow.
- Any change to how `isWalledStudent()`/messaging treats existing already-migrated staff beyond the role change itself.
