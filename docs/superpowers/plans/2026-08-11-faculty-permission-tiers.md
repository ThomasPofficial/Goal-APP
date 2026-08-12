# Faculty Permission Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give schools real, individual logins for faculty (principal, guidance counselors, IT managers, teachers), organized into admin-customizable permission tiers that gate the roster and campaigns/fundraising features.

**Architecture:** A new `STAFF` role sits alongside the existing sole-admin `SCHOOL` role. Each `STAFF` user is scoped to a school via `profile.schoolId` and gets its permissions from either a shared `FacultyTier` (+ optional additive per-person overrides) or, if unassigned to any tier, a fully custom per-person permission set. A new `requireSchoolCapability(capability)` helper replaces the hardcoded `role === "SCHOOL"` checks on roster/campaigns routes, resolving the effective `schoolId` and authorization for both `SCHOOL` and `STAFF` callers. Staff onboard via an invite-link flow built on the app's **existing** `PasswordResetToken` model and `resetPassword(token, password)` server action (`app/actions/auth.ts`) — reused rather than duplicated, per a reconciliation with a concurrent session's overlapping roster-activation spec (see the design doc's "Reconciliation note"). Sending the notification is mocked (link is displayed on-screen, not emailed). A person invited as staff is `role: STUDENT` until they claim the link, at which point `role` flips to `STAFF` — driven by pre-existing tier/override data on their `Profile`, not by any special token type, so `resetPassword` itself stays fully generic.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma (Postgres on Render), NextAuth v5 (Credentials provider, JWT sessions), bcryptjs.

## Global Constraints

- No automated test runner exists for the Next.js app (`app/`, `lib/`, `prisma/`) — `server/` has its own separate Jest suite for an unrelated socket service, not applicable here. Per project convention, verify each task with `npx tsc --noEmit` (must be clean of new errors) plus a manual check (dev server + browser, or a throwaway `npx tsx` script for pure-logic files) rather than inventing a new test framework.
- Every schema change needs a **hand-written** migration file in `prisma/migrations/YYYYMMDDHHMMSS_description/migration.sql` — `prisma generate` does NOT create one, and Render runs `prisma migrate deploy` at startup; a missing file means a crash-on-deploy with "column does not exist." Use `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` and wrap `ADD CONSTRAINT` in a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;` block, matching existing migrations (see `prisma/migrations/20260807000000_add_partnership_request_and_invite/migration.sql`).
- `ALTER TYPE ... ADD VALUE` must live alone in its own migration file, not combined with statements that might use the new value in the same transaction (matches the existing `20260628100000_add_school_role` migration, which only adds the `SCHOOL` enum value).
- Never use curl or PowerShell `Invoke-WebRequest` against HTTPS endpoints in this dev environment (SSL cert verification fails here) — use `node --use-system-ca` or plain `fetch`/`node -e` for local `http://localhost:3000` calls (no SSL involved there).
- Out of scope for this feature (do not touch): mentorship pairing (`/school/mentorship`), partnerships/connections approval, real email delivery (the invite notification step is intentionally mocked), per-tier permission revocation below what a tier grants (only additive overrides), any change to `isWalledStudent()`'s messaging/mentorship gating beyond the natural effect of `STAFF` no longer being `role: STUDENT`, and the generic roster-activation feature for students/alumni (`/school/roster`'s add-member/CSV-import flow, `app/api/school/roster/members/route.ts` / `import/route.ts`'s *creation* logic) — owned by a concurrent session's `docs/superpowers/plans/2026-08-11-roster-invite-activation-design.md`. This plan's Task 13 still touches those same two roster files, but only their top-level auth check (swapping `getSchoolSession()`/inline role checks for `requireSchoolCapability`), never their user-creation branches — keep that boundary so the two efforts don't collide.
- `app/actions/auth.ts`'s `resetPassword` function is shared with the existing `/reset-password` (forgot-password) flow and, per the reconciliation, is also the claim mechanism for this feature's staff invites. Task 4 makes exactly one additive change to it (success return gains `userId`) — do not change its validation, expiry, or password-setting logic, and do not add any staff-specific branching inside it. Staff-specific logic (the role flip) lives entirely in `lib/staffInvite.ts`, which calls `resetPassword` rather than reimplementing it.

---

## File Structure

New files:
- `lib/facultyPermissions.ts` — capability list, default tier definitions, `getOrCreateDefaultTiers()`, `computeEffectivePermissions()`.
- `lib/staffInvite.ts` — `createStaffInvite()` (resolves the user, sets tier/override data, issues a `PasswordResetToken`), `notifyInvite()` (mocked), `checkStaffInviteToken()` (GET-time validity check), `acceptStaffInvite()` (calls the existing `resetPassword`, then promotes role to `STAFF` when appropriate).
- `app/api/school/staff/tiers/route.ts` — GET (list, seeding defaults on first call), POST (create tier) — `SCHOOL`-only.
- `app/api/school/staff/tiers/[tierId]/route.ts` — PATCH (rename/edit permissions), DELETE — `SCHOOL`-only.
- `app/api/school/staff/route.ts` — GET (list staff + pending invites), POST (send invite) — `staff:manage`.
- `app/api/school/staff/[userId]/route.ts` — PATCH (reassign tier or set custom permissions for one person) — `staff:manage`.
- `app/api/staff/accept-invite/route.ts` — GET (validate token), POST (accept: set password via the existing `resetPassword`, promote role) — public, no session required.
- `app/staff/accept-invite/page.tsx` + `AcceptInviteClient.tsx` — public accept-invite page (outside the `(dashboard)` route group, like `/login`).
- `app/(dashboard)/school/staff/page.tsx` + `StaffClient.tsx` — staff management UI: list, invite, reassign, tier editor.

Modified files:
- `prisma/schema.prisma` — `STAFF` enum value, `FacultyTier` model, `Profile.staffTierId`/`staffTier`/`staffPermissionOverrides`/`staffInvited`. No new invite/token table — invites reuse the existing `PasswordResetToken` model.
- `app/actions/auth.ts` — one additive change: `resetPassword`'s success return gains `userId`. No other change to this file.
- `lib/school-auth.ts` — add `requireSchoolCapability(capability)`.
- `app/api/school/roster/route.ts`, `app/api/school/roster/members/route.ts`, `app/api/school/roster/import/route.ts`, `app/api/school/roster/members/[userId]/route.ts`, `app/(dashboard)/school/roster/page.tsx` — swap to capability-based gating (auth-check lines only — see Global Constraints on the roster-file boundary with the concurrent activation work).
- `app/api/campaigns/route.ts`, `app/api/campaigns/[id]/route.ts`, `app/api/campaigns/generate/route.ts`, `app/api/campaigns/[id]/tweak/route.ts`, `app/(dashboard)/campaigns/page.tsx`, `app/(dashboard)/campaigns/new/page.tsx` — swap to capability-based gating; fix `schoolId: session.user.id` → effective `schoolId` from the capability check.
- `app/(dashboard)/layout.tsx`, `components/layout/Sidebar.tsx`, `components/layout/SidebarShell.tsx` — add `isStaff`/`staffCapabilities` plumbing and nav.

---

### Task 1: Schema — STAFF role, FacultyTier, Profile permission/invite fields

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260811120000_add_staff_role/migration.sql`
- Create: `prisma/migrations/20260811120100_add_faculty_tier_and_profile_permission_fields/migration.sql`

**Interfaces:**
- Produces: `UserRole.STAFF`, `FacultyTier { id, schoolId, name, permissions, isSystemDefault, createdAt, updatedAt }`, `Profile.staffTierId?`, `Profile.staffTier?` (relation), `Profile.staffPermissionOverrides`, `Profile.staffInvited`.
- No new invite/token table — staff invites reuse the existing `PasswordResetToken` model (`prisma/schema.prisma`, already present) untouched by this task.

- [ ] **Step 1: Add `STAFF` to `UserRole` in `prisma/schema.prisma`**

```prisma
enum UserRole {
  STUDENT
  ORG
  ADMIN
  SCHOOL
  STAFF
}
```

- [ ] **Step 2: Add `FacultyTier`** (place after the `Profile` model in `prisma/schema.prisma`)

```prisma
model FacultyTier {
  id              String    @id @default(cuid())
  schoolId        String    // references User.id where role=SCHOOL
  name            String
  permissions     String    @default("[]") // JSON array of capability strings
  isSystemDefault Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  profiles        Profile[]

  @@index([schoolId])
}
```

- [ ] **Step 3: Add permission/invite fields to `Profile`** — insert after the existing `staffTitle String?` line in `prisma/schema.prisma`:

```prisma
  staffTierId              String?
  staffTier                FacultyTier? @relation(fields: [staffTierId], references: [id])
  staffPermissionOverrides String       @default("[]") // JSON array; additive if staffTierId set, else the full set
  staffInvited              Boolean      @default(false) // true once a staff invite has been sent for this profile
```

- [ ] **Step 4: Write the enum migration** — `prisma/migrations/20260811120000_add_staff_role/migration.sql`:

```sql
-- Add STAFF role to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';
```

- [ ] **Step 5: Write the table/columns migration** — `prisma/migrations/20260811120100_add_faculty_tier_and_profile_permission_fields/migration.sql`:

```sql
-- Faculty permission tiers: FacultyTier, Profile permission/invite fields

CREATE TABLE IF NOT EXISTS "FacultyTier" (
  "id"              TEXT NOT NULL,
  "schoolId"        TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "permissions"     TEXT NOT NULL DEFAULT '[]',
  "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FacultyTier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FacultyTier_schoolId_idx" ON "FacultyTier"("schoolId");

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "staffTierId" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "staffPermissionOverrides" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "staffInvited" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE "Profile" ADD CONSTRAINT "Profile_staffTierId_fkey"
    FOREIGN KEY ("staffTierId") REFERENCES "FacultyTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

- [ ] **Step 6: Generate the Prisma client and verify**

Run: `npx prisma generate`
Expected: completes with no errors, regenerates `node_modules/@prisma/client` with the new types.

Run: `npx tsc --noEmit`
Expected: no new errors beyond this repo's pre-existing baseline (8 errors in `app/(dashboard)/admin/org-categories/page.tsx`, `app/(dashboard)/orgs/OrgsClient.tsx`, and `prisma/seed-mock.ts`, confirmed present before this plan started — unrelated to this feature, do not fix them as part of this task).

- [ ] **Step 7: Apply the migration locally against the dev database**

Run: `npx prisma migrate deploy`
Expected: both new migrations listed as applied, no errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260811120000_add_staff_role prisma/migrations/20260811120100_add_faculty_tier_and_profile_permission_fields
git commit -m "feat: add STAFF role, FacultyTier model, and staff permission fields on Profile"
```

---

### Task 2: `lib/facultyPermissions.ts` — capabilities, default tiers, effective-permission logic

**Files:**
- Create: `lib/facultyPermissions.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`, `FacultyTier` Prisma model (Task 1).
- Produces: `CAPABILITIES: readonly Capability[]`, `type Capability`, `DEFAULT_TIERS: { name: string; permissions: Capability[] }[]`, `getOrCreateDefaultTiers(schoolId: string): Promise<FacultyTierRow[]>`, `computeEffectivePermissions(args: { tierPermissions: string | null; overrides: string }): Capability[]`, `hasCapability(perms: Capability[], cap: Capability): boolean`.

- [ ] **Step 1: Write `lib/facultyPermissions.ts`**

```typescript
import { prisma } from "@/lib/prisma";

export const CAPABILITIES = [
  "roster:view",
  "roster:edit",
  "campaigns:view",
  "campaigns:edit",
  "staff:manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const DEFAULT_TIERS: { name: string; permissions: Capability[] }[] = [
  {
    name: "Principal",
    permissions: ["roster:view", "roster:edit", "campaigns:view", "campaigns:edit", "staff:manage"],
  },
  {
    name: "Guidance Counselor",
    permissions: ["roster:view", "roster:edit", "campaigns:view"],
  },
  {
    name: "IT Manager",
    permissions: ["roster:view", "roster:edit", "staff:manage"],
  },
  {
    name: "Teacher",
    permissions: ["roster:view"],
  },
];

function parseCapabilityList(json: string | null | undefined): Capability[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is Capability => CAPABILITIES.includes(v));
  } catch {
    return [];
  }
}

export async function getOrCreateDefaultTiers(schoolId: string) {
  const existing = await prisma.facultyTier.findMany({
    where: { schoolId },
    orderBy: { createdAt: "asc" },
  });
  if (existing.length > 0) return existing;

  await prisma.facultyTier.createMany({
    data: DEFAULT_TIERS.map((t) => ({
      schoolId,
      name: t.name,
      permissions: JSON.stringify(t.permissions),
      isSystemDefault: true,
    })),
  });

  return prisma.facultyTier.findMany({
    where: { schoolId },
    orderBy: { createdAt: "asc" },
  });
}

export function computeEffectivePermissions(args: {
  tierPermissions: string | null | undefined;
  overrides: string | null | undefined;
}): Capability[] {
  const overrides = parseCapabilityList(args.overrides);
  if (!args.tierPermissions) {
    // No tier: overrides ARE the complete, custom permission set for this person.
    return overrides;
  }
  const tierPerms = parseCapabilityList(args.tierPermissions);
  return Array.from(new Set([...tierPerms, ...overrides]));
}

export function hasCapability(perms: Capability[], capability: Capability): boolean {
  return perms.includes(capability);
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Write and run a throwaway verification script** — create `scratch-facultyPermissions.ts` at the repo root:

```typescript
import { computeEffectivePermissions, hasCapability, CAPABILITIES } from "./lib/facultyPermissions";

// Tiered person: union of tier + overrides
const tiered = computeEffectivePermissions({
  tierPermissions: JSON.stringify(["roster:view"]),
  overrides: JSON.stringify(["campaigns:view"]),
});
console.assert(hasCapability(tiered, "roster:view"), "expected roster:view from tier");
console.assert(hasCapability(tiered, "campaigns:view"), "expected campaigns:view from override");
console.assert(!hasCapability(tiered, "staff:manage"), "did not expect staff:manage");

// Custom person (no tier): overrides ARE the full set
const custom = computeEffectivePermissions({
  tierPermissions: null,
  overrides: JSON.stringify(["campaigns:edit"]),
});
console.assert(hasCapability(custom, "campaigns:edit"), "expected campaigns:edit for custom person");
console.assert(!hasCapability(custom, "roster:view"), "custom person should not inherit anything else");

// Garbage/empty input never throws
console.assert(computeEffectivePermissions({ tierPermissions: null, overrides: "not json" }).length === 0, "bad JSON should yield []");

console.log("facultyPermissions checks OK", CAPABILITIES.length, "capabilities defined");
```

Run: `npx tsx scratch-facultyPermissions.ts`
Expected: `facultyPermissions checks OK 5 capabilities defined` with no assertion failures printed.

- [ ] **Step 4: Delete the throwaway script**

```bash
rm scratch-facultyPermissions.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/facultyPermissions.ts
git commit -m "feat: add faculty permission capability and default-tier logic"
```

---

### Task 3: `lib/school-auth.ts` — `requireSchoolCapability()`

**Files:**
- Modify: `lib/school-auth.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`, `prisma` from `@/lib/prisma`, `Capability`/`computeEffectivePermissions`/`hasCapability` from `@/lib/facultyPermissions` (Task 2).
- Produces: `requireSchoolCapability(capability: Capability): Promise<{ schoolId: string } | { error: "Unauthorized" | "Forbidden"; status: 401 | 403 }>`. Existing `getSchoolSession()` is unchanged (still used by out-of-scope routes like mentorship/partnerships).

- [ ] **Step 1: Add `requireSchoolCapability` to `lib/school-auth.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEffectivePermissions, hasCapability, type Capability } from "@/lib/facultyPermissions";

export async function getSchoolSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" as const, status: 401 as const };
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") return { error: "Forbidden" as const, status: 403 as const };
  return { schoolId: session.user.id };
}

export async function requireSchoolCapability(capability: Capability) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" as const, status: 401 as const };

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      profile: {
        select: {
          schoolId: true,
          staffPermissionOverrides: true,
          staffTier: { select: { permissions: true } },
        },
      },
    },
  });

  if (dbUser?.role === "SCHOOL" || dbUser?.role === "ADMIN") {
    return { schoolId: session.user.id };
  }

  if (dbUser?.role === "STAFF" && dbUser.profile?.schoolId) {
    const perms = computeEffectivePermissions({
      tierPermissions: dbUser.profile.staffTier?.permissions ?? null,
      overrides: dbUser.profile.staffPermissionOverrides,
    });
    if (hasCapability(perms, capability)) {
      return { schoolId: dbUser.profile.schoolId };
    }
  }

  return { error: "Forbidden" as const, status: 403 as const };
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/school-auth.ts
git commit -m "feat: add requireSchoolCapability for STAFF-aware permission checks"
```

---

### Task 4: `lib/staffInvite.ts` — create, notify (mocked), accept (built on the existing password-reset primitive)

**Files:**
- Modify: `app/actions/auth.ts` — one additive change to `resetPassword`'s success return.
- Create: `lib/staffInvite.ts`

**Interfaces:**
- Consumes: `prisma`, `bcryptjs` (already a dependency), `crypto` (`randomBytes`, `createHash` — Node builtin, matches the existing pattern in `app/actions/auth.ts`), `Capability` (Task 2), `resetPassword` from `@/app/actions/auth`.
- Produces (from `app/actions/auth.ts`): `resetPassword(token, password): Promise<{ error: string } | { success: true; userId: string }>` — same signature as today, success branch gains `userId`.
- Produces (from `lib/staffInvite.ts`): `createStaffInvite(args: { email: string; schoolId: string; tierId?: string | null; customPermissions?: Capability[]; staffTitle?: string }): Promise<{ status: "invited"; link: string } | { status: "already-staff" }>`, `notifyInvite(email: string, link: string): Promise<void>` (mock — logs only), `checkStaffInviteToken(token: string): Promise<{ valid: true; email: string } | { valid: false; error: string }>`, `acceptStaffInvite(args: { token: string; password: string; displayName?: string; staffTitle?: string }): Promise<{ error: string } | { userId: string }>`.

- [ ] **Step 1: Extend `resetPassword`'s success return in `app/actions/auth.ts`** — this is the ONLY change to this file. Find the function's return type and its two return statements (see the current file: `Promise<{ error: string } | { success: true }>` in the signature, and `return { success: true };` at the end of the `$transaction` block). Change the signature's success branch to `{ success: true; userId: string }` and the final return to include it:

```typescript
export async function resetPassword(
  token: string,
  password: string
): Promise<{ error: string } | { success: true; userId: string }> {
```

and at the end (replacing only `return { success: true };`):

```typescript
  return { success: true, userId: user.id };
```

Nothing else in this function changes — same token hashing, same expiry check, same `$transaction`, same error branches. `user` is already in scope from the existing `const user = await prisma.user.findUnique({ where: { email: record.email } });` line above it.

- [ ] **Step 2: Write `lib/staffInvite.ts`**

```typescript
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { resetPassword } from "@/app/actions/auth";
import type { Capability } from "@/lib/facultyPermissions";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function baseUrl() {
  return process.env.AUTH_URL ?? "https://app.nivarro.co";
}

function hasAnyStaffAssignment(profile: { staffTierId: string | null; staffPermissionOverrides: string }) {
  if (profile.staffTierId) return true;
  try {
    const parsed = JSON.parse(profile.staffPermissionOverrides);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export async function createStaffInvite(args: {
  email: string;
  schoolId: string;
  tierId?: string | null;
  customPermissions?: Capability[];
  staffTitle?: string;
}): Promise<{ status: "invited"; link: string } | { status: "already-staff" }> {
  const email = args.email.trim().toLowerCase();
  const overridesJson = JSON.stringify(args.customPermissions ?? []);

  const existing = await prisma.user.findUnique({ where: { email }, include: { profile: true } });

  if (existing?.role && !["STUDENT", "STAFF"].includes(existing.role)) {
    throw new Error("This email already belongs to a different account type");
  }

  if (existing?.role === "STAFF") {
    // Already has a working login — just update their tier/overrides, no token needed.
    await prisma.profile.update({
      where: { userId: existing.id },
      data: { staffTierId: args.tierId ?? null, staffPermissionOverrides: overridesJson, staffInvited: true },
    });
    return { status: "already-staff" };
  }

  let userId: string;
  if (existing) {
    await prisma.profile.update({
      where: { userId: existing.id },
      data: {
        staffTierId: args.tierId ?? null,
        staffPermissionOverrides: overridesJson,
        staffInvited: true,
        ...(args.staffTitle ? { staffTitle: args.staffTitle } : {}),
      },
    });
    userId = existing.id;
  } else {
    const created = await prisma.user.create({
      data: {
        email,
        name: email,
        role: "STUDENT",
        profile: {
          create: {
            displayName: email,
            schoolId: args.schoolId,
            staffTitle: args.staffTitle ?? null,
            staffTierId: args.tierId ?? null,
            staffPermissionOverrides: overridesJson,
            staffInvited: true,
            onboardingComplete: false,
          },
        },
      },
    });
    userId = created.id;
  }

  // Same dedup + token scheme as requestPasswordReset (app/actions/auth.ts),
  // just a 7-day expiry instead of 1 hour — this is a "get around to it"
  // invite, not an urgent security action.
  await prisma.passwordResetToken.deleteMany({ where: { email } });
  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");
  await prisma.passwordResetToken.create({
    data: { email, token: hashedToken, expires: new Date(Date.now() + INVITE_TTL_MS) },
  });

  const link = `${baseUrl()}/staff/accept-invite?token=${rawToken}`;
  await notifyInvite(email, link);

  return { status: "invited", link };
}

// Mocked: real email delivery is deferred. The caller (API route) returns
// `link` directly in the response so the inviter can copy/send it manually.
// Swap this function's body for a lib/resend.ts call to go live later —
// nothing else in the invite flow needs to change.
export async function notifyInvite(email: string, link: string) {
  console.log(`[staff-invite mock] would email ${email}: ${link}`);
}

export async function checkStaffInviteToken(token: string): Promise<{ valid: true; email: string } | { valid: false; error: string }> {
  const hashedToken = createHash("sha256").update(token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { token: hashedToken } });
  if (!record) return { valid: false, error: "Invite not found" };
  if (record.expires < new Date()) return { valid: false, error: "Invite expired" };
  return { valid: true, email: record.email };
}

export async function acceptStaffInvite(args: {
  token: string;
  password: string;
  displayName?: string;
  staffTitle?: string;
}): Promise<{ error: string } | { userId: string }> {
  const result = await resetPassword(args.token, args.password);
  if ("error" in result) return result;

  const user = await prisma.user.findUnique({ where: { id: result.userId }, include: { profile: true } });
  if (!user?.profile) return { userId: result.userId };

  if (args.displayName || args.staffTitle) {
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        ...(args.displayName ? { displayName: args.displayName } : {}),
        ...(args.staffTitle ? { staffTitle: args.staffTitle } : {}),
      },
    });
  }

  // Only promote when this activation was a staff invite (signaled by
  // pre-existing tier/override data set at invite time), never for a plain
  // password reset — resetPassword itself has no concept of staff invites.
  if (user.role === "STUDENT" && hasAnyStaffAssignment(user.profile)) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "STAFF" } });
  }

  return { userId: user.id };
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors beyond the pre-existing baseline (see Task 1 Step 6).

- [ ] **Step 4: Manual verification of the extended `resetPassword`** — confirm the existing `/reset-password` flow still works: use `requestPasswordReset` (e.g. via the app's "forgot password" UI, or by calling it directly against a demo account's email) to generate a real reset link, open `/reset-password?token=...`, submit a new password, and confirm login with the new password succeeds. This is the regression check for Step 1's change — the only consumer of `resetPassword` besides this feature.

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth.ts lib/staffInvite.ts
git commit -m "feat: add staff invite flow built on the existing password-reset primitive"
```

---

### Task 5: `app/api/school/staff/tiers/route.ts` — list (seed defaults) + create tier

**Files:**
- Create: `app/api/school/staff/tiers/route.ts`

**Interfaces:**
- Consumes: `getSchoolSession` (`@/lib/school-auth`), `getOrCreateDefaultTiers`/`CAPABILITIES` (`@/lib/facultyPermissions`), `prisma`.
- Produces: `GET` → `{ tiers: { id, name, permissions: Capability[], isSystemDefault }[] }`; `POST { name, permissions }` → `{ tier }`. Both `SCHOOL`-only (tier *definitions* are never delegated, per the design's delegation rule).

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, getOrCreateDefaultTiers, type Capability } from "@/lib/facultyPermissions";

export async function GET() {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const tiers = await getOrCreateDefaultTiers(check.schoolId);

  return NextResponse.json({
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name,
      permissions: JSON.parse(t.permissions) as Capability[],
      isSystemDefault: t.isSystemDefault,
    })),
  });
}

export async function POST(req: NextRequest) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => ({}));
  const { name, permissions } = body as { name?: string; permissions?: string[] };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const validPermissions = (permissions ?? []).filter((p): p is Capability =>
    (CAPABILITIES as readonly string[]).includes(p)
  );

  const tier = await prisma.facultyTier.create({
    data: {
      schoolId: check.schoolId,
      name: name.trim(),
      permissions: JSON.stringify(validPermissions),
      isSystemDefault: false,
    },
  });

  return NextResponse.json({
    tier: { id: tier.id, name: tier.name, permissions: validPermissions, isSystemDefault: false },
  });
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification against the dev server** — start `npm run dev`, log in as the `SCHOOL` demo account (`ridgepoint@nivarro.demo` / `ridgepoint2026` or another school-role demo account from the seed endpoint), then in the browser console or a scratch `node -e` fetch against `http://localhost:3000/api/school/staff/tiers` with the session cookie:

Expected on first `GET`: `{ tiers: [...] }` with exactly 4 entries named Principal, Guidance Counselor, IT Manager, Teacher, each `isSystemDefault: true`.
Expected on second `GET`: same 4 entries (not duplicated — confirms `getOrCreateDefaultTiers` only seeds once).

- [ ] **Step 4: Commit**

```bash
git add app/api/school/staff/tiers/route.ts
git commit -m "feat: add faculty tier list/create endpoint (SCHOOL-only)"
```

---

### Task 6: `app/api/school/staff/tiers/[tierId]/route.ts` — rename/edit, delete

**Files:**
- Create: `app/api/school/staff/tiers/[tierId]/route.ts`

**Interfaces:**
- Consumes: `getSchoolSession`, `CAPABILITIES`/`Capability`, `prisma`.
- Produces: `PATCH { name?, permissions? }` → `{ tier }`; `DELETE` → `{ ok: true }`. Both scoped to tiers belonging to the caller's school; `SCHOOL`-only.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { tierId } = await params;

  const existing = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, permissions } = body as { name?: string; permissions?: string[] };

  const data: { name?: string; permissions?: string } = {};
  if (name?.trim()) data.name = name.trim();
  if (permissions) {
    const validPermissions = permissions.filter((p): p is Capability =>
      (CAPABILITIES as readonly string[]).includes(p)
    );
    data.permissions = JSON.stringify(validPermissions);
  }

  const tier = await prisma.facultyTier.update({ where: { id: tierId }, data });

  return NextResponse.json({
    tier: { id: tier.id, name: tier.name, permissions: JSON.parse(tier.permissions), isSystemDefault: tier.isSystemDefault },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { tierId } = await params;

  const existing = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Staff on this tier fall back to no-permissions rather than a dangling reference.
  await prisma.profile.updateMany({ where: { staffTierId: tierId }, data: { staffTierId: null } });
  await prisma.facultyTier.delete({ where: { id: tierId } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification** — with the dev server running and logged in as a `SCHOOL` account, `PATCH` one of the seeded tiers (e.g. rename "Teacher" → "Classroom Staff", or add `campaigns:view` to its permissions) and re-`GET` `/api/school/staff/tiers` to confirm the change persisted; then `DELETE` a non-default tier you create via Task 5's `POST` and confirm it's gone from the list.

Expected: rename/permission edits persist across requests; delete removes the tier and returns `{ ok: true }`; deleting a tier a staff member is on doesn't error (their `staffTierId` is cleared).

- [ ] **Step 4: Commit**

```bash
git add "app/api/school/staff/tiers/[tierId]/route.ts"
git commit -m "feat: add faculty tier rename/edit/delete endpoint (SCHOOL-only)"
```

---

### Task 7: `app/api/school/staff/route.ts` — list staff + send invite

**Files:**
- Create: `app/api/school/staff/route.ts`

**Interfaces:**
- Consumes: `requireSchoolCapability` (Task 3), `createStaffInvite` (Task 4), `prisma`.
- Produces: `GET` → `{ staff: { userId, email, displayName, staffTitle, tierId, tierName, isCustom }[], pendingInvites: { userId, email, displayName, staffTitle, tierId, tierName, isCustom }[] }` — `staff` is everyone with `role: "STAFF"`; `pendingInvites` is everyone still `role: "STUDENT"` with `profile.staffInvited: true` (invited, not yet claimed). `POST { email, tierId?, staffTitle? }` (tier case) or `{ email, customPermissions, staffTitle? }` (custom case) → `{ status: "invited"; link: string } | { status: "already-staff" }`. Both gated on `staff:manage`.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolCapability } from "@/lib/school-auth";
import { createStaffInvite } from "@/lib/staffInvite";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";

export async function GET() {
  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const profiles = await prisma.profile.findMany({
    where: {
      schoolId: check.schoolId,
      user: { role: { in: ["STAFF", "STUDENT"] } },
      OR: [{ user: { role: "STAFF" } }, { staffInvited: true }],
    },
    include: { user: { select: { id: true, email: true, role: true } }, staffTier: { select: { id: true, name: true } } },
    orderBy: { displayName: "asc" },
  });

  const toRow = (p: (typeof profiles)[number]) => ({
    userId: p.user.id,
    email: p.user.email,
    displayName: p.displayName,
    staffTitle: p.staffTitle,
    tierId: p.staffTierId,
    tierName: p.staffTierId ? p.staffTier?.name ?? null : "Custom",
    isCustom: !p.staffTierId,
  });

  return NextResponse.json({
    staff: profiles.filter((p) => p.user.role === "STAFF").map(toRow),
    pendingInvites: profiles.filter((p) => p.user.role === "STUDENT").map(toRow),
  });
}

export async function POST(req: NextRequest) {
  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => ({}));
  const { email, tierId, customPermissions, staffTitle } = body as {
    email?: string;
    tierId?: string | null;
    customPermissions?: string[];
    staffTitle?: string;
  };

  if (!email?.trim()) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  if (tierId) {
    const tier = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
    if (!tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const validCustomPermissions = (customPermissions ?? []).filter((p): p is Capability =>
    (CAPABILITIES as readonly string[]).includes(p)
  );

  try {
    const result = await createStaffInvite({
      email: email.trim(),
      schoolId: check.schoolId,
      tierId: tierId ?? null,
      customPermissions: tierId ? [] : validCustomPermissions,
      staffTitle,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send invite";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors beyond the pre-existing baseline (see Task 1 Step 6).

- [ ] **Step 3: Manual verification** — as a `SCHOOL` account, `POST` `/api/school/staff` with `{ "email": "test-teacher@example.com", "tierId": "<a real tier id from Task 5's GET>", "staffTitle": "Teacher" }`.

Expected: `200` with `{ status: "invited", link: "https://app.nivarro.co/staff/accept-invite?token=..." }` (or `http://localhost:...` if `AUTH_URL` is set for local dev); a `GET` to `/api/school/staff` afterward shows the email under `pendingInvites` with the right `tierName`. Re-`POST`ing the same email regenerates the link (resend behavior) rather than erroring.

- [ ] **Step 4: Commit**

```bash
git add app/api/school/staff/route.ts
git commit -m "feat: add staff list and invite endpoint"
```

---

### Task 8: `app/api/school/staff/[userId]/route.ts` — reassign tier / set custom permissions

**Files:**
- Create: `app/api/school/staff/[userId]/route.ts`

**Interfaces:**
- Consumes: `requireSchoolCapability`, `prisma`, `CAPABILITIES`/`Capability`.
- Produces: `PATCH { tierId }` (assign to a tier, clears overrides) or `PATCH { customPermissions }` (switch to Custom with this exact set) → `{ ok: true }`. Gated on `staff:manage`; only touches `STAFF` profiles within the caller's own school.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolCapability } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { userId } = await params;

  const target = await prisma.user.findFirst({
    where: { id: userId, role: "STAFF", profile: { schoolId: check.schoolId } },
    include: { profile: true },
  });
  if (!target?.profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { tierId, customPermissions } = body as { tierId?: string | null; customPermissions?: string[] };

  if (tierId !== undefined) {
    if (tierId) {
      const tier = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
      if (!tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }
    await prisma.profile.update({
      where: { userId },
      data: { staffTierId: tierId, staffPermissionOverrides: "[]" },
    });
  } else if (customPermissions !== undefined) {
    const validPermissions = customPermissions.filter((p): p is Capability =>
      (CAPABILITIES as readonly string[]).includes(p)
    );
    await prisma.profile.update({
      where: { userId },
      data: { staffTierId: null, staffPermissionOverrides: JSON.stringify(validPermissions) },
    });
  } else {
    return NextResponse.json({ error: "tierId or customPermissions required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification** — after Task 4's/Task 9's accept flow produces a real `STAFF` user, `PATCH` `/api/school/staff/<that-userId>` with `{ "customPermissions": ["roster:view", "campaigns:view"] }`, then confirm via `/api/school/staff` GET that `isCustom: true` and via a login as that staff user that they can hit `campaigns:view`-gated routes but not `roster:edit`-gated ones. Then `PATCH` again with `{ "tierId": "<a tier id>" }` and confirm it switches back to `isCustom: false` with the tier's permissions applying.

Expected: both directions work; permission checks in Task 3's helper reflect the change immediately (no caching).

- [ ] **Step 4: Commit**

```bash
git add "app/api/school/staff/[userId]/route.ts"
git commit -m "feat: add per-staff tier reassignment and custom permission endpoint"
```

---

### Task 9: `app/api/staff/accept-invite/route.ts` — public token validation + accept

**Files:**
- Create: `app/api/staff/accept-invite/route.ts`

**Interfaces:**
- Consumes: `checkStaffInviteToken`/`acceptStaffInvite` (Task 4).
- Produces: `GET ?token=` → `{ valid: true, email } | { valid: false, error }` (no auth required); `POST { token, password, displayName?, staffTitle? }` → `{ userId } | { error }` (no auth required — this endpoint is how a staff member gets their FIRST session). The underlying token IS a `PasswordResetToken` row (Task 4) — this route never references that model directly, only through `lib/staffInvite.ts`'s two functions.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { checkStaffInviteToken, acceptStaffInvite } from "@/lib/staffInvite";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false, error: "Missing token" }, { status: 400 });

  const result = await checkStaffInviteToken(token);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, password, displayName, staffTitle } = body as {
    token?: string;
    password?: string;
    displayName?: string;
    staffTitle?: string;
  };

  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: "token and a password of at least 6 characters are required" }, { status: 400 });
  }

  const result = await acceptStaffInvite({ token, password, displayName, staffTitle });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ userId: result.userId });
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification** — using the invite link produced in Task 7's Step 3, extract the `token` query param and: `GET /api/staff/accept-invite?token=<token>` → expect `{ valid: true, email: "test-teacher@example.com" }`; then `POST /api/staff/accept-invite` with `{ "token": "<token>", "password": "testpass123", "displayName": "Test Teacher" }` → expect `{ userId: "..." }`. Repeat the `GET` afterward and confirm it now returns `{ valid: false, error: "Invite not found" }` (the underlying `PasswordResetToken` row is deleted on successful claim, same as a normal password reset). Confirm in Prisma Studio (`npx prisma studio`) or a quick query that the `User` for that email now has `role: "STAFF"`, and log in as `test-teacher@example.com` / `testpass123` via `/login` to confirm the password actually works.

Expected: all of the above pass; login succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/api/staff/accept-invite/route.ts
git commit -m "feat: add public staff invite validation and acceptance endpoint"
```

---

### Task 10: Public accept-invite page

**Files:**
- Create: `app/staff/accept-invite/page.tsx`
- Create: `app/staff/accept-invite/AcceptInviteClient.tsx`

**Interfaces:**
- Consumes: `/api/staff/accept-invite` (Task 9).
- Produces: a page at `/staff/accept-invite?token=...` — outside `(dashboard)`, no session required, styled like `/login`.

- [ ] **Step 1: Write `app/staff/accept-invite/page.tsx`**

```typescript
import AcceptInviteClient from "./AcceptInviteClient";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AcceptInviteClient token={token ?? ""} />;
}
```

- [ ] **Step 2: Write `app/staff/accept-invite/AcceptInviteClient.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AcceptInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [staffTitle, setStaffTitle] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setError("Missing invite token");
      return;
    }
    fetch(`/api/staff/accept-invite?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setStatus("valid");
          setEmail(data.email);
        } else {
          setStatus("invalid");
          setError(data.error ?? "This invite is no longer valid");
        }
      })
      .catch(() => {
        setStatus("invalid");
        setError("Could not check this invite. Try again.");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, displayName, staffTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create your account");
        setSubmitting(false);
        return;
      }
      await signIn("credentials", { email, password, redirectTo: "/dashboard" });
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  if (status === "checking") return <div style={{ padding: 32 }}>Checking invite...</div>;
  if (status === "invalid") return <div style={{ padding: 32 }}>{error}</div>;

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 24 }}>
      <h1>Set up your account</h1>
      <p>You're joining as staff — email: {email}</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Full name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Title (optional, e.g. "AP History Teacher")</label>
          <input value={staffTitle} onChange={(e) => setStaffTitle(e.target.value)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification** — with the dev server running, send a fresh invite (Task 7 Step 3 style, different email), open the returned link directly in a browser at `http://localhost:3000/staff/accept-invite?token=...`.

Expected: page shows "Checking invite..." then the form with the correct email; submitting creates the account and redirects to `/dashboard` logged in as that staff user (confirm the account menu / session shows their name).

- [ ] **Step 5: Commit**

```bash
git add app/staff/accept-invite
git commit -m "feat: add public staff accept-invite page"
```

---

### Task 11: Staff management UI (`/school/staff`)

**Files:**
- Create: `app/(dashboard)/school/staff/page.tsx`
- Create: `app/(dashboard)/school/staff/StaffClient.tsx`

**Interfaces:**
- Consumes: `/api/school/staff` (Task 7), `/api/school/staff/[userId]` (Task 8), `/api/school/staff/tiers` + `/api/school/staff/tiers/[tierId]` (Tasks 5–6), `requireSchoolCapability`/`getSchoolSession`.
- Produces: a page visible to `SCHOOL` and delegated `STAFF` (`staff:manage`); tier-editor section additionally gated to `SCHOOL` only, matching the design's delegation rule.

- [ ] **Step 1: Write `app/(dashboard)/school/staff/page.tsx`** (server component: auth gate + initial data fetch, mirrors `app/(dashboard)/school/roster/page.tsx`'s pattern)

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSchoolCapability } from "@/lib/school-auth";
import { getOrCreateDefaultTiers, type Capability } from "@/lib/facultyPermissions";
import StaffClient from "./StaffClient";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) redirect("/dashboard");

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const isSchool = dbUser?.role === "SCHOOL";

  const tiers = await getOrCreateDefaultTiers(check.schoolId);

  return (
    <StaffClient
      isSchool={isSchool}
      initialTiers={tiers.map((t) => ({
        id: t.id,
        name: t.name,
        permissions: JSON.parse(t.permissions) as Capability[],
        isSystemDefault: t.isSystemDefault,
      }))}
    />
  );
}
```

- [ ] **Step 2: Write `app/(dashboard)/school/staff/StaffClient.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";

interface Tier {
  id: string;
  name: string;
  permissions: Capability[];
  isSystemDefault: boolean;
}

interface StaffMember {
  userId: string;
  email: string | null;
  displayName: string;
  staffTitle: string | null;
  tierId: string | null;
  tierName: string | null;
  isCustom: boolean;
}

interface PendingInvite {
  userId: string;
  email: string | null;
  displayName: string;
  staffTitle: string | null;
  tierId: string | null;
  tierName: string | null;
  isCustom: boolean;
}

export default function StaffClient({ isSchool, initialTiers }: { isSchool: boolean; initialTiers: Tier[] }) {
  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMode, setInviteMode] = useState<"tier" | "custom">("tier");
  const [inviteTierId, setInviteTierId] = useState(initialTiers[0]?.id ?? "");
  const [inviteCustomPerms, setInviteCustomPerms] = useState<Capability[]>([]);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  async function refreshStaff() {
    const res = await fetch("/api/school/staff");
    const data = await res.json();
    setStaff(data.staff ?? []);
    setPendingInvites(data.pendingInvites ?? []);
  }

  useEffect(() => {
    refreshStaff();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/school/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        inviteMode === "tier"
          ? { email: inviteEmail, tierId: inviteTierId }
          : { email: inviteEmail, customPermissions: inviteCustomPerms }
      ),
    });
    const data = await res.json();
    if (res.ok) {
      setLastInviteLink(data.link);
      setInviteEmail("");
      await refreshStaff();
    }
  }

  async function reassignTier(userId: string, tierId: string) {
    await fetch(`/api/school/staff/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId }),
    });
    await refreshStaff();
  }

  async function renameTier(tierId: string, name: string) {
    await fetch(`/api/school/staff/tiers/${tierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const res = await fetch("/api/school/staff/tiers");
    const data = await res.json();
    setTiers(data.tiers ?? []);
  }

  return (
    <div>
      <h1>Staff</h1>

      <section>
        <h2>Invite staff</h2>
        <form onSubmit={handleInvite}>
          <input
            type="email"
            placeholder="email@school.org"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <label>
            <input type="radio" checked={inviteMode === "tier"} onChange={() => setInviteMode("tier")} />
            Assign a tier
          </label>
          {inviteMode === "tier" && (
            <select value={inviteTierId} onChange={(e) => setInviteTierId(e.target.value)}>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <label>
            <input type="radio" checked={inviteMode === "custom"} onChange={() => setInviteMode("custom")} />
            Custom permissions for just this person
          </label>
          {inviteMode === "custom" && (
            <div>
              {CAPABILITIES.map((cap) => (
                <label key={cap}>
                  <input
                    type="checkbox"
                    checked={inviteCustomPerms.includes(cap)}
                    onChange={(e) =>
                      setInviteCustomPerms((prev) =>
                        e.target.checked ? [...prev, cap] : prev.filter((p) => p !== cap)
                      )
                    }
                  />
                  {cap}
                </label>
              ))}
            </div>
          )}
          <button type="submit">Send invite</button>
        </form>
        {lastInviteLink && (
          <p>
            Invite link (send this to them yourself — email delivery isn't wired up yet):{" "}
            <code>{lastInviteLink}</code>
          </p>
        )}
      </section>

      <section>
        <h2>Active staff</h2>
        <ul>
          {staff.map((s) => (
            <li key={s.userId}>
              {s.displayName} ({s.email}) — {s.staffTitle ?? "no title"} —{" "}
              <select value={s.tierId ?? ""} onChange={(e) => reassignTier(s.userId, e.target.value)}>
                <option value="" disabled>{s.isCustom ? "Custom" : s.tierName}</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Pending invites</h2>
        <ul>
          {pendingInvites.map((i) => (
            <li key={i.userId}>{i.displayName} ({i.email}) — {i.staffTitle ?? "no title"} — {i.isCustom ? "Custom" : i.tierName}</li>
          ))}
        </ul>
      </section>

      {isSchool && (
        <section>
          <h2>Tiers</h2>
          <ul>
            {tiers.map((t) => (
              <li key={t.id}>
                <input
                  defaultValue={t.name}
                  onBlur={(e) => e.target.value !== t.name && renameTier(t.id, e.target.value)}
                />
                — {t.permissions.join(", ") || "no permissions"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification** — log in as a `SCHOOL` demo account, visit `/school/staff`.

Expected: 4 default tiers listed under "Tiers" with rename-on-blur working (confirm via re-fetching `/api/school/staff/tiers`); inviting an email in both "Assign a tier" and "Custom permissions" modes produces a link shown on screen; "Active staff" list updates after accepting an invite in another browser/incognito window; reassigning a staff member's tier via the dropdown persists after a page refresh.

Then log in as the `STAFF` account created via Task 9/10's manual test (give it `staff:manage` via Task 8's endpoint first if it doesn't have it) and confirm the "Tiers" edit section is hidden while invite/reassign still work.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/school/staff
git commit -m "feat: add staff management UI (invite, reassign, tier editor)"
```

---

### Task 12: Nav wiring for `STAFF`

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/SidebarShell.tsx`

**Interfaces:**
- Consumes: `computeEffectivePermissions`/`Capability` (Task 2).
- Produces: `isStaff: boolean` and `staffCapabilities: Capability[]` props threaded from `layout.tsx` → `SidebarShell` → `Sidebar`; a nav list for staff filtered by capability.

- [ ] **Step 1: Compute staff capabilities in `app/(dashboard)/layout.tsx`** — extend the existing `dbUser` query's `select` and add the derived values (edit the existing block, don't duplicate the query):

```typescript
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isAlumni: true,
      profile: {
        select: {
          displayName: true,
          geniusType: true,
          schoolId: true,
          staffPermissionOverrides: true,
          staffTier: { select: { permissions: true } },
        },
      },
    },
  });

  const role = dbUser?.role ?? "STUDENT";
  const isSchool = role === "SCHOOL";
  const isStaff = role === "STAFF";
  const isOrg = role === "ORG" || role === "ADMIN";
  const isNivarroAdmin = role === "ADMIN";
  const profile = dbUser?.profile ?? null;
  const isWalledStudent = role === "STUDENT" && !!profile?.schoolId;
  const isAlumni = !!dbUser?.isAlumni;
  const staffCapabilities = isStaff
    ? computeEffectivePermissions({
        tierPermissions: profile?.staffTier?.permissions ?? null,
        overrides: profile?.staffPermissionOverrides ?? "[]",
      })
    : [];
```

Add the import at the top: `import { computeEffectivePermissions } from "@/lib/facultyPermissions";`

Then pass the new props to `SidebarShell`:

```typescript
      <SidebarShell
        userName={profile?.displayName ?? session.user.name}
        userEmail={session.user.email}
        geniusType={(profile?.geniusType as GeniusType | null) ?? null}
        myOrgId={myOrg?.id ?? null}
        myOrgName={myOrg?.name ?? null}
        isOrg={isOrg}
        isNivarroAdmin={isNivarroAdmin}
        isSchool={isSchool}
        isStaff={isStaff}
        staffCapabilities={staffCapabilities}
        isWalledStudent={isWalledStudent}
        isAlumni={isAlumni}
      />
```

- [ ] **Step 2: Add `isStaff`/`staffCapabilities` to `components/layout/Sidebar.tsx`** — extend `SidebarProps`, the function signature, and build a filtered `staffNav`:

```typescript
import type { Capability } from "@/lib/facultyPermissions";
```

Add to `SidebarProps`:
```typescript
  isStaff?: boolean;
  staffCapabilities?: Capability[];
```

Add to the function signature (alongside the existing destructured props): `isStaff = false, staffCapabilities = []`.

Add after `SCHOOL_NAV`:

```typescript
function buildStaffNav(caps: Capability[]) {
  const items: { href: string; label: string; Icon: typeof Users }[] = [
    { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  ];
  if (caps.includes("roster:view")) items.push({ href: "/school/roster", label: "Roster", Icon: Users });
  if (caps.includes("campaigns:view")) items.push({ href: "/campaigns", label: "Fundraise", Icon: HeartHandshake });
  if (caps.includes("staff:manage")) items.push({ href: "/school/staff", label: "Staff", Icon: UsersRound });
  items.push({ href: "/notifications", label: "Notifications", Icon: Bell });
  return items;
}
```

Update the `navItems`/`homeHref` lines:

```typescript
  const staffNav = buildStaffNav(staffCapabilities);
  const navItems = isSchool ? SCHOOL_NAV : isStaff ? staffNav : isOrg ? orgNav : isWalledStudent ? walledNav : studentNav;
  const homeHref = isSchool ? "/campaigns" : isStaff ? staffNav[0]?.href ?? "/dashboard" : isOrg && myOrgId ? `/orgs/${myOrgId}` : "/dashboard";
```

- [ ] **Step 3: Thread the same props through `components/layout/SidebarShell.tsx`** — add `isStaff?: boolean; staffCapabilities?: Capability[];` to its `Props` interface (import `Capability` from `@/lib/facultyPermissions`), accept them in the function signature, and pass them straight through to the inner `Sidebar` call (alongside the existing `isSchool={isSchool}` line). Leave `bottomTabs`/mobile-nav logic pointed at `isSchool ? SCHOOL_BOTTOM_TABS : ...` unchanged for now — staff get the desktop sidebar nav via `Sidebar`; extending the mobile bottom-tab bar for `STAFF` is a reasonable follow-up but not required for this feature to work.

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification** — log in as the `STAFF` test account from earlier tasks with a tier that has `roster:view` and `campaigns:view` but not `staff:manage`.

Expected: sidebar shows Dashboard, Roster, Fundraise, Notifications — no "Staff" link. Switch that account to a tier/custom set including `staff:manage` (via Task 8's endpoint) and refresh: "Staff" link appears.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/layout.tsx" components/layout/Sidebar.tsx components/layout/SidebarShell.tsx
git commit -m "feat: add STAFF nav filtered by effective permissions"
```

---

### Task 13: Roster — swap to capability-based gating

**Files:**
- Modify: `app/api/school/roster/route.ts`
- Modify: `app/api/school/roster/members/route.ts`
- Modify: `app/api/school/roster/import/route.ts`
- Modify: `app/api/school/roster/members/[userId]/route.ts`
- Modify: `app/(dashboard)/school/roster/page.tsx`

**Interfaces:**
- Consumes: `requireSchoolCapability` (Task 3).
- Produces: same response shapes as today; `GET`/list operations require `roster:view`, mutating operations (`POST`/import/delete) require `roster:edit`.

- [ ] **Step 1: `app/api/school/roster/route.ts`** — the file currently has one `GET` using `getSchoolSession()` (see the version read during planning). Replace:

```typescript
import { getSchoolSession } from "@/lib/school-auth";
```

with

```typescript
import { requireSchoolCapability } from "@/lib/school-auth";
```

and replace `const check = await getSchoolSession();` with `const check = await requireSchoolCapability("roster:view");`. Everything else in the file (destructuring `check.schoolId`, the response shape) is unchanged.

- [ ] **Step 2: `app/api/school/roster/members/route.ts`** — this `POST` handler adds/edits members, so it needs `roster:edit`. Replace the same import and swap `getSchoolSession()` → `requireSchoolCapability("roster:edit")` at its one call site.

- [ ] **Step 3: `app/api/school/roster/import/route.ts`** — CSV import is a write, needs `roster:edit`. Same swap at each `getSchoolSession()` call site in the file (there may be more than one handler — apply to all).

- [ ] **Step 4: `app/api/school/roster/members/[userId]/route.ts`** — this file has two handlers (seen at lines 9 and 77 during planning). Inspect each handler's HTTP method: if it's a `GET`, use `requireSchoolCapability("roster:view")`; if it's a mutating method (`PATCH`/`DELETE`), use `requireSchoolCapability("roster:edit")`.

- [ ] **Step 5: `app/(dashboard)/school/roster/page.tsx`** — replace the inline role check:

```typescript
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");
```

with:

```typescript
  const check = await requireSchoolCapability("roster:view");
  if ("error" in check) redirect("/dashboard");
```

and update the subsequent `prisma.profile.findMany({ where: { schoolId: session.user.id }, ... })` call to use `schoolId: check.schoolId` instead — this is the fix that makes a `STAFF` viewer see their *school's* roster rather than failing (since a staff member's own `session.user.id` isn't a school id). Add `import { requireSchoolCapability } from "@/lib/school-auth";` and drop the now-unused `prisma.user.findUnique` role lookup and its `prisma` import only if nothing else in the file still needs `prisma` (it does — `prisma.profile.findMany` — so keep the import, just remove the now-dead `dbUser` lookup).

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Manual regression check as the existing `SCHOOL` account** — visit `/school/roster` and confirm the roster still loads and CSV import/add-member still work exactly as before (this is the critical regression check — `SCHOOL` behavior must be byte-identical to pre-change).

- [ ] **Step 8: Manual verification as a `STAFF` account** — with a tier granting only `roster:view` (e.g. "Teacher"), confirm `/school/roster` loads read-only data (POST to `/api/school/roster/members` should 403). Then reassign that account to a tier with `roster:edit` (e.g. "Guidance Counselor") and confirm the add-member `POST` now succeeds and the new member shows up under the correct school (i.e. `check.schoolId`, not the staff member's own id).

- [ ] **Step 9: Commit**

```bash
git add app/api/school/roster app/(dashboard)/school/roster/page.tsx
git commit -m "feat: gate roster routes on roster:view/roster:edit capabilities"
```

---

### Task 14: Campaigns — swap to capability-based gating

**Files:**
- Modify: `app/api/campaigns/route.ts`
- Modify: `app/api/campaigns/[id]/route.ts`
- Modify: `app/api/campaigns/generate/route.ts`
- Modify: `app/api/campaigns/[id]/tweak/route.ts`
- Modify: `app/(dashboard)/campaigns/page.tsx`
- Modify: `app/(dashboard)/campaigns/new/page.tsx`

**Interfaces:**
- Consumes: `requireSchoolCapability` (Task 3).
- Produces: same response shapes as today; `GET`s require `campaigns:view`, mutating operations (`POST create/publish/generate/tweak`) require `campaigns:edit`; every `schoolId: session.user.id` query in these files becomes `schoolId: check.schoolId`.

- [ ] **Step 1: `app/api/campaigns/route.ts`** — replace both inline checks (`GET` at lines 10–13, `POST` at lines 39–42 per the version read during planning):

```typescript
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
```

becomes, in `GET`:

```typescript
  const check = await requireSchoolCapability("campaigns:view");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
```

and in `POST` (which both lists a campaign by id and publishes it — a write):

```typescript
  const check = await requireSchoolCapability("campaigns:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
```

Then replace every `schoolId: session.user.id` in this file's Prisma calls with `schoolId: check.schoolId`. Drop the now-unused `session` variable and its `auth()` call plus the `dbUser`/`dbUser2` lookups if nothing else in the file needs the raw session (double check — if `session.user.id` isn't used anywhere else after this change, remove the `auth()` import/call too; if it's still referenced elsewhere in the file, keep it and only replace the role-check blocks).

- [ ] **Step 2: `app/api/campaigns/[id]/route.ts`** — same pattern at its two check sites (lines ~16–21 and ~99–102 per planning read): the first (reading a campaign) uses `requireSchoolCapability("campaigns:view")`, the second (whichever handler mutates — check the HTTP method, PATCH/DELETE-style handlers use `campaigns:edit`). Replace `schoolId: session.user.id` → `schoolId: check.schoolId` in the `prisma.campaign.findFirst` calls that follow each check.

- [ ] **Step 3: `app/api/campaigns/generate/route.ts`** — this is a write (AI-generates campaign content), use `requireSchoolCapability("campaigns:edit")` at its check site (lines ~14–19 per planning read), and replace `schoolId: session.user.id` → `schoolId: check.schoolId` in both the `findFirst` (line ~65) and `create` (line ~85) calls.

- [ ] **Step 4: `app/api/campaigns/[id]/tweak/route.ts`** — a write (AI-tweaks existing campaign copy), use `requireSchoolCapability("campaigns:edit")` at its check site (lines ~19–24 per planning read), and replace `schoolId: session.user.id` → `schoolId: check.schoolId` in the `findFirst` call (line ~31).

- [ ] **Step 5: `app/(dashboard)/campaigns/page.tsx`** — replace:

```typescript
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") redirect("/dashboard");
```

with a `requireSchoolCapability("campaigns:view")` check (mirroring Task 13 Step 5's pattern), and update any subsequent `schoolId: session.user.id` query in this file to `schoolId: check.schoolId`.

- [ ] **Step 6: `app/(dashboard)/campaigns/new/page.tsx`** — same swap, using `requireSchoolCapability("campaigns:edit")` (creating a new campaign is a write) in place of its `role !== "SCHOOL" && role !== "ADMIN"` check.

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Manual regression check as the existing `SCHOOL` account** — visit `/campaigns`, view the list, create a new campaign via `/campaigns/new`, publish it, and use the AI generate/tweak features if reachable from the UI. All should behave exactly as before.

- [ ] **Step 9: Manual verification as a `STAFF` account** — with a tier granting only `campaigns:view` (e.g. "Guidance Counselor"), confirm `/campaigns` loads the list read-only and `/campaigns/new` (or its underlying `POST`) is blocked with 403/redirect. Reassign to a tier with `campaigns:edit` (e.g. "Principal") and confirm creating/publishing a campaign now works and the campaign appears under the correct school (`check.schoolId`), visible to the `SCHOOL` account too.

- [ ] **Step 10: Commit**

```bash
git add app/api/campaigns "app/(dashboard)/campaigns"
git commit -m "feat: gate campaigns routes on campaigns:view/campaigns:edit capabilities"
```

---

## Self-Review Notes

- **Spec coverage:** real STAFF logins (Tasks 1, 4, 9, 10) ✓; preset tiers + per-person overrides (Tasks 1, 2, 5, 6) ✓; roster + campaigns gating only, mentorship/partnerships untouched (Tasks 13–14, nothing else modified) ✓; tier rename/edit/delete SCHOOL-only (Task 6) ✓; per-person Custom permission set by email at invite time (Tasks 4, 7, 10) ✓; delegated `staff:manage` can invite/reassign but not edit tier definitions (Tasks 5–8 route-level gating) ✓; mocked notification, swappable later (Task 4's `notifyInvite`) ✓; migration of existing inert roster "STAFF" rows via the same invite path (Task 4's `createStaffInvite` existing-user branch) ✓; nav visibility by capability (Task 12) ✓; reconciliation with the concurrent roster-activation spec — reuse of `PasswordResetToken`/`resetPassword` instead of a parallel token system, single additive touch point on `app/actions/auth.ts` (Task 4 Step 1) ✓.
- **Type consistency:** `Capability`/`CAPABILITIES` defined once in Task 2 and imported everywhere else; `requireSchoolCapability`'s return shape (`{ schoolId } | { error, status }`) used identically in every consuming route; `computeEffectivePermissions`'s two call sites (Task 3's helper, Task 12's layout) pass the same `{ tierPermissions, overrides }` shape; `resetPassword`'s extended return (`{ success: true; userId: string }`) is consumed only by `acceptStaffInvite` (Task 4) — the existing `/reset-password` page only narrows on `"error" in result`, so the added field doesn't require any change there; `pendingInvites`/`staff` rows share the same shape (`{ userId, email, displayName, staffTitle, tierId, tierName, isCustom }`) end-to-end from Task 7's GET through Task 11's `StaffMember`/`PendingInvite` interfaces.
- **No placeholders:** every step has real, complete code or a concrete manual-verification procedure with an expected result — no "add error handling" or "similar to Task N" shortcuts.
- **Reconciliation boundary respected:** confirmed no task in this plan creates or modifies `lib/account-invite.ts`, `lib/invite-email.ts`, `app/(auth)/activate-account`, or the user-creation branches inside `app/api/school/roster/members/route.ts` / `import/route.ts` — those remain the concurrent session's scope. Task 13 touches those two roster files' auth-check lines only.
