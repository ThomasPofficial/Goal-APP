# School Staff Accounts — Design

## Context

Account creation across the four user-facing types (Standard, Student, Alum, Admin/Teacher) was audited for how each is gated:

- **Standard** (`role: STUDENT`, `schoolId: null`) — public self-serve signup via `/api/auth/register`. Already fully locked down: the endpoint only accepts `name`/`email`/`password` and hardcodes `role: STUDENT`, so a client can never set `schoolId` or elevate role.
- **Student / Alum** (`role: STUDENT`, `schoolId` set, `isAlumni` bool) — only creatable via `/api/school/roster/members` and `/api/school/roster/import`, both gated by `getSchoolSession()` (caller must already be logged in as a `SCHOOL`-role account) and hardcode `schoolId` to the caller's own id. A school can only roster its own students. Sound.
- **Admin/Teacher** (`role: SCHOOL`) — only creatable via `/api/hq/schools` POST, gated by `getAdminSession()` (caller must be the site-wide super-admin). No self-serve path exists.

**Decisions already made (this session):**
1. No payment/subscription flag is needed on the school account. Manual creation of the `SCHOOL` account by the Nivarro admin (only after a contract/payment exists) is the control — this is unchanged by this spec.
2. Each school currently has exactly **one** `SCHOOL`-role login. There is no way to give a second real person (e.g. a counselor and a teacher) their own admin/teacher login at the same school. This spec adds that capability.

**Non-goal, clarified during design:** the roster's `STAFF` role option (`/api/school/roster/members`, `/api/school/roster/import`) is unrelated to this feature. It tags a walled student-style profile with `staffTitle` so that person is selectable as a teacher-mentor in `/api/school/mentorship`'s pairing UI (`kind: "STAFF"` alongside `kind: "ALUMNI"` mentors). It grants no login/dashboard access and is out of scope here — nothing about it changes.

## Goal

Let an existing (canonical) school account create additional real logins for staff at the same school, each with full admin/teacher dashboard access (roster, CSV import, mentorship pairing, etc.) scoped to that same school — without introducing a payment flag, a permissions-tier system, or a separate `School` table.

**Concurrency:** canonical and staff accounts are fully separate `User` rows with independent credentials and sessions — multiple people (canonical + any number of staff) can be logged into the app simultaneously from different devices with no conflict. Nothing about this design shares a login.

## Data model

Add one nullable self-relation field to `User`:

```prisma
model User {
  ...
  primarySchoolId String?
  primarySchool   User?   @relation("SchoolStaff", fields: [primarySchoolId], references: [id])
  staffAccounts   User[]  @relation("SchoolStaff")
}
```

- `primarySchoolId == null` on a `SCHOOL`-role user → **canonical school account** (today's model, unchanged). This is the id that `Student.schoolId` and every school-scoped query already points to.
- `primarySchoolId` set on a `SCHOOL`-role user → **secondary staff account**, attached to the canonical account named by that id.

Written as a manual migration (per project convention — migrations are hand-authored, not `prisma migrate dev`), following the pattern of `20260710000000_school_admin_features`.

## Auth / session resolution

`lib/school-auth.ts` currently:

```ts
export async function getSchoolSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL") return { error: "Forbidden", status: 403 };
  return { schoolId: session.user.id };
}
```

Changes to:

```ts
export async function getSchoolSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, primarySchoolId: true },
  });
  if (dbUser?.role !== "SCHOOL") return { error: "Forbidden", status: 403 };
  return { schoolId: dbUser.primarySchoolId ?? session.user.id, callerId: session.user.id };
}
```

This is the only change needed to make every existing school-scoped route (roster, import, mentorship pairing) work identically for staff and canonical accounts — they all consume `schoolId` from this function already. `callerId` is added to the return so the new staff-management endpoints can tell canonical apart from staff (see below).

## Staff management

New routes, all requiring `getSchoolSession()` to succeed first:

- **`POST /api/school/staff`** — body `{ name, email }`. Guard: reject with 403 unless the caller is canonical (`callerId === schoolId`) — a staff account cannot create another staff account. Duplicate-email check mirrors `/api/hq/schools`. Creates `User` with `role: SCHOOL`, `primarySchoolId: schoolId`, a random unusable password hash (`bcrypt.hash(randomUUID(), 10)`, matching every other invite-style account creation in the codebase), and a minimal `Profile` (`displayName: name`). Then **automatically** sends a set-password email — no separate step for the admin, no "forgot password" self-service required from the new hire. Implementation: extract the token-generation + email-send body of `requestPasswordReset` (`app/actions/auth.ts`) into a shared helper (e.g. `sendPasswordSetupEmail(email, { welcome: boolean })`) that both the existing forgot-password action and this new endpoint call — same `PasswordResetToken` model and `/reset-password?token=...` link, just different subject/copy for the welcome case ("You've been added as staff at [School] — set your password to get started" vs. "Reset your password").
- **`GET /api/school/staff`** — lists accounts where `primarySchoolId === schoolId` (canonical or staff may call this).
- **`DELETE /api/school/staff/[userId]`** — canonical-only (403 otherwise). Deletes the staff `User` row. Note: this does not proactively invalidate an already-issued NextAuth JWT session for that user (nothing in the app currently does this for any account type); it stops working the next time their session is refreshed/expires. Acceptable given existing precedent — flagged here rather than silently assumed.

**Permissions model:** intentionally flat, not tiered. A staff account has identical operational access to roster/import/mentorship as the canonical account once created. The only asymmetry is that only the canonical account can add/remove staff. This avoids building out a `SchoolAdminTier`-style permission system that was proposed in an older, now-stale spec (`nivarro-account-role-system-design.md`) but was never requested here.

## UI

A new "Staff" panel on the existing `/school/roster` page (`RosterClient.tsx`), separate from the student/alumni CSV import flow: an add-by-name/email form plus a list of current staff with a remove button. Visible to both canonical and staff accounts; add/remove controls only rendered/enabled for the canonical account (`callerId === schoolId`).

## Edge cases

- Staff inviting staff: blocked server-side (403), not just hidden in the UI.
- Removing the canonical account itself: out of scope — there is no "promote a staff account to canonical" flow. If this is ever needed it's a separate spec.
- A staff account's own `Profile` is independent of the canonical account's `Profile` (separate `displayName`, etc.) — they are fully distinct `User` rows, just linked by `primarySchoolId`.

## Testing

- Unit/integration: `getSchoolSession()` resolves the same `schoolId` for canonical and staff callers; roster/import/mentorship routes behave identically regardless of which kind of `SCHOOL` account calls them.
- `POST /api/school/staff` rejected (403) when called by a staff account.
- `DELETE /api/school/staff/[userId]` rejected (403) when called by a staff account, or when `userId` doesn't belong to caller's school.
- Manual/browser: click "Add Teacher" from the canonical account, confirm a welcome email with a working set-password link arrives automatically, set a real password, log in as the new staff account while the canonical account stays logged in on another session, confirm both see identical roster data.
