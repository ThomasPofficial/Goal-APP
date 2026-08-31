# School Permissions Switchboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Nivarro's existing Faculty Permission Tiers system so a school's Owner (and delegated Core Admins) can grant/revoke fine-grained permissions across roster, campaigns, mentorship, partnerships, and community management, support multiple co-equal full admins, and manage everyone through a single Google-Docs-style "Permissions" page.

**Architecture:** Additive extension of the existing `FacultyTier`/`Capability` system in `lib/facultyPermissions.ts` and `lib/school-auth.ts` — no new tables. Two new `Profile` columns (`staffPermissionRevocations`, `isCoreAdmin`) plus five new capability strings. Every route that today hard-codes `role !== "SCHOOL"` gets swept onto the existing `requireSchoolCapability()`/new `requireCoreAdmin()` helpers. The `/school/staff` page is rebuilt as a 3-tab client (People / Groups / Admins) split across small, focused component files.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM (PostgreSQL), NextAuth v5. No test framework exists anywhere in this codebase (`package.json` has no test script, no `*.test.ts` files) — verification follows the project's established pattern instead: `npx tsc --noEmit` after every task, plus a scripted manual/curl check where relevant. Do not introduce a test framework as a side effect of this plan.

**Spec:** `docs/superpowers/specs/2026-08-31-school-permissions-switchboard-design.md`

## Global Constraints

- Every new SQL migration file uses `ADD COLUMN IF NOT EXISTS` (per project convention — Render runs `prisma migrate deploy` at startup; a missing migration file crashes the deploy even if `schema.prisma` was edited).
- `prisma generate` alone does NOT create a migration file — always hand-write the `.sql` file alongside the schema edit.
- Never use `next-auth/react`'s `signOut` (unrelated to this plan, but do not touch `lib/auth-actions.ts`).
- Follow the existing inline-`style` React convention already used throughout `app/(dashboard)/school/staff/StaffClient.tsx` and `components/layout/Sidebar.tsx` — this codebase does not use a CSS-in-JS library or Tailwind for these dashboard surfaces (Tailwind utility classes appear elsewhere in the app but not in this file family).
- `requireSchoolCapability()`'s and `requireCoreAdmin()`'s success return shape gains two new fields (`isOwner`, `isCoreAdmin`) alongside the existing `schoolId` — this is additive and every existing call site (`app/api/school/roster/**`, `app/api/campaigns/**`) that destructures only `{ schoolId }` continues to work unchanged. Do not modify those files.
- The Emergency Access / `OWNER_LOCKOUT` support-ticket feature described in the spec is **NOT part of this plan** — it depends on the `support-tickets` branch (currently unmerged into `main`) and must be planned separately once that branch lands.
- This codebase has zero automated tests. Each task's "verify" step is `npx tsc --noEmit` (must show no *new* errors — the repo has a handful of pre-existing baseline errors in unrelated files; compare against a `main`-branch baseline count if unsure) plus a concrete manual/curl check. Do not add Jest/Vitest/etc. as part of this plan.

---

### Task 1: Schema — add `staffPermissionRevocations` and `isCoreAdmin` to `Profile`

**Files:**
- Modify: `prisma/schema.prisma:128-132`
- Create: `prisma/migrations/20260831130000_add_permission_revocations_and_core_admin/migration.sql`

**Interfaces:**
- Produces: `Profile.staffPermissionRevocations: string` (JSON-encoded `Capability[]`, default `"[]"`), `Profile.isCoreAdmin: boolean` (default `false`) — every later task reads/writes these two fields by exactly these names.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, the `Profile` model currently reads (lines 128-132):

```prisma
  staffTitle          String?     // "Dean", "Counselor", "AP History Teacher", etc.
  staffTierId              String?
  staffTier                FacultyTier? @relation(fields: [staffTierId], references: [id])
  staffPermissionOverrides String       @default("[]") // JSON array; additive if staffTierId set, else the full set
  staffInvited              Boolean      @default(false) // true once a staff invite has been sent for this profile
```

Replace with:

```prisma
  staffTitle          String?     // "Dean", "Counselor", "AP History Teacher", etc.
  staffTierId              String?
  staffTier                FacultyTier? @relation(fields: [staffTierId], references: [id])
  staffPermissionOverrides   String     @default("[]") // JSON array; additive if staffTierId set, else the full set
  staffPermissionRevocations String     @default("[]") // JSON array; capabilities to subtract from the tier's grants (ignored if staffTierId is null)
  isCoreAdmin                Boolean    @default(false) // true = Owner-equivalent power for this school, bypasses the tier system entirely
  staffInvited              Boolean      @default(false) // true once a staff invite has been sent for this profile
```

- [ ] **Step 2: Write the migration file**

Create `prisma/migrations/20260831130000_add_permission_revocations_and_core_admin/migration.sql`:

```sql
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "staffPermissionRevocations" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "isCoreAdmin" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: completes with no errors, updates `node_modules/@prisma/client` types to include the two new fields.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors (existing baseline errors, if any, are unrelated to `Profile`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260831130000_add_permission_revocations_and_core_admin
git commit -m "Add staffPermissionRevocations and isCoreAdmin to Profile"
```

---

### Task 2: Expand capabilities and add revocation/toggle logic

**Files:**
- Modify: `lib/facultyPermissions.ts` (full rewrite of the file's content, same exports plus new ones)

**Interfaces:**
- Consumes: none (pure logic module).
- Produces: `CAPABILITIES: readonly Capability[]` (10 entries), `Capability` type, `DEFAULT_TIERS`, `computeEffectivePermissions(args: { tierPermissions, overrides, revocations }): Capability[]`, `hasCapability(perms, capability): boolean`, `capabilityState(cap, tierPerms, overrides, revocations): "inherited" | "granted" | "off"`, `toggleCapability(cap, tierPerms, overrides, revocations): { overrides: Capability[]; revocations: Capability[] }`. Every later task that imports from `@/lib/facultyPermissions` uses these exact names.

- [ ] **Step 1: Replace the file**

Replace the full contents of `lib/facultyPermissions.ts` with:

```ts
export const CAPABILITIES = [
  "roster:view",
  "roster:edit",
  "campaigns:view",
  "campaigns:edit",
  "mentorship:view",
  "mentorship:edit",
  "partnerships:view",
  "partnerships:edit",
  "community:manage",
  "staff:manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const DEFAULT_TIERS: { name: string; permissions: Capability[] }[] = [
  {
    name: "Principal",
    permissions: [
      "roster:view",
      "roster:edit",
      "campaigns:view",
      "campaigns:edit",
      "mentorship:view",
      "mentorship:edit",
      "partnerships:view",
      "partnerships:edit",
      "community:manage",
      "staff:manage",
    ],
  },
  {
    name: "Guidance Counselor",
    permissions: ["roster:view", "roster:edit", "campaigns:view", "mentorship:view", "mentorship:edit", "partnerships:view"],
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
    return parsed.filter((v): v is Capability => (CAPABILITIES as readonly string[]).includes(v));
  } catch {
    return [];
  }
}

export function computeEffectivePermissions(args: {
  tierPermissions: string | null | undefined;
  overrides: string | null | undefined;
  revocations: string | null | undefined;
}): Capability[] {
  const overrides = parseCapabilityList(args.overrides);
  if (!args.tierPermissions) {
    // No tier: overrides ARE the complete, custom permission set for this person.
    // Revocations have nothing to subtract from in this state.
    return overrides;
  }
  const tierPerms = parseCapabilityList(args.tierPermissions);
  const revocations = parseCapabilityList(args.revocations);
  const granted = new Set<Capability>([...tierPerms, ...overrides]);
  for (const r of revocations) granted.delete(r);
  return Array.from(granted);
}

export function hasCapability(perms: Capability[], capability: Capability): boolean {
  return perms.includes(capability);
}

export type CapabilityState = "inherited" | "granted" | "off";

// UI helper: given a tiered person's tier permissions + their personal
// overrides/revocations, classify one capability's display state.
// "inherited" = comes from the tier (dimmed checkbox in the UI, click to revoke).
// "granted" = a personal override beyond the tier (highlighted, click to remove).
// "off" = not granted at all (click to add, either as an override or by un-revoking).
export function capabilityState(
  cap: Capability,
  tierPermissions: Capability[],
  overrides: Capability[],
  revocations: Capability[]
): CapabilityState {
  if (overrides.includes(cap)) return "granted";
  if (tierPermissions.includes(cap) && !revocations.includes(cap)) return "inherited";
  return "off";
}

// UI helper: click-to-toggle transition for a tiered person's capability cell.
// Only meaningful when the person has a tier — Custom (untiered) people toggle
// their overrides array directly instead (overrides ARE the whole set there).
export function toggleCapability(
  cap: Capability,
  tierPermissions: Capability[],
  overrides: Capability[],
  revocations: Capability[]
): { overrides: Capability[]; revocations: Capability[] } {
  const state = capabilityState(cap, tierPermissions, overrides, revocations);
  if (state === "granted") {
    return { overrides: overrides.filter((c) => c !== cap), revocations };
  }
  if (state === "inherited") {
    return { overrides, revocations: [...revocations, cap] };
  }
  // state === "off"
  if (tierPermissions.includes(cap)) {
    // Was revoked — un-revoke to fall back to inherited.
    return { overrides, revocations: revocations.filter((c) => c !== cap) };
  }
  return { overrides: [...overrides, cap], revocations };
}
```

- [ ] **Step 2: Verify with a scratch script (no test framework exists — this is a one-off manual check, not a kept test)**

Create a temporary file `/tmp-check.ts` is not appropriate on Windows; instead run this inline with `npx tsx`:

Run:
```bash
npx tsx -e "
import { computeEffectivePermissions, capabilityState, toggleCapability } from './lib/facultyPermissions';
const tier = JSON.stringify(['roster:view','roster:edit']);
console.log('effective (tier+override+revoke):', computeEffectivePermissions({ tierPermissions: tier, overrides: JSON.stringify(['campaigns:view']), revocations: JSON.stringify(['roster:edit']) }));
console.log('state roster:view (inherited):', capabilityState('roster:view', ['roster:view','roster:edit'], [], []));
console.log('state roster:edit (revoked -> off):', capabilityState('roster:edit', ['roster:view','roster:edit'], [], ['roster:edit']));
console.log('toggle inherited roster:view -> revoke:', toggleCapability('roster:view', ['roster:view'], [], []));
"
```
Expected output:
```
effective (tier+override+revoke): [ 'roster:view', 'campaigns:view' ]
state roster:view (inherited): inherited
state roster:edit (revoked -> off): off
toggle inherited roster:view -> revoke: { overrides: [], revocations: [ 'roster:view' ] }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (existing `computeEffectivePermissions` callers in `lib/school-auth.ts` and `app/(dashboard)/layout.tsx` will now show a missing-`revocations`-argument error — that's expected and fixed in Task 3).

- [ ] **Step 4: Commit**

```bash
git add lib/facultyPermissions.ts
git commit -m "Expand capabilities to 10, add revocation and toggle helpers"
```

---

### Task 3: Core Admin support in `lib/school-auth.ts` + wire into `app/(dashboard)/layout.tsx`

**Files:**
- Modify: `lib/school-auth.ts` (full rewrite)
- Modify: `app/(dashboard)/layout.tsx:20-54`

**Interfaces:**
- Consumes: `computeEffectivePermissions`, `CAPABILITIES`, `hasCapability`, `Capability` from `@/lib/facultyPermissions` (Task 2).
- Produces: `getSchoolCapabilities(): Promise<{ schoolId: string; isOwner: boolean; isCoreAdmin: boolean; capabilities: Capability[] } | { error: "Unauthorized"; status: 401 } | { error: "Forbidden"; status: 403 }>`, `requireSchoolCapability(capability: Capability): Promise<{ schoolId: string; isOwner: boolean; isCoreAdmin: boolean } | { error; status }>`, `requireCoreAdmin(): Promise<{ schoolId: string; isOwner: boolean; isCoreAdmin: boolean } | { error; status }>`. `getSchoolSession()` is kept **unchanged** in this task — five files still call it and aren't swept onto the new helpers until Tasks 4, 7, and 9, so removing it here would break the build for every commit in between. Task 9 (the last task to sweep a caller) deletes it once it confirms zero callers remain.

- [ ] **Step 1: Rewrite `lib/school-auth.ts`**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, computeEffectivePermissions, hasCapability, type Capability } from "@/lib/facultyPermissions";

type AuthError = { error: "Unauthorized"; status: 401 } | { error: "Forbidden"; status: 403 };

// Single source of truth for "what can this caller do at their school right now."
// SCHOOL/ADMIN implicitly have every capability. A Core Admin STAFF also has every
// capability (bypasses the tier system entirely). A plain STAFF gets the tier +
// override - revocation computation.
export async function getSchoolCapabilities(): Promise<
  { schoolId: string; isOwner: boolean; isCoreAdmin: boolean; capabilities: Capability[] } | AuthError
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      profile: {
        select: {
          schoolId: true,
          isCoreAdmin: true,
          staffPermissionOverrides: true,
          staffPermissionRevocations: true,
          staffTier: { select: { permissions: true } },
        },
      },
    },
  });

  if (dbUser?.role === "SCHOOL" || dbUser?.role === "ADMIN") {
    return { schoolId: session.user.id, isOwner: true, isCoreAdmin: false, capabilities: [...CAPABILITIES] };
  }

  if (dbUser?.role === "STAFF" && dbUser.profile?.schoolId) {
    if (dbUser.profile.isCoreAdmin) {
      return { schoolId: dbUser.profile.schoolId, isOwner: false, isCoreAdmin: true, capabilities: [...CAPABILITIES] };
    }
    const capabilities = computeEffectivePermissions({
      tierPermissions: dbUser.profile.staffTier?.permissions ?? null,
      overrides: dbUser.profile.staffPermissionOverrides,
      revocations: dbUser.profile.staffPermissionRevocations,
    });
    return { schoolId: dbUser.profile.schoolId, isOwner: false, isCoreAdmin: false, capabilities };
  }

  return { error: "Forbidden", status: 403 };
}

export async function requireSchoolCapability(
  capability: Capability
): Promise<{ schoolId: string; isOwner: boolean; isCoreAdmin: boolean } | AuthError> {
  const check = await getSchoolCapabilities();
  if ("error" in check) return check;
  if (!hasCapability(check.capabilities, capability)) return { error: "Forbidden", status: 403 };
  return { schoolId: check.schoolId, isOwner: check.isOwner, isCoreAdmin: check.isCoreAdmin };
}

// For the three actions capped at Owner/Core-Admin regardless of any tier:
// creating/editing FacultyTier definitions, promoting/demoting Core Admins,
// and granting/revoking the staff:manage capability itself.
export async function requireCoreAdmin(): Promise<
  { schoolId: string; isOwner: boolean; isCoreAdmin: boolean } | AuthError
> {
  const check = await getSchoolCapabilities();
  if ("error" in check) return check;
  if (!check.isOwner && !check.isCoreAdmin) return { error: "Forbidden", status: 403 };
  return { schoolId: check.schoolId, isOwner: check.isOwner, isCoreAdmin: check.isCoreAdmin };
}

// TEMPORARY — kept only so the five not-yet-swept call sites below keep
// compiling between this task and Task 9. Task 9 deletes this function once
// it confirms every caller has moved to requireSchoolCapability/requireCoreAdmin.
// Do not add any new caller of this function.
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
```

Note: `getSchoolSession()` above is scaffolding, not a design decision — it has exactly five remaining call sites on `main` today (`app/api/school/mentorship/route.ts`, `app/api/school/mentorship/[conversationId]/route.ts`, `app/api/school/staff/tiers/route.ts`, `app/api/school/staff/tiers/[tierId]/route.ts`, `app/api/school/roster/members/[userId]/resend-invite/route.ts`), all of which Tasks 4, 7, and 9 in this plan sweep onto `requireSchoolCapability`/`requireCoreAdmin`. Task 9 deletes the function itself as its final step once it confirms zero callers remain.

- [ ] **Step 2: Update `app/(dashboard)/layout.tsx`**

The current block (lines 20-54) reads:

```tsx
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isAlumni: true,
      profile: {
        select: {
          displayName: true,
          schoolId: true,
          staffPermissionOverrides: true,
          staffTier: { select: { permissions: true } },
        },
      },
    },
  });

  const role = dbUser?.role ?? "STUDENT";
  const isSchool = role === "SCHOOL";
  const isOrg = role === "ORG" || role === "ADMIN";
  const isNivarroAdmin = role === "ADMIN";
  const profile = dbUser?.profile ?? null;
  // A STAFF account with no schoolId can't pass requireSchoolCapability (it keys
  // every check off profile.schoolId), so the sidebar must not advertise
  // Roster/Fundraise/Staff links it would be denied — never promise what the API denies.
  const isStaff = role === "STAFF" && !!profile?.schoolId;
  // Student/Alum account = STUDENT role with a school affiliation — walled-off nav.
  // (Standard = STUDENT role with no school affiliation; that's just "none of the above" here.)
  const isWalledStudentAccount = await isWalledStudent(session.user.id);
  const isAlumni = !!dbUser?.isAlumni;
  const staffCapabilities = isStaff
    ? computeEffectivePermissions({
        tierPermissions: profile?.staffTier?.permissions ?? null,
        overrides: profile?.staffPermissionOverrides ?? "[]",
      })
    : [];
```

Replace with:

```tsx
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isAlumni: true,
      profile: {
        select: {
          displayName: true,
          schoolId: true,
          isCoreAdmin: true,
          staffPermissionOverrides: true,
          staffPermissionRevocations: true,
          staffTier: { select: { permissions: true } },
        },
      },
    },
  });

  const role = dbUser?.role ?? "STUDENT";
  const isSchool = role === "SCHOOL";
  const isOrg = role === "ORG" || role === "ADMIN";
  const isNivarroAdmin = role === "ADMIN";
  const profile = dbUser?.profile ?? null;
  // A STAFF account with no schoolId can't pass requireSchoolCapability (it keys
  // every check off profile.schoolId), so the sidebar must not advertise
  // Roster/Fundraise/Staff links it would be denied — never promise what the API denies.
  const isStaff = role === "STAFF" && !!profile?.schoolId;
  // Student/Alum account = STUDENT role with a school affiliation — walled-off nav.
  // (Standard = STUDENT role with no school affiliation; that's just "none of the above" here.)
  const isWalledStudentAccount = await isWalledStudent(session.user.id);
  const isAlumni = !!dbUser?.isAlumni;
  // A Core Admin bypasses the tier system entirely — treat them as having every
  // capability for nav-gating purposes, same as requireSchoolCapability does server-side.
  const staffCapabilities = !isStaff
    ? []
    : profile?.isCoreAdmin
      ? [...CAPABILITIES]
      : computeEffectivePermissions({
          tierPermissions: profile?.staffTier?.permissions ?? null,
          overrides: profile?.staffPermissionOverrides ?? "[]",
          revocations: profile?.staffPermissionRevocations ?? "[]",
        });
```

Also update the import line near the top of the file — it currently reads:

```tsx
import { computeEffectivePermissions } from "@/lib/facultyPermissions";
```

Change to:

```tsx
import { CAPABILITIES, computeEffectivePermissions } from "@/lib/facultyPermissions";
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npm run dev` in the background, then in a browser log in as `team.nivarro@gmail.com` / `nivarro2026` (the real Nivarro `ADMIN` account per project memory) and confirm the dashboard loads with no runtime error — this exercises the new `profile` select fields even for a non-`STAFF` account (they'll just be `null`/unused, but a Prisma select typo would 500 the whole layout).

- [ ] **Step 4: Commit**

```bash
git add lib/school-auth.ts "app/(dashboard)/layout.tsx"
git commit -m "Add Core Admin support to school-auth (getSchoolSession kept temporarily, removed in Task 9)"
```

---

### Task 4: Tier CRUD routes move to `requireCoreAdmin()`

**Files:**
- Modify: `app/api/school/staff/tiers/route.ts`
- Modify: `app/api/school/staff/tiers/[tierId]/route.ts`

**Interfaces:**
- Consumes: `requireCoreAdmin` from `@/lib/school-auth` (Task 3).

- [ ] **Step 1: Update `app/api/school/staff/tiers/route.ts`**

Change the import line:
```ts
import { getSchoolSession } from "@/lib/school-auth";
```
to:
```ts
import { requireCoreAdmin } from "@/lib/school-auth";
```

Change both occurrences of `const check = await getSchoolSession();` (GET and POST handlers) to `const check = await requireCoreAdmin();`.

- [ ] **Step 2: Update `app/api/school/staff/tiers/[tierId]/route.ts`**

Same change: import `requireCoreAdmin` instead of `getSchoolSession`, and replace both `const check = await getSchoolSession();` occurrences (PATCH and DELETE handlers) with `const check = await requireCoreAdmin();`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected no new errors.

Manual check (with `npm run dev` running): log in as `team.nivarro@gmail.com`, `POST /api/school/staff/tiers` with `{"name":"Test Tier","permissions":["roster:view"]}` via the browser devtools console (`fetch('/api/school/staff/tiers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Test Tier',permissions:['roster:view']})}).then(r=>r.json()).then(console.log)`) — expect a 200 with the created tier. Then delete it via `DELETE /api/school/staff/tiers/<id>` the same way.

- [ ] **Step 4: Commit**

```bash
git add app/api/school/staff/tiers
git commit -m "Move tier CRUD to requireCoreAdmin"
```

---

### Task 5: Person create/edit APIs — name, title, Core Admin flag, and full edit support

**Files:**
- Modify: `lib/staffInvite.ts:22-138` (the `createStaffInvite` function)
- Modify: `app/api/school/staff/route.ts` (POST handler)
- Modify: `app/api/school/staff/[userId]/route.ts` (full rewrite of the PATCH handler)
- Modify: `app/api/school/staff/route.ts` (GET handler — return `overrides`/`revocations`/`isCoreAdmin` per row)

**Interfaces:**
- Consumes: `requireSchoolCapability`, `Capability`, `CAPABILITIES`, `computeEffectivePermissions` (Tasks 2-3).
- Produces: `POST /api/school/staff` body gains optional `name`, `staffTitle`, `makeCoreAdmin`; `PATCH /api/school/staff/[userId]` body becomes `{ name?, email?, staffTitle?, tierId?, overrides?, revocations? }`, replacing the old `{ tierId? | customPermissions? }` contract; `GET /api/school/staff` rows gain `isCoreAdmin: boolean`, `overrides: Capability[]`, `revocations: Capability[]`.

- [ ] **Step 1: Extend `createStaffInvite` in `lib/staffInvite.ts`**

Change the function signature (currently lines 22-28):

```ts
export async function createStaffInvite(args: {
  email: string;
  schoolId: string;
  tierId?: string | null;
  customPermissions?: Capability[];
  staffTitle?: string;
}): Promise<{ status: "invited"; link: string } | { status: "already-staff" }> {
```

to:

```ts
export async function createStaffInvite(args: {
  email: string;
  schoolId: string;
  tierId?: string | null;
  customPermissions?: Capability[];
  staffTitle?: string;
  displayName?: string;
  // Only ever used to PROMOTE (true) via this path — never demotes an existing
  // Core Admin as a side effect of an unrelated invite/edit. Demotion is only
  // ever explicit, via PATCH /api/school/admins/[userId].
  isCoreAdmin?: boolean;
}): Promise<{ status: "invited"; link: string } | { status: "already-staff" }> {
```

In the `existing?.role === "STAFF"` branch, the `data` object currently reads:

```ts
    const data = {
      schoolId: args.schoolId,
      staffTierId: args.tierId ?? null,
      staffPermissionOverrides: overridesJson,
      staffInvited: true,
    };
```

Replace with:

```ts
    const data = {
      schoolId: args.schoolId,
      staffTierId: args.tierId ?? null,
      staffPermissionOverrides: overridesJson,
      staffInvited: true,
      ...(args.staffTitle ? { staffTitle: args.staffTitle } : {}),
      ...(args.displayName?.trim() ? { displayName: args.displayName.trim() } : {}),
      ...(args.isCoreAdmin === true ? { isCoreAdmin: true } : {}),
    };
```

In the `else if (existing)` branch (promoting a plain student/alumni to staff), the `data` object currently reads:

```ts
    const data = {
      schoolId: args.schoolId,
      staffTierId: args.tierId ?? null,
      staffPermissionOverrides: overridesJson,
      staffInvited: true,
      ...(args.staffTitle ? { staffTitle: args.staffTitle } : {}),
    };
```

Replace with:

```ts
    const data = {
      schoolId: args.schoolId,
      staffTierId: args.tierId ?? null,
      staffPermissionOverrides: overridesJson,
      staffInvited: true,
      ...(args.staffTitle ? { staffTitle: args.staffTitle } : {}),
      ...(args.displayName?.trim() ? { displayName: args.displayName.trim() } : {}),
      ...(args.isCoreAdmin === true ? { isCoreAdmin: true } : {}),
    };
```

In the brand-new-user `else` branch, currently:

```ts
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
```

Replace with:

```ts
    const created = await prisma.user.create({
      data: {
        email,
        name: args.displayName?.trim() || email,
        role: "STUDENT",
        profile: {
          create: {
            displayName: args.displayName?.trim() || email,
            schoolId: args.schoolId,
            staffTitle: args.staffTitle ?? null,
            staffTierId: args.tierId ?? null,
            staffPermissionOverrides: overridesJson,
            staffInvited: true,
            isCoreAdmin: args.isCoreAdmin === true,
            onboardingComplete: false,
          },
        },
      },
    });
```

- [ ] **Step 2: Update the POST handler in `app/api/school/staff/route.ts`**

Change the destructure (currently):

```ts
  const { email, tierId, customPermissions, staffTitle } = body as {
    email?: string;
    tierId?: string | null;
    customPermissions?: string[];
    staffTitle?: string;
  };
```

to:

```ts
  const { email, tierId, customPermissions, staffTitle, name, makeCoreAdmin } = body as {
    email?: string;
    tierId?: string | null;
    customPermissions?: string[];
    staffTitle?: string;
    name?: string;
    makeCoreAdmin?: boolean;
  };
```

Replace the existing `isSchoolOwner` line and its two guard blocks (currently):

```ts
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Same distinction as the PATCH route: schoolId equals the caller's own id only
  // for SCHOOL/ADMIN. A delegated staff:manage holder may invite using existing
  // tiers, but may never mint a new staff:manage holder (incl. an accomplice).
  const isSchoolOwner = check.schoolId === session.user.id;
  if (!isSchoolOwner && effectiveCustomPermissions.includes("staff:manage")) {
```

with:

```ts
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isOwnerOrCoreAdmin = check.isOwner || check.isCoreAdmin;
  if (!isOwnerOrCoreAdmin && effectiveCustomPermissions.includes("staff:manage")) {
```

and the later `if (!isSchoolOwner && session.user.email ...)` block's `isSchoolOwner` reference to `isOwnerOrCoreAdmin`.

Then update the `createStaffInvite` call:

```ts
    const result = await createStaffInvite({
      email: email.trim(),
      schoolId: check.schoolId,
      tierId: tierId ?? null,
      customPermissions: effectiveCustomPermissions,
      staffTitle,
      displayName: name,
      isCoreAdmin: isOwnerOrCoreAdmin ? !!makeCoreAdmin : false,
    });
```

- [ ] **Step 3: Update the GET handler's `toRow` in `app/api/school/staff/route.ts`**

Change:

```ts
  const toRow = (p: (typeof profiles)[number]) => ({
    userId: p.user.id,
    email: p.user.email,
    displayName: p.displayName,
    staffTitle: p.staffTitle,
    tierId: p.staffTierId,
    tierName: p.staffTierId ? p.staffTier?.name ?? null : "Custom",
    isCustom: !p.staffTierId,
  });
```

to:

```ts
  const toRow = (p: (typeof profiles)[number]) => ({
    userId: p.user.id,
    email: p.user.email,
    displayName: p.displayName,
    staffTitle: p.staffTitle,
    tierId: p.staffTierId,
    tierName: p.staffTierId ? p.staffTier?.name ?? null : "Custom",
    isCustom: !p.staffTierId,
    isCoreAdmin: p.isCoreAdmin,
    overrides: JSON.parse(p.staffPermissionOverrides || "[]") as Capability[],
    revocations: JSON.parse(p.staffPermissionRevocations || "[]") as Capability[],
  });
```

(`p.isCoreAdmin`/`p.staffPermissionRevocations` are already present on `profiles` — the existing query uses `include`, not `select`, so every `Profile` scalar column, including the two new ones from Task 1, is already returned without any query change.)

- [ ] **Step 4: Rewrite `app/api/school/staff/[userId]/route.ts`**

Replace the entire file with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSchoolCapability } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, computeEffectivePermissions, type Capability } from "@/lib/facultyPermissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { userId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Nobody edits their own staff record here — this is the self-escalation path
  // a delegated staff:manage holder would otherwise use to widen their own access.
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You cannot change your own staff access" }, { status: 403 });
  }

  // Matches STAFF (already active) and pending invites (still STUDENT, staffInvited
  // true) — the People tab's edit form works on both.
  const target = await prisma.user.findFirst({
    where: {
      id: userId,
      profile: { schoolId: check.schoolId },
      OR: [{ role: "STAFF" }, { role: "STUDENT", profile: { staffInvited: true } }],
    },
    include: { profile: { include: { staffTier: { select: { permissions: true } } } } },
  });
  if (!target?.profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, email, staffTitle, tierId, overrides, revocations } = body as {
    name?: string;
    email?: string;
    staffTitle?: string;
    tierId?: string | null;
    overrides?: string[];
    revocations?: string[];
  };

  const isOwnerOrCoreAdmin = check.isOwner || check.isCoreAdmin;

  if (email !== undefined && email.trim() && email.trim().toLowerCase() !== target.email?.toLowerCase()) {
    try {
      await prisma.user.update({ where: { id: userId }, data: { email: email.trim().toLowerCase() } });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
      }
      throw err;
    }
  }

  const identityData: { displayName?: string; staffTitle?: string | null } = {};
  if (name !== undefined && name.trim()) identityData.displayName = name.trim();
  if (staffTitle !== undefined) identityData.staffTitle = staffTitle.trim() || null;

  let permissionData: { staffTierId?: string | null; staffPermissionOverrides?: string; staffPermissionRevocations?: string } = {};

  if (tierId !== undefined) {
    let newTierPermissionsJson: string | null = null;
    if (tierId) {
      const tier = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
      if (!tier) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      newTierPermissionsJson = tier.permissions;
    }

    const validOverrides = (overrides ?? []).filter((p): p is Capability => (CAPABILITIES as readonly string[]).includes(p));
    const validRevocations = (revocations ?? []).filter((p): p is Capability => (CAPABILITIES as readonly string[]).includes(p));

    const oldEffective = computeEffectivePermissions({
      tierPermissions: target.profile.staffTier?.permissions ?? null,
      overrides: target.profile.staffPermissionOverrides,
      revocations: target.profile.staffPermissionRevocations,
    });
    const newEffective = computeEffectivePermissions({
      tierPermissions: newTierPermissionsJson,
      overrides: JSON.stringify(validOverrides),
      revocations: JSON.stringify(validRevocations),
    });

    // Delegation rule: a plain staff:manage holder may reassign groups and tune
    // any other capability, but never grants or revokes staff:manage itself —
    // only comparing old vs. new means resubmitting an unrelated field on
    // someone whose group already includes staff:manage isn't blocked.
    if (oldEffective.includes("staff:manage") !== newEffective.includes("staff:manage") && !isOwnerOrCoreAdmin) {
      return NextResponse.json({ error: "Only an owner or core admin can change staff management access" }, { status: 403 });
    }

    permissionData = tierId
      ? { staffTierId: tierId, staffPermissionOverrides: JSON.stringify(validOverrides), staffPermissionRevocations: JSON.stringify(validRevocations) }
      : { staffTierId: null, staffPermissionOverrides: JSON.stringify(validOverrides), staffPermissionRevocations: "[]" };
  }

  await prisma.profile.update({
    where: { userId },
    data: { ...identityData, ...permissionData },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected no new errors.

Manual check (browser devtools console while logged in as `team.nivarro@gmail.com`):
```js
fetch('/api/school/staff', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'plan-test-teacher@nivarro.demo', name:'Plan Test Teacher', staffTitle:'Test', customPermissions:['roster:view']})}).then(r=>r.json()).then(console.log)
```
Expect `{ status: 'invited', link: '...' }`. Then:
```js
fetch('/api/school/staff').then(r=>r.json()).then(console.log)
```
Confirm the new pending invite row shows `displayName: 'Plan Test Teacher'`, `overrides: ['roster:view']`, `revocations: []`, `isCoreAdmin: false`.

- [ ] **Step 6: Commit**

```bash
git add lib/staffInvite.ts app/api/school/staff
git commit -m "Add name/title/Core Admin fields to person create/edit APIs"
```

---

### Task 6: Admin management endpoints

**Files:**
- Create: `app/api/school/admins/route.ts`
- Create: `app/api/school/admins/[userId]/route.ts`

**Interfaces:**
- Consumes: `requireCoreAdmin` from `@/lib/school-auth` (Task 3).
- Produces: `GET /api/school/admins` → `{ owner: { userId, email, displayName } | null; coreAdmins: { userId, email, displayName }[] }`; `PATCH /api/school/admins/[userId]` body `{ isCoreAdmin: boolean }`.

- [ ] **Step 1: Create `app/api/school/admins/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireCoreAdmin } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const check = await requireCoreAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  const [owner, coreAdmins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: schoolId },
      select: { id: true, email: true, name: true, profile: { select: { displayName: true } } },
    }),
    prisma.profile.findMany({
      where: { schoolId, isCoreAdmin: true },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return NextResponse.json({
    owner: owner
      ? { userId: owner.id, email: owner.email, displayName: owner.profile?.displayName ?? owner.name ?? "Owner" }
      : null,
    coreAdmins: coreAdmins.map((p) => ({ userId: p.userId, email: p.user.email, displayName: p.displayName })),
  });
}
```

- [ ] **Step 2: Create `app/api/school/admins/[userId]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireCoreAdmin } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const check = await requireCoreAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { userId } = await params;

  // The Owner is the literal data anchor for this school (every school-scoped
  // record FKs to this exact User.id) — it can never be demoted or removed here.
  if (userId === check.schoolId) {
    return NextResponse.json({ error: "The owner account cannot be changed here" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { isCoreAdmin } = body as { isCoreAdmin?: boolean };
  if (typeof isCoreAdmin !== "boolean") {
    return NextResponse.json({ error: "isCoreAdmin (boolean) is required" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, role: "STAFF", profile: { schoolId: check.schoolId } },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Demotion intentionally does NOT touch staffTierId/staffPermissionOverrides —
  // whatever group/custom permissions this person had before promotion are still
  // there and take effect again immediately.
  await prisma.profile.update({ where: { userId }, data: { isCoreAdmin } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected no new errors.

Manual check: as `team.nivarro@gmail.com`, in devtools console:
```js
fetch('/api/school/admins').then(r=>r.json()).then(console.log)
```
Expect `{ owner: {...}, coreAdmins: [] }`. Then promote the pending test teacher from Task 5 once they're `STAFF` (skip if still pending — this is exercised end-to-end again in Task 14's manual walkthrough) and confirm `PATCH /api/school/admins/<their-id>` with `{"isCoreAdmin":true}` returns `{ ok: true }`, and a repeat `GET` shows them in `coreAdmins`. Confirm `PATCH /api/school/admins/<team.nivarro's own id>` returns 403.

- [ ] **Step 4: Commit**

```bash
git add app/api/school/admins
git commit -m "Add Core Admin management endpoints"
```

---

### Task 7: Enforcement sweep — mentorship routes

**Files:**
- Modify: `app/api/school/mentorship/route.ts`
- Modify: `app/api/school/mentorship/[conversationId]/route.ts`

**Interfaces:**
- Consumes: `requireSchoolCapability` (Task 3).

- [ ] **Step 1: Update `app/api/school/mentorship/route.ts`**

Change the import:
```ts
import { getSchoolSession } from "@/lib/school-auth";
```
to:
```ts
import { requireSchoolCapability } from "@/lib/school-auth";
```

In the `GET` handler, change `const check = await getSchoolSession();` to `const check = await requireSchoolCapability("mentorship:view");`.

In the `POST` handler, change `const check = await getSchoolSession();` to `const check = await requireSchoolCapability("mentorship:edit");`.

- [ ] **Step 2: Update `app/api/school/mentorship/[conversationId]/route.ts`**

Same import change. In the `DELETE` handler, change `const check = await getSchoolSession();` to `const check = await requireSchoolCapability("mentorship:edit");`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected no new errors.

Manual check: as `team.nivarro@gmail.com`, confirm `GET /api/school/mentorship` still returns 200 with the same shape as before (Owner is unaffected by the sweep — this just confirms the swap didn't break the happy path).

- [ ] **Step 4: Commit**

```bash
git add app/api/school/mentorship
git commit -m "Gate mentorship routes on mentorship:view/edit capabilities"
```

---

### Task 8: Enforcement sweep — partnerships, connections, and their page

**Files:**
- Modify: `app/(dashboard)/school/partnerships/page.tsx`
- Modify: `app/(dashboard)/school/partnerships/SchoolPartnershipsClient.tsx`
- Modify: `app/api/school/partnerships/[id]/approve/route.ts`
- Modify: `app/api/school/partnerships/[id]/reject/route.ts`
- Modify: `app/api/school/connections/route.ts`
- Modify: `app/api/school/connections/[id]/approve/route.ts`

**Interfaces:**
- Consumes: `getSchoolCapabilities`, `requireSchoolCapability` (Task 3).
- Produces: `SchoolPartnershipsClient` gains four new required props (`canViewMentorship`, `canEditMentorship`, `canViewPartnerships`, `canEditPartnerships: boolean`).

- [ ] **Step 1: Update the four API routes to `requireSchoolCapability`**

`app/api/school/partnerships/[id]/approve/route.ts` and `reject/route.ts` currently each do their own inline `auth()` + `role !== "SCHOOL"` check and use `session.user.id` as `schoolId`. In both files, replace:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
```

with (add the import; keep `auth` if the file still needs it elsewhere — neither of these two files does after this change, so drop it):

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolCapability } from "@/lib/school-auth";
```

and replace the body that currently reads:

```ts
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SCHOOL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const schoolId = session.user.id;
```

with:

```ts
  const check = await requireSchoolCapability("partnerships:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const schoolId = check.schoolId;
```

Do the same in `app/api/school/connections/route.ts`'s `GET` (use `requireSchoolCapability("partnerships:view")`) and `app/api/school/connections/[id]/approve/route.ts`'s `POST` (use `requireSchoolCapability("partnerships:edit")`) — both files have the identical `auth()` + `role !== "SCHOOL"` + `schoolId = session.user.id` shape as the two files above, with only one `auth()` call each (for this exact check), so apply the same three changes to each: swap the import from `auth`/`prisma` to `requireSchoolCapability`/`prisma` (drop the now-unused `auth` import), replace the inline check block with the `requireSchoolCapability(...)` call, and replace `schoolId = session.user.id` with `schoolId = check.schoolId`.

- [ ] **Step 2: Update `app/(dashboard)/school/partnerships/page.tsx`**

Replace:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SchoolPartnershipsClient from "./SchoolPartnershipsClient";
import { finalizeExpiredPartnershipRequests, partnerUserSummaries } from "@/lib/partnerships";

export default async function SchoolPartnershipsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");

  const schoolId = session.user.id;
```

with:

```ts
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SchoolPartnershipsClient from "./SchoolPartnershipsClient";
import { finalizeExpiredPartnershipRequests, partnerUserSummaries } from "@/lib/partnerships";
import { getSchoolCapabilities } from "@/lib/school-auth";

export default async function SchoolPartnershipsPage() {
  const check = await getSchoolCapabilities();
  if ("error" in check) redirect(check.error === "Unauthorized" ? "/login" : "/dashboard");

  const canViewMentorship = check.capabilities.includes("mentorship:view");
  const canEditMentorship = check.capabilities.includes("mentorship:edit");
  const canViewPartnerships = check.capabilities.includes("partnerships:view");
  const canEditPartnerships = check.capabilities.includes("partnerships:edit");
  if (!canViewMentorship && !canViewPartnerships) redirect("/dashboard");

  const schoolId = check.schoolId;
```

At the bottom of the file, the return statement currently reads:

```tsx
  return (
    <SchoolPartnershipsClient
      pairings={formattedPairings}
      students={students}
      mentors={formattedMentors}
      requestQueue={formattedQueue}
      requestHistory={formattedHistory}
      connectionRequestQueue={formattedConnectionQueue}
      connectionRequestHistory={formattedConnectionHistory}
    />
  );
```

Change to:

```tsx
  return (
    <SchoolPartnershipsClient
      pairings={formattedPairings}
      students={students}
      mentors={formattedMentors}
      requestQueue={formattedQueue}
      requestHistory={formattedHistory}
      connectionRequestQueue={formattedConnectionQueue}
      connectionRequestHistory={formattedConnectionHistory}
      canViewMentorship={canViewMentorship}
      canEditMentorship={canEditMentorship}
      canViewPartnerships={canViewPartnerships}
      canEditPartnerships={canEditPartnerships}
    />
  );
```

- [ ] **Step 3: Update `app/(dashboard)/school/partnerships/SchoolPartnershipsClient.tsx`**

Add the four booleans to `Props` (currently lines 87-95):

```ts
interface Props {
  pairings: Pairing[];
  students: StudentOption[];
  mentors: MentorOption[];
  requestQueue: PartnershipRequestRow[];
  requestHistory: PartnershipRequestRow[];
  connectionRequestQueue: ConnectionRequestRow[];
  connectionRequestHistory: ConnectionRequestRow[];
  canViewMentorship: boolean;
  canEditMentorship: boolean;
  canViewPartnerships: boolean;
  canEditPartnerships: boolean;
}
```

Add them to the destructured props (currently lines 127-135):

```ts
export default function SchoolPartnershipsClient({
  pairings,
  students,
  mentors,
  requestQueue,
  requestHistory,
  connectionRequestQueue,
  connectionRequestHistory,
  canViewMentorship,
  canEditMentorship,
  canViewPartnerships,
  canEditPartnerships,
}: Props) {
```

The JSX has three natural sections to gate — the mentorship pairing UI (the header/button/list at lines 271-424 plus the "New Pairing Modal" at lines 728-933), and the two request queues (1:1 connections at 425-559 and group partnerships at 561-726). Wrap the **outermost `<div>` at line 271** — currently:

```tsx
  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
```

Change to:

```tsx
  return (
    <div style={{ maxWidth: 900 }}>
      {canViewMentorship && (
      <>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
```

Also gate the "+ New Pairing" button's disabled/visibility on `canEditMentorship` — the button currently reads (inside that same header div):

```tsx
        <button
          onClick={() => setShowNewModal(true)}
          disabled={students.length === 0 || mentors.length === 0}
```

Change the opening to:

```tsx
        {canEditMentorship && (
        <button
          onClick={() => setShowNewModal(true)}
          disabled={students.length === 0 || mentors.length === 0}
```

and add a matching `)}` immediately after that `</button>`'s closing tag.

Close the mentorship-section fragment right after the pairing list block ends (currently line 423, the `)}` that closes `{pairings.length > 0 && (...)}`) and right before the `{/* 1:1 Mentorship Requests */}` comment at line 425 — insert:

```tsx
      </>
      )}
```

Then wrap the two request-queue sections (the `{/* 1:1 Mentorship Requests */}` block through the end of the `{/* Partnership Requests */}` block's history list, i.e. everything currently between lines 425 and 726) in `{canViewPartnerships && (<>...</>)}` the same way: insert `{canViewPartnerships && (\n<>` right before the `{/* 1:1 Mentorship Requests */}` comment, and `</>\n)}` right after the closing `)}` of the `requestHistory.length > 0 && (...)` block (just before the `{/* New Pairing Modal */}` comment).

Within that wrapped region, gate the two action buttons on `canEditPartnerships`: wrap the "Create Room" button in the connection-request queue (the `<button onClick={() => handleApproveConnectionRequest(r.id)} ...>` block) and the "Decline"/"Create Room" button pair in the partnership-request queue (the `<div style={{ display: "flex", gap: 8, flexShrink: 0 }}>` containing both buttons) each in `{canEditPartnerships && (...)}`.

Finally, gate the "New Pairing Modal" (currently `{showNewModal && (...)}` at line 729) on edit rights too — change:

```tsx
      {/* New Pairing Modal */}
      {showNewModal && (
```

to:

```tsx
      {/* New Pairing Modal */}
      {canEditMentorship && showNewModal && (
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expected no new errors.

Manual check with `npm run dev`: log in as `team.nivarro@gmail.com` (Owner-equivalent, sees everything) and load `/school/partnerships` — confirm it renders identically to before this task (all three sections visible, all buttons present). This is the critical regression check since the Owner path exercises every gated section at once.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/school/partnerships" app/api/school/partnerships app/api/school/connections
git commit -m "Gate partnerships/connections on mentorship and partnerships capabilities"
```

---

### Task 9: Enforcement sweep — community admin panel and roster resend-invite

**Files:**
- Modify: `app/(dashboard)/communities/page.tsx`
- Modify: `app/api/communities/school-code/route.ts`
- Modify: `app/api/school/roster/members/[userId]/resend-invite/route.ts`

**Interfaces:**
- Consumes: `requireSchoolCapability` (Task 3).

- [ ] **Step 1: Update `app/(dashboard)/communities/page.tsx`**

This page serves every account type, not just school admins. The existing `user` lookup (`select: { role: true, schoolCode: true }`) is used only to compute `isAdmin` and to read `schoolCode` — both need to change, because a capable `STAFF` account (not just `role === "SCHOOL"`) should now count as admin, and `schoolCode` lives on the **Owner's** `User` row, not the `STAFF` account's own (which would always be `null`). Change:

```ts
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, schoolCode: true },
  });
  const isAdmin = user?.role === "SCHOOL";
```

to:

```ts
  const capCheck = await getSchoolCapabilities();
  const isAdmin = !("error" in capCheck) && capCheck.capabilities.includes("community:manage");
  let adminSchoolCode: string | null = null;
  if (isAdmin && !("error" in capCheck)) {
    const owner = await prisma.user.findUnique({ where: { id: capCheck.schoolId }, select: { schoolCode: true } });
    adminSchoolCode = owner?.schoolCode ?? null;
  }
```

(the `!("error" in capCheck)` check is repeated deliberately inside the `if` — `isAdmin` being `true` doesn't by itself narrow `capCheck`'s type for TypeScript, so `capCheck.schoolId` needs its own guard in scope, not a re-use of the boolean.)

Add the import near the top:
```ts
import { getSchoolCapabilities } from "@/lib/school-auth";
```

Note the `schoolCode={isAdmin ? (user?.schoolCode ?? null) : null}` line further down needs to change too — change:

```tsx
      schoolCode={isAdmin ? (user?.schoolCode ?? null) : null}
```

to:

```tsx
      schoolCode={adminSchoolCode}
```

- [ ] **Step 2: Update `app/api/communities/school-code/route.ts`**

Replace:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  schoolCode: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { schoolCode: parsed.data.schoolCode },
    });
    return NextResponse.json({ ok: true, schoolCode: parsed.data.schoolCode });
  } catch (e: unknown) {
```

with:

```ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSchoolCapability } from "@/lib/school-auth";

const schema = z.object({
  schoolCode: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
});

export async function PATCH(req: Request) {
  const check = await requireSchoolCapability("community:manage");
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });

  try {
    await prisma.user.update({
      where: { id: check.schoolId },
      data: { schoolCode: parsed.data.schoolCode },
    });
    return NextResponse.json({ ok: true, schoolCode: parsed.data.schoolCode });
  } catch (e: unknown) {
```

(leave the rest of the `catch` block, which handles the unique-constraint-violation case, unchanged).

- [ ] **Step 3: Update `app/api/school/roster/members/[userId]/resend-invite/route.ts`**

Replace:

```ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";
import { createAccountInvite } from "@/lib/account-invite";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await getSchoolSession();
```

with:

```ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireSchoolCapability } from "@/lib/school-auth";
import { createAccountInvite } from "@/lib/account-invite";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await requireSchoolCapability("roster:edit");
```

(rest of the file is unchanged — it already destructures `{ schoolId }` from `check`).

- [ ] **Step 4: Remove the now-unused `getSchoolSession` scaffolding**

This is the last of the three sweep tasks (Tasks 4, 7, and this one) that had a `getSchoolSession()` caller — after Step 3 above, grep the whole project for `getSchoolSession` and confirm the only remaining match is its own definition in `lib/school-auth.ts` (the "TEMPORARY" function Task 3 added). If any other caller remains, stop and fix it as part of this task rather than proceeding — the plan's task ordering assumed all five callers (Task 4's two, Task 7's two, this task's one) would be gone by this point.

Once confirmed, delete the `getSchoolSession` function (and its preceding `TEMPORARY` comment block) from `lib/school-auth.ts` entirely.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected no new errors. This should also resolve the "missing revocations argument" errors flagged as expected back in Task 2, since every remaining `computeEffectivePermissions` caller has now been updated — confirm zero errors mentioning `facultyPermissions` remain. This is also the first point where `getSchoolSession` is fully gone — a stray import of it anywhere would now surface as a real compile error, not just a lint warning.

Manual check with `npm run dev`: as `team.nivarro@gmail.com`, load `/communities` and confirm the admin join-code panel still renders and a code can still be set. Then confirm `POST /api/school/roster/members/<some-unactivated-member-id>/resend-invite` (pick one from `/school/roster`) still returns an activation URL.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/communities" app/api/communities/school-code app/api/school/roster/members lib/school-auth.ts
git commit -m "Gate community admin panel and roster resend-invite on capabilities, remove getSchoolSession scaffolding"
```

---

### Task 10: `/school/staff` page — fetch Owner/Core-Admin status, prep for the new client

**Files:**
- Modify: `app/(dashboard)/school/staff/page.tsx`

**Interfaces:**
- Consumes: `requireSchoolCapability` (Task 3).
- Produces: passes `isOwnerOrCoreAdmin: boolean` and `initialGroups` to `PermissionsClient` (created in Task 11 — this task's `page.tsx` import will not resolve until Task 11 lands; that's expected, both tasks land together in the same review pass or Task 10 is reviewed alongside Task 11).

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `app/(dashboard)/school/staff/page.tsx` with:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireSchoolCapability } from "@/lib/school-auth";
import type { Capability } from "@/lib/facultyPermissions";
import { getOrCreateDefaultTiers } from "@/lib/facultyPermissions.server";
import PermissionsClient from "./PermissionsClient";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) redirect("/dashboard");

  const isOwnerOrCoreAdmin = check.isOwner || check.isCoreAdmin;

  const tiers = await getOrCreateDefaultTiers(check.schoolId);

  return (
    <PermissionsClient
      isOwnerOrCoreAdmin={isOwnerOrCoreAdmin}
      initialGroups={tiers.map((t) => ({
        id: t.id,
        name: t.name,
        permissions: JSON.parse(t.permissions) as Capability[],
        isSystemDefault: t.isSystemDefault,
      }))}
    />
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — this WILL show an error that `./PermissionsClient` cannot be found. That is expected at this point in the plan; note it and proceed — Task 11 creates that file. Do not attempt to work around it by importing the old `StaffClient` here.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/school/staff/page.tsx"
git commit -m "Update school/staff page for Owner/Core Admin status (PermissionsClient added next task)"
```

---

### Task 11: Shared styles + `PermissionsClient` tab shell

**Files:**
- Create: `app/(dashboard)/school/staff/styles.ts`
- Create: `app/(dashboard)/school/staff/PermissionsClient.tsx`
- Delete: `app/(dashboard)/school/staff/StaffClient.tsx` (superseded by `PermissionsClient.tsx` + the three tab components in Tasks 12-14)

**Interfaces:**
- Consumes: `Capability` from `@/lib/facultyPermissions`.
- Produces: `Group` and `Person` TypeScript interfaces (exported from `PermissionsClient.tsx`, imported by `PeopleTab.tsx`/`GroupsTab.tsx`/`AdminsTab.tsx` in Tasks 12-14), plus the style constants `inputStyle`, `labelStyle`, `sectionHeadingStyle`, `sectionCardStyle`, `primaryButtonStyle`, `selectStyle`, `capabilityLabel(cap): string` from `styles.ts`.

- [ ] **Step 1: Create `app/(dashboard)/school/staff/styles.ts`**

```ts
import type { CSSProperties } from "react";

export const inputStyle: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  borderRadius: 0,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  marginBottom: 6,
  textTransform: "uppercase",
};

export const sectionHeadingStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--text)",
  margin: "0 0 14px",
};

export const sectionCardStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 0,
  padding: "20px 22px",
  marginBottom: 24,
};

export const primaryButtonStyle: CSSProperties = {
  padding: "8px 20px",
  background: "var(--amber)",
  border: "1px solid var(--amber)",
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
  whiteSpace: "nowrap",
};

export const selectStyle: CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  borderRadius: 0,
  outline: "none",
};

export function capabilityLabel(cap: string): string {
  return cap.replace(":", " · ");
}
```

- [ ] **Step 2: Create `app/(dashboard)/school/staff/PermissionsClient.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Capability } from "@/lib/facultyPermissions";
import PeopleTab from "./PeopleTab";
import GroupsTab from "./GroupsTab";
import AdminsTab from "./AdminsTab";

export interface Group {
  id: string;
  name: string;
  permissions: Capability[];
  isSystemDefault: boolean;
}

export interface Person {
  userId: string;
  email: string | null;
  displayName: string;
  staffTitle: string | null;
  tierId: string | null;
  tierName: string | null;
  isCustom: boolean;
  isCoreAdmin: boolean;
  overrides: Capability[];
  revocations: Capability[];
  isPending: boolean;
}

interface StaffApiRow {
  userId: string;
  email: string | null;
  displayName: string;
  staffTitle: string | null;
  tierId: string | null;
  tierName: string | null;
  isCustom: boolean;
  isCoreAdmin: boolean;
  overrides: Capability[];
  revocations: Capability[];
}

interface Props {
  isOwnerOrCoreAdmin: boolean;
  initialGroups: Group[];
}

type Tab = "people" | "groups" | "admins";

export default function PermissionsClient({ isOwnerOrCoreAdmin, initialGroups }: Props) {
  const [tab, setTab] = useState<Tab>("people");
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);

  function toPerson(row: StaffApiRow, isPending: boolean): Person {
    return { ...row, isPending };
  }

  async function refreshPeople() {
    setLoadingPeople(true);
    try {
      const res = await fetch("/api/school/staff");
      const data = await res.json();
      setPeople([
        ...((data.staff ?? []) as StaffApiRow[]).map((r) => toPerson(r, false)),
        ...((data.pendingInvites ?? []) as StaffApiRow[]).map((r) => toPerson(r, true)),
      ]);
    } finally {
      setLoadingPeople(false);
    }
  }

  async function refreshGroups() {
    const res = await fetch("/api/school/staff/tiers");
    const data = await res.json();
    setGroups(data.tiers ?? []);
  }

  useEffect(() => {
    refreshPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: "people", label: "People" },
    ...(isOwnerOrCoreAdmin ? ([{ key: "groups", label: "Groups" }, { key: "admins", label: "Admins" }] as { key: Tab; label: string }[]) : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.1 }}>
          Permissions
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
          Add people, name permission groups, and manage who can manage this school.
        </p>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--amber)" : "2px solid transparent",
              color: tab === t.key ? "var(--text)" : "var(--muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "people" && (
        <PeopleTab people={people} loading={loadingPeople} groups={groups} isOwnerOrCoreAdmin={isOwnerOrCoreAdmin} onChanged={refreshPeople} />
      )}
      {tab === "groups" && isOwnerOrCoreAdmin && <GroupsTab groups={groups} onChanged={refreshGroups} />}
      {tab === "admins" && isOwnerOrCoreAdmin && <AdminsTab onChanged={refreshPeople} />}
    </div>
  );
}
```

- [ ] **Step 3: Delete the superseded file**

```bash
git rm "app/(dashboard)/school/staff/StaffClient.tsx"
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expected errors: `./PeopleTab`, `./GroupsTab`, `./AdminsTab` not found (Tasks 12-14 create them). No other new errors should appear.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/school/staff/styles.ts" "app/(dashboard)/school/staff/PermissionsClient.tsx"
git commit -m "Add shared styles and PermissionsClient tab shell, remove old StaffClient"
```

---

### Task 12: People tab — add/edit person, 3-state capability list

**Files:**
- Create: `app/(dashboard)/school/staff/PeopleTab.tsx`

**Interfaces:**
- Consumes: `Group`, `Person` from `./PermissionsClient` (Task 11); `CAPABILITIES`, `Capability`, `toggleCapability`, `capabilityState` from `@/lib/facultyPermissions` (Task 2); style constants from `./styles` (Task 11).
- Produces: default export `PeopleTab(props: { people: Person[]; loading: boolean; groups: Group[]; isOwnerOrCoreAdmin: boolean; onChanged: () => void })`.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { CAPABILITIES, toggleCapability, capabilityState, type Capability } from "@/lib/facultyPermissions";
import type { Group, Person } from "./PermissionsClient";
import { inputStyle, labelStyle, sectionHeadingStyle, sectionCardStyle, primaryButtonStyle, selectStyle, capabilityLabel } from "./styles";

interface Props {
  people: Person[];
  loading: boolean;
  groups: Group[];
  isOwnerOrCoreAdmin: boolean;
  onChanged: () => void;
}

interface FormState {
  userId: string | null; // null = creating a new person
  name: string;
  email: string;
  staffTitle: string;
  groupId: string | null; // null = Custom
  overrides: Capability[];
  revocations: Capability[];
  makeCoreAdmin: boolean;
}

function emptyForm(defaultGroupId: string | null): FormState {
  return { userId: null, name: "", email: "", staffTitle: "", groupId: defaultGroupId, overrides: [], revocations: [], makeCoreAdmin: false };
}

export default function PeopleTab({ people, loading, groups, isOwnerOrCoreAdmin, onChanged }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  function openCreate() {
    setError(null);
    setInviteLink(null);
    setForm(emptyForm(groups[0]?.id ?? null));
  }

  function openEdit(p: Person) {
    setError(null);
    setInviteLink(null);
    setForm({
      userId: p.userId,
      name: p.displayName,
      email: p.email ?? "",
      staffTitle: p.staffTitle ?? "",
      groupId: p.tierId,
      overrides: p.overrides,
      revocations: p.revocations,
      makeCoreAdmin: p.isCoreAdmin,
    });
  }

  function groupPermissions(groupId: string | null): Capability[] {
    return groups.find((g) => g.id === groupId)?.permissions ?? [];
  }

  function toggle(cap: Capability) {
    if (!form) return;
    if (form.groupId === null) {
      setForm({
        ...form,
        overrides: form.overrides.includes(cap) ? form.overrides.filter((c) => c !== cap) : [...form.overrides, cap],
      });
      return;
    }
    const { overrides, revocations } = toggleCapability(cap, groupPermissions(form.groupId), form.overrides, form.revocations);
    setForm({ ...form, overrides, revocations });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.userId && !form.email.trim()) {
      setError("Email is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!form.userId) {
        const res = await fetch("/api/school/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            form.groupId
              ? {
                  email: form.email.trim(),
                  name: form.name.trim() || undefined,
                  staffTitle: form.staffTitle.trim() || undefined,
                  tierId: form.groupId,
                  makeCoreAdmin: form.makeCoreAdmin,
                }
              : {
                  email: form.email.trim(),
                  name: form.name.trim() || undefined,
                  staffTitle: form.staffTitle.trim() || undefined,
                  customPermissions: form.overrides,
                  makeCoreAdmin: form.makeCoreAdmin,
                }
          ),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to add person.");
          return;
        }
        if (data.status === "invited" && data.link) setInviteLink(data.link);
        await onChanged();
        if (!(data.status === "invited" && data.link)) setForm(null);
      } else {
        const res = await fetch(`/api/school/staff/${form.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            staffTitle: form.staffTitle.trim(),
            tierId: form.groupId,
            overrides: form.overrides,
            revocations: form.revocations,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to save.");
          return;
        }
        await onChanged();
        setForm(null);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={primaryButtonStyle}>
          + Add person
        </button>
      </div>

      {form && (
        <section style={sectionCardStyle}>
          <h2 style={sectionHeadingStyle}>{form.userId ? "Edit person" : "Add person"}</h2>
          <form onSubmit={handleSave}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ minWidth: 200 }}>
                <label style={labelStyle}>Name</label>
                <input style={{ ...inputStyle, width: "100%" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div style={{ minWidth: 220 }}>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  required
                  style={{ ...inputStyle, width: "100%" }}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div style={{ minWidth: 180 }}>
                <label style={labelStyle}>Title</label>
                <input
                  style={{ ...inputStyle, width: "100%" }}
                  placeholder="AP History Teacher"
                  value={form.staffTitle}
                  onChange={(e) => setForm({ ...form, staffTitle: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14, maxWidth: 260 }}>
              <label style={labelStyle}>Group</label>
              <select
                style={{ ...selectStyle, width: "100%" }}
                value={form.groupId ?? "__custom__"}
                onChange={(e) => setForm({ ...form, groupId: e.target.value === "__custom__" ? null : e.target.value })}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="__custom__">Custom</option>
              </select>
            </div>

            {isOwnerOrCoreAdmin && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", marginBottom: 14, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.makeCoreAdmin}
                  onChange={(e) => setForm({ ...form, makeCoreAdmin: e.target.checked })}
                  style={{ accentColor: "var(--amber)", cursor: "pointer" }}
                />
                Make Core Admin (full access, can manage other admins)
              </label>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Permissions</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CAPABILITIES.map((cap) => {
                  const state = form.groupId
                    ? capabilityState(cap, groupPermissions(form.groupId), form.overrides, form.revocations)
                    : form.overrides.includes(cap)
                      ? "granted"
                      : "off";
                  const disabled = cap === "staff:manage" && !isOwnerOrCoreAdmin;
                  return (
                    <button
                      type="button"
                      key={cap}
                      disabled={disabled}
                      onClick={() => toggle(cap)}
                      title={
                        state === "inherited"
                          ? "Inherited from group — click to revoke for this person"
                          : state === "granted"
                            ? "Granted directly — click to remove"
                            : "Click to grant"
                      }
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        padding: "5px 10px",
                        border: "1px solid var(--border)",
                        background: state === "off" ? "var(--bg)" : state === "inherited" ? "rgba(232,137,58,0.12)" : "var(--amber)",
                        color: state === "granted" ? "#000" : "var(--text)",
                        opacity: disabled ? 0.5 : 1,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {capabilityLabel(cap)}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            {inviteLink && (
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
                Invite link (send this yourself — email delivery isn&apos;t wired up yet):{" "}
                <code style={{ wordBreak: "break-all" }}>{inviteLink}</code>
              </p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setForm(null)} style={{ ...primaryButtonStyle, background: "var(--bg)", color: "var(--text)" }}>
                {inviteLink ? "Done" : "Cancel"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section style={sectionCardStyle}>
        <h2 style={sectionHeadingStyle}>People</h2>
        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
        ) : people.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>No one added yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {people.map((p) => (
              <button
                key={p.userId}
                onClick={() => openEdit(p)}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                  color: "inherit",
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {p.displayName}
                    {p.isCoreAdmin && <span style={{ color: "var(--amber)", fontSize: 11, marginLeft: 6 }}>CORE ADMIN</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
                    {p.email && <span>{p.email}</span>}
                    <span>{p.staffTitle ?? "No title"}</span>
                    {p.isPending && <span style={{ color: "var(--amber)" }}>Pending</span>}
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{p.isCustom ? "Custom" : p.tierName}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected remaining errors: only `./GroupsTab`, `./AdminsTab` not found (Tasks 13-14). No errors from `PeopleTab.tsx` itself.

Manual check with `npm run dev`: load `/school/staff` as `team.nivarro@gmail.com` (this will still fail to render fully since `GroupsTab`/`AdminsTab` don't exist yet — that's expected; skip full manual verification of this page until Task 14 completes, but confirm the dev server itself doesn't crash on `PeopleTab.tsx`'s own syntax by running `npx tsc --noEmit` cleanly for this file).

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/school/staff/PeopleTab.tsx"
git commit -m "Add People tab with Google-Docs-style add/edit-person flow"
```

---

### Task 13: Groups tab — permission matrix

**Files:**
- Create: `app/(dashboard)/school/staff/GroupsTab.tsx`

**Interfaces:**
- Consumes: `Group` from `./PermissionsClient` (Task 11); `CAPABILITIES`, `Capability` from `@/lib/facultyPermissions`; style constants from `./styles`.
- Produces: default export `GroupsTab(props: { groups: Group[]; onChanged: () => void })`.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";
import type { Group } from "./PermissionsClient";
import { inputStyle, sectionHeadingStyle, sectionCardStyle, primaryButtonStyle, capabilityLabel } from "./styles";

interface Props {
  groups: Group[];
  onChanged: () => void;
}

export default function GroupsTab({ groups, onChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function toggleCell(group: Group, cap: Capability) {
    const next = group.permissions.includes(cap) ? group.permissions.filter((c) => c !== cap) : [...group.permissions, cap];
    await fetch(`/api/school/staff/tiers/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: next }),
    });
    onChanged();
  }

  async function rename(group: Group, name: string) {
    if (!name.trim() || name === group.name) return;
    await fetch(`/api/school/staff/tiers/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    onChanged();
  }

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/school/staff/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), permissions: [] }),
      });
      setNewName("");
      onChanged();
    } finally {
      setCreating(false);
    }
  }

  async function deleteGroup(id: string) {
    if (!window.confirm("Delete this group? People on it keep their personal permissions but lose the group's.")) return;
    await fetch(`/api/school/staff/tiers/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <section style={sectionCardStyle}>
      <h2 style={sectionHeadingStyle}>Groups</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>Group</th>
              {CAPABILITIES.map((cap) => (
                <th key={cap} style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {capabilityLabel(cap)}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px" }}>
                  <input defaultValue={g.name} onBlur={(e) => rename(g, e.target.value)} style={{ ...inputStyle, minWidth: 160, fontWeight: 700 }} />
                </td>
                {CAPABILITIES.map((cap) => (
                  <td key={cap} style={{ textAlign: "center", padding: "6px 8px" }}>
                    <input
                      type="checkbox"
                      checked={g.permissions.includes(cap)}
                      onChange={() => toggleCell(g, cap)}
                      style={{ accentColor: "var(--amber)", cursor: "pointer" }}
                    />
                  </td>
                ))}
                <td style={{ padding: "6px 8px" }}>
                  {!g.isSystemDefault && (
                    <button onClick={() => deleteGroup(g.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11 }}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={addGroup} style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <input placeholder="New group name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ ...inputStyle, flex: 1, maxWidth: 260 }} />
        <button type="submit" disabled={creating} style={primaryButtonStyle}>
          + Add group
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected remaining error: only `./AdminsTab` not found (Task 14). No errors from `GroupsTab.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/school/staff/GroupsTab.tsx"
git commit -m "Add Groups tab with permission matrix"
```

---

### Task 14: Admins tab + full manual walkthrough

**Files:**
- Create: `app/(dashboard)/school/staff/AdminsTab.tsx`

**Interfaces:**
- Consumes: none beyond `fetch` calls to Task 6's endpoints; style constants from `./styles`.
- Produces: default export `AdminsTab(props: { onChanged: () => void })`.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import { sectionHeadingStyle, sectionCardStyle, primaryButtonStyle } from "./styles";

interface AdminRow {
  userId: string;
  email: string | null;
  displayName: string;
}

interface AdminsData {
  owner: AdminRow | null;
  coreAdmins: AdminRow[];
}

interface Props {
  onChanged: () => void;
}

export default function AdminsTab({ onChanged }: Props) {
  const [data, setData] = useState<AdminsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/school/admins");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function demote(userId: string) {
    if (!window.confirm("Remove Core Admin status from this person? They'll fall back to their previous group.")) return;
    await fetch(`/api/school/admins/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCoreAdmin: false }),
    });
    await refresh();
    onChanged();
  }

  return (
    <section style={sectionCardStyle}>
      <h2 style={sectionHeadingStyle}>Admins</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
        The owner account can never be removed here. Any Core Admin can promote or remove any other from the People tab or this list.
      </p>
      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {data?.owner && (
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{data.owner.displayName}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{data.owner.email}</div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", textTransform: "uppercase" }}>Owner</span>
            </div>
          )}
          {data?.coreAdmins.map((a) => (
            <div key={a.userId} style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.displayName}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.email}</div>
              </div>
              <button onClick={() => demote(a.userId)} style={{ ...primaryButtonStyle, background: "var(--bg)", color: "var(--text)" }}>
                Remove Core Admin
              </button>
            </div>
          ))}
          {data?.coreAdmins.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>No Core Admins yet.</p>}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify — full type check**

Run: `npx tsc --noEmit`
Expected: **zero new errors anywhere in the project.** This is the first point in the plan where every file compiles together — if any error remains, trace it back to the task that introduced it before proceeding.

- [ ] **Step 3: Full manual walkthrough**

With `npm run dev` running, log in as `team.nivarro@gmail.com` / `nivarro2026`:

1. Load `/school/staff`. Confirm the sidebar entry reads **"Permissions"** (not "Staff") and the page header reads **"Permissions"** with **People / Groups / Admins** tabs.
2. On **People**, click **+ Add person**. Fill Name: "Plan Walkthrough Teacher", Email: `plan-walkthrough@nivarro.demo`, Title: "Test Teacher", Group: "Teacher". Submit. Confirm an invite link appears and the new row shows up in the People list tagged "Pending".
3. Click that pending person's row. Confirm the edit form pre-fills with their name/email/title/group. Change their Group to "Guidance Counselor", grant an extra `staff:manage` capability by clicking its chip (confirm it turns solid/"granted" styled), save. Reload the page and re-open them — confirm the extra grant persisted.
4. Switch to **Groups**. Confirm the matrix shows all 10 capability columns and the 4 default rows with the checkbox states matching the spec's default table (Principal all-checked, Teacher only `roster:view`, etc.). Toggle a checkbox for "Teacher" (e.g. add `campaigns:view`), confirm it persists on reload. Add a new group named "Plan Test Group", confirm it appears with zero permissions checked, then delete it.
5. Copy the invite link shown in step 2 (or regenerate it via `fetch('/api/school/staff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'plan-walkthrough@nivarro.demo',tierId:null,customPermissions:[]})}).then(r=>r.json()).then(console.log)` if lost — this also exercises the POST route's "already-staff-adjacent" pending-invite-update path), open it in an incognito window, and complete account activation (set a password).
6. Log in (incognito) as `plan-walkthrough@nivarro.demo` with the password just set. They should NOT be a Core Admin yet (only Guidance Counselor tier + a personal `staff:manage` grant, from step 3). Confirm their sidebar shows **Permissions** (from the `staff:manage` override) and **Partnerships** (from the tier's `mentorship:view/edit`/`partnerships:view`), but on `/school/staff` only the **People** tab is visible — no **Groups** or **Admins** tab (those are Core-Admin/Owner-only).
7. **403 check** — still logged in as `plan-walkthrough@nivarro.demo`, in devtools console run `fetch('/api/school/admins').then(r=>r.status).then(console.log)`. Expect `403` (this account has `staff:manage` but is not a Core Admin, and `/api/school/admins` requires `requireCoreAdmin()`). Also run `fetch('/api/school/staff/tiers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Should Fail',permissions:[]})}).then(r=>r.status).then(console.log)` — expect `403` too (tier creation is Core-Admin-only).
8. Log back in as `team.nivarro@gmail.com`. On **People**, open "Plan Walkthrough Teacher" and check **Make Core Admin**, save.
9. Still as Owner, click **+ Add person** again to create a second test account: Name "Plan Walkthrough Admin2", Email `plan-walkthrough-2@nivarro.demo`, Group "Teacher", and check **Make Core Admin** at creation time (not via a later edit — this exercises the `makeCoreAdmin` field on the POST/invite path itself, not just the PATCH path). Submit, then activate this second account the same way as step 5 (copy its invite link, incognito window, set password).
10. Log in (a different incognito window) as `plan-walkthrough-2@nivarro.demo`. Confirm they land as a full Core Admin (all tabs visible on `/school/staff`, including **Groups**' tier-editor controls). On the **Admins** tab, confirm both the Owner and "Plan Walkthrough Teacher" are listed as Core Admins alongside themselves.
11. **Symmetric peer demotion check** — still as `plan-walkthrough-2@nivarro.demo` (a Core Admin promoted only moments ago), click "Remove Core Admin" on **"Plan Walkthrough Teacher"** (a different, pre-existing Core Admin — not themselves). Confirm it succeeds. Log in as `plan-walkthrough@nivarro.demo` again and confirm their sidebar/permissions have reverted to their Guidance Counselor tier (plus the personal `staff:manage` grant from step 3) — not zeroed out, and not still a Core Admin.
12. As `plan-walkthrough-2@nivarro.demo`, confirm attempting to demote the Owner is rejected: `fetch('/api/school/admins/<team.nivarro's user id>', {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({isCoreAdmin:false})}).then(r=>r.status).then(console.log)` returns `403`. (Find the Owner's user id from the `owner.userId` field in a prior `GET /api/school/admins` response.)
13. Log back in as `team.nivarro@gmail.com`. Load `/school/partnerships` and confirm the mentorship pairing section, the 1:1 request queue, and the group partnership queue are all still visible with working action buttons (Owner sees everything — this is the regression check for Task 8's sweep).
14. Load `/communities` and confirm the join-code admin panel is still visible and functional (Task 9's sweep).
15. Clean up: on the **People** tab, there is no delete-person action in this plan's scope (not requested) — leave the three test accounts (`plan-walkthrough@nivarro.demo`, `plan-walkthrough-2@nivarro.demo`, and the deleted "Plan Test Group") in place; note in the PR/handoff that these should be cleaned up via `/hq` if desired, since no in-app delete path exists for them yet.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/school/staff/AdminsTab.tsx"
git commit -m "Add Admins tab; complete People/Groups/Admins Permissions surface"
```

---

### Task 15: Nav wiring — rename to Permissions, add Partnerships entry

**Files:**
- Modify: `components/layout/Sidebar.tsx:22-41`

**Interfaces:**
- Consumes: `staffCapabilities: Capability[]` (already computed correctly by Task 3's `layout.tsx` change — Core Admins already resolve to the full `CAPABILITIES` list, so no new prop threading is needed here).

- [ ] **Step 1: Update `buildStaffNav` and `SCHOOL_NAV`**

Currently:

```tsx
const SCHOOL_NAV = [
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/communities",         label: "Community",     Icon: Globe },
  { href: "/campaigns",           label: "Fundraise",     Icon: HeartHandshake },
  { href: "/school/partnerships", label: "Partnerships",  Icon: UsersRound },
  { href: "/messages",            label: "Messages",      Icon: MessageSquare },
  { href: "/notifications",       label: "Notifications", Icon: Bell },
  { href: "/school/roster",       label: "Roster",        Icon: Users },
];

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

Replace with:

```tsx
const SCHOOL_NAV = [
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/communities",         label: "Community",     Icon: Globe },
  { href: "/campaigns",           label: "Fundraise",     Icon: HeartHandshake },
  { href: "/school/partnerships", label: "Partnerships",  Icon: UsersRound },
  { href: "/school/staff",        label: "Permissions",   Icon: UsersRound },
  { href: "/messages",            label: "Messages",      Icon: MessageSquare },
  { href: "/notifications",       label: "Notifications", Icon: Bell },
  { href: "/school/roster",       label: "Roster",        Icon: Users },
];

function buildStaffNav(caps: Capability[]) {
  const items: { href: string; label: string; Icon: typeof Users }[] = [
    { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  ];
  if (caps.includes("roster:view")) items.push({ href: "/school/roster", label: "Roster", Icon: Users });
  if (caps.includes("campaigns:view")) items.push({ href: "/campaigns", label: "Fundraise", Icon: HeartHandshake });
  if (
    caps.includes("mentorship:view") ||
    caps.includes("mentorship:edit") ||
    caps.includes("partnerships:view") ||
    caps.includes("partnerships:edit")
  ) {
    items.push({ href: "/school/partnerships", label: "Partnerships", Icon: UsersRound });
  }
  if (caps.includes("staff:manage")) items.push({ href: "/school/staff", label: "Permissions", Icon: UsersRound });
  items.push({ href: "/notifications", label: "Notifications", Icon: Bell });
  return items;
}
```

`SCHOOL_NAV` (the Owner's nav) previously had no link to `/school/staff` at all — confirmed by reading the array during planning; the Owner could only reach that page by typing the URL directly. The change above adds a "Permissions" entry to `SCHOOL_NAV` so the Owner can discover the page from the sidebar too, matching the spec's "visible to the Owner, any Core Admin, and any capable STAFF" requirement.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected zero new errors.

Manual check: log in as a `STAFF` account with only `roster:view` (e.g. re-use "Plan Walkthrough Teacher" from Task 14 if still on the Teacher group) and confirm their sidebar does NOT show Partnerships or Permissions. Then, using the same account after Task 14's step 3 granted it `staff:manage`, confirm both now appear, with the staff:manage-gated entry labeled **"Permissions"**.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "Rename staff nav entry to Permissions, add Partnerships entry for mentorship/partnerships capabilities"
```

---

## Post-plan note

The Emergency Access (`OWNER_LOCKOUT` support ticket) piece of the spec is intentionally excluded from this plan — it depends on the `support-tickets` branch merging into `main` first. Once that lands, write a follow-up plan covering: the `SupportTicketCategory` enum + `category` column migration, the Support modal's "Locked out as the school owner?" option, and the `/hq/support` triage page's "issue temporary password" action for that category.
