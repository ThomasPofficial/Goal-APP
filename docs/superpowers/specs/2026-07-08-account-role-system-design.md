# Account & Role System Design

**Date:** 2026-07-08
**Status:** Approved, pending implementation plan

## Purpose

Nivarro currently has four account types (`STUDENT`, `ORG`, `ADMIN`, `SCHOOL`) plus a boolean `isAlumni` flag standing in for a fifth. Role checks (`role === "SCHOOL"`, `role !== "ADMIN"`, etc.) are duplicated ad hoc across ~25 files with inconsistent patterns. This spec formalizes a clean role model, centralizes permission enforcement, and adds the missing structural pieces needed for schools to have multiple admins with different permission levels and for alumni/staff to propose changes rather than only ever having a single all-or-nothing admin account per school.

**Explicitly out of scope:**
- `ORG` role changes — external company accounts are a separate, unrelated feature area. (Future direction: ORG will become school-like but company-agnostic, with its own private community and paid membership — tracked outside this spec, not designed here.)
- Building the actual feature UIs this permission system will gate (map visibility toggle UI, mentor-community admin grid, ad generator, brochure redesign, `/hq` panel UI). This spec defines the role/permission/data model; feature specs build on top of it.
- A general, app-wide undo engine. Change-log + revert is bounded to the school-admin-scoped mutations this spec introduces permission tiers for.
- Staff invite email polish (magic links, branded emails) — a basic API to create/manage staff accounts is in scope; a polished invite UX is not.

## Current State (as of this session)

- `UserRole` enum: `STUDENT | ORG | ADMIN | SCHOOL` (`prisma/schema.prisma:64`)
- `User.isAlumni: Boolean` + `Profile.isAvailableToMentor: Boolean` — alumni/mentors are `STUDENT`-role users with `isAlumni=true`, not a distinct role
- `Profile.schoolId` — links students/alumni to the `User.id` of their `SCHOOL`-role account (the school account's own id is the anchor; the school itself has no `schoolId`)
- `Profile.staffTitle` exists ("Dean", "Counselor", "AP History Teacher") but is unwired — no role/permission concept of "staff" currently exists
- `ADMIN` (the Nivarro operator account, `team.nivarro@gmail.com`) currently piggybacks on `ORG`'s dashboard logic (`app/(dashboard)/layout.tsx:29`: `isOrg = role === "ORG" || role === "ADMIN"`) because the planned `/hq` panel (`plans/nivarro-hq-school-admin-design.md`) was never built
- `/api/alumni/verify` — self-service "enter your grad year" flow that flips `isAlumni: true` on the same account (no role change today)
- Role checks are inline and inconsistent across ~25 files (see File Map below)

## Role Model

| Role | Who | Notes |
|---|---|---|
| `STUDENT` | Current, non-graduated students | Default role |
| `ALUMNI` *(new)* | Graduated students (self-verified) + bulk-imported historical grads | Replaces `isAlumni` flag entirely |
| `SCHOOL` | Any account administering a school (owner, teacher/editor, or viewer) | Broadened meaning — see Staff Tiers below |
| `ADMIN` | Nivarro founder/co-founder account only | Full access to everything, independent of `ORG` |
| `ORG` | External company accounts | **Untouched** in this spec |

### Migration
- Any existing `User` with `role=STUDENT AND isAlumni=true` → `role=ALUMNI`
- `User.isAlumni` column dropped after migration (redundant once `ALUMNI` is a role)
- `Profile.isAvailableToMentor` is retained unchanged — not every alumnus opts to mentor
- Existing `SCHOOL`-role accounts get `Profile.schoolAdminTier = OWNER` by default (fully backward compatible, no behavior change for existing single-admin schools)

### Graduation transition
`/api/alumni/verify` changes from a flag flip to a real role transition: `role: STUDENT → ALUMNI`. Same `User` row, same history (profile, messages, community memberships all carry over unchanged since it's the same id).

## School Staff Tiers (new)

Reuses the existing `Profile.schoolId` linkage pattern rather than introducing a new join table.

- New enum `SchoolAdminTier { OWNER, EDITOR, VIEWER }` on `Profile.schoolAdminTier` (nullable — only meaningful when `role=SCHOOL`)
- The school-creating account is the anchor: `Profile.schoolId = null`, `schoolAdminTier = OWNER` (implicit — it *is* the school)
- Additional staff accounts: `role=SCHOOL`, `Profile.schoolId` = anchor school's `User.id`, `schoolAdminTier = EDITOR | VIEWER`, `Profile.staffTitle` = e.g. "AP History Teacher"
- Staff account creation/tier changes are **OWNER-only** (or `ADMIN`) — never proposable by `EDITOR`, to avoid privilege escalation

### Tier permissions

| Action | VIEWER | EDITOR | OWNER |
|---|---|---|---|
| View rosters, communities, brochure, destinations settings, campaigns | ✅ | ✅ | ✅ |
| Edit brochure text/testimonials | ❌ | ✅ direct | ✅ direct |
| Adjust destinations map visibility | ❌ | ✅ direct | ✅ direct |
| Create/delete mentor communities | ❌ | 🟡 propose only | ✅ direct |
| Add/remove students or alumni from roster | ❌ | 🟡 propose only | ✅ direct |
| Change campaign goal amounts | ❌ | 🟡 propose only | ✅ direct |
| Approve/reject proposals | ❌ | ❌ | ✅ |
| Manage staff accounts/tiers | ❌ | ❌ | ✅ |
| Revert a change (see Change Log) | ❌ | ❌ | ✅ |

## Proposal Model (unified for ALUMNI + EDITOR)

Both alumni and `EDITOR`-tier staff can propose but not directly execute certain changes; only `OWNER` (or `ADMIN`) approves.

```prisma
model Proposal {
  id               String         @id @default(cuid())
  schoolId         String         // anchor school this proposal belongs to
  proposedByUserId String
  type             ProposalType
  title            String
  description       String?
  status           ProposalStatus @default(PENDING)
  reviewedByUserId String?
  reviewNote       String?
  createdAt        DateTime       @default(now())
  resolvedAt       DateTime?

  school         User  @relation("SchoolProposals", fields: [schoolId], references: [id], onDelete: Cascade)
  proposedBy     User  @relation("ProposedBy", fields: [proposedByUserId], references: [id], onDelete: Cascade)
  reviewedBy     User? @relation("ReviewedBy", fields: [reviewedByUserId], references: [id])
}

enum ProposalType {
  NEW_COMMUNITY
  PRODUCT_IDEA
  ROSTER_CHANGE
}

enum ProposalStatus {
  PENDING
  APPROVED
  REJECTED
}
```

- `ALUMNI` can submit `NEW_COMMUNITY` / `PRODUCT_IDEA` proposals for a school they're linked to (via existing community membership) or a school they were a student of.
- `EDITOR`-tier `SCHOOL` staff can submit `NEW_COMMUNITY` / `ROSTER_CHANGE` proposals for their own school.
- Approving a `NEW_COMMUNITY` proposal triggers the actual `Conversation` room creation (reuses existing `app/api/communities/rooms/route.ts` creation logic) — this one is fully automated. Approving `ROSTER_CHANGE` / `PRODUCT_IDEA` only records the decision (`status=APPROVED`) — it does **not** automatically execute a roster mutation or idea intake. The `OWNER` performs the actual change themselves afterward using their own direct `OWNER` permissions; building automated execution for those two types is a follow-on feature, not this spec's job.

## Change Log + Revert (bounded scope)

```prisma
model ChangeLog {
  id              String    @id @default(cuid())
  schoolId        String    // anchor school this change belongs to
  actorUserId     String
  entityType      String    // e.g. "BrochureSettings", "DestinationsSettings", "Campaign"
  entityId        String
  action          ChangeAction
  beforeJson      String?   // null for CREATE
  afterJson       String?   // null for DELETE
  createdAt       DateTime  @default(now())
  revertedAt      DateTime?
  revertedByUserId String?

  school  User  @relation("SchoolChangeLogs", fields: [schoolId], references: [id], onDelete: Cascade)
  actor   User  @relation("ChangeActor", fields: [actorUserId], references: [id])
}

enum ChangeAction {
  CREATE
  UPDATE
  DELETE
}
```

- A shared `recordChange()` helper wraps direct mutations made by `EDITOR`/`OWNER`/`ADMIN` on school-scoped resources covered by this spec (brochure settings/testimonials, destinations visibility settings, campaign goal amounts). It snapshots the row state before and after the mutation.
- `POST /api/school/changelog/[id]/revert` — `OWNER`/`ADMIN` only. Restores `beforeJson` onto the entity (upsert by `entityType`/`entityId`); marks `revertedAt`/`revertedByUserId`.
- **Boundary:** this only covers the school-admin-scoped mutations enumerated above — not a general-purpose undo engine for the whole application. Bulk operations (e.g., a future CSV import) would need one `ChangeLog` row per affected entity to be revertible; that wiring is left to whichever future spec builds bulk import.

## Alumni Directory Access (permission fix)

Today, non-alumni `STUDENT` accounts are fully blocked from `/alumni` (`AlumniGate` only offers a "verify your grad year" form). This spec changes that: `STUDENT` gains **read access** to browse the alumni directory (to find/request a mentor). The grad-year self-verify flow becomes the separate `STUDENT → ALUMNI` role transition described above, not a prerequisite for viewing the directory.

Actually requesting mentorship (a formal request/accept workflow between a student and a specific alumnus) is **not** designed here — this spec only grants read access; the request workflow is a follow-on feature.

## Centralized Permission Module

New `lib/permissions.ts`, replacing all inline role-string comparisons:

```ts
type Role = "STUDENT" | "ALUMNI" | "SCHOOL" | "ADMIN" | "ORG";
type SchoolTier = "OWNER" | "EDITOR" | "VIEWER";

function isNivarroAdmin(role: Role): boolean;
function isAlumni(role: Role): boolean;
function schoolTierOf(profile: { schoolAdminTier: SchoolTier | null }, isAnchor: boolean): SchoolTier | null;
function canManageSchool(user: { role: Role; id: string }, targetSchoolId: string, tier: { schoolAdminTier: SchoolTier | null }): boolean;
function canEditDirectly(tier: SchoolTier, resource: "brochure" | "destinations" | "communities" | "roster" | "campaigns"): boolean;
function canPropose(role: Role, tier: SchoolTier | null, type: ProposalType): boolean;
function canApproveProposal(tier: SchoolTier | null, role: Role): boolean;
function canAccessAlumniDirectory(role: Role): boolean; // true for STUDENT, ALUMNI, SCHOOL, ADMIN
function canRevertChange(tier: SchoolTier | null, role: Role): boolean;
```

All ~25 existing call sites are updated to import and call these helpers instead of inline comparisons (see File Map).

## Schema Changes

```sql
-- New ALUMNI role value (Postgres enum alter)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ALUMNI';

-- Migrate existing alumni-flagged students
UPDATE "User" SET role = 'ALUMNI' WHERE role = 'STUDENT' AND "isAlumni" = true;

-- Drop the now-redundant flag
ALTER TABLE "User" DROP COLUMN IF EXISTS "isAlumni";

-- School staff tiers
CREATE TYPE "SchoolAdminTier" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "schoolAdminTier" "SchoolAdminTier";
UPDATE "Profile" p SET "schoolAdminTier" = 'OWNER'
  FROM "User" u WHERE u.id = p."userId" AND u.role = 'SCHOOL' AND p."schoolId" IS NULL;

-- Proposals
CREATE TYPE "ProposalType" AS ENUM ('NEW_COMMUNITY', 'PRODUCT_IDEA', 'ROSTER_CHANGE');
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TABLE IF NOT EXISTS "Proposal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "proposedByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" "ProposalType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT REFERENCES "User"("id"),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);

-- Change log
CREATE TYPE "ChangeAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
CREATE TABLE IF NOT EXISTS "ChangeLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "schoolId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "actorUserId" TEXT NOT NULL REFERENCES "User"("id"),
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" "ChangeAction" NOT NULL,
  "beforeJson" TEXT,
  "afterJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revertedAt" TIMESTAMP(3),
  "revertedByUserId" TEXT REFERENCES "User"("id")
);
```

Note: Postgres requires `ALTER TYPE ... ADD VALUE` to run outside a transaction block and cannot be combined with subsequent statements that use the new value in the same transaction — the migration file needs to be split accordingly (add the enum value first, commit, then run the `UPDATE` in a follow-up statement/migration).

## File Map (permission call sites to update)

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `ALUMNI` to `UserRole`, remove `isAlumni`, add `SchoolAdminTier`, `Profile.schoolAdminTier`, `Proposal`, `ChangeLog` models |
| `prisma/migrations/20260708000000_account_role_system/migration.sql` | Raw SQL above (split for enum-value transaction rule) |
| `lib/permissions.ts` | New — all helper functions |
| `lib/auth.ts` | No change needed (role already flows through JWT/session) |
| `app/api/alumni/verify/route.ts` | Change `isAlumni: true` update → `role: "ALUMNI"` |
| `app/(dashboard)/alumni/page.tsx`, `AlumniGate.tsx` | `STUDENT` gets directory read access; gate only applies pre-graduation-verify students who now see directory + an inline "verify graduation" affordance instead of a hard block |
| `app/(dashboard)/layout.tsx` | `isOrg` no longer includes `ADMIN`; `ADMIN` gets its own branch via `isNivarroAdmin` |
| `app/(dashboard)/communities/page.tsx`, `app/api/communities/rooms/route.ts`, `app/api/communities/rooms/[id]/members/route.ts`, `app/api/communities/rooms/[id]/members/[userId]/route.ts`, `app/api/communities/school-code/route.ts` | Replace `role === 'SCHOOL'` with `canManageSchool()` / tier-aware checks |
| `app/(dashboard)/school/destinations/page.tsx`, `app/(dashboard)/school/alumni/page.tsx`, `app/(dashboard)/campaigns/new/page.tsx` | Replace inline `role !== "SCHOOL" && role !== "ADMIN"` with `canManageSchool()` |
| `app/api/school/brochure/route.ts`, `settings/route.ts`, `send-survey-emails/route.ts`, `testimonials/route.ts`, `testimonials/[id]/route.ts`, `students/route.ts` | Replace inline checks with `canManageSchool()`/`canEditDirectly()`; wire `recordChange()` for mutations |
| `app/api/admin/survey/status/route.ts`, `linkedin-scan/route.ts`, `enqueue/route.ts` | Replace inline `role === "ADMIN" || role === "SCHOOL"` |
| `app/api/profiles/[id]/route.ts` | Replace `isAdmin = dbUser?.role === "ADMIN"` with `isNivarroAdmin()` |
| `app/api/admin/setup-profile/route.ts` | Update role checks for new tier field |
| New: `app/api/school/staff/route.ts`, `app/api/school/staff/[userId]/route.ts` | List/create/update-tier/remove staff accounts (OWNER/ADMIN only) |
| New: `app/api/proposals/route.ts`, `app/api/proposals/[id]/route.ts` | Create proposal (ALUMNI/EDITOR), list (OWNER/ADMIN), approve/reject (OWNER/ADMIN) |
| New: `app/api/school/changelog/route.ts`, `app/api/school/changelog/[id]/revert/route.ts` | List change log, revert (OWNER/ADMIN only) |

## Global Constraints

- All school-scoped API routes must resolve the anchor `schoolId` and check tier via `canManageSchool()`/`canEditDirectly()` — never trust a client-supplied `schoolId` without verifying the caller's membership
- `ADMIN` bypasses all school-scoped checks unconditionally
- Migrations: raw SQL files in `prisma/migrations/`, `ADD COLUMN IF NOT EXISTS` for safety, enum-value additions split into their own transaction per Postgres rules
- No new npm packages
