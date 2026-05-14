# Six-Step Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the core Nivarro platform journey: browse orgs → pick project → search scholars → recruit → apply → platform unlocks.

**Architecture:** New Prisma models (OrgProject, RecruitmentRequest, TeamApplication) + REST API endpoints + UI pages. Org detail page gets a projects section. New `/orgs/[orgId]/projects/[projectId]` page hosts scholar search and apply flow. Notifications page handles incoming recruitment requests.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Tailwind CSS, existing CSS variable theme, lucide-react icons.

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add 3 models + 3 enums + relations on Profile/Team |
| `app/api/org-projects/route.ts` | GET (list by orgId), POST (create) |
| `app/api/org-projects/[id]/route.ts` | GET (detail) |
| `app/api/org-projects/[id]/scholars/route.ts` | GET (search with filters) |
| `app/api/org-projects/[id]/recruit/route.ts` | POST (send request) |
| `app/api/org-projects/[id]/apply/route.ts` | POST (team application) |
| `app/api/recruitment-requests/route.ts` | GET (received requests for current user) |
| `app/api/recruitment-requests/[id]/route.ts` | PATCH (accept/decline) |
| `app/api/team-applications/[id]/route.ts` | PATCH (accept/reject - admin) |
| `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx` | Add OrgProject cards section |
| `app/(dashboard)/orgs/[orgId]/page.tsx` | Fetch and pass projects data |
| `app/(dashboard)/orgs/[orgId]/projects/[projectId]/page.tsx` | New server page |
| `app/(dashboard)/orgs/[orgId]/projects/[projectId]/ProjectDetailClient.tsx` | New client component |
| `app/(dashboard)/notifications/page.tsx` | New notifications page |
| `app/(dashboard)/notifications/NotificationsClient.tsx` | New notifications client |
| `app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx` | Add application status banner |
| `components/layout/Sidebar.tsx` | Add notifications link |

---

### Task 1: Schema — Add OrgProject, RecruitmentRequest, TeamApplication

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new enums and models to schema.prisma**

Open `prisma/schema.prisma`. At the end of the `// ORGS & OPPORTUNITIES` section, after the `SavedOpportunity` model, add:

```prisma
enum OrgProjectStatus {
  OPEN
  CLOSED
  FILLED
}

model OrgProject {
  id             String           @id @default(cuid())
  orgId          String
  title          String
  description    String?
  openSpots      Int              @default(1)
  requiredSkills String           @default("[]")
  deadline       DateTime?
  status         OrgProjectStatus @default(OPEN)
  createdAt      DateTime         @default(now())

  org              Org                  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  recruitmentReqs  RecruitmentRequest[]
  teamApplications TeamApplication[]
}
```

Add to the `Org` model's relations:
```prisma
  projects      OrgProject[]
```

- [ ] **Step 2: Add RecruitmentRequest model**

After OrgProject, add:

```prisma
enum RecruitmentStatus {
  PENDING
  ACCEPTED
  DECLINED
}

model RecruitmentRequest {
  id            String            @id @default(cuid())
  orgProjectId  String
  fromProfileId String
  toProfileId   String
  teamId        String
  message       String?
  status        RecruitmentStatus @default(PENDING)
  createdAt     DateTime          @default(now())

  orgProject  OrgProject @relation(fields: [orgProjectId], references: [id], onDelete: Cascade)
  fromProfile Profile    @relation("SentRecruitments", fields: [fromProfileId], references: [id], onDelete: Cascade)
  toProfile   Profile    @relation("ReceivedRecruitments", fields: [toProfileId], references: [id], onDelete: Cascade)
  team        Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([orgProjectId, fromProfileId, toProfileId])
}
```

Add to Profile model's relations:
```prisma
  sentRecruitments     RecruitmentRequest[] @relation("SentRecruitments")
  receivedRecruitments RecruitmentRequest[] @relation("ReceivedRecruitments")
```

Add to Team model's relations:
```prisma
  recruitmentRequests RecruitmentRequest[]
  teamApplications    TeamApplication[]
```

- [ ] **Step 3: Add TeamApplication model and ACCEPTED team status**

After RecruitmentRequest, add:

```prisma
enum ApplicationStatus {
  PENDING
  ACCEPTED
  REJECTED
  WITHDRAWN
}

model TeamApplication {
  id           String            @id @default(cuid())
  teamId       String
  orgProjectId String
  whyJoin      String?
  status       ApplicationStatus @default(PENDING)
  submittedAt  DateTime          @default(now())
  decidedAt    DateTime?

  team       Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)
  orgProject OrgProject @relation(fields: [orgProjectId], references: [id], onDelete: Cascade)

  @@unique([teamId, orgProjectId])
}
```

In the existing `TeamStatus` enum, add `ACCEPTED`:
```prisma
enum TeamStatus {
  ACTIVE
  SUBMITTED
  ACCEPTED
  COMPLETED
}
```

- [ ] **Step 4: Run migration**

```bash
cd "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP"
npx prisma migrate dev --name add-six-step-workflow
```

Expected: Migration created and applied, Prisma client regenerated.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add OrgProject, RecruitmentRequest, TeamApplication schema"
```

---

### Task 2: API — Org Projects CRUD

**Files:**
- Create: `app/api/org-projects/route.ts`
- Create: `app/api/org-projects/[id]/route.ts`

- [ ] **Step 1: Create `app/api/org-projects/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const projects = await prisma.orgProject.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      openSpots: true,
      requiredSkills: true,
      deadline: true,
      status: true,
      _count: { select: { teamApplications: { where: { status: "ACCEPTED" } } } },
    },
  });

  return NextResponse.json({ projects });
}

const createSchema = z.object({
  orgId: z.string(),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  openSpots: z.number().int().min(1).max(50).default(1),
  requiredSkills: z.array(z.string()).default([]),
  deadline: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const { orgId, title, description, openSpots, requiredSkills, deadline } = parsed.data;

  const project = await prisma.orgProject.create({
    data: {
      orgId,
      title,
      description,
      openSpots,
      requiredSkills: JSON.stringify(requiredSkills),
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/org-projects/[id]/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.orgProject.findUnique({
    where: { id },
    include: {
      org: { select: { id: true, name: true, accentColor: true } },
      teamApplications: {
        include: {
          team: {
            include: {
              members: {
                include: { profile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ project });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/org-projects
git commit -m "feat: add org-projects list and detail API"
```

---

### Task 3: API — Scholar Search

**Files:**
- Create: `app/api/org-projects/[id]/scholars/route.ts`

- [ ] **Step 1: Create the scholar search endpoint**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const geniusType = searchParams.get("geniusType");
  const traits = searchParams.getAll("trait");
  const q = searchParams.get("q") ?? "";

  const where: Record<string, unknown> = {
    onboardingComplete: true,
  };

  if (geniusType) where.geniusType = geniusType;
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { headline: { contains: q, mode: "insensitive" } },
    ];
  }
  if (traits.length > 0) {
    where.traitLinks = {
      some: { trait: { slug: { in: traits } } },
    };
  }

  const scholars = await prisma.profile.findMany({
    where,
    take: 20,
    select: {
      id: true,
      displayName: true,
      headline: true,
      avatarUrl: true,
      geniusType: true,
      handle: true,
      traitLinks: {
        take: 3,
        include: { trait: { select: { slug: true, name: true } } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ scholars });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/org-projects/[id]/scholars
git commit -m "feat: add scholar search endpoint for org projects"
```

---

### Task 4: API — Recruitment Requests

**Files:**
- Create: `app/api/org-projects/[id]/recruit/route.ts`
- Create: `app/api/recruitment-requests/route.ts`
- Create: `app/api/recruitment-requests/[id]/route.ts`

- [ ] **Step 1: Create `app/api/org-projects/[id]/recruit/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  toProfileId: z.string(),
  teamId: z.string(),
  message: z.string().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orgProjectId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const membership = await prisma.teamMember.findFirst({
    where: { teamId: parsed.data.teamId, profileId: myProfile.id },
  });
  if (!membership) return NextResponse.json({ error: "Not on team" }, { status: 403 });

  const existing = await prisma.recruitmentRequest.findUnique({
    where: {
      orgProjectId_fromProfileId_toProfileId: {
        orgProjectId,
        fromProfileId: myProfile.id,
        toProfileId: parsed.data.toProfileId,
      },
    },
  });
  if (existing) return NextResponse.json({ error: "Already sent" }, { status: 409 });

  const request = await prisma.recruitmentRequest.create({
    data: {
      orgProjectId,
      fromProfileId: myProfile.id,
      toProfileId: parsed.data.toProfileId,
      teamId: parsed.data.teamId,
      message: parsed.data.message,
    },
  });

  return NextResponse.json({ request }, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/recruitment-requests/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ requests: [] });

  const requests = await prisma.recruitmentRequest.findMany({
    where: { toProfileId: myProfile.id, status: "PENDING" },
    include: {
      orgProject: { select: { id: true, title: true, org: { select: { id: true, name: true } } } },
      fromProfile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
```

- [ ] **Step 3: Create `app/api/recruitment-requests/[id]/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ status: z.enum(["ACCEPTED", "DECLINED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const request = await prisma.recruitmentRequest.findUnique({ where: { id } });
  if (!request || request.toProfileId !== myProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.recruitmentRequest.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  if (parsed.data.status === "ACCEPTED") {
    const alreadyMember = await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId: request.teamId, profileId: myProfile.id } },
    });
    if (!alreadyMember) {
      await prisma.teamMember.create({
        data: { teamId: request.teamId, profileId: myProfile.id, role: "MEMBER" },
      });
    }
  }

  return NextResponse.json({ request: updated });
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/org-projects/[id]/recruit app/api/recruitment-requests
git commit -m "feat: add recruitment request send/accept/decline APIs"
```

---

### Task 5: API — Team Application

**Files:**
- Create: `app/api/org-projects/[id]/apply/route.ts`
- Create: `app/api/team-applications/[id]/route.ts`

- [ ] **Step 1: Create `app/api/org-projects/[id]/apply/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  teamId: z.string(),
  whyJoin: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orgProjectId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const membership = await prisma.teamMember.findFirst({
    where: { teamId: parsed.data.teamId, profileId: myProfile.id },
  });
  if (!membership) return NextResponse.json({ error: "Not on team" }, { status: 403 });

  const existing = await prisma.teamApplication.findUnique({
    where: { teamId_orgProjectId: { teamId: parsed.data.teamId, orgProjectId } },
  });
  if (existing) return NextResponse.json({ error: "Already applied" }, { status: 409 });

  const application = await prisma.teamApplication.create({
    data: {
      teamId: parsed.data.teamId,
      orgProjectId,
      whyJoin: parsed.data.whyJoin,
    },
  });

  await prisma.team.update({
    where: { id: parsed.data.teamId },
    data: { status: "SUBMITTED" },
  });

  return NextResponse.json({ application }, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/team-applications/[id]/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ status: z.enum(["ACCEPTED", "REJECTED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const application = await prisma.teamApplication.findUnique({
    where: { id },
    include: { orgProject: { select: { orgId: true } } },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.teamApplication.update({
    where: { id },
    data: { status: parsed.data.status, decidedAt: new Date() },
  });

  if (parsed.data.status === "ACCEPTED") {
    await prisma.team.update({
      where: { id: application.teamId },
      data: { status: "ACCEPTED" },
    });
  }

  return NextResponse.json({ application: updated });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/org-projects/[id]/apply app/api/team-applications
git commit -m "feat: add team application submit and accept/reject APIs"
```

---

### Task 6: UI — Update OrgDetailClient with Projects Section

**Files:**
- Modify: `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx`
- Modify: `app/(dashboard)/orgs/[orgId]/page.tsx`

- [ ] **Step 1: Read the current org detail page**

Read `app/(dashboard)/orgs/[orgId]/page.tsx` to see the current data fetching.

- [ ] **Step 2: Update page.tsx to fetch projects**

In `app/(dashboard)/orgs/[orgId]/page.tsx`, after the existing org query, add a projects fetch and pass it to the client. The full updated file should look like:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import OrgDetailClient from "./OrgDetailClient";

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth();
  const { orgId } = await params;

  const [org, projects] = await Promise.all([
    prisma.org.findUnique({
      where: { id: orgId },
      include: {
        opportunities: { orderBy: { createdAt: "desc" } },
        teams: {
          include: {
            members: { include: { profile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true, userId: true } } } },
          },
        },
      },
    }),
    prisma.orgProject.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        openSpots: true,
        requiredSkills: true,
        deadline: true,
        status: true,
      },
    }),
  ]);

  if (!org) notFound();

  let myProfileId: string | null = null;
  let myTeamId: string | null = null;
  if (session?.user?.id) {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    myProfileId = profile?.id ?? null;
    if (myProfileId) {
      const membership = await prisma.teamMember.findFirst({
        where: { profileId: myProfileId, team: { orgId } },
        select: { teamId: true },
      });
      myTeamId = membership?.teamId ?? null;
    }
  }

  const serializedOrg = {
    ...org,
    deadline: org.deadline?.toISOString() ?? null,
    opportunities: org.opportunities.map((o) => ({
      ...o,
      deadline: o.deadline?.toISOString() ?? null,
    })),
    teams: org.teams.map((t) => ({
      ...t,
      members: t.members.map((m) => ({ ...m, profile: m.profile ? { ...m.profile } : null })),
    })),
  };

  const serializedProjects = projects.map((p) => ({
    ...p,
    deadline: p.deadline?.toISOString() ?? null,
  }));

  return (
    <OrgDetailClient
      org={serializedOrg}
      projects={serializedProjects}
      myProfileId={myProfileId}
      myTeamId={myTeamId}
    />
  );
}
```

- [ ] **Step 3: Add OrgProject type and Projects section to OrgDetailClient.tsx**

At the top of OrgDetailClient, add the interface:

```typescript
interface OrgProjectSummary {
  id: string;
  title: string;
  description: string | null;
  openSpots: number;
  requiredSkills: string;
  deadline: string | null;
  status: string;
}
```

Add `projects: OrgProjectSummary[]` to the component props.

After the `opportunities` section in the left column, add:

```tsx
{projects.length > 0 && (
  <div>
    <h2 className="text-sm font-semibold text-[#e8e8ec] mb-3">Open Projects</h2>
    <div className="space-y-2">
      {projects.map((proj) => {
        const skills: string[] = JSON.parse(proj.requiredSkills || "[]");
        return (
          <Link
            key={proj.id}
            href={`/orgs/${org.id}/projects/${proj.id}`}
            className="block bg-[#16161a] border border-[#2a2a33] hover:border-[#c9a84c]/40 rounded-lg p-3 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[#e8e8ec] group-hover:text-[#c9a84c] transition-colors">{proj.title}</p>
                {proj.description && (
                  <p className="text-xs text-[#9898a8] mt-0.5 line-clamp-2">{proj.description}</p>
                )}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {skills.slice(0, 4).map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1e1e24] text-[#9898a8] border border-[#2a2a33]">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-semibold text-[#c9a84c]">{proj.openSpots}</p>
                <p className="text-[10px] text-[#5a5a6a]">open spots</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/orgs
git commit -m "feat: show org projects on org detail page"
```

---

### Task 7: UI — Project Detail Page (Scholar Search + Apply)

**Files:**
- Create: `app/(dashboard)/orgs/[orgId]/projects/[projectId]/page.tsx`
- Create: `app/(dashboard)/orgs/[orgId]/projects/[projectId]/ProjectDetailClient.tsx`

- [ ] **Step 1: Create the server page**

Create `app/(dashboard)/orgs/[orgId]/projects/[projectId]/page.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProjectDetailClient from "./ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { orgId, projectId } = await params;

  const project = await prisma.orgProject.findUnique({
    where: { id: projectId },
    include: {
      org: { select: { id: true, name: true, accentColor: true } },
    },
  });

  if (!project || project.orgId !== orgId) notFound();

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  let myTeams: { id: string; name: string }[] = [];
  if (myProfile) {
    const memberships = await prisma.teamMember.findMany({
      where: { profileId: myProfile.id },
      include: { team: { select: { id: true, name: true, status: true } } },
    });
    myTeams = memberships
      .filter((m) => m.team.status === "ACTIVE")
      .map((m) => ({ id: m.team.id, name: m.team.name }));
  }

  const existingApplication = myTeams.length
    ? await prisma.teamApplication.findFirst({
        where: { orgProjectId: projectId, teamId: { in: myTeams.map((t) => t.id) } },
        select: { id: true, status: true, teamId: true },
      })
    : null;

  return (
    <ProjectDetailClient
      project={{
        ...project,
        deadline: project.deadline?.toISOString() ?? null,
        createdAt: project.createdAt.toISOString(),
      }}
      myProfileId={myProfile?.id ?? null}
      myTeams={myTeams}
      existingApplication={existingApplication}
    />
  );
}
```

- [ ] **Step 2: Create ProjectDetailClient.tsx**

Create `app/(dashboard)/orgs/[orgId]/projects/[projectId]/ProjectDetailClient.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search, ArrowLeft, UserPlus, CheckCircle2, Clock } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

const GENIUS_KEYS: GeniusTypeKey[] = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"];

interface Scholar {
  id: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  geniusType: GeniusTypeKey | null;
  handle: string | null;
  traitLinks: { trait: { slug: string; name: string } }[];
}

interface ProjectDetailClientProps {
  project: {
    id: string;
    orgId: string;
    title: string;
    description: string | null;
    openSpots: number;
    requiredSkills: string;
    deadline: string | null;
    status: string;
    org: { id: string; name: string; accentColor: string | null };
  };
  myProfileId: string | null;
  myTeams: { id: string; name: string }[];
  existingApplication: { id: string; status: string; teamId: string } | null;
}

export default function ProjectDetailClient({
  project, myProfileId, myTeams, existingApplication,
}: ProjectDetailClientProps) {
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [q, setQ] = useState("");
  const [geniusFilter, setGeniusFilter] = useState<GeniusTypeKey | "">("");
  const [loading, setLoading] = useState(false);
  const [recruitingId, setRecruitingId] = useState<string | null>(null);
  const [recruitMsg, setRecruitMsg] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState(myTeams[0]?.id ?? "");
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const [applyTeamId, setApplyTeamId] = useState(myTeams[0]?.id ?? "");
  const [applyMsg, setApplyMsg] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<{ id: string; status: string; teamId: string } | null>(existingApplication);

  const requiredSkills: string[] = JSON.parse(project.requiredSkills || "[]");
  const accentColor = project.org.accentColor ?? "#c9a84c";

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (geniusFilter) params.set("geniusType", geniusFilter);
    const res = await fetch(`/api/org-projects/${project.id}/scholars?${params}`);
    const data = await res.json();
    setScholars(data.scholars ?? []);
    setLoading(false);
  }, [q, geniusFilter, project.id]);

  useEffect(() => {
    search();
  }, [search]);

  const sendRecruit = async (toProfileId: string) => {
    if (!selectedTeamId || !myProfileId) return;
    await fetch(`/api/org-projects/${project.id}/recruit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toProfileId, teamId: selectedTeamId, message: recruitMsg }),
    });
    setSentTo((prev) => new Set(prev).add(toProfileId));
    setRecruitingId(null);
    setRecruitMsg("");
  };

  const handleApply = async () => {
    if (!applyTeamId) return;
    setApplying(true);
    const res = await fetch(`/api/org-projects/${project.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: applyTeamId, whyJoin: applyMsg }),
    });
    const data = await res.json();
    setApplying(false);
    if (data.application) setApplied({ id: data.application.id, status: data.application.status, teamId: applyTeamId });
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#9898a8]">
        <Link href={`/orgs/${project.orgId}`} className="flex items-center gap-1 hover:text-[#c9a84c] transition-colors">
          <ArrowLeft className="w-4 h-4" /> {project.org.name}
        </Link>
        <span>/</span>
        <span className="text-[#e8e8ec]">{project.title}</span>
      </div>

      {/* Header */}
      <div className="bg-[#0D1525] border border-[rgba(201,168,76,0.12)] rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#EAE8E0] mb-1">{project.title}</h1>
            {project.description && <p className="text-sm text-[#8A8898] leading-relaxed">{project.description}</p>}
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {requiredSkills.map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.28)] text-[#c9a84c]">{s}</span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-bold" style={{ color: accentColor }}>{project.openSpots}</p>
            <p className="text-xs text-[#5A5570]">open spots</p>
            {project.deadline && (
              <p className="text-xs text-[#8A8898] mt-1">Deadline: {format(new Date(project.deadline), "MMM d, yyyy")}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scholar Search */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-[#EAE8E0] uppercase tracking-wider">Scholar Pool</h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5570]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search scholars…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0D1525] border border-[rgba(201,168,76,0.12)] text-sm text-[#EAE8E0] placeholder-[#5A5570] focus:outline-none focus:border-[rgba(201,168,76,0.28)]"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {GENIUS_KEYS.map((g) => {
                const info = GENIUS_TYPES[g];
                return (
                  <button
                    key={g}
                    onClick={() => setGeniusFilter((prev) => (prev === g ? "" : g))}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      geniusFilter === g
                        ? "border-[#c9a84c] text-[#c9a84c] bg-[#c9a84c]/10"
                        : "border-[rgba(201,168,76,0.12)] text-[#8A8898] hover:border-[rgba(201,168,76,0.28)]"
                    )}
                  >
                    {g[0] + g.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-sm text-[#5A5570]">Searching…</div>
            ) : scholars.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#5A5570]">No scholars found</div>
            ) : (
              scholars.map((scholar) => (
                <div key={scholar.id} className="bg-[#0D1525] border border-[rgba(201,168,76,0.12)] rounded-xl p-3 flex items-center gap-3">
                  <Avatar src={scholar.avatarUrl} name={scholar.displayName} geniusType={scholar.geniusType} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${scholar.handle ?? scholar.id}`} className="font-medium text-sm text-[#EAE8E0] hover:text-[#c9a84c] transition-colors">
                        {scholar.displayName}
                      </Link>
                      {scholar.geniusType && <GeniusTypeBadge type={scholar.geniusType} size="xs" />}
                    </div>
                    {scholar.headline && <p className="text-xs text-[#8A8898] truncate">{scholar.headline}</p>}
                    {scholar.traitLinks.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {scholar.traitLinks.map((tl) => (
                          <span key={tl.trait.slug} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#111C32] text-[#8A8898]">{tl.trait.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {sentTo.has(scholar.id) ? (
                      <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                      </span>
                    ) : recruitingId === scholar.id ? (
                      <div className="space-y-1 w-48">
                        <textarea
                          value={recruitMsg}
                          onChange={(e) => setRecruitMsg(e.target.value)}
                          placeholder="Optional message…"
                          rows={2}
                          className="w-full text-xs resize-none rounded-lg border border-[rgba(201,168,76,0.28)] bg-[#111C32] text-[#EAE8E0] placeholder-[#5A5570] px-2 py-1.5 focus:outline-none"
                        />
                        {myTeams.length > 1 && (
                          <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full text-xs rounded-lg border border-[rgba(201,168,76,0.12)] bg-[#111C32] text-[#EAE8E0] px-2 py-1.5 focus:outline-none"
                          >
                            {myTeams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex gap-1">
                          <button onClick={() => setRecruitingId(null)} className="flex-1 text-xs py-1 rounded-lg border border-[rgba(201,168,76,0.12)] text-[#8A8898]">Cancel</button>
                          <button onClick={() => sendRecruit(scholar.id)} className="flex-1 text-xs py-1 rounded-lg bg-[#c9a84c] text-[#05080F] font-semibold">Send</button>
                        </div>
                      </div>
                    ) : myProfileId && scholar.id !== myProfileId ? (
                      <button
                        onClick={() => setRecruitingId(scholar.id)}
                        className="flex items-center gap-1 text-xs font-medium text-[#c9a84c] hover:text-[#e3c06a] border border-[rgba(201,168,76,0.28)] px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Recruit
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Apply Panel */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#EAE8E0] uppercase tracking-wider">Apply</h2>
          <div className="bg-[#0D1525] border border-[rgba(201,168,76,0.12)] rounded-xl p-4 space-y-3">
            {applied ? (
              <div className="text-center py-4">
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold mb-2",
                  applied.status === "ACCEPTED" ? "bg-green-950 text-green-400" :
                  applied.status === "REJECTED" ? "bg-red-950/40 text-red-400" :
                  "bg-blue-950 text-blue-400"
                )}>
                  <Clock className="w-3.5 h-3.5" />
                  {applied.status === "ACCEPTED" ? "Accepted!" : applied.status === "REJECTED" ? "Not selected" : "Under review"}
                </div>
                <Link href={`/teams/${applied.teamId}`} className="block text-xs text-[#c9a84c] hover:underline mt-1">View team workspace →</Link>
              </div>
            ) : myTeams.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-[#8A8898] mb-2">You need a team to apply</p>
                <Link href="/teams" className="text-xs text-[#c9a84c] hover:underline">Create or join a team →</Link>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-[#8A8898] block mb-1">Your team</label>
                  <select
                    value={applyTeamId}
                    onChange={(e) => setApplyTeamId(e.target.value)}
                    className="w-full text-sm rounded-lg border border-[rgba(201,168,76,0.12)] bg-[#111C32] text-[#EAE8E0] px-3 py-2 focus:outline-none focus:border-[rgba(201,168,76,0.28)]"
                  >
                    {myTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#8A8898] block mb-1">Why does your team fit? (optional)</label>
                  <textarea
                    value={applyMsg}
                    onChange={(e) => setApplyMsg(e.target.value)}
                    rows={4}
                    placeholder="What makes your team a strong match for this project?"
                    className="w-full resize-none text-sm rounded-lg border border-[rgba(201,168,76,0.12)] bg-[#111C32] text-[#EAE8E0] placeholder-[#5A5570] px-3 py-2 focus:outline-none focus:border-[rgba(201,168,76,0.28)]"
                  />
                </div>
                <button
                  onClick={handleApply}
                  disabled={applying || !applyTeamId}
                  className="w-full py-2.5 rounded-lg bg-[#c9a84c] hover:bg-[#e3c06a] text-[#05080F] text-sm font-semibold disabled:opacity-40 transition-colors"
                >
                  {applying ? "Submitting…" : "Submit Application"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/orgs/[orgId]/projects"
git commit -m "feat: add project detail page with scholar search and apply flow"
```

---

### Task 8: UI — Notifications Page

**Files:**
- Create: `app/(dashboard)/notifications/page.tsx`
- Create: `app/(dashboard)/notifications/NotificationsClient.tsx`

- [ ] **Step 1: Create the server page**

Create `app/(dashboard)/notifications/page.tsx`:

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

  const requests = myProfile
    ? await prisma.recruitmentRequest.findMany({
        where: { toProfileId: myProfile.id },
        include: {
          orgProject: { select: { id: true, title: true, orgId: true, org: { select: { id: true, name: true } } } },
          fromProfile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true, handle: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <NotificationsClient
      requests={requests.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
```

- [ ] **Step 2: Create NotificationsClient.tsx**

Create `app/(dashboard)/notifications/NotificationsClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

interface RecruitmentRequest {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  orgProject: { id: string; title: string; orgId: string; org: { id: string; name: string } };
  fromProfile: { id: string; displayName: string; avatarUrl: string | null; geniusType: GeniusTypeKey | null; handle: string | null };
  team: { id: string; name: string };
}

export default function NotificationsClient({ requests }: { requests: RecruitmentRequest[] }) {
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(requests.map((r) => [r.id, r.status]))
  );

  const respond = async (id: string, status: "ACCEPTED" | "DECLINED") => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
    await fetch(`/api/recruitment-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const pending = requests.filter((r) => statuses[r.id] === "PENDING");
  const handled = requests.filter((r) => statuses[r.id] !== "PENDING");

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-[#EAE8E0]">Notifications</h1>

      {requests.length === 0 ? (
        <div className="text-center py-16 text-sm text-[#5A5570]">
          No notifications yet. When someone recruits you, you'll see it here.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8A8898] uppercase tracking-wider mb-3">Pending ({pending.length})</p>
              <div className="space-y-3">
                {pending.map((req) => (
                  <RequestCard key={req.id} req={req} status={statuses[req.id]} onRespond={respond} />
                ))}
              </div>
            </div>
          )}
          {handled.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8A8898] uppercase tracking-wider mb-3">Earlier</p>
              <div className="space-y-3">
                {handled.map((req) => (
                  <RequestCard key={req.id} req={req} status={statuses[req.id]} onRespond={respond} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RequestCard({
  req, status, onRespond,
}: {
  req: RecruitmentRequest;
  status: string;
  onRespond: (id: string, s: "ACCEPTED" | "DECLINED") => void;
}) {
  return (
    <div className={cn(
      "bg-[#0D1525] border rounded-xl p-4",
      status === "PENDING" ? "border-[rgba(201,168,76,0.28)]" : "border-[rgba(201,168,76,0.12)] opacity-60"
    )}>
      <div className="flex items-start gap-3">
        <Avatar src={req.fromProfile.avatarUrl} name={req.fromProfile.displayName} geniusType={req.fromProfile.geniusType} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${req.fromProfile.handle ?? req.fromProfile.id}`}
              className="font-medium text-sm text-[#EAE8E0] hover:text-[#c9a84c] transition-colors"
            >
              {req.fromProfile.displayName}
            </Link>
            {req.fromProfile.geniusType && <GeniusTypeBadge type={req.fromProfile.geniusType} size="xs" />}
            <span className="text-xs text-[#5A5570]">{formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</span>
          </div>
          <p className="text-xs text-[#8A8898] mt-0.5">
            Invited you to join <span className="text-[#c9a84c]">{req.team.name}</span> for{" "}
            <Link href={`/orgs/${req.orgProject.orgId}/projects/${req.orgProject.id}`} className="text-[#c9a84c] hover:underline">
              {req.orgProject.title}
            </Link>{" "}
            · {req.orgProject.org.name}
          </p>
          {req.message && (
            <p className="text-xs text-[#8A8898] mt-1.5 italic bg-[#111C32] rounded-lg px-3 py-2">"{req.message}"</p>
          )}
          {status === "PENDING" ? (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onRespond(req.id, "ACCEPTED")}
                className="px-4 py-1.5 rounded-lg bg-[#c9a84c] text-[#05080F] text-xs font-semibold hover:bg-[#e3c06a] transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onRespond(req.id, "DECLINED")}
                className="px-4 py-1.5 rounded-lg border border-[rgba(201,168,76,0.12)] text-[#8A8898] text-xs hover:border-red-500/30 hover:text-red-400 transition-colors"
              >
                Decline
              </button>
            </div>
          ) : (
            <span className={cn(
              "inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full",
              status === "ACCEPTED" ? "bg-green-950 text-green-400" : "bg-[#1e1e24] text-[#5A5570]"
            )}>
              {status === "ACCEPTED" ? "Accepted" : "Declined"}
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
git add "app/(dashboard)/notifications"
git commit -m "feat: add notifications page for recruitment requests"
```

---

### Task 9: UI — Team Workspace Status Banner + Sidebar Notifications Link

**Files:**
- Modify: `app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add status banner to TeamWorkspaceClient**

In `TeamWorkspaceClient.tsx`, after the existing header `<div>` (the one with `flex items-start justify-between mb-4 pb-4 border-b`), add a status banner based on `team.status`. Insert this right after the header closing `</div>`:

```tsx
{/* Application status banner */}
{team.status === "SUBMITTED" && (
  <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-950/40 border border-blue-500/20">
    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
    <div className="flex-1">
      <p className="text-sm font-medium text-blue-300">Application under review</p>
      <p className="text-xs text-blue-400/70">The org is reviewing your team's application.</p>
    </div>
  </div>
)}
{team.status === "ACCEPTED" && (
  <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-green-950/40 border border-green-500/20">
    <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
    <div className="flex-1">
      <p className="text-sm font-medium text-green-300">Accepted — you're in!</p>
      <p className="text-xs text-green-400/70">Your team has been accepted. Full workspace unlocked.</p>
    </div>
  </div>
)}
{team.status === "ACTIVE" && (
  <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111C32] border border-[rgba(201,168,76,0.12)]">
    <div className="flex-1">
      <p className="text-sm font-medium text-[#8A8898]">No active application</p>
      <p className="text-xs text-[#5A5570]">
        Browse org projects and apply to unlock the full platform.{" "}
        <Link href="/orgs" className="text-[#c9a84c] hover:underline">Browse orgs →</Link>
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 2: Add notifications link to Sidebar.tsx**

Read `components/layout/Sidebar.tsx` to see the current nav links. Find the `navLinks` array (or wherever the nav items are defined). Add a Notifications item:

```tsx
{ href: "/notifications", icon: Bell, label: "Notifications" }
```

Import `Bell` from lucide-react at the top if not already imported.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx "app/(dashboard)/teams"
git commit -m "feat: add application status banner and notifications nav link"
```

---

### Task 10: Seed Sample OrgProject Data

**Files:**
- Create (temporary): `scripts/seed-org-projects.ts`

- [ ] **Step 1: Check if any orgs exist in the DB**

```bash
cd "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP"
npx tsx -e "
const { prisma } = require('./lib/prisma');
async function main() {
  const orgs = await prisma.org.findMany({ select: { id: true, name: true } });
  console.log(JSON.stringify(orgs, null, 2));
  await prisma.\$disconnect();
}
main();
"
```

- [ ] **Step 2: If orgs exist, seed 2-3 projects per org**

```typescript
// scripts/seed-org-projects.ts
import { prisma } from "../lib/prisma";

async function main() {
  const orgs = await prisma.org.findMany({ select: { id: true, name: true } });
  
  for (const org of orgs) {
    const existing = await prisma.orgProject.count({ where: { orgId: org.id } });
    if (existing > 0) continue;

    await prisma.orgProject.createMany({
      data: [
        {
          orgId: org.id,
          title: "Product Research Track",
          description: "Build a user research framework and deliver actionable insights for our 2026 product roadmap.",
          openSpots: 3,
          requiredSkills: JSON.stringify(["DYNAMO", "STEEL", "Research"]),
        },
        {
          orgId: org.id,
          title: "Engineering Cohort",
          description: "Develop a core feature end-to-end, from technical spec through deployment.",
          openSpots: 2,
          requiredSkills: JSON.stringify(["DYNAMO", "BLAZE", "TypeScript"]),
        },
      ],
    });
    console.log(`Seeded projects for ${org.name}`);
  }
  
  await prisma.$disconnect();
}

main();
```

Run it:
```bash
npx tsx scripts/seed-org-projects.ts
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-org-projects.ts
git commit -m "chore: add org projects seed script"
```

---

### Task 11: Build Verification

- [ ] **Step 1: Run type check**

```bash
cd "C:/Users/thoma/OneDrive/Documents/GitHub/Goal-APP"
npx tsc --noEmit
```

Expected: No type errors. If there are errors, fix them before proceeding.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build completes successfully with no errors.

- [ ] **Step 3: Fix any build errors found**

Common issues to watch for:
- Missing `import Link from "next/link"` in new files
- `params` must be awaited in Next.js 15 (already handled in code above)
- Prisma client not recognizing new models → ensure `npx prisma generate` ran as part of migration
- `GeniusTypeKey` import path — use `@/lib/geniusTypes`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve build issues from six-step workflow"
git push origin main
```
