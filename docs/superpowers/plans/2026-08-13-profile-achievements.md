# Profile Achievements & Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two public sections to student profiles — **Projects** (curated pins of completed `Project`/`OrgProject` records) and **Achievements** (free-text entries) — and fully remove the Animal Archetypes feature.

**Architecture:** Two new Prisma models (`Achievement`, `ProfileHighlight`) hung off `Profile`, five new API routes for CRUD + eligibility, two new client components wired into the existing `ProfileClient.tsx`, and a full teardown of the Animal Archetypes code path (schema, lib, API route, component, seed data).

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 7 / PostgreSQL, Zod, NextAuth v5 (`auth()` helper), Tailwind utility classes matching the existing dark-card visual language.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-13-profile-achievements-design.md` — read it first for the "why" behind every decision below.
- No automated test framework exists in this repo. Per-task verification = `npx tsc --noEmit` (clean of new errors) + `npm run lint` (clean). Task 8 is a full manual browser QA pass covering everything.
- All mutation routes resolve `profileId`/ownership from the session (`auth()`), never from the request body. Return 401 if unauthenticated, 404 if the record isn't owned by the caller.
- Both new profile sections (Projects, Achievements) are **public** — visible to any viewer, not gated to `isOwn`. Only the add/pin/delete/unpin *controls* are gated to `isOwn`.
- No image support, no manual reordering (both sections sort reverse-chronologically) — confirmed out of scope in the spec.
- Migrations in this repo are hand-written SQL files under `prisma/migrations/<timestamp>_<name>/migration.sql`, applied via `prisma migrate deploy` (runs automatically on deploy via `scripts/start.js`, and can be run locally against `DATABASE_URL` to verify). Follow the exact style of recent migrations (`IF NOT EXISTS` / `IF EXISTS` everywhere, FK constraints wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;`).
- `main` was mid-merge (leftover conflicts from the Genius Type removal) when this plan was written; confirmed resolved before this plan starts. If it isn't, stop and resolve that first — don't build on top of conflict markers.

---

### Task 1: Prisma schema — Achievement & ProfileHighlight models

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260813000000_add_achievements_and_highlights/migration.sql`

**Interfaces:**
- Produces: `Achievement` model (`id`, `profileId`, `title`, `description?`, `link?`, `achievedAt?`, `createdAt`), `ProfileHighlight` model (`id`, `profileId`, `projectId?`, `orgProjectId?`, `pinnedAt`) — consumed by Tasks 2, 3, 4.

- [ ] **Step 1: Add the two new models to `prisma/schema.prisma`**

Insert this block immediately after the `enum ProjectRole { ... }` block (which currently ends right before the `// ─── PEER ENDORSEMENTS ───` comment):

```prisma
// ─────────────────────────────────────────────
// PROFILE ACHIEVEMENTS & HIGHLIGHTS
// ─────────────────────────────────────────────

model Achievement {
  id          String    @id @default(cuid())
  profileId   String
  title       String
  description String?
  link        String?
  achievedAt  DateTime?
  createdAt   DateTime  @default(now())

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
}

model ProfileHighlight {
  id           String   @id @default(cuid())
  profileId    String
  projectId    String?
  orgProjectId String?
  pinnedAt     DateTime @default(now())

  profile    Profile     @relation(fields: [profileId], references: [id], onDelete: Cascade)
  project    Project?    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  orgProject OrgProject? @relation(fields: [orgProjectId], references: [id], onDelete: Cascade)

  @@unique([profileId, projectId])
  @@unique([profileId, orgProjectId])
}
```

- [ ] **Step 2: Add the back-relations to `Profile`, `Project`, `OrgProject`**

In `model Profile`, the relations list currently ends with:

```prisma
  orgReviews           OrgReview[]
  alumniSchools        AlumniSchool[]
}
```

Change to:

```prisma
  orgReviews           OrgReview[]
  alumniSchools        AlumniSchool[]
  achievements         Achievement[]
  highlights           ProfileHighlight[]
}
```

In `model Project`, currently:

```prisma
  members      ProjectMember[]
  endorsements PeerEndorsement[]
}
```

Change to:

```prisma
  members      ProjectMember[]
  endorsements PeerEndorsement[]
  highlights   ProfileHighlight[]
}
```

In `model OrgProject`, currently:

```prisma
  org              Org                  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  recruitmentReqs  RecruitmentRequest[]
  teamApplications TeamApplication[]
  reviews          OrgReview[]
  algorithmQuotas  AlgorithmQuota[]
  workflowSessions WorkflowSession[]
}
```

Change to:

```prisma
  org              Org                  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  recruitmentReqs  RecruitmentRequest[]
  teamApplications TeamApplication[]
  reviews          OrgReview[]
  algorithmQuotas  AlgorithmQuota[]
  workflowSessions WorkflowSession[]
  highlights       ProfileHighlight[]
}
```

- [ ] **Step 3: Write the migration SQL**

Create `prisma/migrations/20260813000000_add_achievements_and_highlights/migration.sql`:

```sql
-- Profile portfolio: free-text Achievement entries, and ProfileHighlight
-- pins for completed Project/OrgProject records surfaced on the profile.

CREATE TABLE IF NOT EXISTS "Achievement" (
  "id"          TEXT NOT NULL,
  "profileId"   TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "link"        TEXT,
  "achievedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Achievement_profileId_idx" ON "Achievement"("profileId");

DO $$ BEGIN
  ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ProfileHighlight" (
  "id"           TEXT NOT NULL,
  "profileId"    TEXT NOT NULL,
  "projectId"    TEXT,
  "orgProjectId" TEXT,
  "pinnedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileHighlight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfileHighlight_profileId_projectId_key" ON "ProfileHighlight"("profileId", "projectId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProfileHighlight_profileId_orgProjectId_key" ON "ProfileHighlight"("profileId", "orgProjectId");

DO $$ BEGIN
  ALTER TABLE "ProfileHighlight" ADD CONSTRAINT "ProfileHighlight_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProfileHighlight" ADD CONSTRAINT "ProfileHighlight_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProfileHighlight" ADD CONSTRAINT "ProfileHighlight_orgProjectId_fkey"
    FOREIGN KEY ("orgProjectId") REFERENCES "OrgProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

Note: a `UNIQUE INDEX` on a nullable column in Postgres treats each `NULL` as distinct, so multiple `ProfileHighlight` rows can each have `projectId = NULL` (org-only pins) without colliding — the uniqueness only bites when `projectId` (or `orgProjectId`) is actually the same non-null value twice for a profile. This is what makes the "exactly one of the two FKs set" pattern work without a DB-level XOR constraint.

- [ ] **Step 4: Apply the migration and regenerate the client**

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: migration applies cleanly (or is a no-op if already applied), client regenerates with `prisma.achievement` and `prisma.profileHighlight` available.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: clean (schema-only change, nothing references the new models yet).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260813000000_add_achievements_and_highlights
git commit -m "Add Achievement and ProfileHighlight models"
```

---

### Task 2: Achievements API

**Files:**
- Create: `app/api/achievements/route.ts`
- Create: `app/api/achievements/[id]/route.ts`

**Interfaces:**
- Consumes: `Achievement` model from Task 1.
- Produces: `POST /api/achievements` → `{ achievement }`; `DELETE /api/achievements/[id]` → `{ success: true }`. Consumed by the `AchievementsSection` component in Task 5.

- [ ] **Step 1: Create the collection route**

Create `app/api/achievements/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  link: z.string().url().max(500).optional(),
  achievedAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  const { title, description, link, achievedAt } = parsed.data;

  const achievement = await prisma.achievement.create({
    data: {
      profileId: profile.id,
      title,
      description,
      link,
      achievedAt: achievedAt ? new Date(achievedAt) : undefined,
    },
  });

  return NextResponse.json({ achievement });
}
```

- [ ] **Step 2: Create the item route**

Create `app/api/achievements/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const achievement = await prisma.achievement.findUnique({
    where: { id },
    select: { id: true, profile: { select: { userId: true } } },
  });
  if (!achievement || achievement.profile.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.achievement.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

(No `PATCH`/edit route — the spec's UI decision is delete-and-re-add for corrections, not edit-in-place, so there's no consumer for a PATCH endpoint.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add app/api/achievements
git commit -m "Add achievements create/delete API routes"
```

---

### Task 3: Profile highlights (pin) API

**Files:**
- Create: `lib/profileHighlights.ts`
- Create: `app/api/profile/eligible-highlights/route.ts`
- Create: `app/api/profile-highlights/route.ts`
- Create: `app/api/profile-highlights/[id]/route.ts`

**Interfaces:**
- Consumes: `ProfileHighlight`, `Project`, `OrgProject`, `TeamApplication`, `TeamMember` models.
- Produces: `getEligibleSelfProjects(userId, profileId)`, `getEligibleOrgProjects(profileId)`, `isSelfProjectEligible(userId, projectId)`, `isOrgProjectEligible(profileId, orgProjectId)` from `lib/profileHighlights.ts` — consumed by the two API routes here. `GET /api/profile/eligible-highlights` → `{ selfProjects: [...], orgProjects: [...] }`; `POST /api/profile-highlights` → `{ highlight }`; `DELETE /api/profile-highlights/[id]` → `{ success: true }` — consumed by `ProjectsSection`/`PinProjectModal` in Task 6.

Eligibility rules (from the spec): a self-organized `Project` is eligible if the caller is a `ProjectMember` (matched by **`userId`**, not `profileId` — `ProjectMember.userId` references `User.id` directly, unlike the org-project path below) and `status = COMPLETED`. An `OrgProject` is eligible if the caller's `Profile` (matched by **`profileId`**) is a member of a `Team` with an `ACCEPTED` `TeamApplication` to that `OrgProject`, and `OrgProject.closedAt` is set.

- [ ] **Step 1: Create the eligibility helper module**

Create `lib/profileHighlights.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export async function getEligibleSelfProjects(userId: string, profileId: string) {
  return prisma.project.findMany({
    where: {
      status: "COMPLETED",
      members: { some: { userId } },
      highlights: { none: { profileId } },
    },
    select: { id: true, name: true, description: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getEligibleOrgProjects(profileId: string) {
  return prisma.orgProject.findMany({
    where: {
      closedAt: { not: null },
      teamApplications: {
        some: { status: "ACCEPTED", team: { members: { some: { profileId } } } },
      },
      highlights: { none: { profileId } },
    },
    select: {
      id: true,
      title: true,
      org: { select: { name: true, logoLetter: true, logoBg: true, logoColor: true } },
    },
    orderBy: { closedAt: "desc" },
  });
}

export async function isSelfProjectEligible(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, status: "COMPLETED", members: { some: { userId } } },
    select: { id: true },
  });
  return !!project;
}

export async function isOrgProjectEligible(profileId: string, orgProjectId: string) {
  const orgProject = await prisma.orgProject.findFirst({
    where: {
      id: orgProjectId,
      closedAt: { not: null },
      teamApplications: { some: { status: "ACCEPTED", team: { members: { some: { profileId } } } } },
    },
    select: { id: true },
  });
  return !!orgProject;
}
```

- [ ] **Step 2: Create the eligibility-list route**

Create `app/api/profile/eligible-highlights/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEligibleSelfProjects, getEligibleOrgProjects } from "@/lib/profileHighlights";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  const [selfProjects, orgProjects] = await Promise.all([
    getEligibleSelfProjects(session.user.id, profile.id),
    getEligibleOrgProjects(profile.id),
  ]);

  return NextResponse.json({
    selfProjects: selfProjects.map((p) => ({
      kind: "project" as const,
      id: p.id,
      title: p.name,
      description: p.description,
    })),
    orgProjects: orgProjects.map((p) => ({
      kind: "orgProject" as const,
      id: p.id,
      title: p.title,
      orgName: p.org.name,
      orgLogoLetter: p.org.logoLetter,
      orgLogoBg: p.org.logoBg,
      orgLogoColor: p.org.logoColor,
    })),
  });
}
```

- [ ] **Step 3: Create the pin route**

Create `app/api/profile-highlights/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { isSelfProjectEligible, isOrgProjectEligible } from "@/lib/profileHighlights";

const pinSchema = z.union([
  z.object({ projectId: z.string().min(1) }),
  z.object({ orgProjectId: z.string().min(1) }),
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  if ("projectId" in parsed.data) {
    const eligible = await isSelfProjectEligible(session.user.id, parsed.data.projectId);
    if (!eligible) {
      return NextResponse.json({ error: "Not eligible to pin this project" }, { status: 403 });
    }
    const highlight = await prisma.profileHighlight.upsert({
      where: { profileId_projectId: { profileId: profile.id, projectId: parsed.data.projectId } },
      create: { profileId: profile.id, projectId: parsed.data.projectId },
      update: {},
    });
    return NextResponse.json({ highlight });
  }

  const eligible = await isOrgProjectEligible(profile.id, parsed.data.orgProjectId);
  if (!eligible) {
    return NextResponse.json({ error: "Not eligible to pin this project" }, { status: 403 });
  }
  const highlight = await prisma.profileHighlight.upsert({
    where: { profileId_orgProjectId: { profileId: profile.id, orgProjectId: parsed.data.orgProjectId } },
    create: { profileId: profile.id, orgProjectId: parsed.data.orgProjectId },
    update: {},
  });
  return NextResponse.json({ highlight });
}
```

- [ ] **Step 4: Create the unpin route**

Create `app/api/profile-highlights/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const highlight = await prisma.profileHighlight.findUnique({
    where: { id },
    select: { id: true, profile: { select: { userId: true } } },
  });
  if (!highlight || highlight.profile.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.profileHighlight.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add lib/profileHighlights.ts app/api/profile/eligible-highlights app/api/profile-highlights
git commit -m "Add profile highlight eligibility, pin, and unpin API routes"
```

---

### Task 4: Fetch achievements & highlights on the profile page

**Files:**
- Modify: `app/(dashboard)/profile/[handle]/page.tsx`

**Interfaces:**
- Consumes: `Achievement`, `ProfileHighlight` models from Task 1.
- Produces: `achievements` prop (`{ id, title, description, link, achievedAt }[]`, dates as ISO strings) and `highlights` prop (`{ id, project, orgProject }[]`) passed into `ProfileClient` — consumed by Tasks 5 and 6.

- [ ] **Step 1: Extend the profile query and pass new props**

In `app/(dashboard)/profile/[handle]/page.tsx`, the first `prisma.profile.findUnique` call (the one keyed by `handle`, used for the viewed profile — not the `myProfile` one) currently ends its `select` block with:

```typescript
        graduationYear: true,
        intendedCollege: true,
      },
    }),
```

Change to:

```typescript
        graduationYear: true,
        intendedCollege: true,
        achievements: {
          orderBy: [{ achievedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
          select: { id: true, title: true, description: true, link: true, achievedAt: true },
        },
        highlights: {
          orderBy: { pinnedAt: "desc" },
          select: {
            id: true,
            project: { select: { id: true, name: true, description: true } },
            orgProject: {
              select: {
                id: true,
                title: true,
                org: { select: { name: true, logoLetter: true, logoBg: true, logoColor: true } },
              },
            },
          },
        },
      },
    }),
```

(Only the primary `profile` query — the `myProfile` query below it is used solely for the `isOwnProfile` identity check and doesn't need these fields.)

Then update the `<ProfileClient>` call at the bottom of the file. It currently reads:

```typescript
  return (
    <ProfileClient
      profile={{
        ...profile,
        archetypeUpdatedAt: profile.archetypeUpdatedAt?.toISOString() ?? null,
      }}
      isOwn={!!isOwnProfile}
      myProfile={myProfile ? { ...myProfile, archetypeUpdatedAt: myProfile.archetypeUpdatedAt?.toISOString() ?? null } : null}
      ownReviews={ownReviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
    />
  );
```

Change to:

```typescript
  return (
    <ProfileClient
      profile={{
        ...profile,
        archetypeUpdatedAt: profile.archetypeUpdatedAt?.toISOString() ?? null,
      }}
      isOwn={!!isOwnProfile}
      myProfile={myProfile ? { ...myProfile, archetypeUpdatedAt: myProfile.archetypeUpdatedAt?.toISOString() ?? null } : null}
      ownReviews={ownReviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      achievements={profile.achievements.map((a) => ({
        ...a,
        achievedAt: a.achievedAt?.toISOString() ?? null,
      }))}
      highlights={profile.highlights}
    />
  );
```

(The `archetypeUpdatedAt` lines stay exactly as-is here — they're removed in Task 7, not this task, to keep this task purely additive.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: **fails** at this point — `ProfileClient`'s `Props` type doesn't accept `achievements`/`highlights` yet. That's expected; Tasks 5 and 6 add those props. Confirm the *only* new error is about the `achievements`/`highlights` props on `ProfileClient`, not something else (e.g. a typo in the `select` block).

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/profile/[handle]/page.tsx"
git commit -m "Fetch achievements and profile highlights for the profile page"
```

---

### Task 5: Achievements section UI

**Files:**
- Create: `app/(dashboard)/profile/[handle]/AchievementsSection.tsx`
- Modify: `app/(dashboard)/profile/[handle]/ProfileClient.tsx`

**Interfaces:**
- Consumes: `POST /api/achievements`, `DELETE /api/achievements/[id]` from Task 2; `achievements` prop from Task 4.
- Produces: `<AchievementsSection achievements={...} isOwn={...} />`, exported `AchievementData` type — consumed by `ProfileClient.tsx` in this task.

- [ ] **Step 1: Create the component**

Create `app/(dashboard)/profile/[handle]/AchievementsSection.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

export interface AchievementData {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  achievedAt: string | null;
}

interface Props {
  achievements: AchievementData[];
  isOwn: boolean;
}

export default function AchievementsSection({ achievements, isOwn }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", link: "", achievedAt: "" });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (achievements.length === 0 && !isOwn) return null;

  const resetForm = () => {
    setForm({ title: "", description: "", link: "", achievedAt: "" });
    setAdding(false);
    setError(null);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          link: form.link.trim() || undefined,
          achievedAt: form.achievedAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add achievement");
        return;
      }
      resetForm();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/achievements/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider">Achievements</h2>
        {isOwn && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[11px] font-mono px-3 py-1 rounded-full transition-colors"
            style={{ background: "#1e1e24", border: "1px solid #2a2a33", color: "#9898a8" }}
          >
            + Add achievement
          </button>
        )}
      </div>

      {achievements.length === 0 && !adding && (
        <div className="rounded-xl p-5 text-center" style={{ background: "#16161a", border: "1px dashed #2a2a33" }}>
          <p className="text-sm" style={{ color: "#5a5a6a" }}>No achievements yet</p>
        </div>
      )}

      {achievements.length > 0 && (
        <div className="space-y-3">
          {achievements.map((a) => (
            <div key={a.id} className="rounded-xl p-4" style={{ background: "#16161a", border: "1px solid #2a2a33" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#e8e8ec" }}>{a.title}</p>
                  {a.achievedAt && (
                    <p className="text-xs mt-0.5" style={{ color: "#5a5a6a" }}>
                      {format(new Date(a.achievedAt), "MMM yyyy")}
                    </p>
                  )}
                  {a.description && (
                    <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "#9898a8" }}>{a.description}</p>
                  )}
                  {a.link && (
                    <a
                      href={a.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs mt-1.5 inline-block"
                      style={{ color: "#4a80f0" }}
                    >
                      View →
                    </a>
                  )}
                </div>
                {isOwn && (
                  <button
                    onClick={() => remove(a.id)}
                    disabled={deletingId === a.id}
                    className="shrink-0 text-[#5a5a6a] hover:text-[#f87171] text-lg leading-none transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 rounded-xl p-4 space-y-3" style={{ background: "#16161a", border: "1px solid #2a2a33" }}>
          <div>
            <label className="block text-xs font-medium text-[#9898a8] uppercase tracking-wider mb-1.5">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="1st Place — State Science Fair"
              className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] placeholder-[#5a5a6a] px-3 py-2 text-sm focus:outline-none focus:border-[#4a80f0] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9898a8] uppercase tracking-wider mb-1.5">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] px-3 py-2 text-sm focus:outline-none focus:border-[#4a80f0] resize-none transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#9898a8] uppercase tracking-wider mb-1.5">Date (optional)</label>
              <input
                type="date"
                value={form.achievedAt}
                onChange={(e) => setForm((f) => ({ ...f, achievedAt: e.target.value }))}
                className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] px-3 py-2 text-sm focus:outline-none focus:border-[#4a80f0] transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#9898a8] uppercase tracking-wider mb-1.5">Link (optional)</label>
              <input
                type="url"
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="https://…"
                className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] placeholder-[#5a5a6a] px-3 py-2 text-sm focus:outline-none focus:border-[#4a80f0] transition-colors"
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-[#f87171] bg-[#f8717115] border border-[#f8717130] rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 py-2 rounded-lg border border-[#2a2a33] text-sm font-medium text-[#9898a8] hover:border-[#3a3a44] hover:text-[#e8e8ec] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-2 rounded-lg bg-[#4a80f0] hover:bg-[#6a9fff] text-[#0f0f11] text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {submitting ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `ProfileClient.tsx`**

Add the import near the top of `app/(dashboard)/profile/[handle]/ProfileClient.tsx`, alongside the existing component imports (right after `import DonationWidget from "@/components/donations/DonationWidget";`):

```typescript
import AchievementsSection, { AchievementData } from "./AchievementsSection";
```

Add `achievements` to the `Props` interface. It currently reads:

```typescript
interface Props {
  profile: ProfileData;
  isOwn: boolean;
  myProfile: ProfileData | null;
  ownReviews?: OwnReview[];
}
```

Change to:

```typescript
interface Props {
  profile: ProfileData;
  isOwn: boolean;
  myProfile: ProfileData | null;
  ownReviews?: OwnReview[];
  achievements: AchievementData[];
}
```

Destructure it in the component signature. It currently reads:

```typescript
export default function ProfileClient({ profile, isOwn, ownReviews = [] }: Props) {
```

Change to:

```typescript
export default function ProfileClient({ profile, isOwn, ownReviews = [], achievements }: Props) {
```

Render the section right after the Interests block and before the Animal Archetypes block. The Interests block currently ends with:

```tsx
      {/* Animal Archetypes */}
```

Insert immediately before that comment:

```tsx
      <AchievementsSection achievements={achievements} isOwn={isOwn} />

      {/* Animal Archetypes */}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: the `achievements` prop error from Task 4 is now gone. Any remaining errors should only be about the still-missing `highlights` prop (added in Task 6).

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profile/[handle]/AchievementsSection.tsx" "app/(dashboard)/profile/[handle]/ProfileClient.tsx"
git commit -m "Add Achievements section to profile"
```

---

### Task 6: Projects (pinned highlights) section UI

**Files:**
- Create: `app/(dashboard)/profile/[handle]/PinProjectModal.tsx`
- Create: `app/(dashboard)/profile/[handle]/ProjectsSection.tsx`
- Modify: `app/(dashboard)/profile/[handle]/ProfileClient.tsx`

**Interfaces:**
- Consumes: `GET /api/profile/eligible-highlights`, `POST /api/profile-highlights`, `DELETE /api/profile-highlights/[id]` from Task 3; `highlights` prop from Task 4.
- Produces: `<ProjectsSection highlights={...} isOwn={...} />`, exported `HighlightData` type — consumed by `ProfileClient.tsx` in this task.

- [ ] **Step 1: Create the pin picker modal**

Create `app/(dashboard)/profile/[handle]/PinProjectModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface EligibleItem {
  kind: "project" | "orgProject";
  id: string;
  title: string;
  description?: string | null;
  orgName?: string;
  orgLogoLetter?: string | null;
  orgLogoBg?: string | null;
  orgLogoColor?: string | null;
}

interface Props {
  onClose: () => void;
  onPinned: () => void;
}

export default function PinProjectModal({ onClose, onPinned }: Props) {
  const [items, setItems] = useState<EligibleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile/eligible-highlights")
      .then((r) => r.json())
      .then((data) => setItems([...(data.selfProjects ?? []), ...(data.orgProjects ?? [])]))
      .finally(() => setLoading(false));
  }, []);

  const pin = async (item: EligibleItem) => {
    setPinningId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/profile-highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          item.kind === "project" ? { projectId: item.id } : { orgProjectId: item.id }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to pin");
        return;
      }
      onPinned();
    } finally {
      setPinningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md overflow-hidden flex flex-col"
        style={{ background: "#16161a", border: "1px solid #2a2a33", maxHeight: "80vh", borderRadius: 16 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a33]">
          <h2 className="text-sm font-semibold text-[#e8e8ec]">Pin a project</h2>
          <button onClick={onClose} className="text-[#5a5a6a] hover:text-[#e8e8ec]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-center py-6" style={{ color: "#5a5a6a" }}>Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "#5a5a6a" }}>
              No completed projects available to pin yet.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg"
                style={{ background: "#1e1e24", border: "1px solid #2a2a33" }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#e8e8ec" }}>{item.title}</p>
                  {item.orgName && (
                    <p className="text-xs" style={{ color: "#5a5a6a" }}>{item.orgName}</p>
                  )}
                </div>
                <button
                  onClick={() => pin(item)}
                  disabled={pinningId === item.id}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: "#4a80f0", color: "#0f0f11" }}
                >
                  {pinningId === item.id ? "Pinning…" : "Pin"}
                </button>
              </div>
            ))
          )}
          {error && <p className="text-xs text-[#f87171] px-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the section component**

Create `app/(dashboard)/profile/[handle]/ProjectsSection.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PinProjectModal from "./PinProjectModal";

export interface HighlightData {
  id: string;
  project: { id: string; name: string; description: string | null } | null;
  orgProject: {
    id: string;
    title: string;
    org: { name: string; logoLetter: string | null; logoBg: string | null; logoColor: string | null };
  } | null;
}

interface Props {
  highlights: HighlightData[];
  isOwn: boolean;
}

export default function ProjectsSection({ highlights, isOwn }: Props) {
  const router = useRouter();
  const [pinning, setPinning] = useState(false);
  const [unpinningId, setUnpinningId] = useState<string | null>(null);

  if (highlights.length === 0 && !isOwn) return null;

  const unpin = async (id: string) => {
    setUnpinningId(id);
    try {
      await fetch(`/api/profile-highlights/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setUnpinningId(null);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider">Projects</h2>
        {isOwn && (
          <button
            onClick={() => setPinning(true)}
            className="text-[11px] font-mono px-3 py-1 rounded-full transition-colors"
            style={{ background: "#1e1e24", border: "1px solid #2a2a33", color: "#9898a8" }}
          >
            + Pin a project
          </button>
        )}
      </div>

      {highlights.length === 0 && (
        <div className="rounded-xl p-5 text-center" style={{ background: "#16161a", border: "1px dashed #2a2a33" }}>
          <p className="text-sm" style={{ color: "#5a5a6a" }}>Complete a project to pin it here</p>
        </div>
      )}

      {highlights.length > 0 && (
        <div className="space-y-3">
          {highlights.map((h) => (
            <div key={h.id} className="rounded-xl p-4" style={{ background: "#16161a", border: "1px solid #2a2a33" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {h.orgProject ? (
                    <>
                      <div className="flex items-center gap-2">
                        {h.orgProject.org.logoLetter && (
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{
                              background: h.orgProject.org.logoBg ?? "#0A1E52",
                              color: h.orgProject.org.logoColor ?? "#6A9FFF",
                            }}
                          >
                            {h.orgProject.org.logoLetter}
                          </div>
                        )}
                        <p className="text-sm font-semibold" style={{ color: "#e8e8ec" }}>{h.orgProject.title}</p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "#5a5a6a" }}>{h.orgProject.org.name}</p>
                    </>
                  ) : h.project ? (
                    <>
                      <p className="text-sm font-semibold" style={{ color: "#e8e8ec" }}>{h.project.name}</p>
                      {h.project.description && (
                        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "#9898a8" }}>{h.project.description}</p>
                      )}
                    </>
                  ) : null}
                </div>
                {isOwn && (
                  <button
                    onClick={() => unpin(h.id)}
                    disabled={unpinningId === h.id}
                    className="shrink-0 text-[#5a5a6a] hover:text-[#f87171] text-lg leading-none transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pinning && (
        <PinProjectModal
          onClose={() => setPinning(false)}
          onPinned={() => {
            setPinning(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `ProfileClient.tsx`**

Add the import next to the `AchievementsSection` import added in Task 5:

```typescript
import ProjectsSection, { HighlightData } from "./ProjectsSection";
```

Extend `Props` (from Task 5's version):

```typescript
interface Props {
  profile: ProfileData;
  isOwn: boolean;
  myProfile: ProfileData | null;
  ownReviews?: OwnReview[];
  achievements: AchievementData[];
  highlights: HighlightData[];
}
```

Destructure it:

```typescript
export default function ProfileClient({ profile, isOwn, ownReviews = [], achievements, highlights }: Props) {
```

Render it above `AchievementsSection` (Projects first, then Achievements — both before the Animal Archetypes block):

```tsx
      <ProjectsSection highlights={highlights} isOwn={isOwn} />
      <AchievementsSection achievements={achievements} isOwn={isOwn} />

      {/* Animal Archetypes */}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean — no more missing-prop errors on `ProfileClient`.

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/profile/[handle]/PinProjectModal.tsx" "app/(dashboard)/profile/[handle]/ProjectsSection.tsx" "app/(dashboard)/profile/[handle]/ProfileClient.tsx"
git commit -m "Add Projects section with pin/unpin to profile"
```

---

### Task 7: Remove Animal Archetypes

**Files:**
- Delete: `lib/animalArchetypes.ts`
- Delete: `lib/runArchetypeAnalysis.ts`
- Delete: `app/api/profile/[handle]/analyze-archetype/route.ts`
- Delete: `components/AnimalArchetypeCard.tsx`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260813000100_remove_animal_archetypes/migration.sql`
- Modify: `app/(dashboard)/profile/[handle]/ProfileClient.tsx`
- Modify: `app/(dashboard)/profile/[handle]/page.tsx`
- Modify: `app/api/org-projects/[id]/reviews/route.ts`
- Modify: `app/api/admin/seed-demo-accounts/route.ts`

**Interfaces:** None — this is pure removal, isolated from Tasks 1–6's new code.

- [ ] **Step 1: Delete the dedicated archetype files**

```bash
git rm lib/animalArchetypes.ts lib/runArchetypeAnalysis.ts "app/api/profile/[handle]/analyze-archetype/route.ts" components/AnimalArchetypeCard.tsx
```

- [ ] **Step 2: Drop the schema columns**

In `prisma/schema.prisma`, `model Profile` currently has this block (among its scalar fields):

```prisma
  animalArchetypes    String      @default("[]")
  archetypeAnalysis   String?
  archetypeUpdatedAt  DateTime?
```

Delete those three lines entirely.

- [ ] **Step 3: Write the drop-column migration**

Create `prisma/migrations/20260813000100_remove_animal_archetypes/migration.sql`:

```sql
-- Removed the Animal Archetypes feature entirely — profiles no longer
-- track AI-assigned archetypes; superseded by the Projects/Achievements
-- portfolio sections.

ALTER TABLE "Profile" DROP COLUMN IF EXISTS "animalArchetypes";
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "archetypeAnalysis";
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "archetypeUpdatedAt";
```

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: applies cleanly; `prisma.profile` fields no longer include the three dropped columns.

- [ ] **Step 4: Edit `ProfileClient.tsx`**

Remove the now-dead imports. Currently:

```typescript
import AnimalArchetypeCard from "@/components/AnimalArchetypeCard";
import type { AnimalKey } from "@/lib/animalArchetypes";
```

Delete both lines.

Remove the three fields from the `ProfileData` interface. Currently:

```typescript
  animalArchetypes: string;
  archetypeAnalysis: string | null;
  archetypeUpdatedAt: string | null;
```

Delete those three lines.

Remove the archetype state. Currently:

```typescript
  const [analyzingArchetype, setAnalyzingArchetype] = useState(false);
  const [archetypeError, setArchetypeError] = useState<string | null>(null);
  const [archetypes, setArchetypes] = useState<AnimalKey[]>(() => {
    try { return JSON.parse(profile.animalArchetypes ?? "[]"); } catch { return []; }
  });
  const [archetypeAnalysis, setArchetypeAnalysis] = useState<string | null>(profile.archetypeAnalysis);
```

Delete those five lines (the `[linkCopied, setLinkCopied]` state and `giveLink` logic right after them stays — only delete the archetype-specific lines above).

Remove the `analyzeArchetype` function. Currently:

```typescript
  const analyzeArchetype = async () => {
    if (!profile.handle) return;
    setAnalyzingArchetype(true);
    setArchetypeError(null);
    try {
      const res = await fetch(`/api/profile/${profile.handle}/analyze-archetype`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setArchetypeError(data.error ?? "Analysis failed");
        return;
      }
      setArchetypes(data.archetypes);
      setArchetypeAnalysis(data.analysis);
    } finally {
      setAnalyzingArchetype(false);
    }
  };
```

Delete the entire function.

Remove the Animal Archetypes JSX block. It starts with the `{/* Animal Archetypes */}` comment (which Tasks 5/6 left in place as a marker, immediately after `<AchievementsSection ... />`) and runs through its matching closing `)}` — the whole block reads:

```tsx
      {/* Animal Archetypes */}
      {(archetypes.length > 0 || isOwn) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#5a6a7a" }}>
              Animal Archetypes
            </h2>
            {isOwn && ownReviews.length >= 3 && (
              <button
                onClick={analyzeArchetype}
                disabled={analyzingArchetype}
                className="text-[11px] font-mono px-3 py-1 rounded-full transition-all"
                style={{
                  background: analyzingArchetype ? "#1a2030" : "#0A1628",
                  border: "1px solid #1E3A5A",
                  color: analyzingArchetype ? "#4a6a8a" : "#4A90D4",
                  cursor: analyzingArchetype ? "not-allowed" : "pointer",
                }}
              >
                {analyzingArchetype
                  ? "Analyzing…"
                  : archetypes.length > 0
                  ? "Re-analyze"
                  : "Analyze now"}
              </button>
            )}
          </div>

          {archetypeError && (
            <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: "#E87070", background: "#200A0A", border: "1px solid #3A1010" }}>
              {archetypeError}
            </p>
          )}

          {archetypes.length > 0 ? (
            <div>
              <div className="flex gap-3 flex-wrap">
                {archetypes.map((key) => (
                  <AnimalArchetypeCard key={key} animalKey={key} />
                ))}
              </div>
              {archetypeAnalysis && (
                <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: "#0A1020", border: "1px solid #1E2A3A" }}>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "#3A5A7A" }}>
                    AI Analysis
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "#6888a8" }}>{archetypeAnalysis}</p>
                </div>
              )}
            </div>
          ) : isOwn ? (
            <div
              className="rounded-xl p-5 text-center"
              style={{ background: "#060C14", border: "1px dashed #1E2A3A" }}
            >
              <div className="text-2xl mb-2">🦍 🐯 🦁</div>
              <p className="text-sm font-medium mb-1" style={{ color: "#4A6A8A" }}>
                Your animal archetypes haven&apos;t been discovered yet
              </p>
              <p className="text-xs" style={{ color: "#2A4060" }}>
                {ownReviews.length >= 3
                  ? "You have enough reviews — your archetypes will be assigned automatically, or click \"Analyze now\" above."
                  : `Archetypes unlock after ${3 - ownReviews.length} more detailed org review${3 - ownReviews.length === 1 ? "" : "s"} (240+ words each). They're assigned automatically when you hit 3.`}
              </p>
            </div>
          ) : null}
        </div>
      )}
```

Delete the entire block, including the leading `{/* Animal Archetypes */}` comment.

- [ ] **Step 5: Edit `page.tsx`**

Remove `archetypeUpdatedAt`, `archetypeAnalysis`, `animalArchetypes` from both `select` blocks (the viewed-profile query and the `myProfile` query) in `app/(dashboard)/profile/[handle]/page.tsx`. Each currently includes:

```typescript
        animalArchetypes: true,
        archetypeAnalysis: true,
        archetypeUpdatedAt: true,
```

Delete those three lines from both occurrences.

Then simplify the `<ProfileClient>` call (from Task 4's version):

```typescript
  return (
    <ProfileClient
      profile={{
        ...profile,
        archetypeUpdatedAt: profile.archetypeUpdatedAt?.toISOString() ?? null,
      }}
      isOwn={!!isOwnProfile}
      myProfile={myProfile ? { ...myProfile, archetypeUpdatedAt: myProfile.archetypeUpdatedAt?.toISOString() ?? null } : null}
      ownReviews={ownReviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      achievements={profile.achievements.map((a) => ({
        ...a,
        achievedAt: a.achievedAt?.toISOString() ?? null,
      }))}
      highlights={profile.highlights}
    />
  );
```

Change to:

```typescript
  return (
    <ProfileClient
      profile={profile}
      isOwn={!!isOwnProfile}
      myProfile={myProfile}
      ownReviews={ownReviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      achievements={profile.achievements.map((a) => ({
        ...a,
        achievedAt: a.achievedAt?.toISOString() ?? null,
      }))}
      highlights={profile.highlights}
    />
  );
```

- [ ] **Step 6: Edit `app/api/org-projects/[id]/reviews/route.ts`**

Remove the import. Currently:

```typescript
import { runArchetypeAnalysis, ARCHETYPE_MIN_REVIEWS, ARCHETYPE_MIN_WORDS } from "@/lib/runArchetypeAnalysis";
```

Delete this line entirely.

Remove the auto-trigger block. Currently, after the review-creation loop:

```typescript
  // Auto-trigger archetype analysis for students who now have 3+ qualifying reviews
  for (const profileId of profilesToCheck) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: {
          animalArchetypes: true,
          orgReviews: { select: { body: true } },
        },
      });
      if (!profile) continue;

      const alreadyHasArchetypes = (() => {
        try { return JSON.parse(profile.animalArchetypes ?? "[]").length > 0; } catch { return false; }
      })();

      if (alreadyHasArchetypes) continue;

      const qualifyingCount = profile.orgReviews.filter(
        (r) => wordCount(r.body) >= ARCHETYPE_MIN_WORDS
      ).length;

      if (qualifyingCount >= ARCHETYPE_MIN_REVIEWS) {
        await runArchetypeAnalysis(profileId);
      }
    } catch {
      // Non-fatal: archetype analysis failure shouldn't block the review response
    }
  }

  return NextResponse.json({ created });
```

Change to:

```typescript
  return NextResponse.json({ created });
```

`profilesToCheck` becomes unused — also delete its declaration (`const profilesToCheck = new Set<string>();`) and the line inside the earlier loop that populated it (`profilesToCheck.add(r.profileId);`). The `wordCount` helper stays — it's still used earlier in the file to validate review length. `ARCHETYPE_MIN_WORDS` is no longer available after removing the import; the earlier validation loop uses it too:

```typescript
  for (const r of reviews) {
    const wc = wordCount(r.body ?? "");
    if (wc < ARCHETYPE_MIN_WORDS)
      return NextResponse.json(
        { error: `Review must be at least ${ARCHETYPE_MIN_WORDS} words (got ${wc})` },
        { status: 400 }
      );
  }
```

Replace `ARCHETYPE_MIN_WORDS` here with a local constant so this validation keeps working without the deleted import. Add near the top of the file, alongside `wordCount`:

```typescript
const MIN_REVIEW_WORDS = 240;
```

And update the validation loop to use it:

```typescript
  for (const r of reviews) {
    const wc = wordCount(r.body ?? "");
    if (wc < MIN_REVIEW_WORDS)
      return NextResponse.json(
        { error: `Review must be at least ${MIN_REVIEW_WORDS} words (got ${wc})` },
        { status: 400 }
      );
  }
```

(240 is the same value `ARCHETYPE_MIN_WORDS` held in the deleted `lib/runArchetypeAnalysis.ts` — the minimum-review-length rule is a review-quality rule independent of archetypes, so it's preserved here rather than dropped.)

- [ ] **Step 7: Edit `app/api/admin/seed-demo-accounts/route.ts`**

Remove the three archetype fields from each of the four seeded profiles (Thomas, Diego, Aiko, Jordan). For Thomas, currently:

```typescript
        onboardingComplete: true,
        animalArchetypes: JSON.stringify(["shark", "lion"]),
        archetypeAnalysis:
          "Thomas leads like a Lion — he walks into rooms and gravity shifts without him trying. But what makes him rare is the Shark underneath: while the team sleeps, he's running another thread. Margaret Chen at Sunset Pines noted he was still fixing audio sync bugs at midnight before the final playtest. That's not grind culture — that's someone who physically cannot stop until the thing is right.",
        archetypeUpdatedAt: new Date("2026-08-31T00:00:00Z"),
        interests: JSON.stringify(["Game Development", "Product Design", "Social Impact", "Venture"]),
```

Change to:

```typescript
        onboardingComplete: true,
        interests: JSON.stringify(["Game Development", "Product Design", "Social Impact", "Venture"]),
```

For Diego, currently:

```typescript
        onboardingComplete: true,
        animalArchetypes: JSON.stringify(["cheetah", "wolf"]),
        archetypeAnalysis:
          "Diego is a Cheetah in the purest sense — the first working build of the game was his, shipped before the team had finished planning. But what makes him more than a sprinter is the Wolf: he consistently brought the team along, made sure no one was left debugging alone, and his Friday updates kept morale high through the weeks where nothing was working.",
        archetypeUpdatedAt: new Date("2026-08-31T00:00:00Z"),
        interests: JSON.stringify(["Full-Stack Development", "Game Development", "UX Engineering", "Open Source"]),
```

Change to:

```typescript
        onboardingComplete: true,
        interests: JSON.stringify(["Full-Stack Development", "Game Development", "UX Engineering", "Open Source"]),
```

For Aiko, currently:

```typescript
        onboardingComplete: true,
        animalArchetypes: JSON.stringify(["owl", "tiger"]),
        archetypeAnalysis:
          "Aiko is the Owl on every team she joins — slow to act, devastating in output. She spent three weeks observing the veterans before touching a design tool. That's the Tiger too: patience that looked like inertia until week four, when she shipped a UI system nobody could have built without that foundation.",
        archetypeUpdatedAt: new Date("2026-08-31T00:00:00Z"),
        interests: JSON.stringify(["UX Design", "Accessibility", "User Research", "Human-Computer Interaction"]),
```

Change to:

```typescript
        onboardingComplete: true,
        interests: JSON.stringify(["UX Design", "Accessibility", "User Research", "Human-Computer Interaction"]),
```

For Jordan, currently:

```typescript
        onboardingComplete: true,
        animalArchetypes: JSON.stringify(["gorilla", "cheetah"]),
        archetypeAnalysis:
          "Jordan is textbook Gorilla — he took the hardest piece of the project (real-time multiplayer for 6+ concurrent players) and didn't surface for 10 days. What came out was complete, tested, and faster than anything the team expected. The Cheetah shows in his velocity once scope is clear: he understands the brief, then disappears and ships.",
        archetypeUpdatedAt: new Date("2026-08-31T00:00:00Z"),
        interests: JSON.stringify(["Systems Engineering", "Game Development", "Networking", "Low-Level Programming"]),
```

Change to:

```typescript
        onboardingComplete: true,
        interests: JSON.stringify(["Systems Engineering", "Game Development", "Networking", "Low-Level Programming"]),
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit`
Expected: clean — no references to `animalArchetypes`, `archetypeAnalysis`, `archetypeUpdatedAt`, `AnimalKey`, `AnimalArchetypeCard`, or `runArchetypeAnalysis` anywhere.

Run: `npm run lint`
Expected: clean (also confirms `profilesToCheck`, `analyzingArchetype`, etc. aren't left as unused variables).

Run: `git grep -n "animalArchetypes\|archetypeAnalysis\|archetypeUpdatedAt\|AnimalArchetypeCard\|runArchetypeAnalysis\|AnimalKey" -- ':!.claude'`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Remove Animal Archetypes feature"
```

---

### Task 8: End-to-end manual QA

**Files:** None (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Achievements flow**

Log in as `student@nivarro.demo` / `demo2026` (or any demo scholar). Go to your own profile (`/profile/<your-handle>`).
- Confirm the Animal Archetypes section is gone and there are no console errors.
- Click "+ Add achievement", fill in a title only (leave description/date/link blank), submit. Confirm it appears in the list immediately (via `router.refresh()`).
- Add a second achievement with all fields filled, including a link. Confirm the date renders as "Mon YYYY" and the link opens in a new tab.
- Delete one achievement via the × button. Confirm it disappears.
- Open the same profile URL in an incognito/logged-out window (or log in as a different demo account). Confirm the Achievements section still shows the remaining entries (public visibility) but with no "+ Add"/delete controls.

- [ ] **Step 3: Projects (pin) flow**

Log in as `thomas@piacentine.dev` (seeded with a completed "Studio 18 / Veterans Game Studio" project — see `app/api/admin/seed-demo-accounts/route.ts`). If demo data needs (re)seeding, `POST /api/admin/seed-demo-accounts?secret=niv-reset-2026` first.
- Go to your own profile. Click "+ Pin a project". Confirm the picker lists the completed Veterans Game Studio project (org-run) and confirm the picker correctly excludes anything already pinned or not completed.
- Pin it. Confirm it appears in the Projects section with the org name/logo.
- Unpin it via the × button. Confirm it disappears and re-appears in the picker if reopened.
- View the profile as a different/logged-out viewer. Confirm any pinned projects are visible without pin/unpin controls.

- [ ] **Step 4: Confirm the review-submission path still works**

As an org admin (e.g. `ridgepoint@nivarro.demo` / `ridgepoint2026`), submit a new OrgReview of 240+ words for a scholar via the existing review flow. Confirm it saves successfully (this exercises the edited `app/api/org-projects/[id]/reviews/route.ts` — specifically that the word-count validation still works after the `ARCHETYPE_MIN_WORDS` import was replaced with the local `MIN_REVIEW_WORDS` constant, and that removing the archetype auto-trigger didn't break review creation).

- [ ] **Step 5: Final check**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean, confirming the whole feature branch compiles and lints with no leftover issues from any task.
