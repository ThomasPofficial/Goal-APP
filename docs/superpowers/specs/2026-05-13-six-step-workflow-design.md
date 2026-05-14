# Nivarro — 6-Step Workflow

**Date:** 2026-05-13  
**Status:** Approved

---

## Problem

The core Nivarro platform journey — the thing that makes it a real product — is not wired up:

1. A user browses orgs and finds one they like
2. They pick a specific project within that org (with open spots and required skills)
3. They search the scholar pool for teammates matching those skills
4. They send recruitment requests to scholars they want on their team
5. The assembled team submits a group application to the org project
6. When accepted, the platform "unlocks" — full messaging and team workspace becomes active

Currently: orgs exist, teams exist, but there is no `OrgProject`, no `RecruitmentRequest`, no `TeamApplication`. The apply endpoint (`/api/orgs/[id]/apply`) sets `team.status = SUBMITTED` but there's no project-level tracking and no acceptance flow.

---

## Design

### 1. New Prisma Models

**OrgProject** — a specific open position within an org
```prisma
model OrgProject {
  id             String           @id @default(cuid())
  orgId          String
  title          String
  description    String?
  openSpots      Int              @default(1)
  requiredSkills String           @default("[]")  // JSON: GeniusType[] or trait slugs
  deadline       DateTime?
  status         OrgProjectStatus @default(OPEN)
  createdAt      DateTime         @default(now())

  org              Org                @relation(fields: [orgId], references: [id], onDelete: Cascade)
  recruitmentReqs  RecruitmentRequest[]
  teamApplications TeamApplication[]
}

enum OrgProjectStatus {
  OPEN
  CLOSED
  FILLED
}
```

**RecruitmentRequest** — a team member invites a scholar to join their team for a project
```prisma
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

enum RecruitmentStatus {
  PENDING
  ACCEPTED
  DECLINED
}
```

**TeamApplication** — a team applies to an org project
```prisma
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

enum ApplicationStatus {
  PENDING
  ACCEPTED
  REJECTED
  WITHDRAWN
}
```

Also add `ACCEPTED` to the existing `TeamStatus` enum (currently ACTIVE/SUBMITTED/COMPLETED).

Profile gets two new relations: `sentRecruitments` and `receivedRecruitments`.  
Team gets `recruitmentRequests` and `teamApplications` relations.

---

### 2. API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/org-projects?orgId=` | List projects for an org |
| POST | `/api/org-projects` | Create org project (org admin) |
| GET | `/api/org-projects/[id]` | Project detail with applications |
| GET | `/api/org-projects/[id]/scholars` | Scholar search with genius/trait filter |
| POST | `/api/org-projects/[id]/recruit` | Send recruitment request |
| PATCH | `/api/recruitment-requests/[id]` | Accept / decline request |
| GET | `/api/recruitment-requests?received=true` | Pending requests for current user |
| POST | `/api/org-projects/[id]/apply` | Team submits application |
| PATCH | `/api/team-applications/[id]` | Org accepts / rejects (admin) |

---

### 3. UI Pages & Components

**Step 1 — Org Detail** (`/orgs/[orgId]`)  
Add "Projects" section below the existing org info. Shows `OrgProject` cards with title, open spots, required skills badges, deadline. Existing `OrgDetailClient.tsx` gets a `projects` prop.

**Step 2 — Project Detail** (`/orgs/[orgId]/projects/[projectId]`)  
New page. Shows: project description, open spots remaining, required skills, and two panels:
- Scholar Search (genius type filter + trait filter, paginated list of matching profiles)
- Team panel (which team you're building, current members)

**Step 3 — Scholar Search** (embedded in project detail)  
`ScholarSearch` component: filter bar (genius type chips + trait chips), calls `/api/org-projects/[id]/scholars?geniusType=&traits=`. Each result card shows avatar, name, genius type, top traits, and a "Recruit" button.

**Step 4 — Recruitment Request** (modal on scholar card)  
"Recruit" opens a small modal: select which of your teams to recruit for, optional message, send. Calls `POST /api/org-projects/[id]/recruit`.

Scholar receives a notification — shown as a badge on the bell icon and in a `/notifications` page. Each request shows project name, recruiter name, team name, message, Accept/Decline buttons.

**Step 5 — Team Application** (on project detail page, bottom panel)  
Once team has ≥1 member, show "Apply as Team" section. Select your team, write a "why join" message, submit. Calls `POST /api/org-projects/[id]/apply`.

**Step 6 — Platform Unlock** (on team workspace `/teams/[teamId]`)  
When `TeamApplication.status === ACCEPTED`: team status banner changes from "Application pending" to "Accepted — you're in." Full messaging and noteboard are shown regardless of lock status. On the org project page, a "Manage Applications" tab appears for org admins to accept/reject.

---

### 4. Notifications

A simple `/notifications` page lists:
- Incoming recruitment requests (with accept/decline)
- Application status updates (pending → accepted/rejected)

Notification count badge on sidebar nav icon ("bell" or next to Messages).  
No real-time push needed — polling on page load is fine.

---

### 5. Platform Lock Logic

Currently the team workspace shows everything freely. After this:
- Teams in `ACTIVE` status (no pending application) see a prompt: "Apply to an org project to unlock full features"
- Teams in `SUBMITTED` see: "Application pending review"
- Teams in `ACCEPTED` (new status) see: full workspace, all features unlocked

The lock is soft — messages and noteboard still exist, but the workspace shows the status banner prominently. No hard feature gating needed.

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add OrgProject, RecruitmentRequest, TeamApplication, ApplicationStatus, OrgProjectStatus, RecruitmentStatus enums; extend Profile, Team |
| `app/api/org-projects/route.ts` | GET list, POST create |
| `app/api/org-projects/[id]/route.ts` | GET detail |
| `app/api/org-projects/[id]/scholars/route.ts` | Scholar search with filter |
| `app/api/org-projects/[id]/recruit/route.ts` | POST send recruitment request |
| `app/api/org-projects/[id]/apply/route.ts` | POST team application |
| `app/api/recruitment-requests/[id]/route.ts` | PATCH accept/decline |
| `app/api/recruitment-requests/route.ts` | GET received requests |
| `app/api/team-applications/[id]/route.ts` | PATCH accept/reject (admin) |
| `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx` | Add projects section |
| `app/(dashboard)/orgs/[orgId]/projects/[projectId]/page.tsx` | New project detail page |
| `app/(dashboard)/orgs/[orgId]/projects/[projectId]/ProjectDetailClient.tsx` | New client component |
| `app/(dashboard)/notifications/page.tsx` | New notifications page |
| `app/(dashboard)/notifications/NotificationsClient.tsx` | New notifications client |
| `app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx` | Add status banner, application status |
| `components/layout/Sidebar.tsx` | Add notifications link with badge |

---

## Out of Scope

- Org admin portal (creating/managing orgs) — orgs are seeded or added via DB directly for now
- Email notifications for accepted applications
- Real-time push notifications
- Payment or verification flows
