# Alumni Multi-School Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an alum (`User.isAlumni === true`) be linked to 0-to-many schools instead of exactly one, with full functional equality across every linked school (roster, mentor pool, community rooms), while enrollment stays admin-invite-only exactly as it is today.

**Architecture:** Add a Prisma join table `AlumniSchool` (profileId × schoolId). Non-alumni Students keep using the existing `Profile.schoolId` scalar untouched. Every code path that currently treats "this user's school" as a single value gets a small alumni-aware branch: alumni resolve through `AlumniSchool`, everyone else resolves exactly as they do today.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM → PostgreSQL (Render), NextAuth v5.

## Global Constraints

- Spec: `docs/superpowers/plans/2026-08-11-alumni-multi-school-design.md` — every requirement below traces back to that file. Read it first if anything here is ambiguous.
- **No self-serve join.** An alum can never add themselves to a school. Every `AlumniSchool` row is created by a school admin through the roster (add or CSV import), or by the one-time migration backfill. The only self-service action is removal.
- **No test framework for this app.** The Next.js app (`Goal-APP/`) has zero unit test infrastructure — only the unrelated `server/` socket.io subproject uses Jest. Every task's verification is (a) `npx tsc --noEmit` staying clean of new errors, and (b) a concrete manual check — a one-off `npx tsx` script against Prisma directly, or a `curl`/browser check against `npm run dev`. Do not introduce a test framework as part of this feature.
- Every alumni-aware branch reads `user.isAlumni`, never `user.role` alone — `role` is `STUDENT` for both current students and alumni.
- Migrations in this repo are raw SQL under `prisma/migrations/<timestamp>_<name>/migration.sql`, applied via `prisma migrate deploy` (runs automatically at boot via `scripts/start.js`). Follow the existing style: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DO $$ ... EXCEPTION WHEN duplicate_object THEN null; END $$;` around `ADD CONSTRAINT`.

---

## File Structure

New files:
- `prisma/migrations/20260811000000_add_alumni_school/migration.sql` — DDL only.
- `scripts/backfill-alumni-schools.ts` — one-off, idempotent data migration (run manually, not part of `migrate deploy`).
- `app/api/profile/schools/[schoolId]/route.ts` — self-service DELETE (alum unlinks themselves from one school).

Modified files (grouped by task below):
- `prisma/schema.prisma`
- `lib/communities.ts`, `lib/accountGate.ts`
- `app/(dashboard)/layout.tsx`, `app/(dashboard)/quiz/page.tsx`, `app/(dashboard)/profile/page.tsx`
- `app/api/school/roster/route.ts`, `app/api/school/roster/members/route.ts`, `app/api/school/roster/import/route.ts`, `app/api/school/roster/members/[userId]/route.ts`
- `app/api/school/mentorship/route.ts`
- `app/api/connections/request/route.ts`, `app/api/partnerships/request/route.ts`, `app/(dashboard)/partnerships/page.tsx`
- `app/(dashboard)/communities/page.tsx`, `app/api/communities/rooms/route.ts`, `app/api/communities/rooms/[id]/members/route.ts`
- `app/api/alumni/verify/route.ts`
- `app/(dashboard)/profile/AlumniProfileEditor.tsx`
- `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/dashboard/WalledDashboardClient.tsx`
- `app/(dashboard)/my-school/page.tsx`, `app/(dashboard)/my-school/SchoolHubClient.tsx`

---

### Task 1: Schema — `AlumniSchool` table

**Files:**
- Modify: `prisma/schema.prisma:141-153` (Profile model), insert new model after it (currently before `enum GeniusType` at line 155)
- Create: `prisma/migrations/20260811000000_add_alumni_school/migration.sql`

**Interfaces:**
- Produces: Prisma model `AlumniSchool { id, profileId, schoolId, createdAt }`, unique on `[profileId, schoolId]`, indexed on `schoolId`. `Profile.alumniSchools: AlumniSchool[]`.

- [ ] **Step 1: Add the relation field to `Profile`**

In `prisma/schema.prisma`, the `Profile` model's relation block currently ends:

```prisma
  workflowSession      WorkflowSession?
  algorithmQuotas      AlgorithmQuota[]
  orgReviews           OrgReview[]
}
```

Change it to:

```prisma
  workflowSession      WorkflowSession?
  algorithmQuotas      AlgorithmQuota[]
  orgReviews           OrgReview[]
  alumniSchools        AlumniSchool[]
}
```

- [ ] **Step 2: Add the `AlumniSchool` model**

Immediately after the `Profile` model's closing `}` (right before `enum GeniusType`), add:

```prisma
// Schools an alumni Profile is linked to. Alumni can have 0-to-many links;
// every non-alumni Student still uses the single Profile.schoolId scalar.
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

- [ ] **Step 3: Write the migration**

Create `prisma/migrations/20260811000000_add_alumni_school/migration.sql`:

```sql
-- Alumni multi-school support: an alum can be linked to 0-to-many schools.
-- Profile.schoolId remains the single-school field for non-alumni Students.

CREATE TABLE IF NOT EXISTS "AlumniSchool" (
  "id"        TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlumniSchool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlumniSchool_profileId_schoolId_key" ON "AlumniSchool"("profileId", "schoolId");
CREATE INDEX IF NOT EXISTS "AlumniSchool_schoolId_idx" ON "AlumniSchool"("schoolId");

DO $$ BEGIN
  ALTER TABLE "AlumniSchool" ADD CONSTRAINT "AlumniSchool_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

- [ ] **Step 4: Apply and generate**

Run:
```bash
npx prisma migrate deploy
npx prisma generate
```
Expected: migration `20260811000000_add_alumni_school` applied, Prisma Client regenerated with `prisma.alumniSchool` available.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260811000000_add_alumni_school
git commit -m "feat: add AlumniSchool join table for alumni multi-school support"
```

---

### Task 2: Backfill script

**Files:**
- Create: `scripts/backfill-alumni-schools.ts`

**Interfaces:**
- Consumes: `prisma.alumniSchool` (Task 1), existing `Profile.schoolId`, `User.isAlumni`.
- Produces: one `AlumniSchool` row per alumni Profile that had a `schoolId`; nulls that `schoolId` afterward. Idempotent — safe to re-run.

- [ ] **Step 1: Write the script**

Create `scripts/backfill-alumni-schools.ts`, following the existing one-off-script convention in this repo (see `scripts/reset-user-password.ts`):

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const alumniProfiles = await prisma.profile.findMany({
    where: { schoolId: { not: null }, user: { isAlumni: true } },
    select: { id: true, schoolId: true, userId: true },
  });

  console.log(`Found ${alumniProfiles.length} alumni profile(s) with a schoolId to migrate.`);

  let linked = 0;
  for (const profile of alumniProfiles) {
    await prisma.alumniSchool.upsert({
      where: { profileId_schoolId: { profileId: profile.id, schoolId: profile.schoolId! } },
      create: { profileId: profile.id, schoolId: profile.schoolId! },
      update: {},
    });
    linked++;
  }
  console.log(`Linked ${linked} AlumniSchool row(s).`);

  const { count } = await prisma.profile.updateMany({
    where: { schoolId: { not: null }, user: { isAlumni: true } },
    data: { schoolId: null },
  });
  console.log(`Nulled Profile.schoolId on ${count} alumni row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it against the dev database**

Run: `npx tsx scripts/backfill-alumni-schools.ts`
Expected output: `Found N alumni profile(s)...`, `Linked N AlumniSchool row(s).`, `Nulled Profile.schoolId on N alumni row(s).` — N should match the count of alumni demo accounts with a school (priya, marcus, zoe from the seed data, all linked to Westside Academy — expect N=3 the first time).

- [ ] **Step 3: Verify idempotency**

Run it again: `npx tsx scripts/backfill-alumni-schools.ts`
Expected: `Found 0 alumni profile(s)...`, `Linked 0...`, `Nulled Profile.schoolId on 0...` — second run is a no-op.

- [ ] **Step 4: Spot-check the data**

Run:
```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.user.findUnique({ where: { email: 'priya@nivarro.io' }, select: { isAlumni: true, profile: { select: { schoolId: true, alumniSchools: true } } } })
  .then(console.log)
  .finally(() => prisma.\$disconnect());
"
```
Expected: `profile.schoolId` is `null`, `profile.alumniSchools` has exactly one entry with the Westside Academy school id.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-alumni-schools.ts
git commit -m "feat: add alumni-schools backfill script"
```

---

### Task 3: Shared helpers — `lib/communities.ts` and `lib/accountGate.ts`

Three separate near-duplicate "resolve this user's school" implementations exist today (`lib/communities.ts`'s `getSchoolId`, `lib/school-auth.ts`'s unused `getSchoolId`, and an inline copy in `app/api/communities/rooms/[id]/members/route.ts`). This task makes `lib/communities.ts` the single canonical multi-school resolver and fixes `isWalledStudent` to be alumni-aware; later tasks point every caller at these two functions.

**Files:**
- Modify: `lib/communities.ts:1-19` (replace `getSchoolId`)
- Modify: `lib/accountGate.ts` (whole file)

**Interfaces:**
- Produces: `getSchoolIds(userId: string): Promise<string[]>` — `[userId]` for SCHOOL role, 0-or-1 entries for a non-alumni Student, all linked school ids for an alum, ordered by `AlumniSchool.createdAt`.
- Produces: `getLinkedSchools(userId: string): Promise<{ id: string; name: string }[]>` — same set as `getSchoolIds` but resolved to display names, for UI lists (dashboard greeting, `/my-school` switcher, profile editor).
- Produces: `isWalledStudent(userId: string): Promise<boolean>` — unchanged signature, now alumni-aware.
- Consumed by: Tasks 4, 6, 7, 8, 9, 10, 11, 12.

- [ ] **Step 1: Replace `getSchoolId` in `lib/communities.ts`**

Current (`lib/communities.ts:1-18`):

```ts
import { prisma } from '@/lib/prisma';

/**
 * Resolves a user's schoolId. SCHOOL-role accounts are their own schoolId;
 * everyone else's comes from their Profile.
 */
export async function getSchoolId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === 'SCHOOL') return userId;
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { schoolId: true },
  });
  return profile?.schoolId ?? null;
}
```

Replace with:

```ts
import { prisma } from '@/lib/prisma';

/**
 * Resolves the set of schools a user belongs to. SCHOOL-role accounts are
 * their own school. Non-alumni Students have 0-or-1 (their Profile.schoolId).
 * Alumni have 0-to-many, resolved through AlumniSchool.
 */
export async function getSchoolIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isAlumni: true },
  });
  if (user?.role === 'SCHOOL') return [userId];

  if (user?.isAlumni) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return [];
    const links = await prisma.alumniSchool.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'asc' },
      select: { schoolId: true },
    });
    return links.map((l) => l.schoolId);
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { schoolId: true },
  });
  return profile?.schoolId ? [profile.schoolId] : [];
}

/**
 * Same resolution as getSchoolIds, but returns each school's display name —
 * for UI lists (dashboard greeting, /my-school switcher, profile editor).
 */
export async function getLinkedSchools(userId: string): Promise<{ id: string; name: string }[]> {
  const schoolIds = await getSchoolIds(userId);
  if (schoolIds.length === 0) return [];
  const schools = await prisma.user.findMany({
    where: { id: { in: schoolIds } },
    select: { id: true, name: true, profile: { select: { displayName: true } } },
  });
  const byId = new Map(schools.map((s) => [s.id, s]));
  return schoolIds
    .map((id) => byId.get(id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({ id: s.id, name: s.profile?.displayName ?? s.name ?? 'School' }));
}
```

- [ ] **Step 2: Rewrite `lib/accountGate.ts`**

Replace the whole file:

```ts
import { prisma } from "@/lib/prisma";

export async function isWalledStudent(userId: string): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isAlumni: true,
      profile: { select: { id: true, schoolId: true } },
    },
  });
  if (dbUser?.role !== "STUDENT" || !dbUser.profile) return false;

  if (dbUser.isAlumni) {
    const linkCount = await prisma.alumniSchool.count({
      where: { profileId: dbUser.profile.id },
    });
    return linkCount > 0;
  }

  return !!dbUser.profile.schoolId;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: errors at every current `getSchoolId` import (3 files — `app/(dashboard)/partnerships/page.tsx`, `app/api/partnerships/request/route.ts`, `app/api/connections/request/route.ts`). That's expected — those are fixed in Task 7. Confirm no *other* new errors beyond those three files.

- [ ] **Step 4: Commit**

```bash
git add lib/communities.ts lib/accountGate.ts
git commit -m "feat: make school resolution and wall-gating alumni-multi-school-aware"
```

---

### Task 4: Consolidate duplicate wall-check logic

Three pages each inline their own copy of the exact "is this a walled Student/Alum" boolean instead of calling `isWalledStudent` — meaning Task 3's fix doesn't reach them. Since alumni will have `Profile.schoolId === null` after the backfill (Task 2), all three would otherwise incorrectly treat every alum as unwalled. Swap each to the shared helper.

**Files:**
- Modify: `app/(dashboard)/layout.tsx:19-36`
- Modify: `app/(dashboard)/quiz/page.tsx:19-32`
- Modify: `app/(dashboard)/profile/page.tsx:1-14`

**Interfaces:**
- Consumes: `isWalledStudent(userId)` from Task 3.

- [ ] **Step 1: `app/(dashboard)/layout.tsx`**

Current (lines 19-36):

```tsx
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isAlumni: true,
      profile: { select: { displayName: true, geniusType: true, schoolId: true } },
    },
  });

  const role = dbUser?.role ?? "STUDENT";
  const isSchool = role === "SCHOOL";
  const isOrg = role === "ORG" || role === "ADMIN";
  const isNivarroAdmin = role === "ADMIN";
  const profile = dbUser?.profile ?? null;
  // Student/Alum account = STUDENT role with a school affiliation — walled-off nav.
  // (Standard = STUDENT role with no school affiliation; that's just "none of the above" here.)
  const isWalledStudent = role === "STUDENT" && !!profile?.schoolId;
  const isAlumni = !!dbUser?.isAlumni;
```

Replace with:

```tsx
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isAlumni: true,
      profile: { select: { displayName: true, geniusType: true } },
    },
  });

  const role = dbUser?.role ?? "STUDENT";
  const isSchool = role === "SCHOOL";
  const isOrg = role === "ORG" || role === "ADMIN";
  const isNivarroAdmin = role === "ADMIN";
  const profile = dbUser?.profile ?? null;
  // Student/Alum account = STUDENT role with a school affiliation — walled-off nav.
  // (Standard = STUDENT role with no school affiliation; that's just "none of the above" here.)
  const isWalledStudentAccount = await isWalledStudent(session.user.id);
  const isAlumni = !!dbUser?.isAlumni;
```

Add the import at the top of the file (alongside the existing `prisma` import):

```tsx
import { isWalledStudent } from "@/lib/accountGate";
```

There is exactly one remaining reference to the old local `isWalledStudent` variable, further down in the same file, where it's passed to `SidebarShell` (current line 68):

```tsx
        isWalledStudent={isWalledStudent}
```

Change the value (not the prop name — `SidebarShell`'s prop is still called `isWalledStudent`) to:

```tsx
        isWalledStudent={isWalledStudentAccount}
```

- [ ] **Step 2: `app/(dashboard)/quiz/page.tsx`**

Current (lines 22-32):

```tsx
  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, profile: { select: { schoolId: true } } },
      })
    : null;

  const isSchoolAffiliatedStudent = dbUser?.role === "STUDENT" && !!dbUser.profile?.schoolId;

  // Student/Alum accounts are walled off from the genius-type quiz entirely.
  if (isSchoolAffiliatedStudent) redirect("/dashboard");
```

Replace with:

```tsx
  const isSchoolAffiliatedStudent = userId ? await isWalledStudent(userId) : false;

  // Student/Alum accounts are walled off from the genius-type quiz entirely.
  if (isSchoolAffiliatedStudent) redirect("/dashboard");
```

Add the import:

```tsx
import { isWalledStudent } from "@/lib/accountGate";
```

(The `dbUser` variable is no longer used for this check — leave the rest of the file, which uses `userId` directly for the profile/workflow queries, unchanged.)

- [ ] **Step 3: `app/(dashboard)/profile/page.tsx`**

Current (lines 1-14):

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileEditor from "./ProfileEditor";
import AlumniProfileEditor from "./AlumniProfileEditor";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isAlumni: true, profile: { select: { schoolId: true } } },
  });
  const walled = dbUser?.role === "STUDENT" && !!dbUser.profile?.schoolId;
```

Replace with:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileEditor from "./ProfileEditor";
import AlumniProfileEditor from "./AlumniProfileEditor";
import { isWalledStudent } from "@/lib/accountGate";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [dbUser, walled] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isAlumni: true },
    }),
    isWalledStudent(userId),
  ]);
```

(The rest of the file references `dbUser?.isAlumni` at line 16 — unaffected, still works since `dbUser` still selects `isAlumni`.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors (still expect the 3 pre-existing `getSchoolId` errors from Task 3, fixed in Task 7).

- [ ] **Step 5: Manual check — nav still walls correctly for non-alumni**

Run `npm run dev`, log in as `student@nivarro.demo` / `demo2026` (non-alumni, walled). Confirm the sidebar still shows the walled nav (My School / Community Chat / Partnerships), not the full Standard nav. Confirm `/quiz` redirects to `/dashboard`.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/layout.tsx" "app/(dashboard)/quiz/page.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "refactor: route wall-gating through the shared isWalledStudent helper"
```

---

### Task 5: School admin roster — alumni-aware linking

**Files:**
- Modify: `app/api/school/roster/route.ts` (GET)
- Modify: `app/api/school/roster/members/route.ts` (POST)
- Modify: `app/api/school/roster/import/route.ts` (POST)
- Modify: `app/api/school/roster/members/[userId]/route.ts` (PATCH, DELETE)

**Interfaces:**
- Consumes: `prisma.alumniSchool` (Task 1).

- [ ] **Step 1: `app/api/school/roster/route.ts` — GET returns alumni via the join table**

Current:

```ts
export async function GET() {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  const memberProfiles = await prisma.profile.findMany({
    where: { schoolId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isAlumni: true,
          createdAt: true,
        },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const members = memberProfiles.map((p) => ({
    profileId: p.id,
    userId: p.userId,
    displayName: p.displayName,
    email: p.user.email ?? null,
    phone: p.phone ?? null,
    role: p.user.role,
    isAlumni: p.user.isAlumni,
    staffTitle: p.staffTitle ?? null,
    graduationYear: p.graduationYear ?? null,
    industry: p.industry ?? null,
    intendedCollege: p.intendedCollege ?? null,
    intendedMajor: p.intendedMajor ?? null,
    isAvailableToMentor: p.isAvailableToMentor,
    createdAt: p.user.createdAt.toISOString(),
  }));

  return NextResponse.json({ members });
}
```

Replace with:

```ts
export async function GET() {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  const [directMembers, alumniLinks] = await Promise.all([
    prisma.profile.findMany({
      where: { schoolId },
      include: {
        user: {
          select: { id: true, email: true, role: true, isAlumni: true, createdAt: true },
        },
      },
    }),
    prisma.alumniSchool.findMany({
      where: { schoolId },
      select: {
        profile: {
          include: {
            user: {
              select: { id: true, email: true, role: true, isAlumni: true, createdAt: true },
            },
          },
        },
      },
    }),
  ]);

  const memberProfiles = [...directMembers, ...alumniLinks.map((l) => l.profile)];

  const members = memberProfiles
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((p) => ({
      profileId: p.id,
      userId: p.userId,
      displayName: p.displayName,
      email: p.user.email ?? null,
      phone: p.phone ?? null,
      role: p.user.role,
      isAlumni: p.user.isAlumni,
      staffTitle: p.staffTitle ?? null,
      graduationYear: p.graduationYear ?? null,
      industry: p.industry ?? null,
      intendedCollege: p.intendedCollege ?? null,
      intendedMajor: p.intendedMajor ?? null,
      isAvailableToMentor: p.isAvailableToMentor,
      createdAt: p.user.createdAt.toISOString(),
    }));

  return NextResponse.json({ members });
}
```

(`directMembers` will never include alumni post-migration since their `schoolId` is null, so there's no double-counting — but the `[...directMembers, ...alumniLinks...]` shape stays correct even for any not-yet-migrated row.)

- [ ] **Step 2: `app/api/school/roster/members/route.ts` — POST links instead of overwrites for alumni**

Current, the `ALUMNI` branch shares `sharedFields` (which includes `schoolId`) with every other role:

```ts
  const sharedFields = {
    displayName: displayName.trim(),
    phone: phone?.trim() || null,
    schoolId,
    onboardingComplete: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let roleFields: Record<string, any> = {};
  if (role === "STUDENT") {
    roleFields = {
      ...(graduationYearNum !== undefined && { graduationYear: graduationYearNum }),
      ...(intendedCollege?.trim() && { intendedCollege: intendedCollege.trim() }),
      ...(intendedMajor?.trim() && { intendedMajor: intendedMajor.trim() }),
    };
  } else if (role === "ALUMNI") {
    roleFields = {
      ...(graduationYearNum !== undefined && { graduationYear: graduationYearNum }),
      ...(industry?.trim() && { industry: industry.trim() }),
      ...(intendedCollege?.trim() && { intendedCollege: intendedCollege.trim() }),
      isAvailableToMentor: Boolean(isAvailableToMentor),
    };
  } else if (role === "STAFF") {
    roleFields = {
      staffTitle: jobTitle?.trim() || null,
    };
  }

  const profileData = { ...sharedFields, ...roleFields };

  const existingUser = await prisma.user.findUnique({
    where: { email: email.trim() },
    include: { profile: true },
  });

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;

    if (existingUser.profile) {
      await prisma.profile.update({
        where: { userId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: profileData as any,
      });
    } else {
      await prisma.profile.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { userId, ...profileData } as any,
      });
    }

    if (role === "ALUMNI" && !existingUser.isAlumni) {
      await prisma.user.update({
        where: { id: userId },
        data: { isAlumni: true },
      });
    }
  } else {
    const newUser = await prisma.user.create({
      data: {
        name: displayName.trim(),
        email: email.trim(),
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        role: "STUDENT",
        isAlumni: role === "ALUMNI",
        profile: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: profileData as any,
        },
      },
    });
    userId = newUser.id;
  }

  return NextResponse.json({ id: userId });
```

Replace with (key change: `schoolId` is excluded from `sharedFields` for the `ALUMNI` role, and an `AlumniSchool` link is upserted after the profile write instead):

```ts
  const isAlumniRole = role === "ALUMNI";

  const sharedFields = {
    displayName: displayName.trim(),
    phone: phone?.trim() || null,
    ...(isAlumniRole ? {} : { schoolId }),
    onboardingComplete: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let roleFields: Record<string, any> = {};
  if (role === "STUDENT") {
    roleFields = {
      ...(graduationYearNum !== undefined && { graduationYear: graduationYearNum }),
      ...(intendedCollege?.trim() && { intendedCollege: intendedCollege.trim() }),
      ...(intendedMajor?.trim() && { intendedMajor: intendedMajor.trim() }),
    };
  } else if (isAlumniRole) {
    roleFields = {
      ...(graduationYearNum !== undefined && { graduationYear: graduationYearNum }),
      ...(industry?.trim() && { industry: industry.trim() }),
      ...(intendedCollege?.trim() && { intendedCollege: intendedCollege.trim() }),
      isAvailableToMentor: Boolean(isAvailableToMentor),
    };
  } else if (role === "STAFF") {
    roleFields = {
      staffTitle: jobTitle?.trim() || null,
    };
  }

  const profileData = { ...sharedFields, ...roleFields };

  const existingUser = await prisma.user.findUnique({
    where: { email: email.trim() },
    include: { profile: true },
  });

  let userId: string;
  let profileId: string;

  if (existingUser) {
    userId = existingUser.id;

    if (existingUser.profile) {
      profileId = existingUser.profile.id;
      await prisma.profile.update({
        where: { userId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: profileData as any,
      });
    } else {
      const created = await prisma.profile.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { userId, ...profileData } as any,
      });
      profileId = created.id;
    }

    if (isAlumniRole && !existingUser.isAlumni) {
      await prisma.user.update({
        where: { id: userId },
        data: { isAlumni: true },
      });
    }
  } else {
    const newUser = await prisma.user.create({
      data: {
        name: displayName.trim(),
        email: email.trim(),
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        role: "STUDENT",
        isAlumni: isAlumniRole,
        profile: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: profileData as any,
        },
      },
      include: { profile: true },
    });
    userId = newUser.id;
    profileId = newUser.profile!.id;
  }

  if (isAlumniRole) {
    await prisma.alumniSchool.upsert({
      where: { profileId_schoolId: { profileId, schoolId } },
      create: { profileId, schoolId },
      update: {},
    });
  }

  return NextResponse.json({ id: userId });
```

- [ ] **Step 3: `app/api/school/roster/import/route.ts` — same treatment per CSV row**

Current, inside the `for (const row of rows)` loop:

```ts
      const sharedFields = {
        displayName,
        phone: row.phone?.trim() || null,
        schoolId,
        onboardingComplete: true,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let roleFields: Record<string, any> = {};
      if (role === "STUDENT") {
        roleFields = {
          ...(graduationYearNum !== undefined &&
            !isNaN(graduationYearNum) && { graduationYear: graduationYearNum }),
          ...(row.college?.trim() && { intendedCollege: row.college.trim() }),
          ...(row.major?.trim() && { intendedMajor: row.major.trim() }),
        };
      } else if (role === "ALUMNI") {
        roleFields = {
          ...(graduationYearNum !== undefined &&
            !isNaN(graduationYearNum) && { graduationYear: graduationYearNum }),
          ...(row.industry?.trim() && { industry: row.industry.trim() }),
          ...(row.college?.trim() && { intendedCollege: row.college.trim() }),
          isAvailableToMentor: isMentorBool,
        };
      } else if (role === "STAFF") {
        roleFields = {
          staffTitle: row.jobTitle?.trim() || null,
        };
      }

      const profileData = { ...sharedFields, ...roleFields };

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: { profile: true },
      });

      if (existingUser) {
        if (existingUser.profile) {
          await prisma.profile.update({
            where: { userId: existingUser.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: profileData as any,
          });
        } else {
          await prisma.profile.create({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { userId: existingUser.id, ...profileData } as any,
          });
        }
        if (isAlumni && !existingUser.isAlumni) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { isAlumni: true },
          });
        }
      } else {
        await prisma.user.create({
          data: {
            name: displayName,
            email,
            passwordHash: await bcrypt.hash(randomUUID(), 10),
            role: "STUDENT",
            isAlumni,
            profile: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              create: profileData as any,
            },
          },
        });
      }

      imported++;
```

Replace with:

```ts
      const sharedFields = {
        displayName,
        phone: row.phone?.trim() || null,
        ...(isAlumni ? {} : { schoolId }),
        onboardingComplete: true,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let roleFields: Record<string, any> = {};
      if (role === "STUDENT") {
        roleFields = {
          ...(graduationYearNum !== undefined &&
            !isNaN(graduationYearNum) && { graduationYear: graduationYearNum }),
          ...(row.college?.trim() && { intendedCollege: row.college.trim() }),
          ...(row.major?.trim() && { intendedMajor: row.major.trim() }),
        };
      } else if (role === "ALUMNI") {
        roleFields = {
          ...(graduationYearNum !== undefined &&
            !isNaN(graduationYearNum) && { graduationYear: graduationYearNum }),
          ...(row.industry?.trim() && { industry: row.industry.trim() }),
          ...(row.college?.trim() && { intendedCollege: row.college.trim() }),
          isAvailableToMentor: isMentorBool,
        };
      } else if (role === "STAFF") {
        roleFields = {
          staffTitle: row.jobTitle?.trim() || null,
        };
      }

      const profileData = { ...sharedFields, ...roleFields };

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: { profile: true },
      });

      let profileId: string;

      if (existingUser) {
        if (existingUser.profile) {
          profileId = existingUser.profile.id;
          await prisma.profile.update({
            where: { userId: existingUser.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: profileData as any,
          });
        } else {
          const created = await prisma.profile.create({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { userId: existingUser.id, ...profileData } as any,
          });
          profileId = created.id;
        }
        if (isAlumni && !existingUser.isAlumni) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { isAlumni: true },
          });
        }
      } else {
        const created = await prisma.user.create({
          data: {
            name: displayName,
            email,
            passwordHash: await bcrypt.hash(randomUUID(), 10),
            role: "STUDENT",
            isAlumni,
            profile: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              create: profileData as any,
            },
          },
          include: { profile: true },
        });
        profileId = created.profile!.id;
      }

      if (isAlumni) {
        await prisma.alumniSchool.upsert({
          where: { profileId_schoolId: { profileId, schoolId } },
          create: { profileId, schoolId },
          update: {},
        });
      }

      imported++;
```

- [ ] **Step 4: `app/api/school/roster/members/[userId]/route.ts` — alumni-aware DELETE**

Current `DELETE`:

```ts
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;
  const { userId } = await params;

  // Security: find profile only if it belongs to this school
  const profile = await prisma.profile.findFirst({
    where: { userId, schoolId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Unlink from school — do NOT delete the user
  await prisma.profile.update({
    where: { id: profile.id },
    data: { schoolId: null },
  });

  return NextResponse.json({ ok: true });
}
```

Replace with:

```ts
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;
  const { userId } = await params;

  // Security: find profile only if it belongs to this school — either
  // directly (non-alumni) or via an AlumniSchool link.
  const profile = await prisma.profile.findFirst({
    where: {
      userId,
      OR: [{ schoolId }, { alumniSchools: { some: { schoolId } } }],
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Unlink from this specific school — do NOT delete the user, and do NOT
  // touch any of their other AlumniSchool links.
  await Promise.all([
    prisma.profile.updateMany({
      where: { id: profile.id, schoolId },
      data: { schoolId: null },
    }),
    prisma.alumniSchool.deleteMany({
      where: { profileId: profile.id, schoolId },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
```

`PATCH` in this same file only updates `Profile` scalar fields and `User.isAlumni` — it never reads or writes `schoolId`, so its update logic needs no change. Its security check at the top has the same "member found via direct schoolId only" gap as `DELETE` did, though. Current:

```ts
  // Security: find profile only if it belongs to this school
  const profile = await prisma.profile.findFirst({
    where: { userId, schoolId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
```

Replace with:

```ts
  // Security: find profile only if it belongs to this school — either
  // directly (non-alumni) or via an AlumniSchool link.
  const profile = await prisma.profile.findFirst({
    where: {
      userId,
      OR: [{ schoolId }, { alumniSchools: { some: { schoolId } } }],
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual check**

Run `npm run dev`. Log in as `school@nivarro.demo` / `demo2026` (Westside Academy admin). On `/school/roster`, confirm `priya@nivarro.io` still appears (now via her `AlumniSchool` link, not `Profile.schoolId`). Add a brand-new test alum via the "Add Member" form with role `ALUMNI`; confirm they appear in the roster. Remove them; confirm they disappear and, via the spot-check script from Task 2, confirm their `AlumniSchool` row for Westside is gone.

- [ ] **Step 7: Commit**

```bash
git add app/api/school/roster
git commit -m "feat: make school roster alumni-aware via AlumniSchool links"
```

---

### Task 6: Mentorship pool — alumni-aware

**Files:**
- Modify: `app/api/school/mentorship/route.ts` (GET, POST)

- [ ] **Step 1: Update the mentor-pool query in GET**

Current:

```ts
    prisma.profile.findMany({
      where: {
        schoolId,
        OR: [{ staffTitle: { not: null } }, { user: { isAlumni: true } }],
      },
      select: { userId: true, displayName: true, staffTitle: true, industry: true, user: { select: { isAlumni: true } } },
      orderBy: { displayName: "asc" },
    }),
```

Replace with:

```ts
    prisma.profile.findMany({
      where: {
        OR: [
          { schoolId, staffTitle: { not: null } },
          { alumniSchools: { some: { schoolId } } },
        ],
      },
      select: { userId: true, displayName: true, staffTitle: true, industry: true, user: { select: { isAlumni: true } } },
      orderBy: { displayName: "asc" },
    }),
```

(The `students` query right above it, `prisma.profile.findMany({ where: { schoolId, staffTitle: null, user: { isAlumni: false } }, ... })`, is unaffected — students are never alumni, so `schoolId` equality remains correct there.)

- [ ] **Step 2: Update the mentor-eligibility check in POST**

Current:

```ts
  // Verify every selected mentor belongs to this school and is staff or alumni
  const validMentors = await prisma.profile.findMany({
    where: {
      userId: { in: mentorIds },
      schoolId,
      OR: [{ staffTitle: { not: null } }, { user: { isAlumni: true } }],
    },
    select: { userId: true },
  });
```

Replace with:

```ts
  // Verify every selected mentor belongs to this school and is staff or alumni
  const validMentors = await prisma.profile.findMany({
    where: {
      userId: { in: mentorIds },
      OR: [
        { schoolId, staffTitle: { not: null } },
        { alumniSchools: { some: { schoolId } } },
      ],
    },
    select: { userId: true },
  });
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual check**

Log in as `school@nivarro.demo`. On `/school/mentorship`, confirm `priya@nivarro.io` (mentor: yes, per the seed data) still appears in the mentor list and can be paired with a student.

- [ ] **Step 5: Commit**

```bash
git add app/api/school/mentorship/route.ts
git commit -m "feat: make mentor pool alumni-aware via AlumniSchool links"
```

---

### Task 7: Connections + partnerships "same school" checks

**Files:**
- Modify: `app/api/connections/request/route.ts`
- Modify: `app/api/partnerships/request/route.ts`
- Modify: `app/(dashboard)/partnerships/page.tsx`

**Interfaces:**
- Consumes: `getSchoolIds(userId)` from Task 3 (replaces the removed `getSchoolId`).

- [ ] **Step 1: `app/api/connections/request/route.ts`**

Current:

```ts
import { getSchoolId } from "@/lib/communities";
```
...
```ts
  const [fromSchoolId, toSchoolId] = await Promise.all([
    getSchoolId(fromUserId),
    getSchoolId(toUserId),
  ]);

  if (!fromSchoolId || !toSchoolId || fromSchoolId !== toSchoolId) {
    return NextResponse.json({ error: "Not in the same school" }, { status: 400 });
  }
```

Replace with:

```ts
import { getSchoolIds } from "@/lib/communities";
```
...
```ts
  const [fromSchoolIds, toSchoolIds] = await Promise.all([
    getSchoolIds(fromUserId),
    getSchoolIds(toUserId),
  ]);

  const sharedSchoolId = fromSchoolIds.find((id) => toSchoolIds.includes(id));

  if (!sharedSchoolId) {
    return NextResponse.json({ error: "Not in the same school" }, { status: 400 });
  }
```

Further down, the request is created with `data: { schoolId: fromSchoolId, ... }` — change `fromSchoolId` to `sharedSchoolId`.

- [ ] **Step 2: `app/api/partnerships/request/route.ts`**

Current:

```ts
import { getSchoolId } from "@/lib/communities";
```
...
```ts
  const fromSchoolId = await getSchoolId(fromUserId);
  if (!fromSchoolId) {
    return NextResponse.json({ error: "Not in a school" }, { status: 400 });
  }

  const invitees = await prisma.user.findMany({
    where: { id: { in: toUserIds } },
    select: { id: true, profile: { select: { schoolId: true } } },
  });
  if (invitees.length !== toUserIds.length) {
    return NextResponse.json({ error: "One or more invitees not found" }, { status: 404 });
  }
  const allSameSchool = invitees.every((u) => u.profile?.schoolId === fromSchoolId);
  if (!allSameSchool) {
    return NextResponse.json({ error: "All invitees must be in your school" }, { status: 400 });
  }
```

Replace with:

```ts
import { getSchoolIds } from "@/lib/communities";
```
...
```ts
  const fromSchoolIds = await getSchoolIds(fromUserId);
  if (fromSchoolIds.length === 0) {
    return NextResponse.json({ error: "Not in a school" }, { status: 400 });
  }

  const inviteeIdsAndSchools = await Promise.all(
    toUserIds.map(async (id) => ({ id, schoolIds: await getSchoolIds(id) }))
  );
  if (inviteeIdsAndSchools.length !== toUserIds.length) {
    return NextResponse.json({ error: "One or more invitees not found" }, { status: 404 });
  }
  // Every invitee must share at least one school with the requester, and all
  // invitees must land on the SAME shared school (the partnership room is
  // scoped to one school).
  const commonSchoolId = fromSchoolIds.find((id) =>
    inviteeIdsAndSchools.every((invitee) => invitee.schoolIds.includes(id))
  );
  if (!commonSchoolId) {
    return NextResponse.json({ error: "All invitees must be in your school" }, { status: 400 });
  }
```

Further down, `schoolId: fromSchoolId` in the `partnershipRequest.create` call becomes `schoolId: commonSchoolId`.

- [ ] **Step 3: `app/(dashboard)/partnerships/page.tsx`**

Current:

```tsx
import { getSchoolId } from "@/lib/communities";
```
...
```tsx
  const [walled, schoolId] = await Promise.all([
    isWalledStudent(session.user.id),
    getSchoolId(session.user.id),
  ]);

  if (schoolId) {
    await finalizeExpiredPartnershipRequests(schoolId);
  }
```

Replace with:

```tsx
import { getSchoolIds } from "@/lib/communities";
```
...
```tsx
  const [walled, schoolIds] = await Promise.all([
    isWalledStudent(session.user.id),
    getSchoolIds(session.user.id),
  ]);

  await Promise.all(schoolIds.map((id) => finalizeExpiredPartnershipRequests(id)));
```

(`schoolId` is not read anywhere else in this file — every other query below is scoped by `session.user.id`, not by school, so no further changes are needed in this file.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean — this resolves the 3 errors left over from Task 3.

- [ ] **Step 5: Manual check**

Log in as `priya@nivarro.io` (alumni, mentor-eligible, linked to Westside). Confirm `/partnerships` loads without error and she can still send a partnership request to a Westside student/staff member.

- [ ] **Step 6: Commit**

```bash
git add app/api/connections/request/route.ts app/api/partnerships/request/route.ts "app/(dashboard)/partnerships/page.tsx"
git commit -m "feat: make same-school checks multi-school-aware for connections and partnerships"
```

---

### Task 8: Communities — multi-school room listing and access

**Files:**
- Modify: `app/(dashboard)/communities/page.tsx`
- Modify: `app/api/communities/rooms/route.ts` (GET only)
- Modify: `app/api/communities/rooms/[id]/members/route.ts`

- [ ] **Step 1: `app/(dashboard)/communities/page.tsx`**

Current:

```tsx
import CommunitiesClient from "./CommunitiesClient";
import { ensureSchoolGeneralRoom } from "@/lib/communities";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Communities — Nivarro" };

export default async function CommunitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // School admin accounts (role=SCHOOL) use their own id as schoolId
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, schoolCode: true },
    }),
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { schoolId: true, displayName: true },
    }),
  ]);

  const isAdmin = user?.role === "SCHOOL";
  const schoolId = isAdmin ? session.user.id : (profile?.schoolId ?? null);

  // Ensure the General Room exists and the current user is a participant — for
  // admins (their own school) and for any school-affiliated student/alum, who
  // has no self-serve code-entry path into their school's room.
  if (schoolId) {
    await ensureSchoolGeneralRoom(schoolId, session.user.id);
  }

  if (!schoolId) {
    return (
      <CommunitiesClient
        schoolId={null}
        myUserId={session.user.id}
        isAdmin={false}
        initialRooms={[]}
        schoolCode={null}
      />
    );
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      type: "COMMUNITY",
      schoolId,
      participants: { some: { userId: session.user.id } },
    },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { participants: true } },
    },
    orderBy: [{ isPrivateRoom: "asc" }, { updatedAt: "desc" }],
  });

  const initialRooms = conversations.map((c) => ({
    id: c.id,
    communityName: c.communityName,
    isPrivateRoom: c.isPrivateRoom,
    memberCount: c._count.participants,
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <CommunitiesClient
      schoolId={schoolId}
      myUserId={session.user.id}
      isAdmin={isAdmin}
      initialRooms={initialRooms}
      schoolCode={isAdmin ? (user?.schoolCode ?? null) : null}
    />
  );
}
```

Replace with:

```tsx
import CommunitiesClient from "./CommunitiesClient";
import { ensureSchoolGeneralRoom, getSchoolIds } from "@/lib/communities";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Communities — Nivarro" };

export default async function CommunitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, schoolCode: true },
  });
  const isAdmin = user?.role === "SCHOOL";
  const schoolIds = await getSchoolIds(session.user.id);

  // Ensure the General Room exists and the current user is a participant, for
  // every linked school — admins (their own school) and any school-affiliated
  // student/alum, who has no self-serve code-entry path into their room(s).
  await Promise.all(schoolIds.map((id) => ensureSchoolGeneralRoom(id, session.user.id)));

  if (schoolIds.length === 0) {
    return (
      <CommunitiesClient
        schoolId={null}
        myUserId={session.user.id}
        isAdmin={false}
        initialRooms={[]}
        schoolCode={null}
      />
    );
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      type: "COMMUNITY",
      schoolId: { in: schoolIds },
      participants: { some: { userId: session.user.id } },
    },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { participants: true } },
    },
    orderBy: [{ isPrivateRoom: "asc" }, { updatedAt: "desc" }],
  });

  const initialRooms = conversations.map((c) => ({
    id: c.id,
    communityName: c.communityName,
    isPrivateRoom: c.isPrivateRoom,
    memberCount: c._count.participants,
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <CommunitiesClient
      schoolId={schoolIds[0]}
      myUserId={session.user.id}
      isAdmin={isAdmin}
      initialRooms={initialRooms}
      schoolCode={isAdmin ? (user?.schoolCode ?? null) : null}
    />
  );
}
```

(`CommunitiesClient`'s `schoolId` prop is only used to scope room-creation requests, not to filter which rooms are *shown* — `initialRooms` already merges every linked school's rooms. Passing `schoolIds[0]` there is a documented simplification, matching the "first common school" simplification already accepted for connection requests.)

- [ ] **Step 2: `app/api/communities/rooms/route.ts` — GET**

Current:

```ts
  let effectiveSchoolId: string | null = null;
  if (userRecord?.role === 'SCHOOL') {
    effectiveSchoolId = session.user.id;
  } else {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { schoolId: true },
    });
    effectiveSchoolId = profile?.schoolId ?? null;
  }

  if (!effectiveSchoolId) {
    return NextResponse.json({ rooms: [] });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      type: 'COMMUNITY',
      schoolId: effectiveSchoolId,
      participants: { some: { userId: session.user.id } },
    },
```

Replace with:

```ts
  const schoolIds = await getSchoolIds(session.user.id);

  if (schoolIds.length === 0) {
    return NextResponse.json({ rooms: [] });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      type: 'COMMUNITY',
      schoolId: { in: schoolIds },
      participants: { some: { userId: session.user.id } },
    },
```

Add the import: `import { getSchoolIds } from '@/lib/communities';` (the `userRecord` fetch above it, used only to compute the now-removed `effectiveSchoolId`, becomes dead — delete that `prisma.user.findUnique` block too since nothing else in `GET` reads `userRecord`).

- [ ] **Step 3: `app/api/communities/rooms/[id]/members/route.ts`**

Current:

```ts
async function getSchoolId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  // SCHOOL accounts: their own id IS the schoolId
  if (user?.role === 'SCHOOL') return userId;
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { schoolId: true },
  });
  return profile?.schoolId ?? null;
}

async function verifyRoomAccess(userId: string, roomId: string) {
  const schoolId = await getSchoolId(userId);
  if (!schoolId) return null;
  const room = await prisma.conversation.findFirst({
    where: { id: roomId, type: 'COMMUNITY', schoolId },
  });
  return room;
}
```

Replace with:

```ts
async function verifyRoomAccess(userId: string, roomId: string) {
  const schoolIds = await getSchoolIds(userId);
  if (schoolIds.length === 0) return null;
  const room = await prisma.conversation.findFirst({
    where: { id: roomId, type: 'COMMUNITY', schoolId: { in: schoolIds } },
  });
  return room;
}
```

Add the import: `import { getSchoolIds } from '@/lib/communities';`

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual check**

Log in as `priya@nivarro.io`. Confirm `/communities` loads Westside's General room and she can post. Confirm `GET /api/communities/rooms` (via the browser network tab or `curl` with her session cookie) returns that room.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/communities/page.tsx" app/api/communities/rooms
git commit -m "feat: make community room listing and access multi-school-aware"
```

---

### Task 9: Alumni self-verify transition

When a walled Student flips themselves to Alumni (`/api/alumni/verify`), they carry forward the single school they already had as a Student. This is the runtime equivalent of the Task 2 backfill for accounts created *after* this feature ships.

**Files:**
- Modify: `app/api/alumni/verify/route.ts`

- [ ] **Step 1: Update the room-join logic**

Current:

```ts
  if (profile) {
    await prisma.profile.update({ where: { id: profile.id }, data: { graduationYear: year } });
    // Auto-join the school's general community room if the alumni is school-linked
    if (profile.schoolId) {
      await ensureSchoolGeneralRoom(profile.schoolId, session.user.id);
    }
  } else {
```

Replace with:

```ts
  if (profile) {
    await prisma.profile.update({ where: { id: profile.id }, data: { graduationYear: year } });
    // Carry forward the school they already had as a Student into an
    // AlumniSchool link, then null the scalar — same shape the Task 2
    // backfill produced for pre-existing alumni.
    if (profile.schoolId) {
      await prisma.alumniSchool.upsert({
        where: { profileId_schoolId: { profileId: profile.id, schoolId: profile.schoolId } },
        create: { profileId: profile.id, schoolId: profile.schoolId },
        update: {},
      });
      await prisma.profile.update({ where: { id: profile.id }, data: { schoolId: null } });
      await ensureSchoolGeneralRoom(profile.schoolId, session.user.id);
    }
  } else {
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual check**

Create a fresh walled Student demo account linked to Westside (via `/school/roster` as `school@nivarro.demo`, role `STUDENT`), log in as them, hit `/api/alumni/verify` with a valid graduation year (e.g. via a `fetch` from devtools console: `fetch('/api/alumni/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graduationYear: 2024 }) })`). Confirm via the spot-check script pattern from Task 2 that their `Profile.schoolId` is now null and they have one `AlumniSchool` row for Westside.

- [ ] **Step 4: Commit**

```bash
git add app/api/alumni/verify/route.ts
git commit -m "feat: carry Student schoolId into AlumniSchool on alumni self-verify"
```

---

### Task 10: Self-service removal + profile editor "Schools" section

**Files:**
- Create: `app/api/profile/schools/[schoolId]/route.ts`
- Modify: `app/(dashboard)/profile/page.tsx`
- Modify: `app/(dashboard)/profile/AlumniProfileEditor.tsx`

**Interfaces:**
- Produces: `DELETE /api/profile/schools/[schoolId]` — 200 `{ ok: true }` on success, 403 if the caller isn't an alum.
- Consumes: `getLinkedSchools(userId)` from Task 3.

- [ ] **Step 1: Create the self-service DELETE route**

Create `app/api/profile/schools/[schoolId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { schoolId } = await params;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAlumni: true, profile: { select: { id: true } } },
  });
  if (!dbUser?.isAlumni || !dbUser.profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.alumniSchool.deleteMany({
    where: { profileId: dbUser.profile.id, schoolId },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Pass linked schools into `AlumniProfileEditor`**

In `app/(dashboard)/profile/page.tsx`, current alumni branch:

```tsx
  if (walled && dbUser?.isAlumni) {
    const alumniProfile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        linkedinUrl: true,
        employer: true,
        jobTitle: true,
        confirmedCollege: true,
        confirmedMajor: true,
        isAvailableToMentor: true,
      },
    });

    return (
      <AlumniProfileEditor
        initialProfile={{
          linkedinUrl: alumniProfile?.linkedinUrl ?? "",
          employer: alumniProfile?.employer ?? "",
          jobTitle: alumniProfile?.jobTitle ?? "",
          confirmedCollege: alumniProfile?.confirmedCollege ?? "",
          confirmedMajor: alumniProfile?.confirmedMajor ?? "",
          isAvailableToMentor: alumniProfile?.isAvailableToMentor ?? false,
        }}
      />
    );
  }
```

Replace with:

```tsx
  if (walled && dbUser?.isAlumni) {
    const [alumniProfile, schools] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        select: {
          linkedinUrl: true,
          employer: true,
          jobTitle: true,
          confirmedCollege: true,
          confirmedMajor: true,
          isAvailableToMentor: true,
        },
      }),
      getLinkedSchools(userId),
    ]);

    return (
      <AlumniProfileEditor
        initialProfile={{
          linkedinUrl: alumniProfile?.linkedinUrl ?? "",
          employer: alumniProfile?.employer ?? "",
          jobTitle: alumniProfile?.jobTitle ?? "",
          confirmedCollege: alumniProfile?.confirmedCollege ?? "",
          confirmedMajor: alumniProfile?.confirmedMajor ?? "",
          isAvailableToMentor: alumniProfile?.isAvailableToMentor ?? false,
        }}
        initialSchools={schools}
      />
    );
  }
```

Add the import: `import { getLinkedSchools } from "@/lib/communities";`

- [ ] **Step 3: Add the "Schools" section to `AlumniProfileEditor.tsx`**

Update the `Props` interface:

```tsx
interface Props {
  initialProfile: {
    linkedinUrl: string;
    employer: string;
    jobTitle: string;
    confirmedCollege: string;
    confirmedMajor: string;
    isAvailableToMentor: boolean;
  };
  initialSchools: { id: string; name: string }[];
}
```

Update the component signature and add school-removal state, right after the existing `useState` calls:

```tsx
export default function AlumniProfileEditor({ initialProfile, initialSchools }: Props) {
  const router = useRouter();
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile.linkedinUrl);
  const [employer, setEmployer] = useState(initialProfile.employer);
  const [jobTitle, setJobTitle] = useState(initialProfile.jobTitle);
  const [confirmedCollege, setConfirmedCollege] = useState(initialProfile.confirmedCollege);
  const [confirmedMajor, setConfirmedMajor] = useState(initialProfile.confirmedMajor);
  const [isAvailableToMentor, setIsAvailableToMentor] = useState(initialProfile.isAvailableToMentor);
  const [schools, setSchools] = useState(initialSchools);
  const [removingSchoolId, setRemovingSchoolId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleRemoveSchool(schoolId: string) {
    setRemovingSchoolId(schoolId);
    const res = await fetch(`/api/profile/schools/${schoolId}`, { method: "DELETE" });
    setRemovingSchoolId(null);
    if (res.ok) {
      setSchools((prev) => prev.filter((s) => s.id !== schoolId));
      router.refresh();
    } else {
      setError("Couldn't remove that school. Try again.");
    }
  }
```

Add a new section, right after the `<form onSubmit={handleSave} className="space-y-6">` opening tag's first child (before the "Destination" `<div>`):

```tsx
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
            Schools
          </h2>
          <p className="text-xs text-[#606068]">
            Schools are added by a school admin — you can remove one you no longer want linked, but you can&apos;t add one yourself.
          </p>
          {schools.length === 0 ? (
            <p className="text-sm text-[#909098]">Not linked to any school yet.</p>
          ) : (
            <ul className="space-y-2">
              {schools.map((school) => (
                <li
                  key={school.id}
                  className="flex items-center justify-between bg-[#16161a] border border-[#242429] rounded-md px-3 py-2"
                >
                  <span className="text-sm text-[#eaeaea]">{school.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSchool(school.id)}
                    disabled={removingSchoolId === school.id}
                    className="text-xs text-[#f87171] hover:text-[#fca5a5] disabled:opacity-60"
                  >
                    {removingSchoolId === school.id ? "Removing..." : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual check**

Log in as `priya@nivarro.io`, go to `/profile`. Confirm the new "Schools" section shows "Westside Academy" with a Remove button. Click Remove, confirm it disappears and (per Task 4's wall check) she becomes unwalled on next nav since she has no schools left — re-link her via the roster as `school@nivarro.demo` afterward to restore the demo data.

- [ ] **Step 6: Commit**

```bash
git add app/api/profile/schools "app/(dashboard)/profile/page.tsx" "app/(dashboard)/profile/AlumniProfileEditor.tsx"
git commit -m "feat: add self-service school removal to the alumni profile editor"
```

---

### Task 11: Dashboard greeting — multi-school display

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/dashboard/WalledDashboardClient.tsx`

- [ ] **Step 1: `WalledDashboardClient.tsx` — accept a list of school names**

Current:

```tsx
interface Props {
  displayName: string;
  schoolName: string;
  hasUnreadCommunity: boolean;
  hasUnreadMentorship: boolean;
}
```
...
```tsx
export default function WalledDashboardClient({ displayName, schoolName, hasUnreadCommunity, hasUnreadMentorship }: Props) {
  const unread: Record<string, boolean> = { hasUnreadCommunity, hasUnreadMentorship };

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>
        Welcome, {displayName}
      </h1>
      <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 32px" }}>
        Your hub at {schoolName}.
      </p>
```

Replace with:

```tsx
interface Props {
  displayName: string;
  schoolNames: string[];
  hasUnreadCommunity: boolean;
  hasUnreadMentorship: boolean;
}
```
...
```tsx
export default function WalledDashboardClient({ displayName, schoolNames, hasUnreadCommunity, hasUnreadMentorship }: Props) {
  const unread: Record<string, boolean> = { hasUnreadCommunity, hasUnreadMentorship };
  const hubLabel =
    schoolNames.length === 0
      ? "your school"
      : schoolNames.length === 1
      ? schoolNames[0]
      : `${schoolNames[0]} and ${schoolNames.length - 1} more`;

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>
        Welcome, {displayName}
      </h1>
      <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 32px" }}>
        Your hub at {hubLabel}.
      </p>
```

- [ ] **Step 2: `dashboard/page.tsx` — fetch names instead of one school**

Current:

```tsx
  if (await isWalledStudent(userId)) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { displayName: true, schoolId: true },
    });

    const school = profile?.schoolId
      ? await prisma.user.findUnique({
          where: { id: profile.schoolId },
          select: { name: true, profile: { select: { displayName: true, headline: true } } },
        })
      : null;
```
...
```tsx
    return (
      <WalledDashboardClient
        displayName={profile?.displayName ?? session.user.name ?? "there"}
        schoolName={school?.profile?.displayName ?? school?.name ?? "your school"}
        hasUnreadCommunity={hasUnreadCommunity}
        hasUnreadMentorship={hasUnreadMentorship}
      />
    );
  }
```

Replace with:

```tsx
  if (await isWalledStudent(userId)) {
    const [profile, schools] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        select: { displayName: true },
      }),
      getLinkedSchools(userId),
    ]);
```
...
```tsx
    return (
      <WalledDashboardClient
        displayName={profile?.displayName ?? session.user.name ?? "there"}
        schoolNames={schools.map((s) => s.name)}
        hasUnreadCommunity={hasUnreadCommunity}
        hasUnreadMentorship={hasUnreadMentorship}
      />
    );
  }
```

Add the import: `import { getLinkedSchools } from "@/lib/communities";`

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual check**

Log in as `student@nivarro.demo` (single school). Confirm the dashboard greeting reads "Your hub at Westside Academy." Log in as `priya@nivarro.io` — confirm it reads the same single-school phrasing (she still has exactly one school at this point in testing unless Task 13's fixture gives her a second).

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx" "app/(dashboard)/dashboard/WalledDashboardClient.tsx"
git commit -m "feat: show multi-school summary in the walled dashboard greeting"
```

---

### Task 12: `/my-school` switcher

**Files:**
- Modify: `app/(dashboard)/my-school/page.tsx`
- Modify: `app/(dashboard)/my-school/SchoolHubClient.tsx`

- [ ] **Step 1: `my-school/page.tsx` — accept a `?school=` query param, default to the first linked school**

Current (full file, per the earlier read):

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SchoolHubClient from "./SchoolHubClient";
import { finalizeExpiredPartnershipRequests } from "@/lib/partnerships";

export default async function MySchoolPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { schoolId: true },
  });

  if (!profile?.schoolId) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>
          My School
        </h1>
        <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 32px" }}>
          Your school hasn&apos;t set up a Nivarro hub yet.
        </p>
        <div style={{ padding: "40px 32px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 12px" }}>
            Not configured
          </p>
          <p style={{ fontSize: 14, color: "var(--n-text2)", margin: 0, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            Ask your school counselor to activate Nivarro for your school. Once they do, you&apos;ll see your alumni network, mentors, and staff here.
          </p>
        </div>
      </div>
    );
  }

  const schoolId = profile.schoolId;
```

Replace the top portion with:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SchoolHubClient from "./SchoolHubClient";
import { finalizeExpiredPartnershipRequests } from "@/lib/partnerships";
import { getLinkedSchools } from "@/lib/communities";

export default async function MySchoolPage(props: {
  searchParams: Promise<{ school?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const linkedSchools = await getLinkedSchools(session.user.id);

  if (linkedSchools.length === 0) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>
          My School
        </h1>
        <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 32px" }}>
          Your school hasn&apos;t set up a Nivarro hub yet.
        </p>
        <div style={{ padding: "40px 32px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 12px" }}>
            Not configured
          </p>
          <p style={{ fontSize: 14, color: "var(--n-text2)", margin: 0, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            Ask your school counselor to activate Nivarro for your school. Once they do, you&apos;ll see your alumni network, mentors, and staff here.
          </p>
        </div>
      </div>
    );
  }

  const searchParams = await props.searchParams;
  const requestedId = searchParams.school;
  const activeSchool = linkedSchools.find((s) => s.id === requestedId) ?? linkedSchools[0];
  const schoolId = activeSchool.id;
```

(Leave the not-configured JSX block's contents exactly as they were — only the guard condition and the surrounding function signature change.)

- [ ] **Step 2: Pass the switcher data to `SchoolHubClient`**

At the bottom of `my-school/page.tsx`, current return:

```tsx
  return (
    <SchoolHubClient
      schoolName={schoolName}
      schoolTagline={schoolTagline}
      staff={staffProfiles}
      alumni={formattedAlumni}
      mentors={mentors}
      students={formattedStudents}
      currentUserId={session.user.id}
    />
  );
```

Replace with:

```tsx
  return (
    <SchoolHubClient
      schoolName={schoolName}
      schoolTagline={schoolTagline}
      staff={staffProfiles}
      alumni={formattedAlumni}
      mentors={mentors}
      students={formattedStudents}
      currentUserId={session.user.id}
      otherSchools={linkedSchools.filter((s) => s.id !== schoolId)}
    />
  );
```

- [ ] **Step 3: `SchoolHubClient.tsx` — render the switcher when there's more than one school**

Update the `Props` interface:

```tsx
interface Props {
  schoolName: string;
  schoolTagline: string;
  staff: StaffMember[];
  alumni: Alumnus[];
  mentors: Alumnus[];
  students: StudentPeer[];
  currentUserId: string;
  otherSchools: { id: string; name: string }[];
}
```

Update the component signature:

```tsx
export default function SchoolHubClient({ schoolName, schoolTagline, staff, alumni, mentors, students, currentUserId: _, otherSchools }: Props) {
```

In the "School banner" block, right after the closing `</p>` of `schoolTagline` (line 132 in the original file), add:

```tsx
            {otherSchools.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--n-muted)" }}>Also at:</span>
                {otherSchools.map((s) => (
                  <a
                    key={s.id}
                    href={`/my-school?school=${s.id}`}
                    style={{
                      fontSize: 12, color: "var(--amber)", textDecoration: "underline",
                    }}
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            )}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual check**

Deferred to Task 13's end-to-end pass, since it needs a second demo SCHOOL account to be meaningful.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/my-school/page.tsx" "app/(dashboard)/my-school/SchoolHubClient.tsx"
git commit -m "feat: add a school switcher to /my-school for multi-school alumni"
```

---

### Task 13: End-to-end manual QA with a two-school alum

This is the only task that actually exercises "one alum, two schools" — every prior task was verified against single-school demo data. No permanent script or seed change is needed; this uses a throwaway second SCHOOL account.

**Files:** none (verification only).

- [ ] **Step 1: Create a throwaway second school and link Priya to it**

Run `npm run dev` in one terminal. In another, run:

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('demo2026', 10);
  const school = await prisma.user.upsert({
    where: { email: 'testschool2@nivarro.demo' },
    update: {},
    create: { name: 'Riverside High', email: 'testschool2@nivarro.demo', passwordHash: hash, role: 'SCHOOL' },
  });
  const priya = await prisma.user.findUniqueOrThrow({ where: { email: 'priya@nivarro.io' }, select: { profile: { select: { id: true } } } });
  await prisma.alumniSchool.upsert({
    where: { profileId_schoolId: { profileId: priya.profile!.id, schoolId: school.id } },
    create: { profileId: priya.profile!.id, schoolId: school.id },
    update: {},
  });
  console.log('Riverside High id:', school.id);
}
main().finally(() => prisma.\$disconnect());
"
```

- [ ] **Step 2: Walk through every surface as Priya**

Log in as `priya@nivarro.io` / `demo2026`.

- `/dashboard` — greeting reads "Your hub at Westside Academy and 1 more."
- `/my-school` — shows Westside Academy by default, with an "Also at: Riverside High" link. Click it, confirm the hub swaps to Riverside High (empty roster, since only Priya is linked there).
- `/communities` — General room list includes both Westside's and Riverside's general rooms (both auto-created via Task 8's `ensureSchoolGeneralRoom` loop).
- `/profile` — "Schools" section lists both Westside Academy and Riverside High, each with a working Remove button.
- Sidebar nav — still shows the walled Student/Alum nav, not the Standard nav (confirms Task 4's `isWalledStudent` fix holds with 2 schools linked).

- [ ] **Step 3: Walk through the school-admin side for the new school**

Log in as `testschool2@nivarro.demo` / `demo2026`. On `/school/roster`, confirm Priya appears as an alumni member. On `/school/mentorship`, confirm she's selectable as a mentor (she has `isAvailableToMentor: true` from the seed data).

- [ ] **Step 4: Clean up the throwaway fixture**

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const school = await prisma.user.findUnique({ where: { email: 'testschool2@nivarro.demo' } });
  if (school) {
    await prisma.alumniSchool.deleteMany({ where: { schoolId: school.id } });
    await prisma.conversation.deleteMany({ where: { schoolId: school.id } });
    await prisma.user.delete({ where: { id: school.id } });
    console.log('Cleaned up Riverside High.');
  }
}
main().finally(() => prisma.\$disconnect());
"
```

Confirm Priya still shows exactly one school (Westside Academy) afterward, via the same spot-check pattern from Task 2.

- [ ] **Step 5: Final full-repo typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

No commit for this task — it's verification only, nothing in the working tree changes.
