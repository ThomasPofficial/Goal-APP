# Nivarro Hackathon Night 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the complete student acceptance loop, real Save button, web scraper, DB cleanup, and full UI polish in one overnight session.

**Architecture:** Manual SQL migrations in `prisma/migrations/` (scripts/start.js runs `prisma migrate deploy`). Two new migrations tonight: SavedOrg (small, first) and OrgProject rich fields (large, second, includes rename of `status` → `listingStatus`). Web scraper lives at `/api/admin/scraper/run` triggered by a Render cron HTTP call — no separate service. Auth signout only via `lib/auth-actions.ts` server action.

**Tech Stack:** Next.js 15 App Router, Prisma ORM, PostgreSQL on Render, NextAuth v5 JWT, Resend for email, @anthropic-ai/sdk (already installed), cheerio (install today), Tailwind CSS v4.

---

## Task 1: Font Fix

**Files:**
- Modify: `app/globals.css` (typography section, ~line 101)

The problem: `h1/h2/h3/h4` all use `var(--font-display)` = Plus Jakarta Sans at weight 800, which users report "hurts." The serif variable `--font-serif` = Cormorant Garamond is already loaded in `app/layout.tsx` but unused. Fix: switch h1/h2 to serif for the MI6/Harvard aesthetic, keep h3/h4 as display for hierarchy, switch status pills everywhere to font-mono.

- [ ] **Step 1: Update typography section in globals.css**

Find the TYPOGRAPHY block (~line 101) and replace it:

```css
/* ─────────────────────────────────────────
   TYPOGRAPHY
───────────────────────────────────────── */

h1, h2 {
  font-family: var(--font-serif);
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: var(--text);
  margin: 0;
  font-style: normal;
}

h3, h4 {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--text);
  margin: 0;
}

h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); }
h2 { font-size: clamp(1.3rem, 3vw, 1.8rem); }
h3 { font-size: clamp(1.05rem, 2vw, 1.25rem); }

p { line-height: 1.65; margin: 0; }
```

- [ ] **Step 2: Verify font loads**

Run `npm run dev` in the Goal-APP directory. Open http://localhost:3000/dashboard. The main headings ("Dashboard", "Notifications", "My Teams") should now render in Cormorant Garamond (a refined serif) rather than Plus Jakarta Sans. Body text stays Plus Jakarta Sans.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "fix: switch h1/h2 headings to Cormorant Garamond serif — user feedback font hurts"
```

---

## Task 2: Remove Fake Demo Accounts from Database

**Files:**
- Create: `app/api/admin/cleanup-demo-data/route.ts`

The secondary demo accounts (elena/james/amara/noah/maya@nivarro.demo, org@nivarro.demo, student@nivarro.demo) are test artifacts. Keep: ridgepoint@nivarro.demo, priya/marcus/zoe@nivarro.io, alex@nivarro.test. The Profile model has `onDelete: Cascade` on User, so deleting the User cascades to Profile, OrgReview, TeamMember, RecruitmentRequest, etc.

- [ ] **Step 1: Create the cleanup route**

```typescript
// app/api/admin/cleanup-demo-data/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const FAKE_EMAILS = [
  "elena@nivarro.demo",
  "james@nivarro.demo",
  "amara@nivarro.demo",
  "noah@nivarro.demo",
  "maya@nivarro.demo",
  "org@nivarro.demo",
  "student@nivarro.demo",
];

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: Record<string, string> = {};

  for (const email of FAKE_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) { results[email] = "not found"; continue; }

    // Delete any Org created by this user first (not cascade from User)
    await prisma.org.deleteMany({ where: { createdById: user.id } });

    // Delete the user — Profile + all relations cascade
    await prisma.user.delete({ where: { id: user.id } });
    results[email] = "deleted";
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Test locally**

With dev server running, POST to `http://localhost:3000/api/admin/cleanup-demo-data?secret=niv-reset-2026`. Response should show each email as "deleted" or "not found".

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/cleanup-demo-data/route.ts
git commit -m "feat: add cleanup-demo-data endpoint to remove fake demo accounts"
```

---

## Task 3: SavedOrg SQL Migration + Schema

**Files:**
- Create: `prisma/migrations/20260613_add_saved_org/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write migration SQL**

```sql
-- prisma/migrations/20260613_add_saved_org/migration.sql
CREATE TABLE "SavedOrg" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedOrg_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SavedOrg_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SavedOrg_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SavedOrg_profileId_orgId_key" ON "SavedOrg"("profileId", "orgId");
```

- [ ] **Step 2: Add SavedOrg model to schema.prisma**

Find the Profile model and add `savedOrgs SavedOrg[]` to its relations. Find the Org model and add `savedByProfiles SavedOrg[]`. Then add the model definition. Add this block near the SavedOpportunity model:

```prisma
model SavedOrg {
  id        String   @id @default(cuid())
  profileId String
  orgId     String
  createdAt DateTime @default(now())

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  org     Org     @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([profileId, orgId])
}
```

In the Profile model, add:
```prisma
savedOrgs     SavedOrg[]
```

In the Org model, add:
```prisma
savedByProfiles SavedOrg[]
```

- [ ] **Step 3: Run prisma generate to update client**

```bash
cd "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP" && npx prisma generate
```

Expected: "Generated Prisma Client"

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260613_add_saved_org/migration.sql prisma/schema.prisma
git commit -m "feat: add SavedOrg model — SQL migration + schema"
```

---

## Task 4: OrgProject Rich Fields Migration + Status Rename

**Files:**
- Create: `prisma/migrations/20260613_add_rich_listing_fields/migration.sql`
- Modify: `prisma/schema.prisma`
- Modify: `app/api/org-projects/[id]/apply-with-team/route.ts` (line 31)
- Modify: `app/api/org-projects/[id]/route.ts` (line 22)
- Modify: `app/api/workflow/route.ts` (line 59)
- Modify: `app/(dashboard)/orgs/OrgsClient.tsx` (filter logic)

The existing `status` column is an enum (`OrgProjectStatus`: OPEN/CLOSED/FILLED). We are replacing it with a TEXT column `listingStatus` (DRAFT/OPEN/CLOSED/ARCHIVED) and dropping the enum.

- [ ] **Step 1: Write migration SQL**

```sql
-- prisma/migrations/20260613_add_rich_listing_fields/migration.sql

-- Add new listingStatus column (TEXT, not enum)
ALTER TABLE "OrgProject" ADD COLUMN "listingStatus" TEXT NOT NULL DEFAULT 'OPEN';

-- Copy existing data: OPEN→OPEN, CLOSED→CLOSED, FILLED→CLOSED
UPDATE "OrgProject" SET "listingStatus" = 
  CASE 
    WHEN status = 'OPEN' THEN 'OPEN'
    WHEN status = 'CLOSED' THEN 'CLOSED'
    WHEN status = 'FILLED' THEN 'CLOSED'
    ELSE 'OPEN'
  END;

-- Drop old status column
ALTER TABLE "OrgProject" DROP COLUMN "status";

-- Drop the enum (only after column is dropped)
DROP TYPE IF EXISTS "OrgProjectStatus";

-- Add all new rich fields
ALTER TABLE "OrgProject"
  ADD COLUMN "locationCity" TEXT,
  ADD COLUMN "locationRequired" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "locationRadius" INTEGER,
  ADD COLUMN "budgetTotal" INTEGER,
  ADD COLUMN "budgetNotes" TEXT,
  ADD COLUMN "toolingStipend" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "toolingAmount" INTEGER,
  ADD COLUMN "gradeEligibility" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "advisorRequired" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "applicationMode" TEXT NOT NULL DEFAULT 'TEAM',
  ADD COLUMN "appMaterials" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "storyBody" TEXT,
  ADD COLUMN "impactStatement" TEXT,
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactRole" TEXT,
  ADD COLUMN "studentOutcomes" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "dayInLife" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "priorTestimonial" TEXT,
  ADD COLUMN "mediaUrls" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "acceptanceRate" DOUBLE PRECISION,
  ADD COLUMN "responseTimeDays" INTEGER,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "lastEditedAt" TIMESTAMP(3);
```

- [ ] **Step 2: Update prisma/schema.prisma — OrgProject model**

Remove `status OrgProjectStatus @default(OPEN)` and the `enum OrgProjectStatus` block. Add all new fields. The OrgProject model should now have:

```prisma
model OrgProject {
  id                   String    @id @default(cuid())
  orgId                String
  title                String
  description          String?
  shortDescription     String?
  fullDescription      String?
  openSpots            Int       @default(1)
  requiredSkills       String    @default("[]")
  preferredGeniusTypes String    @default("[]")
  roles                String    @default("[]")
  hoursPerWeek         String?
  duration             String?
  format               String?
  progressPercent      Int       @default(0)
  deadline             DateTime?
  listingStatus        String    @default("OPEN")
  closedAt             DateTime?
  outcomeNote          String?
  createdAt            DateTime  @default(now())

  // Rich listing fields
  locationCity         String?
  locationRequired     String    @default("NONE")
  locationRadius       Int?
  budgetTotal          Int?
  budgetNotes          String?
  toolingStipend       Boolean   @default(false)
  toolingAmount        Int?
  gradeEligibility     String    @default("[]")
  advisorRequired      String    @default("NONE")
  applicationMode      String    @default("TEAM")
  appMaterials         String    @default("[]")
  storyBody            String?
  impactStatement      String?
  contactName          String?
  contactRole          String?
  studentOutcomes      String    @default("[]")
  dayInLife            String    @default("[]")
  priorTestimonial     String?
  mediaUrls            String    @default("[]")
  acceptanceRate       Float?
  responseTimeDays     Int?
  publishedAt          DateTime?
  lastEditedAt         DateTime?

  org          Org              @relation(fields: [orgId], references: [id], onDelete: Cascade)
  applications TeamApplication[]
  reviews      OrgReview[]
  recruitments RecruitmentRequest[]
}
```

Remove the `enum OrgProjectStatus` block entirely.

- [ ] **Step 3: Fix apply-with-team route**

In `app/api/org-projects/[id]/apply-with-team/route.ts` line 31, change:
```typescript
if (orgProject.status !== "OPEN") return NextResponse.json({ error: "Project closed" }, { status: 409 });
```
to:
```typescript
if (orgProject.listingStatus !== "OPEN") return NextResponse.json({ error: "Project closed" }, { status: 409 });
```
Also update the select to include `listingStatus` instead of `status`.

- [ ] **Step 4: Fix org-projects route**

In `app/api/org-projects/[id]/route.ts` line 22, change:
```typescript
if (status === "CLOSED") { data.status = "CLOSED"; data.closedAt = new Date(); }
```
to:
```typescript
if (status === "CLOSED") { data.listingStatus = "CLOSED"; data.closedAt = new Date(); }
```

- [ ] **Step 5: Fix workflow route**

In `app/api/workflow/route.ts` line 59, change:
```typescript
if (project.status !== "OPEN") return NextResponse.json({ error: "Project is not open" }, { status: 409 });
```
to:
```typescript
if (project.listingStatus !== "OPEN") return NextResponse.json({ error: "Project is not open" }, { status: 409 });
```

- [ ] **Step 6: Fix OrgsClient.tsx status references**

In `app/(dashboard)/orgs/OrgsClient.tsx`, find all `org.status` references and change to `org.listingStatus`. The filter and badge logic currently compares against "OPEN" and "ROLLING" — update accordingly.

- [ ] **Step 7: Grep for any remaining status references on OrgProject**

```bash
grep -rn "\.status\b" "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP/app" --include="*.ts" --include="*.tsx" | grep -v "node_modules\|\.next\|TeamApplication\|Team\b\|User\|Org\b\|Recruitment\|WorkflowSession\|Project\b[^I]" | head -30
```

Fix any remaining references to OrgProject.status that the above grep surfaces.

- [ ] **Step 8: Run prisma generate**

```bash
cd "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP" && npx prisma generate
```

- [ ] **Step 9: Commit**

```bash
git add prisma/migrations/20260613_add_rich_listing_fields/migration.sql prisma/schema.prisma app/api/org-projects app/api/workflow app/(dashboard)/orgs/OrgsClient.tsx
git commit -m "feat: add rich listing fields to OrgProject, rename status to listingStatus"
```

---

## Task 5: Notification Loop — Accept Flips Team Status

**Files:**
- Modify: `app/api/applications/[id]/route.ts`

The OrgDetailClient calls `PATCH /api/applications/[id]` on accept/reject. Currently this route only updates `TeamApplication.status`. It needs to also flip `Team.status = "ACCEPTED"` so the student's Teams page can show the accepted state.

Note: `/api/team-applications/[id]` already does this — but OrgDetailClient uses `/api/applications/[id]`, so that's the one to fix.

- [ ] **Step 1: Update the PATCH handler**

Replace the entire file:

```typescript
// app/api/applications/[id]/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (!["ACCEPTED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const application = await prisma.teamApplication.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      status: true,
      orgProject: { select: { org: { select: { createdById: true } } } },
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (application.orgProject.org.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (application.status !== "PENDING") {
    return NextResponse.json({ error: "Already decided" }, { status: 409 });
  }

  const updated = await prisma.teamApplication.update({
    where: { id },
    data: { status, decidedAt: new Date() },
  });

  // Flip team status to ACCEPTED so students see it in notifications + Teams page
  if (status === "ACCEPTED") {
    await prisma.team.update({
      where: { id: application.teamId },
      data: { status: "ACCEPTED" },
    });
  }

  return NextResponse.json(updated);
}
```

- [ ] **Step 2: Verify**

In dev, accept a team application as an org user. Then check `prisma studio` or a DB query that the team's status is now ACCEPTED.

- [ ] **Step 3: Commit**

```bash
git add "app/api/applications/[id]/route.ts"
git commit -m "feat: flip team.status=ACCEPTED when org accepts application"
```

---

## Task 6: Notifications Page — Show Acceptance/Rejection Events

**Files:**
- Modify: `app/(dashboard)/notifications/page.tsx`
- Modify: `app/(dashboard)/notifications/NotificationsClient.tsx`

Currently the notifications page only shows `RecruitmentRequest` items. Students have no way to see that their team was accepted or rejected. We add a second data source: `TeamApplication` records for teams the student is a member of.

- [ ] **Step 1: Update the server page to fetch both data sources**

Replace `app/(dashboard)/notifications/page.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const [requests, applications] = await Promise.all([
    myProfile
      ? prisma.recruitmentRequest.findMany({
          where: { toProfileId: myProfile.id },
          include: {
            orgProject: {
              select: {
                id: true, title: true, orgId: true,
                org: { select: { id: true, name: true } },
              },
            },
            fromProfile: {
              select: { id: true, displayName: true, avatarUrl: true, geniusType: true, handle: true },
            },
            team: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),

    myProfile
      ? prisma.teamApplication.findMany({
          where: {
            status: { not: "PENDING" },
            team: { members: { some: { profileId: myProfile.id } } },
          },
          include: {
            team: { select: { id: true, name: true } },
            orgProject: {
              select: {
                id: true, title: true, orgId: true,
                org: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { decidedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <NotificationsClient
      requests={requests.map((r) => ({
        ...r,
        type: "recruitment" as const,
        sortDate: r.createdAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        fromProfile: {
          ...r.fromProfile,
          geniusType: r.fromProfile.geniusType as string | null,
        },
      }))}
      applications={applications.map((a) => ({
        id: a.id,
        type: "decision" as const,
        status: a.status,
        sortDate: (a.decidedAt ?? a.team.members ? new Date() : new Date()).toISOString(),
        decidedAt: a.decidedAt?.toISOString() ?? null,
        team: a.team,
        orgProject: a.orgProject,
      }))}
    />
  );
}
```

- [ ] **Step 2: Update NotificationsClient to render both types**

Replace `app/(dashboard)/notifications/NotificationsClient.tsx`:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

interface RecruitmentItem {
  id: string;
  type: "recruitment";
  status: string;
  sortDate: string;
  message: string | null;
  createdAt: string;
  orgProject: { id: string; title: string; orgId: string; org: { id: string; name: string } };
  fromProfile: { id: string; displayName: string; avatarUrl: string | null; geniusType: string | null; handle: string | null };
  team: { id: string; name: string };
}

interface DecisionItem {
  id: string;
  type: "decision";
  status: string;
  sortDate: string;
  decidedAt: string | null;
  team: { id: string; name: string };
  orgProject: { id: string; title: string; orgId: string; org: { id: string; name: string } };
}

type NotifItem = RecruitmentItem | DecisionItem;

export default function NotificationsClient({
  requests,
  applications,
}: {
  requests: RecruitmentItem[];
  applications: DecisionItem[];
}) {
  const [recruitStatuses, setRecruitStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(requests.map((r) => [r.id, r.status]))
  );

  const respond = async (id: string, status: "ACCEPTED" | "DECLINED") => {
    setRecruitStatuses((prev) => ({ ...prev, [id]: status }));
    await fetch(`/api/recruitment-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  // Merge and sort all items by date descending
  const allItems: NotifItem[] = [
    ...requests.map((r) => ({ ...r, status: recruitStatuses[r.id] ?? r.status })),
    ...applications,
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

  const pending = allItems.filter((i) => i.type === "recruitment" && i.status === "PENDING");
  const earlier = allItems.filter((i) => !(i.type === "recruitment" && i.status === "PENDING"));

  if (allItems.length === 0) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl font-medium">Notifications</h1>
        <div className="text-center py-16 space-y-2">
          <p className="text-sm" style={{ color: "var(--muted)" }}>No notifications yet.</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Acceptances, invitations, and decisions show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl font-medium">Notifications</h1>

      {pending.length > 0 && (
        <div>
          <p className="text-xs font-mono font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
            PENDING · {pending.length}
          </p>
          <div className="space-y-3">
            {pending.map((item) =>
              item.type === "recruitment" ? (
                <RecruitCard key={item.id} req={item} status={recruitStatuses[item.id]} onRespond={respond} />
              ) : null
            )}
          </div>
        </div>
      )}

      {earlier.length > 0 && (
        <div>
          <p className="text-xs font-mono font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
            EARLIER
          </p>
          <div className="space-y-3">
            {earlier.map((item) =>
              item.type === "recruitment" ? (
                <RecruitCard key={item.id} req={item} status={recruitStatuses[item.id]} onRespond={respond} />
              ) : (
                <DecisionCard key={item.id} item={item} />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DecisionCard({ item }: { item: DecisionItem }) {
  const accepted = item.status === "ACCEPTED";
  return (
    <div
      className={cn(
        "border p-4 transition-opacity",
        accepted
          ? "border-emerald-800/40"
          : "border-red-900/30 opacity-70"
      )}
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
          accepted ? "bg-emerald-400" : "bg-red-500"
        )} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {accepted ? "Your team was accepted" : "Application not accepted"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
            <Link href={`/teams/${item.team.id}`} className="hover:underline" style={{ color: "var(--blue)" }}>
              {item.team.name}
            </Link>
            {" · "}
            <Link
              href={`/orgs/${item.orgProject.orgId}/projects/${item.orgProject.id}`}
              className="hover:underline"
              style={{ color: "var(--text2)" }}
            >
              {item.orgProject.title}
            </Link>
            {" · "}
            {item.orgProject.org.name}
          </p>
          {item.decidedAt && (
            <p className="text-xs mt-1 font-mono" style={{ color: "var(--muted)" }}>
              {formatDistanceToNow(new Date(item.decidedAt), { addSuffix: true })}
            </p>
          )}
        </div>
        <span className={cn(
          "text-xs font-mono uppercase tracking-widest px-2 py-0.5 flex-shrink-0",
          accepted ? "text-emerald-400" : "text-red-400"
        )}>
          {accepted ? "ACCEPTED" : "REJECTED"}
        </span>
      </div>
    </div>
  );
}

function RecruitCard({
  req, status, onRespond,
}: {
  req: RecruitmentItem;
  status: string;
  onRespond: (id: string, s: "ACCEPTED" | "DECLINED") => void;
}) {
  return (
    <div className={cn(
      "border p-4 transition-opacity",
      status === "PENDING"
        ? "border-[rgba(74,128,240,0.28)]"
        : "border-[rgba(74,128,240,0.12)] opacity-60"
    )} style={{ background: "var(--surface)" }}>
      <div className="flex items-start gap-3">
        <Avatar
          src={req.fromProfile.avatarUrl}
          name={req.fromProfile.displayName}
          geniusType={req.fromProfile.geniusType as GeniusTypeKey | null}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${req.fromProfile.handle ?? req.fromProfile.id}`}
              className="font-medium text-sm hover:underline"
              style={{ color: "var(--text)" }}
            >
              {req.fromProfile.displayName}
            </Link>
            {req.fromProfile.geniusType && (
              <GeniusTypeBadge type={req.fromProfile.geniusType as GeniusTypeKey} size="sm" />
            )}
            <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
              {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
            Invited you to join{" "}
            <Link href={`/teams/${req.team.id}`} className="hover:underline" style={{ color: "var(--blue)" }}>
              {req.team.name}
            </Link>
            {" for "}
            <Link
              href={`/orgs/${req.orgProject.orgId}/projects/${req.orgProject.id}`}
              className="hover:underline"
              style={{ color: "var(--blue)" }}
            >
              {req.orgProject.title}
            </Link>
            {" · "}
            {req.orgProject.org.name}
          </p>
          {req.message && (
            <p className="text-xs mt-1.5 italic px-3 py-2" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
              &ldquo;{req.message}&rdquo;
            </p>
          )}
          {status === "PENDING" ? (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onRespond(req.id, "ACCEPTED")}
                className="btn-primary px-4 py-1.5 text-xs"
              >
                Accept
              </button>
              <button
                onClick={() => onRespond(req.id, "DECLINED")}
                className="btn-ghost px-4 py-1.5 text-xs"
              >
                Decline
              </button>
            </div>
          ) : (
            <span className="font-mono text-xs uppercase tracking-widest mt-2 inline-block" style={{
              color: status === "ACCEPTED" ? "var(--blue)" : "var(--muted)"
            }}>
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/notifications/page.tsx" "app/(dashboard)/notifications/NotificationsClient.tsx"
git commit -m "feat: show team acceptance/rejection events on notifications page"
```

---

## Task 7: POST /api/orgs/[id]/save Route

**Files:**
- Create: `app/api/orgs/[id]/save/route.ts`

- [ ] **Step 1: Create the save/unsave toggle endpoint**

```typescript
// app/api/orgs/[id]/save/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orgId } = await params;

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const existing = await prisma.savedOrg.findUnique({
    where: { profileId_orgId: { profileId: profile.id, orgId } },
  });

  if (existing) {
    await prisma.savedOrg.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  await prisma.savedOrg.create({ data: { profileId: profile.id, orgId } });
  return NextResponse.json({ saved: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/orgs/[id]/save/route.ts"
git commit -m "feat: POST /api/orgs/[id]/save — toggle SavedOrg"
```

---

## Task 8: Wire Save Button + /saved Page + Dashboard Count

**Files:**
- Modify: `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx` (lines 211, 674-683)
- Modify: `app/(dashboard)/orgs/[orgId]/page.tsx` (add initialSaved prop)
- Modify: `app/(dashboard)/dashboard/page.tsx` (savedCount)
- Modify: `app/(dashboard)/dashboard/DashboardClient.tsx` (savedCount display)
- Create: `app/(dashboard)/saved/page.tsx`

- [ ] **Step 1: Update OrgDetailClient — read initialSaved, wire button**

In `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx`:

Find `const [saved, setSaved] = useState(false);` (line ~211) and change to:
```typescript
const [saved, setSaved] = useState(initialSaved);
```

Add `initialSaved: boolean` to the component props interface.

Find the Save button click handler (line ~674):
```typescript
onClick={() => setSaved((s) => !s)}
```
Replace with:
```typescript
onClick={async () => {
  const res = await fetch(`/api/orgs/${orgId}/save`, { method: "POST" });
  const data = await res.json();
  setSaved(data.saved);
}}
```

- [ ] **Step 2: Update org detail page.tsx to pass initialSaved**

In `app/(dashboard)/orgs/[orgId]/page.tsx`, add a query for whether the current user has saved this org, and pass it to OrgDetailClient:

```typescript
// After session check, before rendering OrgDetailClient:
const myProfile = await prisma.profile.findUnique({
  where: { userId: session.user.id },
  select: { id: true },
});

const initialSaved = myProfile
  ? !!(await prisma.savedOrg.findUnique({
      where: { profileId_orgId: { profileId: myProfile.id, orgId } },
    }))
  : false;
```

Then pass `initialSaved={initialSaved}` to `<OrgDetailClient />`.

- [ ] **Step 3: Update dashboard page.tsx savedCount**

In `app/(dashboard)/dashboard/page.tsx`, find where `savedOpportunities` is queried in the profile select. Add `savedOrgs` to the same profile query:

```typescript
savedOrgs: { select: { id: true } },
savedOpportunities: { select: { id: true } },
```

Then compute the count as:
```typescript
const savedCount = (profile?.savedOrgs?.length ?? 0) + (profile?.savedOpportunities?.length ?? 0);
```

Pass `savedCount` to `<DashboardClient savedCount={savedCount} />` and update DashboardClient to make "Saved: N" a link to `/saved`.

- [ ] **Step 4: Create /saved page**

```typescript
// app/(dashboard)/saved/page.tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SavedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const savedOrgs = profile
    ? await prisma.savedOrg.findMany({
        where: { profileId: profile.id },
        include: {
          org: {
            select: {
              id: true,
              name: true,
              tagline: true,
              logoUrl: true,
              orgProjects: {
                where: { listingStatus: "OPEN" },
                select: { id: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>Saved</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {savedOrgs.length} saved org{savedOrgs.length !== 1 ? "s" : ""}
        </p>
      </div>

      {savedOrgs.length === 0 ? (
        <div className="text-center py-20" style={{ color: "var(--muted)" }}>
          <p className="text-sm">No saved orgs yet.</p>
          <Link href="/orgs" className="text-sm mt-2 inline-block" style={{ color: "var(--blue)" }}>
            Browse orgs →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {savedOrgs.map(({ org }) => (
            <div
              key={org.id}
              className="flex items-center justify-between p-4 border"
              style={{ background: "var(--surface)", borderColor: "var(--border-md)" }}
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/orgs/${org.id}`}
                  className="font-medium text-sm hover:underline"
                  style={{ color: "var(--text)" }}
                >
                  {org.name}
                </Link>
                {org.tagline && (
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text2)" }}>{org.tagline}</p>
                )}
                <p className="text-xs font-mono mt-1" style={{ color: "var(--muted)" }}>
                  {org.orgProjects.length} open listing{org.orgProjects.length !== 1 ? "s" : ""}
                </p>
              </div>
              <UnsaveButton orgId={org.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Create `app/(dashboard)/saved/UnsaveButton.tsx` as a client component:

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UnsaveButton({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const unsave = async () => {
    setLoading(true);
    await fetch(`/api/orgs/${orgId}/save`, { method: "POST" });
    router.refresh();
  };

  return (
    <button
      onClick={unsave}
      disabled={loading}
      className="text-xs px-3 py-1.5 border font-mono uppercase tracking-widest"
      style={{ color: "var(--muted)", borderColor: "var(--border-md)", background: "transparent", cursor: "pointer" }}
    >
      {loading ? "..." : "UNSAVE"}
    </button>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx" "app/(dashboard)/orgs/[orgId]/page.tsx" "app/(dashboard)/dashboard/page.tsx" "app/(dashboard)/dashboard/DashboardClient.tsx" "app/(dashboard)/saved/page.tsx" "app/(dashboard)/saved/UnsaveButton.tsx"
git commit -m "feat: real Save button for orgs + /saved page + dashboard savedCount"
```

---

## Task 9: Sunset Pines Canonical Seed

**Files:**
- Modify: `app/api/admin/seed-demo-accounts/route.ts`

Add Sunset Pines org + project with ALL rich listing fields after the Marcus profile block.

- [ ] **Step 1: Add Sunset Pines seed to seed-demo-accounts**

After the Marcus profile block (before the final `return NextResponse.json(...)`), add:

```typescript
  // ── Sunset Pines canonical listing ──────────────────────────────────────
  let sunsetOrg = await prisma.org.findFirst({ where: { name: "Sunset Pines Senior Living" } });
  if (!sunsetOrg) {
    // Use ridgepoint user as placeholder creator (or create a dedicated user)
    const sunsetUser = await prisma.user.upsert({
      where: { email: "sunsetpines@nivarro.demo" },
      update: {},
      create: { name: "Sunset Pines Admin", email: "sunsetpines@nivarro.demo", passwordHash: hash },
    });
    sunsetOrg = await prisma.org.create({
      data: {
        name: "Sunset Pines Senior Living",
        tagline: "Where veterans find connection through play.",
        description: "A senior living community serving 18 Vietnam-era veterans in Sacramento.",
        createdById: sunsetUser.id,
        verified: false,
      },
    });
  }

  const sunsetProject = await prisma.orgProject.findFirst({
    where: { orgId: sunsetOrg.id, title: "Veterans Game Studio" },
  });

  if (!sunsetProject) {
    await prisma.orgProject.create({
      data: {
        orgId: sunsetOrg.id,
        title: "Veterans Game Studio",
        description: "Build a multiplayer game for 18 Vietnam-era veterans at Sunset Pines Senior Living.",
        shortDescription: "Build a co-op game that 18 veterans at Sunset Pines will play together every afternoon.",
        impactStatement: "18 Vietnam-era veterans at Sunset Pines will play together every afternoon.",
        storyBody: `Margaret Chen wrote us a letter.\n\n"I'm the Activities Director at Sunset Pines Senior Living in Sacramento. We have 18 residents — all Vietnam-era veterans, most in their late 70s and 80s. They served together, and 50 years later they still prefer each other's company. The problem: they're bored. Card games don't cut it anymore. The TV stays on but no one watches it.\n\nI'm not asking for an app. I'm asking for a game. Something they can play together, right here, on the big screen in the common room. Something that lets them cooperate, not compete. Something with a bit of history in it — the kind they'd recognize.\n\nI have a $15,000 budget. I have 18 players ready to playtest the moment you walk in. I have stories you won't hear anywhere else. What I don't have is the team to build it."`,
        locationCity: "Sacramento, CA",
        locationRequired: "REQUIRED",
        locationRadius: 15,
        budgetTotal: 15000,
        budgetNotes: "Split however the team decides. Submit receipts for tooling.",
        toolingStipend: true,
        toolingAmount: null,
        gradeEligibility: JSON.stringify(["11", "12"]),
        advisorRequired: "REQUIRED",
        applicationMode: "TEAM",
        appMaterials: JSON.stringify(["cover_letter", "why_us"]),
        requiredSkills: JSON.stringify(["Game development", "Multiplayer networking", "UI/UX accessibility", "Communication"]),
        preferredGeniusTypes: JSON.stringify(["DYNAMO", "BLAZE"]),
        openSpots: 5,
        hoursPerWeek: "10-15",
        duration: "June 15 – August 30 (11 weeks)",
        format: "In-person",
        contactName: "Margaret Chen",
        contactRole: "Activities Director, Sunset Pines Senior Living",
        studentOutcomes: JSON.stringify(["PAID", "PORTFOLIO", "REC_LETTER", "MENTORSHIP"]),
        dayInLife: JSON.stringify([
          "Visit Sunset Pines to hear veterans' stories — design the game with them, not for them",
          "Build in Unity/Godot/web — procedurally varied missions, co-op for 6-8 simultaneous players",
          "Weekly playtests with residents — sit with an 80-year-old and watch him play",
          "Submit tooling receipts; manage your own budget split as a team",
          "Ship a real product by August 30 — it will be played every afternoon",
        ]),
        listingStatus: "OPEN",
        publishedAt: new Date(),
      },
    });
  }
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/seed-demo-accounts/route.ts
git commit -m "feat: seed Sunset Pines canonical listing with all rich fields"
```

---

## Task 10: My Teams Page — ACCEPTED Pulse Animation

**Files:**
- Modify: `app/(dashboard)/teams/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add keyframe to globals.css**

After the `.pulse-dot` keyframes block, add:

```css
@keyframes accepted-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); }
}

.team-accepted {
  border-color: rgba(52, 211, 153, 0.5) !important;
  animation: accepted-pulse 1.5s ease-in-out 3;
}
```

- [ ] **Step 2: Apply the class to ACCEPTED teams in teams/page.tsx**

In the team card `Link` element (currently has `className="block rounded-xl p-5 transition-all card"`), add conditional class:

```typescript
className={cn(
  "block p-5 transition-all card",
  team.status === "ACCEPTED" && "team-accepted"
)}
```

Also update the `StatusBadge` for ACCEPTED to be more prominent — add a green dot:

```typescript
ACCEPTED: { label: "ACCEPTED", className: "font-mono uppercase tracking-widest text-emerald-400 bg-emerald-900/20" },
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/teams/page.tsx" app/globals.css
git commit -m "feat: ACCEPTED teams pulse animation on My Teams page"
```

---

## Task 11: Team Workspace — Accepted Onboarding Banner

**Files:**
- Modify: `app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx`

- [ ] **Step 1: Add dismissible banner at the top of TeamWorkspaceClient**

In `TeamWorkspaceClient`, after the `const [tab, setTab] = useState(...)` line, add:

```typescript
const [bannerDismissed, setBannerDismissed] = useState(false);
```

Then at the top of the JSX return (before the tab bar), add:

```typescript
{team.status === "ACCEPTED" && !bannerDismissed && (
  <div
    className="relative p-4 mb-4 border border-emerald-800/40"
    style={{ background: "rgba(6, 78, 59, 0.2)" }}
  >
    <button
      onClick={() => setBannerDismissed(true)}
      className="absolute top-3 right-3 text-xs"
      style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
      aria-label="Dismiss"
    >
      ✕
    </button>
    <p className="text-sm font-semibold text-emerald-300 mb-2">Your team was accepted</p>
    <ol className="space-y-1">
      {[
        "Introduce yourselves in the chat below",
        "Review the project brief in Applications tab",
        "Message the org to confirm next steps",
      ].map((step, i) => (
        <li key={i} className="text-xs flex gap-2" style={{ color: "var(--text2)" }}>
          <span className="font-mono text-emerald-400">{i + 1}.</span>
          {step}
        </li>
      ))}
    </ol>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx"
git commit -m "feat: dismissible accepted onboarding banner in team workspace"
```

---

## Task 12: Web Scraper — SQL Migration + Schema

**Files:**
- Create: `prisma/migrations/20260613_add_scraper_queue/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write migration SQL**

```sql
-- prisma/migrations/20260613_add_scraper_queue/migration.sql
CREATE TABLE "ScrapedListing" (
  "id" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceInstitution" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "rawDescription" TEXT NOT NULL,
  "deadline" TEXT,
  "aiSummary" TEXT,
  "aiConfidence" DOUBLE PRECISION,
  "aiApproved" BOOLEAN,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScrapedListing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScrapedListing_status_idx" ON "ScrapedListing"("status");
```

- [ ] **Step 2: Add ScrapedListing model to schema.prisma**

```prisma
model ScrapedListing {
  id                 String    @id @default(cuid())
  sourceUrl          String
  sourceInstitution  String
  title              String
  rawDescription     String
  deadline           String?
  aiSummary          String?
  aiConfidence       Float?
  aiApproved         Boolean?
  status             String    @default("PENDING")
  reviewedBy         String?
  reviewedAt         DateTime?
  scrapedAt          DateTime  @default(now())

  @@index([status])
}
```

- [ ] **Step 3: Run prisma generate**

```bash
cd "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP" && npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260613_add_scraper_queue/migration.sql prisma/schema.prisma
git commit -m "feat: add ScrapedListing table for web scraper queue"
```

---

## Task 13: Web Scraper — API Route with Claude Pre-Screen + Resend Email

**Files:**
- Create: `app/api/admin/scraper/run/route.ts`
- Create: `app/api/admin/scraper/[id]/approve/route.ts`
- Create: `app/api/admin/scraper/[id]/reject/route.ts`

Install cheerio first:
```bash
cd "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP" && npm install cheerio
```

- [ ] **Step 1: Create the scraper run route**

```typescript
// app/api/admin/scraper/run/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import { getResendClient } from "@/lib/resend";

const SOURCES = [
  {
    institution: "Stanford Compression Forum",
    url: "https://compression.stanford.edu/programs",
  },
  {
    institution: "MIT PRIMES",
    url: "https://math.mit.edu/research/highschool/primes/index.php",
  },
  {
    institution: "Carnegie Mellon Pre-College",
    url: "https://www.cmu.edu/pre-college/",
  },
  {
    institution: "UPenn Wharton Global Youth",
    url: "https://globalyouth.wharton.upenn.edu/",
  },
];

async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Nivarro-Bot/1.0 (educational opportunity aggregator; contact team@nivarro.co)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  // Remove nav/footer/scripts, get main content text
  $("nav, footer, script, style, .nav, .footer, header").remove();
  return $("main, article, .content, body").first().text().replace(/\s+/g, " ").trim().slice(0, 3000);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const newListings: { institution: string; title: string; url: string; confidence: number; summary: string }[] = [];

  for (const source of SOURCES) {
    let pageText: string;
    try {
      pageText = await scrapeUrl(source.url);
    } catch (e) {
      console.error(`Failed to scrape ${source.url}:`, e);
      continue;
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are screening web pages for legitimate student opportunity listings from educational institutions.

Institution: ${source.institution}
URL: ${source.url}
Page content: ${pageText}

Answer in JSON only:
{
  "isOpportunity": true/false,
  "confidence": 0.0-1.0,
  "title": "program name if found",
  "deadline": "deadline if found, else null",
  "summary": "1-2 sentence summary for review queue",
  "reason": "why approved or rejected"
}

Approve only if: clearly a student program/research opportunity, from the stated institution, has actionable information. Reject if: generic marketing page, no program details, or unrelated.`,
        },
      ],
    });

    let parsed: { isOpportunity: boolean; confidence: number; title: string; deadline: string | null; summary: string } | null = null;
    try {
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      continue;
    }

    if (!parsed || !parsed.isOpportunity || parsed.confidence < 0.7) continue;

    // Check if already in DB
    const exists = await prisma.scrapedListing.findFirst({
      where: { sourceUrl: source.url, title: parsed.title },
    });
    if (exists) continue;

    const listing = await prisma.scrapedListing.create({
      data: {
        sourceUrl: source.url,
        sourceInstitution: source.institution,
        title: parsed.title ?? "Untitled Program",
        rawDescription: pageText.slice(0, 1000),
        deadline: parsed.deadline,
        aiSummary: parsed.summary,
        aiConfidence: parsed.confidence,
        status: "PENDING",
      },
    });

    newListings.push({
      institution: source.institution,
      title: listing.title,
      url: source.url,
      confidence: parsed.confidence,
      summary: parsed.summary ?? "",
    });
  }

  if (newListings.length === 0) {
    return NextResponse.json({ found: 0, message: "No new listings found" });
  }

  // Email team@nivarro.co
  const resend = getResendClient();
  const listHtml = newListings
    .map(
      (l) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee"><strong>${l.title}</strong><br/><small>${l.institution}</small></td>
          <td style="padding:8px;border-bottom:1px solid #eee">${(l.confidence * 100).toFixed(0)}%</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${l.summary}</td>
        </tr>`
    )
    .join("");

  await resend.emails.send({
    from: "Nivarro Scraper <noreply@nivarro.co>",
    to: "team@nivarro.co",
    subject: `[Nivarro Scraper] ${newListings.length} new listing${newListings.length > 1 ? "s" : ""} found — review required`,
    html: `
      <h2>Scraper found ${newListings.length} new listing${newListings.length > 1 ? "s" : ""}</h2>
      <p>Review and approve at: <a href="https://app.nivarro.co/admin/scraper-queue">app.nivarro.co/admin/scraper-queue</a></p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #eee">Program</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #eee">AI Confidence</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #eee">Summary</th>
          </tr>
        </thead>
        <tbody>${listHtml}</tbody>
      </table>
    `,
  });

  return NextResponse.json({ found: newListings.length, listings: newListings });
}
```

- [ ] **Step 2: Create approve endpoint**

```typescript
// app/api/admin/scraper/[id]/approve/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.email !== "team@nivarro.co") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const updated = await prisma.scrapedListing.update({
    where: { id },
    data: { status: "APPROVED", reviewedBy: session.user.email, reviewedAt: new Date() },
  });
  return NextResponse.json(updated);
}
```

- [ ] **Step 3: Create reject endpoint**

```typescript
// app/api/admin/scraper/[id]/reject/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.email !== "team@nivarro.co") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const updated = await prisma.scrapedListing.update({
    where: { id },
    data: { status: "REJECTED", reviewedBy: session.user.email, reviewedAt: new Date() },
  });
  return NextResponse.json(updated);
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/scraper package-lock.json package.json
git commit -m "feat: web scraper — cheerio + Claude pre-screen + Resend email to team@nivarro.co"
```

---

## Task 14: /admin/scraper-queue Page

**Files:**
- Create: `app/(dashboard)/admin/scraper-queue/page.tsx`
- Create: `app/(dashboard)/admin/scraper-queue/ScraperQueueClient.tsx`

- [ ] **Step 1: Create server page with auth gate**

```typescript
// app/(dashboard)/admin/scraper-queue/page.tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ScraperQueueClient from "./ScraperQueueClient";

export default async function ScraperQueuePage() {
  const session = await auth();
  if (session?.user?.email !== "team@nivarro.co") redirect("/dashboard");

  const listings = await prisma.scrapedListing.findMany({
    orderBy: [{ status: "asc" }, { scrapedAt: "desc" }],
  });

  return (
    <ScraperQueueClient
      listings={listings.map((l) => ({
        ...l,
        scrapedAt: l.scrapedAt.toISOString(),
        reviewedAt: l.reviewedAt?.toISOString() ?? null,
      }))}
    />
  );
}
```

- [ ] **Step 2: Create ScraperQueueClient**

```typescript
// app/(dashboard)/admin/scraper-queue/ScraperQueueClient.tsx
"use client";

import { useState } from "react";

interface Listing {
  id: string;
  sourceInstitution: string;
  title: string;
  sourceUrl: string;
  aiConfidence: number | null;
  aiSummary: string | null;
  status: string;
  scrapedAt: string;
}

export default function ScraperQueueClient({ listings }: { listings: Listing[] }) {
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(listings.map((l) => [l.id, l.status]))
  );

  const act = async (id: string, action: "approve" | "reject") => {
    await fetch(`/api/admin/scraper/${id}/${action}`, { method: "POST" });
    setStatuses((prev) => ({ ...prev, [id]: action === "approve" ? "APPROVED" : "REJECTED" }));
  };

  const runScraper = async () => {
    const res = await fetch("/api/admin/scraper/run?secret=niv-reset-2026");
    const data = await res.json();
    alert(`Done. Found: ${data.found ?? 0} new listings.`);
    window.location.reload();
  };

  const pending = listings.filter((l) => statuses[l.id] === "PENDING");
  const reviewed = listings.filter((l) => statuses[l.id] !== "PENDING");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>Scraper Queue</h1>
          <p className="text-sm mt-1 font-mono" style={{ color: "var(--muted)" }}>
            {pending.length} PENDING · {reviewed.length} REVIEWED
          </p>
        </div>
        <button onClick={runScraper} className="btn-primary text-sm px-4 py-2">
          Run Scraper Now
        </button>
      </div>

      {pending.length > 0 && (
        <section>
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>PENDING REVIEW</p>
          <div className="space-y-3">
            {pending.map((l) => (
              <ListingRow key={l.id} listing={l} status={statuses[l.id]} onAct={act} />
            ))}
          </div>
        </section>
      )}

      {reviewed.length > 0 && (
        <section>
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>REVIEWED</p>
          <div className="space-y-3">
            {reviewed.map((l) => (
              <ListingRow key={l.id} listing={l} status={statuses[l.id]} onAct={act} />
            ))}
          </div>
        </section>
      )}

      {listings.length === 0 && (
        <p className="text-sm text-center py-16" style={{ color: "var(--muted)" }}>
          No scraped listings yet. Run the scraper to populate the queue.
        </p>
      )}
    </div>
  );
}

function ListingRow({ listing, status, onAct }: { listing: Listing; status: string; onAct: (id: string, action: "approve" | "reject") => void }) {
  return (
    <div className="p-4 border flex items-start justify-between gap-4" style={{ background: "var(--surface)", borderColor: "var(--border-md)" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-mono uppercase tracking-widest px-2 py-0.5 ${
            status === "PENDING" ? "text-amber-400" :
            status === "APPROVED" ? "text-emerald-400" : "text-red-400"
          }`}>{status}</span>
          <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
            {listing.aiConfidence != null ? `AI: ${(listing.aiConfidence * 100).toFixed(0)}%` : ""}
          </span>
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{listing.title}</p>
        <p className="text-xs" style={{ color: "var(--text2)" }}>{listing.sourceInstitution}</p>
        {listing.aiSummary && (
          <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>{listing.aiSummary}</p>
        )}
        <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs mt-1 inline-block hover:underline" style={{ color: "var(--blue)" }}>
          {listing.sourceUrl}
        </a>
      </div>
      {status === "PENDING" && (
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onAct(listing.id, "approve")} className="btn-primary text-xs px-3 py-1.5">Approve</button>
          <button onClick={() => onAct(listing.id, "reject")} className="btn-ghost text-xs px-3 py-1.5">Reject</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/admin/scraper-queue"
git commit -m "feat: /admin/scraper-queue page — review + approve/reject scraped listings"
```

---

## Task 15: UI Polish

**Files:**
- Modify: `app/(dashboard)/orgs/OrgsClient.tsx` (org cards)
- Modify: `app/globals.css` (status pills)

- [ ] **Step 1: Fix org card status pill to use font-mono**

In `OrgsClient.tsx`, find the status badge span (around line 183-190) and add `font-mono uppercase tracking-widest` classes.

- [ ] **Step 2: Ensure org description is line-clamp-2**

In `OrgsClient.tsx` line ~208, verify the description paragraph has `line-clamp-2`. It already does — confirm and move on.

- [ ] **Step 3: Add status pill font-mono utility class to globals.css**

```css
/* Status pills — mono uppercase */
.status-pill {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
}
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/orgs/OrgsClient.tsx" app/globals.css
git commit -m "fix: status pills font-mono, org card text clamping"
```

---

## Task 16: QA + Deploy

- [ ] **Step 1: Verify all migrations exist**

```bash
ls "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP/prisma/migrations/"
```

Expected to see: `20260613_add_saved_org`, `20260613_add_rich_listing_fields`, `20260613_add_scraper_queue`

- [ ] **Step 2: Run dev server and smoke test**

```bash
cd "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP" && npm run dev
```

Test as alex@nivarro.test:
- /notifications — should show no errors
- /teams — teams page loads
- /saved — should show empty state

Test as ridgepoint@nivarro.demo:
- Accept a team → notifications page shows it on the student side

- [ ] **Step 3: Deploy**

```bash
node --use-system-ca -e "const https = require('https'); https.get('https://api.render.com/deploy/srv-d7o25h68bjmc7395irug?key=XETPeUTTsjo', r => { console.log(r.statusCode); r.on('data', d => process.stdout.write(d)); });"
```

- [ ] **Step 4: Run seed + cleanup on production**

After deploy, POST to production:
1. `POST https://app.nivarro.co/api/admin/cleanup-demo-data?secret=niv-reset-2026`
2. `POST https://app.nivarro.co/api/admin/seed-demo-accounts?secret=niv-reset-2026`

- [ ] **Step 5: Final smoke test on production**

Open `https://goal-app-3.onrender.com` (or app.nivarro.co). Verify /orgs loads, the Sunset Pines listing appears.
