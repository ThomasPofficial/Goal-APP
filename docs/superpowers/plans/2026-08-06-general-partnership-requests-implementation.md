# General Partnership Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1:1 mentor-request flow on `/my-school` with a general group "partnership request" flow (any mix of students/alumni/staff, admin-approved, 48h auto-finalize window), and rename the mentorship surfaces to "Partnerships".

**Architecture:** New `PartnershipRequest`/`PartnershipInvite` Prisma models + `/api/partnerships/*` routes, additive alongside the untouched `ConnectionRequest` model (still used by the unrelated site-wide `/alumni` directory). `/my-school`, `/mentorship` (→ `/partnerships`), and `/school/mentorship` (→ `/school/partnerships`) are updated to use the new models; old routes become redirect stubs.

**Tech Stack:** Next.js App Router, TypeScript, Prisma / PostgreSQL, NextAuth v5, zod, lucide-react icons, inline `style={{}}` objects (this codebase's dashboard pages do not use Tailwind or a component library — match existing inline-style patterns exactly).

## Global Constraints

- No automated test runner is configured in this repo (`package.json` has no `test` script, no jest/vitest/playwright dependency). Verification for every task is: `npx tsc --noEmit` must show no new errors, plus the manual check described in the task.
- Follow existing code style exactly: inline `style={{}}` objects using the CSS custom properties already used in each file (`var(--border)`, `var(--muted)`, `var(--text)`, `var(--bg)`, `var(--surface)`, `var(--amber)`, `var(--font-mono)`, `var(--n-text2)`, etc.).
- `ConnectionRequest`, `ConnectionRequestStatus`, `/api/connections/*`, `/api/school/connections/*`, and `RequestMentorshipModal` as used by `/alumni`/`AlumniDirectory.tsx` are **out of scope** — do not modify them.
- The idea-board API routes under `/api/mentorship/[conversationId]/ideas/*`, and the admin-direct-pairing API routes under `/api/school/mentorship/route.ts` and `/api/school/mentorship/[conversationId]/route.ts` **stay at their current paths** — only the page routes and the request/approval API routes are renamed/replaced.
- `ConversationType.MENTORSHIP` enum value is **not** renamed — only display copy and page/route paths change.
- Run `git status --porcelain` before starting each task; other concurrent sessions may be editing this repo — if you see changes outside this plan's file list, ignore them and stay scoped to the files below.
- Dev server: `npm run dev` (Turbopack). A pre-existing unescaped `#` in `app/globals.css` can cause a CSS parse 500 unrelated to this plan — not something to fix here.

---

### Task 1: Schema — add `PartnershipRequest` + `PartnershipInvite`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `prisma.partnershipRequest`, `prisma.partnershipInvite` Prisma Client models, consumed by Tasks 2–7.

- [ ] **Step 1: Add the new models and enums**

In `prisma/schema.prisma`, immediately after the `ConnectionRequestStatus` enum (currently ends at line 354, right before `model Message {`), insert:

```prisma
model PartnershipRequest {
  id          String                   @id @default(cuid())
  schoolId    String
  fromUserId  String
  message     String?
  status      PartnershipRequestStatus @default(PENDING)
  roomId      String?
  expiresAt   DateTime
  createdAt   DateTime                 @default(now())
  finalizedAt DateTime?

  invites PartnershipInvite[]

  @@index([schoolId, status])
}

enum PartnershipRequestStatus {
  PENDING
  AWAITING_APPROVAL
  APPROVED
  EXPIRED_EMPTY
  REJECTED
}

model PartnershipInvite {
  id          String                  @id @default(cuid())
  requestId   String
  userId      String
  status      PartnershipInviteStatus @default(PENDING)
  respondedAt DateTime?

  request PartnershipRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([requestId])
  @@index([userId, status])
}

enum PartnershipInviteStatus {
  PENDING
  ACCEPTED
  DECLINED
}
```

Use this exact anchor for the edit — old text:

```prisma
enum ConnectionRequestStatus {
  PENDING
  ACCEPTED
  DECLINED
}

model Message {
```

New text: the same, with the block above inserted between the closing `}` of `ConnectionRequestStatus` and `model Message {`.

- [ ] **Step 2: Generate and apply the migration**

Run: `cd "C:\Users\thoma\Goal-APP" && npx prisma migrate dev --name add_partnership_request_and_invite`
Expected: a new folder under `prisma/migrations/` (timestamp prefix + `add_partnership_request_and_invite`) containing `migration.sql` with `CREATE TABLE "PartnershipRequest"`, `CREATE TABLE "PartnershipInvite"`, and the two new enum types. Prisma Client regenerates automatically.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (nothing consumes the new models yet).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add PartnershipRequest and PartnershipInvite models"
```

---

### Task 2: `lib/partnerships.ts` + `POST /api/partnerships/request`

**Files:**
- Create: `lib/partnerships.ts`
- Create: `app/api/partnerships/request/route.ts`

**Interfaces:**
- Consumes: `prisma.partnershipRequest`, `prisma.partnershipInvite` (Task 1); `getSchoolId` from `lib/communities.ts` (existing).
- Produces: `isEligiblePartner(userId: string): Promise<boolean>`, `finalizeExpiredPartnershipRequests(schoolId: string): Promise<void>`, `buildGroupName(names: string[]): string`, `partnerUserSummary(userId: string): Promise<{ id: string; displayName: string; handle: string | null; avatarUrl: string | null }>`, `createPartnershipRoom(schoolId: string, participantIds: string[], groupName: string): Promise<{ id: string }>`, `PARTNERSHIP_WINDOW_MS: number` — all consumed by Tasks 3, 4, 5, 6, 7. `POST /api/partnerships/request` — request `{ toUserIds: string[], message?: string }`, response `{ request: PartnershipRequest & { invites: PartnershipInvite[] } }` on 200, `{ error: string }` on 400/403/404.

- [ ] **Step 1: Write `lib/partnerships.ts`**

```ts
import { prisma } from "@/lib/prisma";

export const PARTNERSHIP_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * A user counts toward the "at least one alumni/staff" guardrail if they're
 * alumni or have a staff title. Mirrors the eligibility check historically
 * used by /api/connections/request.
 */
export async function isEligiblePartner(userId: string): Promise<boolean> {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isAlumni: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { staffTitle: true } }),
  ]);
  return Boolean(user?.isAlumni) || Boolean(profile?.staffTitle);
}

export async function partnerUserSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } },
  });
  return {
    id: userId,
    displayName: user?.profile?.displayName ?? user?.name ?? "Someone",
    handle: user?.profile?.handle ?? null,
    avatarUrl: user?.profile?.avatarUrl ?? null,
  };
}

export function buildGroupName(names: string[]): string {
  if (names.length === 0) return "Partnership";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/**
 * Creates a MENTORSHIP-type conversation (NOT lib/communities.ts's
 * createPrivateRoom, which hardcodes type: 'COMMUNITY' — those rooms surface
 * on /communities, not /partnerships). Mirrors the shape used by the
 * school-admin direct-pairing tool (app/api/school/mentorship/route.ts POST)
 * so approved partnerships land in the same place and get the same
 * chat/idea-board/rename UI on /partnerships.
 */
export async function createPartnershipRoom(
  schoolId: string,
  participantIds: string[],
  groupName: string
): Promise<{ id: string }> {
  const uniqueIds = [...new Set(participantIds)];
  return prisma.conversation.create({
    data: {
      type: "MENTORSHIP",
      schoolId,
      communityName: groupName,
      participants: { create: uniqueIds.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });
}

/**
 * Lazily finalizes PENDING partnership requests whose 48h window has
 * passed. No cron infra exists in this app, so this is called at the top
 * of every page/route that reads partnership data for a school.
 */
export async function finalizeExpiredPartnershipRequests(schoolId: string): Promise<void> {
  const expired = await prisma.partnershipRequest.findMany({
    where: { schoolId, status: "PENDING", expiresAt: { lte: new Date() } },
    include: { invites: true },
  });

  for (const request of expired) {
    const acceptedIds = request.invites.filter((i) => i.status === "ACCEPTED").map((i) => i.userId);
    let hasEligible = false;
    for (const id of acceptedIds) {
      if (await isEligiblePartner(id)) {
        hasEligible = true;
        break;
      }
    }
    await prisma.partnershipRequest.update({
      where: { id: request.id },
      data: {
        status: hasEligible ? "AWAITING_APPROVAL" : "EXPIRED_EMPTY",
        finalizedAt: new Date(),
      },
    });
  }
}
```

- [ ] **Step 2: Write `app/api/partnerships/request/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolId } from "@/lib/communities";
import { isEligiblePartner, PARTNERSHIP_WINDOW_MS } from "@/lib/partnerships";
import { z } from "zod";

const requestSchema = z.object({
  toUserIds: z.array(z.string().min(1)).min(1),
  message: z.string().trim().max(500).optional(),
});

// POST — student/alumni requests a group partnership with any mix of people at their school
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fromUserId = session.user.id;

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const toUserIds = [...new Set(parsed.data.toUserIds)];
  const message = parsed.data.message || null;

  if (toUserIds.includes(fromUserId)) {
    return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
  }

  const fromUser = await prisma.user.findUnique({
    where: { id: fromUserId },
    select: { role: true },
  });
  if (!fromUser || fromUser.role === "SCHOOL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const eligibility = await Promise.all(toUserIds.map((id) => isEligiblePartner(id)));
  if (!eligibility.some(Boolean)) {
    return NextResponse.json({ error: "Include at least one alumni or teacher/staff member" }, { status: 400 });
  }

  const request = await prisma.partnershipRequest.create({
    data: {
      schoolId: fromSchoolId,
      fromUserId,
      message,
      expiresAt: new Date(Date.now() + PARTNERSHIP_WINDOW_MS),
      invites: { create: toUserIds.map((userId) => ({ userId })) },
    },
    include: { invites: true },
  });

  return NextResponse.json({ request });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/partnerships.ts` or `app/api/partnerships/request/route.ts`.

- [ ] **Step 4: Manual check**

`npm run dev`. Open Prisma Studio (`npx prisma studio`) or query the DB to find, within one school: your logged-in walled student's `userId`, one alumni or staff `userId` (`Profile.staffTitle` set, or `User.isAlumni: true`), and one other plain student `userId`. Log in as the walled student in the browser, then in devtools console:

```js
fetch('/api/partnerships/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ toUserIds: ['<alumni-or-staff-id>', '<other-student-id>'], message: 'Test request' }),
}).then(r => r.json()).then(console.log);
```

Confirm it returns `{ request: { ... invites: [ ...2 rows ] } }` with status 200. Repeat with only the plain-student id in `toUserIds` (no alumni/staff) — confirm it returns `{ error: "Include at least one alumni or teacher/staff member" }` with status 400. Repeat with your own id included — confirm `{ error: "Cannot invite yourself" }`.

- [ ] **Step 5: Commit**

```bash
git add lib/partnerships.ts app/api/partnerships/request/route.ts
git commit -m "feat(partnerships): add creation endpoint and shared helpers"
```

---

### Task 3: `PATCH /api/partnerships/invites/[id]/respond`

**Files:**
- Create: `app/api/partnerships/invites/[id]/respond/route.ts`

**Interfaces:**
- Consumes: `prisma.partnershipInvite` (Task 1).
- Produces: `PATCH /api/partnerships/invites/:id/respond` — request `{ action: "accept" | "decline" }`, response `{ invite: PartnershipInvite }` on 200, `{ error: string }` on 400/401/403/404/409. Consumed by Task 6 (`PartnershipsClient.tsx`).

- [ ] **Step 1: Write the route file**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const respondSchema = z.object({ action: z.enum(["accept", "decline"]) });

// PATCH — the invited person accepts or declines
export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const invite = await prisma.partnershipInvite.findUnique({
    where: { id },
    include: { request: true },
  });
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (invite.status !== "PENDING" || invite.request.status !== "PENDING") {
    return NextResponse.json({ error: "Already responded to" }, { status: 409 });
  }

  const updated = await prisma.partnershipInvite.update({
    where: { id },
    data: {
      status: parsed.data.action === "accept" ? "ACCEPTED" : "DECLINED",
      respondedAt: new Date(),
    },
  });

  return NextResponse.json({ invite: updated });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/api/partnerships/invites/[id]/respond/route.ts`.

- [ ] **Step 3: Manual check**

Using the `PartnershipInvite` id created by Task 2's manual check (look it up via Prisma Studio, filtering `PartnershipInvite` by `userId = '<alumni-or-staff-id>'`), log in as that alumni/staff account and run in devtools console:

```js
fetch('/api/partnerships/invites/<inviteId>/respond', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'accept' }),
}).then(r => r.json()).then(console.log);
```

Confirm `{ invite: { status: "ACCEPTED", ... } }` with status 200. Run it again — confirm `{ error: "Already responded to" }` with status 409. Log in as a third, uninvolved account and try responding to a different pending invite that isn't theirs — confirm `{ error: "Forbidden" }` with status 403.

- [ ] **Step 4: Commit**

```bash
git add "app/api/partnerships/invites/[id]/respond/route.ts"
git commit -m "feat(partnerships): add invite accept/decline endpoint"
```

---

### Task 4: `POST /api/school/partnerships/[id]/approve` + `POST /api/school/partnerships/[id]/reject`

**Files:**
- Create: `app/api/school/partnerships/[id]/approve/route.ts`
- Create: `app/api/school/partnerships/[id]/reject/route.ts`

**Interfaces:**
- Consumes: `prisma.partnershipRequest` (Task 1); `createPartnershipRoom`, `buildGroupName`, `partnerUserSummary` from `lib/partnerships.ts` (Task 2 — **not** `createPrivateRoom` from `lib/communities.ts`, which creates `type: 'COMMUNITY'` rooms that surface on `/communities`, not `/partnerships`).
- Produces: `POST /api/school/partnerships/:id/approve` — response `{ request: PartnershipRequest, room: { id: string } }` on 200. `POST /api/school/partnerships/:id/reject` — response `{ request: PartnershipRequest }` on 200. Both consumed by Task 7 (`SchoolPartnershipsClient.tsx`).

- [ ] **Step 1: Write the approve route**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPartnershipRoom, buildGroupName, partnerUserSummary } from "@/lib/partnerships";

type Params = Promise<{ id: string }>;

// POST — school admin approves an AWAITING_APPROVAL request, creating the group room
export async function POST(_req: Request, { params }: { params: Params }) {
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

  const request = await prisma.partnershipRequest.findUnique({
    where: { id },
    include: { invites: true },
  });
  if (!request || request.schoolId !== schoolId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (request.status !== "AWAITING_APPROVAL") {
    return NextResponse.json({ error: "Not ready for approval" }, { status: 409 });
  }

  const acceptedIds = request.invites.filter((i) => i.status === "ACCEPTED").map((i) => i.userId);
  const participantSummaries = await Promise.all([request.fromUserId, ...acceptedIds].map(partnerUserSummary));
  const groupName = buildGroupName(participantSummaries.map((p) => p.displayName));

  const room = await createPartnershipRoom(schoolId, [request.fromUserId, ...acceptedIds, schoolId], groupName);

  if (request.message) {
    await prisma.message.create({
      data: { conversationId: room.id, senderId: request.fromUserId, content: request.message },
    });
  }

  const updated = await prisma.partnershipRequest.update({
    where: { id },
    data: { status: "APPROVED", roomId: room.id },
  });

  return NextResponse.json({ request: updated, room });
}
```

- [ ] **Step 2: Write the reject route**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

// POST — school admin declines an AWAITING_APPROVAL request
export async function POST(_req: Request, { params }: { params: Params }) {
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

  const request = await prisma.partnershipRequest.findUnique({ where: { id } });
  if (!request || request.schoolId !== schoolId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (request.status !== "AWAITING_APPROVAL") {
    return NextResponse.json({ error: "Not ready for rejection" }, { status: 409 });
  }

  const updated = await prisma.partnershipRequest.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  return NextResponse.json({ request: updated });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing either new route file.

- [ ] **Step 4: Manual check**

Using Prisma Studio, manually set the `PartnershipRequest` row created in Task 2/3's manual checks to `status: "AWAITING_APPROVAL"` (since Task 5 — the finalize sweep — isn't wired into a page yet). Log in as the `SCHOOL` account for that school and run in devtools console:

```js
fetch('/api/school/partnerships/<requestId>/approve', { method: 'POST' }).then(r => r.json()).then(console.log);
```

Confirm `{ request: { status: "APPROVED", roomId: "..." }, room: { id: "..." } }` with status 200. Verify in Prisma Studio that a new `Conversation` row with `type: "MENTORSHIP"` and `communityName` set to the generated group name exists, with participants matching the requester + accepted invitee(s) + the school account. Create a second test request the same way (reset it to `AWAITING_APPROVAL` via Prisma Studio) and confirm `/reject` sets `status: "REJECTED"` with no room created.

- [ ] **Step 5: Commit**

```bash
git add app/api/school/partnerships
git commit -m "feat(partnerships): add school admin approve/reject endpoints"
```

---

### Task 5: `/my-school` — multi-select partnership request UI

**Files:**
- Modify: `app/(dashboard)/my-school/page.tsx`
- Modify: `app/(dashboard)/my-school/SchoolHubClient.tsx`
- Create: `components/partnerships/RequestPartnershipModal.tsx`

**Interfaces:**
- Consumes: `POST /api/partnerships/request` (Task 2); `finalizeExpiredPartnershipRequests` from `lib/partnerships.ts` (Task 2).
- Produces: nothing consumed by later tasks — self-contained.

- [ ] **Step 1: Add a Students query and finalize call to `page.tsx`**

Replace the full contents of `app/(dashboard)/my-school/page.tsx` with:

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

  await finalizeExpiredPartnershipRequests(schoolId);

  const [school, staffProfiles, allAlumni, allStudents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        profile: { select: { displayName: true, headline: true, bio: true } },
      },
    }),
    prisma.profile.findMany({
      where: { schoolId, staffTitle: { not: null } },
      select: {
        userId: true,
        displayName: true,
        staffTitle: true,
        bio: true,
        avatarUrl: true,
        handle: true,
        industry: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: {
        isAlumni: true,
        profile: { schoolId },
      },
      select: {
        id: true,
        name: true,
        profile: {
          select: {
            displayName: true,
            handle: true,
            avatarUrl: true,
            bio: true,
            industry: true,
            graduationYear: true,
            isAvailableToMentor: true,
            intendedCollege: true,
            teamMemberships: {
              select: { team: { select: { name: true, org: { select: { name: true } } } } },
              take: 3,
            },
            orgReviews: {
              select: { org: { select: { name: true } } },
              take: 3,
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.profile.findMany({
      where: { schoolId, staffTitle: null, user: { isAlumni: false }, userId: { not: session.user.id } },
      select: { userId: true, displayName: true, handle: true, avatarUrl: true, graduationYear: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  const schoolName = school?.profile?.displayName ?? school?.name ?? "Your School";
  const schoolTagline = school?.profile?.headline ?? "Your private Nivarro community";

  const formattedAlumni = allAlumni.map((u) => ({
    id: u.id,
    displayName: u.profile?.displayName ?? u.name ?? "Alumni",
    handle: u.profile?.handle ?? null,
    avatarUrl: u.profile?.avatarUrl ?? null,
    bio: u.profile?.bio ?? null,
    industry: u.profile?.industry ?? null,
    graduationYear: u.profile?.graduationYear ?? null,
    isAvailableToMentor: u.profile?.isAvailableToMentor ?? false,
    intendedCollege: u.profile?.intendedCollege ?? null,
    orgs: [
      ...new Set([
        ...(u.profile?.teamMemberships ?? []).map((m) => m.team.org?.name).filter(Boolean),
        ...(u.profile?.orgReviews ?? []).map((r) => r.org.name),
      ]),
    ].slice(0, 3) as string[],
  }));

  const mentors = formattedAlumni.filter((a) => a.isAvailableToMentor);

  const formattedStudents = allStudents.map((s) => ({
    id: s.userId,
    displayName: s.displayName,
    handle: s.handle,
    avatarUrl: s.avatarUrl,
    graduationYear: s.graduationYear,
  }));

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
}
```

(This drops the old `myOutgoingRequests`/`initialRequestedIds` plumbing — the per-person "already requested" dedupe is intentionally not carried over to the group flow, per the design spec.)

- [ ] **Step 2: Create the new request modal**

Create `components/partnerships/RequestPartnershipModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Person {
  id: string;
  displayName: string;
}

interface Props {
  people: Person[];
  onSend: (message: string) => Promise<void> | void;
  onClose: () => void;
}

export default function RequestPartnershipModal({ people, onSend, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await onSend(message.trim());
    setSending(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0,
          width: "100%", maxWidth: 460, padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 6px" }}>
              Request a Partnership
            </p>
            <p style={{ fontSize: 14, color: "var(--text)", margin: 0, lineHeight: 1.5 }}>
              {people.map((p) => p.displayName).join(", ")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--n-muted)", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <label style={{ display: "block", fontSize: 12, color: "var(--n-text2)", marginBottom: 8 }}>
          Tell them what you&apos;re hoping for (optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="e.g. I'd love to put together a small group to work on..."
          style={{
            width: "100%", background: "var(--surface2)", border: "1px solid var(--border-md)",
            borderRadius: 0, padding: "10px 12px", fontSize: 13, color: "var(--text)",
            fontFamily: "inherit", resize: "vertical", marginBottom: 12,
          }}
        />
        <p style={{ fontSize: 11, color: "var(--n-muted)", margin: "0 0 16px" }}>
          Each person has 48 hours to respond. Once at least one alumni or staff member accepts, your school admin creates the group chat.
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={sending}
            style={{
              padding: "8px 16px", border: "1px solid var(--border-md)", background: "transparent",
              color: "var(--n-text2)", borderRadius: 0, cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: "8px 16px", border: "1px solid var(--amber)", background: "var(--amber)",
              color: "#000", borderRadius: 0, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1,
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            }}
          >
            {sending ? "Sending…" : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `SchoolHubClient.tsx` with multi-select mode**

Replace the full contents of `app/(dashboard)/my-school/SchoolHubClient.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { GraduationCap, Briefcase, BookOpen, CheckSquare, Square, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import RequestPartnershipModal from "@/components/partnerships/RequestPartnershipModal";

interface StaffMember {
  userId: string;
  displayName: string;
  staffTitle: string | null;
  bio: string | null;
  avatarUrl: string | null;
  handle: string | null;
  industry: string | null;
}

interface Alumnus {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  industry: string | null;
  graduationYear: number | null;
  isAvailableToMentor: boolean;
  intendedCollege: string | null;
  orgs: string[];
}

interface StudentPeer {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  graduationYear: number | null;
}

interface Props {
  schoolName: string;
  schoolTagline: string;
  staff: StaffMember[];
  alumni: Alumnus[];
  mentors: Alumnus[];
  students: StudentPeer[];
  currentUserId: string;
}

function Avatar({ name, avatarUrl, handle, size = 44 }: { name: string; avatarUrl: string | null; handle?: string | null; size?: number }) {
  const content = avatarUrl ? (
    <img src={avatarUrl} alt={name} width={size} height={size} style={{ borderRadius: 0, objectFit: "cover", flexShrink: 0, display: "block" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: 0, background: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ color: "#000", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size * 0.4 }}>{name[0]?.toUpperCase()}</span>
    </div>
  );
  return handle ? (
    <Link href={`/profile/${handle}`} style={{ flexShrink: 0, lineHeight: 0 }} title={`View ${name}'s profile`}>
      {content}
    </Link>
  ) : content;
}

function SelectBox({ checked }: { checked: boolean }) {
  return checked ? (
    <CheckSquare size={20} style={{ color: "var(--amber)", flexShrink: 0 }} />
  ) : (
    <Square size={20} style={{ color: "var(--n-muted)", flexShrink: 0 }} />
  );
}

export default function SchoolHubClient({ schoolName, schoolTagline, staff, alumni, mentors, students, currentUserId: _ }: Props) {
  const [alumniFilter, setAlumniFilter] = useState<"all" | "mentors">("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const visibleAlumni = alumniFilter === "mentors" ? alumni.filter((a) => a.isAvailableToMentor) : alumni;

  const allPeople = [
    ...staff.map((s) => ({ id: s.userId, displayName: s.displayName })),
    ...alumni.map((a) => ({ id: a.id, displayName: a.displayName })),
    ...students.map((s) => ({ id: s.id, displayName: s.displayName })),
  ];

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function submitRequest(message: string) {
    const res = await fetch("/api/partnerships/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserIds: [...selected], message: message || undefined }),
    });
    if (res.ok) {
      setShowModal(false);
      setSelectMode(false);
      setSelected(new Set());
      setBanner("Partnership request sent — you'll see responses on the Partnerships page.");
    } else {
      const data = await res.json().catch(() => null);
      setBanner(data?.error ?? "Couldn't send that request. Try again.");
      setShowModal(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>

      {/* School banner */}
      <div style={{ padding: "32px 36px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 8px" }}>
              Private Community
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.5vw, 46px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px", lineHeight: 1.05 }}>
              {schoolName}
            </h1>
            <p style={{ fontSize: 16, color: "var(--n-text2)", margin: 0 }}>{schoolTagline}</p>
          </div>
          {selectMode ? (
            <button
              onClick={cancelSelect}
              style={{
                padding: "10px 18px", borderRadius: 0, border: "1px solid var(--border-md)",
                background: "transparent", color: "var(--n-text2)", fontFamily: "var(--font-mono)",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setSelectMode(true)}
              style={{
                padding: "10px 18px", borderRadius: 0, border: "1px solid var(--amber)",
                background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Request a Partnership
            </button>
          )}
        </div>
      </div>

      {banner && (
        <div style={{ padding: "12px 16px", border: "1px solid var(--amber)", background: "rgba(232,137,58,0.1)", color: "var(--text)", fontSize: 13, marginBottom: 20 }}>
          {banner}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "Students", value: students.length },
          { label: "Alumni", value: alumni.length },
          { label: "Mentors", value: mentors.length },
          { label: "Staff", value: staff.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: "1 1 100px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "12px 18px" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 36, color: "var(--amber)", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
            <p style={{ margin: "3px 0 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--n-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Staff */}
      {staff.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
            School Staff
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {staff.map((s) => (
              <div key={s.userId} onClick={selectMode ? () => toggleSelected(s.userId) : undefined} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start", cursor: selectMode ? "pointer" : "default" }}>
                <Avatar name={s.displayName} avatarUrl={s.avatarUrl} handle={selectMode ? null : s.handle} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: "var(--text)" }}>
                    {!selectMode && s.handle ? (
                      <Link href={`/profile/${s.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{s.displayName}</Link>
                    ) : s.displayName}
                  </p>
                  {s.staffTitle && (
                    <p style={{ margin: "3px 0 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber)" }}>
                      {s.staffTitle}
                    </p>
                  )}
                  {s.bio && (
                    <p style={{ margin: "7px 0 0", fontSize: 13, color: "var(--n-text2)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {s.bio}
                    </p>
                  )}
                </div>
                {selectMode && <SelectBox checked={selected.has(s.userId)} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mentors spotlight */}
      {mentors.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
            Mentor Spotlight
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {mentors.map((m) => (
              <MentorCard key={m.id} alumnus={m} selectMode={selectMode} selected={selected.has(m.id)} onToggle={() => toggleSelected(m.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Alumni network */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: 0 }}>
            Alumni Network
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "mentors"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAlumniFilter(f)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 0,
                  border: alumniFilter === f ? "1px solid var(--amber)" : "1px solid var(--border)",
                  background: alumniFilter === f ? "var(--amber)" : "transparent",
                  color: alumniFilter === f ? "#000" : "var(--n-text2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {f === "all" ? "All" : "Mentors"}
              </button>
            ))}
          </div>
        </div>

        {visibleAlumni.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <GraduationCap size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
              {alumniFilter === "mentors" ? "No alumni have opened mentorship yet." : "No alumni yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {visibleAlumni.map((a) => (
              <AlumnusCard key={a.id} alumnus={a} selectMode={selectMode} selected={selected.has(a.id)} onToggle={() => toggleSelected(a.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Students */}
      <section>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
          Students
        </p>
        {students.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <UsersIcon size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No other students yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {students.map((s) => (
              <div key={s.id} onClick={selectMode ? () => toggleSelected(s.id) : undefined} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "15px 17px", display: "flex", gap: 11, alignItems: "center", cursor: selectMode ? "pointer" : "default" }}>
                <Avatar name={s.displayName} avatarUrl={s.avatarUrl} handle={selectMode ? null : s.handle} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {!selectMode && s.handle ? (
                      <Link href={`/profile/${s.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{s.displayName}</Link>
                    ) : s.displayName}
                  </p>
                  {s.graduationYear && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--n-text2)", letterSpacing: "0.08em" }}>
                      Class of {s.graduationYear}
                    </span>
                  )}
                </div>
                {selectMode && <SelectBox checked={selected.has(s.id)} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating selection bar */}
      {selectMode && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
          background: "var(--surface)", borderTop: "1px solid var(--border)",
          padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--n-text2)" }}>
            {selected.size === 0 ? "Select people to invite" : `${selected.size} selected`}
          </p>
          <button
            onClick={() => setShowModal(true)}
            disabled={selected.size === 0}
            style={{
              padding: "10px 20px", borderRadius: 0, border: "1px solid var(--amber)",
              background: selected.size === 0 ? "rgba(232,137,58,0.3)" : "var(--amber)",
              color: "#000", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              cursor: selected.size === 0 ? "not-allowed" : "pointer",
            }}
          >
            Continue
          </button>
        </div>
      )}

      {showModal && (
        <RequestPartnershipModal
          people={allPeople.filter((p) => selected.has(p.id))}
          onClose={() => setShowModal(false)}
          onSend={submitRequest}
        />
      )}
    </div>
  );
}

function MentorCard({ alumnus: a, selectMode, selected, onToggle }: { alumnus: Alumnus; selectMode: boolean; selected: boolean; onToggle: () => void }) {
  return (
    <div onClick={selectMode ? onToggle : undefined} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 11, cursor: selectMode ? "pointer" : "default" }}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <Avatar name={a.displayName} avatarUrl={a.avatarUrl} handle={selectMode ? null : a.handle} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: "var(--text)" }}>
            {!selectMode && a.handle ? <Link href={`/profile/${a.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{a.displayName}</Link> : a.displayName}
          </p>
          <div style={{ display: "flex", gap: 7, marginTop: 3, flexWrap: "wrap" }}>
            {a.graduationYear && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", fontWeight: 700, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 2 }}>
                <GraduationCap size={10} /> {`'${String(a.graduationYear).slice(-2)}`}
              </span>
            )}
            {a.industry && (
              <span style={{ fontSize: 12, color: "var(--n-text2)", display: "flex", alignItems: "center", gap: 2 }}>
                <Briefcase size={10} /> {a.industry}
              </span>
            )}
          </div>
        </div>
        {selectMode ? (
          <SelectBox checked={selected} />
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", background: "rgba(232,137,58,0.15)", padding: "2px 6px", borderRadius: 0, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
            MENTOR
          </span>
        )}
      </div>
      {a.bio && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--n-text2)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {a.bio}
        </p>
      )}
    </div>
  );
}

function AlumnusCard({ alumnus: a, selectMode, selected, onToggle }: { alumnus: Alumnus; selectMode: boolean; selected: boolean; onToggle: () => void }) {
  return (
    <div onClick={selectMode ? onToggle : undefined} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "15px 17px", display: "flex", gap: 11, alignItems: "center", cursor: selectMode ? "pointer" : "default" }}>
      <Avatar name={a.displayName} avatarUrl={a.avatarUrl} handle={selectMode ? null : a.handle} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {!selectMode && a.handle ? <Link href={`/profile/${a.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{a.displayName}</Link> : a.displayName}
        </p>
        <div style={{ display: "flex", gap: 9, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
          {a.graduationYear && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 2 }}>
              <GraduationCap size={10} /> {`'${String(a.graduationYear).slice(-2)}`}
            </span>
          )}
          {a.industry && (
            <span style={{ fontSize: 12, color: "var(--n-text2)" }}>{a.industry}</span>
          )}
          {a.intendedCollege && (
            <span style={{ fontSize: 12, color: "var(--n-text2)", display: "flex", alignItems: "center", gap: 2 }}>
              <BookOpen size={10} /> {a.intendedCollege.split(" ").slice(0, 2).join(" ")}
            </span>
          )}
          {a.isAvailableToMentor && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", background: "rgba(232,137,58,0.15)", padding: "1px 5px", letterSpacing: "0.08em" }}>
              MENTOR
            </span>
          )}
        </div>
      </div>
      {selectMode && <SelectBox checked={selected} />}
    </div>
  );
}
```

Note this drops the old `requestedIds`/`errorIds` per-person "already sent" tracking and the `RequestMentorshipModal` import — replaced by group `selected` state and `RequestPartnershipModal`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/(dashboard)/my-school/page.tsx`, `app/(dashboard)/my-school/SchoolHubClient.tsx`, or `components/partnerships/RequestPartnershipModal.tsx`.

- [ ] **Step 5: Manual check**

`npm run dev`. Log in as a walled student, go to `/my-school`. Confirm:
- A new "Students" section appears below Alumni Network, listing other students at the school.
- Clicking "Request a Partnership" switches every section into checkbox mode (staff/mentors/alumni/students all show checkboxes instead of profile-link-only cards).
- Selecting only students (no alumni/staff) then clicking "Continue" → sending shows the server's 400 error in the banner ("Include at least one alumni or teacher/staff member").
- Selecting a mix (one staff + one student) → "Continue" opens the modal with both names listed → sending shows the success banner and exits select mode.
- "Cancel" at any point clears the selection and exits select mode without submitting.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/my-school/page.tsx" "app/(dashboard)/my-school/SchoolHubClient.tsx" components/partnerships/RequestPartnershipModal.tsx
git commit -m "feat(my-school): replace 1:1 mentor request with group partnership request"
```

---

### Task 6: `/partnerships` (rename from `/mentorship`) — group-aware requests panel

**Files:**
- Create: `app/(dashboard)/partnerships/page.tsx`
- Create: `app/(dashboard)/partnerships/PartnershipsClient.tsx`
- Create: `app/api/partnerships/my-threads/route.ts`
- Modify: `app/(dashboard)/mentorship/page.tsx` (becomes a redirect stub)
- Delete: `app/(dashboard)/mentorship/MentorshipClient.tsx`
- Delete: `app/api/mentorship/my-threads/route.ts`

**Interfaces:**
- Consumes: `PATCH /api/partnerships/invites/[id]/respond` (Task 3); `finalizeExpiredPartnershipRequests`, `partnerUserSummary` from `lib/partnerships.ts` (Task 2); `getSchoolId` from `lib/communities.ts` (existing); `isWalledStudent` from `lib/accountGate.ts` (existing).
- Produces: nothing consumed by later tasks — self-contained. `GET /api/partnerships/my-threads` is a straight path-rename of the existing `/api/mentorship/my-threads` handler (same query/response shape), so `Task 7`'s admin surface is unaffected.

- [ ] **Step 1: Create `app/api/partnerships/my-threads/route.ts`**

Copy the current contents of `app/api/mentorship/my-threads/route.ts` verbatim into this new file (same handler, same query filtering `type: "MENTORSHIP"`, same response shape — only the file's path changes, not its logic). Read `app/api/mentorship/my-threads/route.ts` first to get its exact current contents (it may include the `name`/`canRename` fields from the earlier rename-chat feature — preserve whatever is currently there).

- [ ] **Step 2: Delete the old thread-list route**

```bash
git rm app/api/mentorship/my-threads/route.ts
```

- [ ] **Step 3: Create `app/(dashboard)/partnerships/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isWalledStudent } from "@/lib/accountGate";
import { getSchoolId } from "@/lib/communities";
import { finalizeExpiredPartnershipRequests, partnerUserSummary } from "@/lib/partnerships";
import PartnershipsClient from "./PartnershipsClient";

export default async function PartnershipsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [walled, schoolId] = await Promise.all([
    isWalledStudent(session.user.id),
    getSchoolId(session.user.id),
  ]);

  if (schoolId) {
    await finalizeExpiredPartnershipRequests(schoolId);
  }

  const [pendingInvites, myRequests] = await Promise.all([
    prisma.partnershipInvite.findMany({
      where: { userId: session.user.id, status: "PENDING", request: { status: "PENDING" } },
      include: { request: { include: { invites: true } } },
      orderBy: { request: { createdAt: "desc" } },
    }),
    prisma.partnershipRequest.findMany({
      where: { fromUserId: session.user.id },
      include: { invites: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Anyone who isn't a walled student still gets in if a request touches them.
  if (!walled && pendingInvites.length === 0 && myRequests.length === 0) redirect("/dashboard");

  const incoming = await Promise.all(
    pendingInvites.map(async (invite) => {
      const otherInvites = await Promise.all(
        invite.request.invites
          .filter((i) => i.userId !== session.user.id)
          .map(async (i) => ({ ...(await partnerUserSummary(i.userId)), status: i.status }))
      );
      return {
        inviteId: invite.id,
        message: invite.request.message,
        createdAt: invite.request.createdAt.toISOString(),
        fromUser: await partnerUserSummary(invite.request.fromUserId),
        otherInvites,
      };
    })
  );

  const sent = await Promise.all(
    myRequests.map(async (r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      roomId: r.roomId,
      invites: await Promise.all(
        r.invites.map(async (i) => ({ ...(await partnerUserSummary(i.userId)), status: i.status }))
      ),
    }))
  );

  return <PartnershipsClient myUserId={session.user.id} incomingRequests={incoming} sentRequests={sent} />;
}
```

- [ ] **Step 4: Create `app/(dashboard)/partnerships/PartnershipsClient.tsx`**

Read the current `app/(dashboard)/mentorship/MentorshipClient.tsx` first (it has the already-shipped chat rename affordance and Idea Board tab — preserve both unchanged). Then create `app/(dashboard)/partnerships/PartnershipsClient.tsx` as a copy of that file with these changes:

1. Rename the component to `PartnershipsClient`.
2. Change the thread-list fetch from `/api/mentorship/my-threads` to `/api/partnerships/my-threads`.
3. Leave every `/api/mentorship/${activeId}/ideas...` and `/api/conversations/${activeId}/...` call **unchanged** (idea board and chat/rename endpoints keep their current paths, per Global Constraints).
4. Replace the `IncomingRequest` interface, the `respond()` function, and the requests panel with the group-aware versions below. Add a new `SentRequest` interface and a "Requests You Sent" panel.

Replace:

```ts
interface IncomingRequest {
  id: string;
  message: string | null;
  createdAt: string;
  fromUser: Person;
}
```

with:

```ts
interface InviteStatusPerson extends Person {
  status: "PENDING" | "ACCEPTED" | "DECLINED";
}

interface IncomingRequest {
  inviteId: string;
  message: string | null;
  createdAt: string;
  fromUser: Person;
  otherInvites: InviteStatusPerson[];
}

type SentStatus = "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "EXPIRED_EMPTY" | "REJECTED";

interface SentRequest {
  id: string;
  status: SentStatus;
  message: string | null;
  createdAt: string;
  expiresAt: string;
  roomId: string | null;
  invites: InviteStatusPerson[];
}
```

Add, right after the `threadLabel` function:

```ts
function sentStatusLabel(r: SentRequest): string {
  switch (r.status) {
    case "PENDING":
      return `Collecting responses — closes ${new Date(r.expiresAt).toLocaleString()}`;
    case "AWAITING_APPROVAL":
      return "Waiting on your school admin to approve";
    case "APPROVED":
      return "Approved — chat is live";
    case "EXPIRED_EMPTY":
      return "Didn't come together — nobody eligible accepted in time";
    case "REJECTED":
      return "Your school admin declined this request";
  }
}
```

Change the component signature from:

```tsx
export default function MentorshipClient({ myUserId, incomingRequests = [] }: { myUserId: string; incomingRequests?: IncomingRequest[] }) {
```

to:

```tsx
export default function PartnershipsClient({ myUserId, incomingRequests = [], sentRequests = [] }: { myUserId: string; incomingRequests?: IncomingRequest[]; sentRequests?: SentRequest[] }) {
```

Replace the `respond` function:

```ts
  async function respond(id: string, action: "accept" | "decline") {
    setRespondingId(id);
    const res = await fetch(`/api/connections/${id}/respond`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
    setRespondingId(null);
  }
```

with:

```ts
  async function respond(inviteId: string, action: "accept" | "decline") {
    setRespondingId(inviteId);
    const res = await fetch(`/api/partnerships/invites/${inviteId}/respond`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.inviteId !== inviteId));
    }
    setRespondingId(null);
  }
```

Change the thread-list fetch:

```ts
    fetch("/api/mentorship/my-threads")
```

to:

```ts
    fetch("/api/partnerships/my-threads")
```

Replace the `requestsPanel` block's `.map()` (it currently keys/maps over `requests` using `r.id`, `r.fromUser`, `r.message`) with:

```tsx
  const requestsPanel = requests.length > 0 && (
    <div style={{ maxWidth: 900, marginBottom: 20, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <p style={{ margin: 0, padding: "12px 16px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)" }}>
        Incoming Requests
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {requests.map((r) => (
          <div
            key={r.inviteId}
            style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{r.fromUser.displayName}</p>
              {r.otherInvites.length > 0 && (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--n-text2)" }}>
                  Also invited: {r.otherInvites.map((p) => `${p.displayName} (${p.status.toLowerCase()})`).join(", ")}
                </p>
              )}
              {r.message && (
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--n-text2)", lineHeight: 1.5 }}>{r.message}</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => respond(r.inviteId, "accept")}
                disabled={respondingId === r.inviteId}
                title="Accept"
                style={{ width: 30, height: 30, border: "1px solid var(--amber)", background: "var(--amber)", color: "#000", cursor: respondingId === r.inviteId ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => respond(r.inviteId, "decline")}
                disabled={respondingId === r.inviteId}
                title="Decline"
                style={{ width: 30, height: 30, border: "1px solid var(--border-md)", background: "transparent", color: "var(--n-text2)", cursor: respondingId === r.inviteId ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const sentPanel = sentRequests.length > 0 && (
    <div style={{ maxWidth: 900, marginBottom: 20, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <p style={{ margin: 0, padding: "12px 16px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)" }}>
        Requests You Sent
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {sentRequests.map((r) => (
          <div key={r.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              {r.invites.map((i) => i.displayName).join(", ")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--n-text2)" }}>{sentStatusLabel(r)}</p>
          </div>
        ))}
      </div>
    </div>
  );
```

Everywhere the old file rendered `{requestsPanel}` alone (the loading state, the empty-threads state, and the main return), also render `{sentPanel}` immediately after it. In the empty-threads state, change the copy from "You haven't been paired with a mentor yet. Your school admin sets up mentorship groups." to "You don't have any partnership chats yet. Head to My School to request one." Also change the two `"Mentorship"` string literals used as thread-label fallbacks (in `threadLabel()` and the header's `active ? threadLabel(active) : "Mentorship"`) to `"Partnership"`.

- [ ] **Step 5: Create the redirect stub at the old `/mentorship` route**

Replace the full contents of `app/(dashboard)/mentorship/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default async function LegacyMentorshipRedirect({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const params = await searchParams;
  redirect(params.conversation ? `/partnerships?conversation=${params.conversation}` : "/partnerships");
}
```

- [ ] **Step 6: Delete the old client component**

```bash
git rm "app/(dashboard)/mentorship/MentorshipClient.tsx"
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing any file in this task.

- [ ] **Step 8: Manual check**

`npm run dev`. As the alumni/staff account from Task 2/3's manual checks (who has a PENDING invite), go to `/partnerships`. Confirm:
- "Incoming Requests" shows the request with "Also invited: \<other student\> (pending)".
- Accepting it removes it from the panel.
- As the requester (the walled student from Task 2), go to `/partnerships` and confirm "Requests You Sent" shows the request with a status line matching its current state (PENDING/AWAITING_APPROVAL/etc. — check Prisma Studio for the current row's `status`).
- Visit the old URL `/mentorship` directly — confirm it redirects to `/partnerships`. Visit `/mentorship?conversation=<some-id>` — confirm it redirects to `/partnerships?conversation=<some-id>`.
- If any existing MENTORSHIP thread exists, confirm it still opens, chat still sends, rename still works, and the Idea Board tab still works (regression check on the untouched functionality carried over from `MentorshipClient.tsx`).

- [ ] **Step 9: Commit**

```bash
git add app/(dashboard)/partnerships app/api/partnerships/my-threads "app/(dashboard)/mentorship/page.tsx"
git commit -m "feat(partnerships): rename /mentorship to /partnerships with group-aware requests panel"
```

---

### Task 7: `/school/partnerships` (rename from `/school/mentorship`) — admin approval queue

**Files:**
- Create: `app/(dashboard)/school/partnerships/page.tsx`
- Create: `app/(dashboard)/school/partnerships/SchoolPartnershipsClient.tsx`
- Modify: `app/(dashboard)/school/mentorship/page.tsx` (becomes a redirect stub)
- Delete: `app/(dashboard)/school/mentorship/MentorshipClient.tsx`

**Interfaces:**
- Consumes: `POST /api/school/partnerships/[id]/approve`, `POST /api/school/partnerships/[id]/reject` (Task 4); `finalizeExpiredPartnershipRequests`, `partnerUserSummary` from `lib/partnerships.ts` (Task 2).
- Produces: nothing consumed by later tasks — self-contained. `app/api/school/mentorship/route.ts` and `app/api/school/mentorship/[conversationId]/route.ts` (the admin direct-pairing create/end endpoints) are **not** touched — `SchoolPartnershipsClient.tsx` keeps calling them at their existing paths.

- [ ] **Step 1: Create `app/(dashboard)/school/partnerships/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SchoolPartnershipsClient from "./SchoolPartnershipsClient";
import { finalizeExpiredPartnershipRequests, partnerUserSummary } from "@/lib/partnerships";

export default async function SchoolPartnershipsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");

  const schoolId = session.user.id;

  await finalizeExpiredPartnershipRequests(schoolId);

  const [pairings, students, mentors, requestQueue, requestHistory] = await Promise.all([
    prisma.conversation.findMany({
      where: { type: "MENTORSHIP", schoolId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { displayName: true, avatarUrl: true, staffTitle: true } },
              },
            },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.profile.findMany({
      where: { schoolId, staffTitle: null, user: { isAlumni: false } },
      select: { userId: true, displayName: true, graduationYear: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.profile.findMany({
      where: {
        schoolId,
        OR: [{ staffTitle: { not: null } }, { user: { isAlumni: true } }],
      },
      select: { userId: true, displayName: true, staffTitle: true, industry: true, user: { select: { isAlumni: true } } },
      orderBy: { displayName: "asc" },
    }),
    prisma.partnershipRequest.findMany({
      where: { schoolId, status: "AWAITING_APPROVAL" },
      include: { invites: true },
      orderBy: { finalizedAt: "asc" },
    }),
    prisma.partnershipRequest.findMany({
      where: { schoolId, status: { in: ["APPROVED", "REJECTED", "EXPIRED_EMPTY"] } },
      include: { invites: true },
      orderBy: { finalizedAt: "desc" },
      take: 50,
    }),
  ]);

  const formatRequestRow = async (r: (typeof requestQueue)[number]) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    finalizedAt: r.finalizedAt?.toISOString() ?? null,
    roomId: r.roomId,
    message: r.message,
    fromUser: await partnerUserSummary(r.fromUserId),
    acceptedInvitees: await Promise.all(
      r.invites.filter((i) => i.status === "ACCEPTED").map((i) => partnerUserSummary(i.userId))
    ),
    otherInvitees: await Promise.all(
      r.invites
        .filter((i) => i.status !== "ACCEPTED")
        .map(async (i) => ({ ...(await partnerUserSummary(i.userId)), status: i.status }))
    ),
  });

  const [formattedQueue, formattedHistory] = await Promise.all([
    Promise.all(requestQueue.map(formatRequestRow)),
    Promise.all(requestHistory.map(formatRequestRow)),
  ]);

  const formattedPairings = pairings.map((c) => ({
    id: c.id,
    name: c.communityName,
    createdAt: c.createdAt.toISOString(),
    participants: c.participants
      .filter((p) => p.userId !== schoolId)
      .map((p) => ({
        userId: p.userId,
        displayName: p.user.profile?.displayName ?? "Unknown",
        avatarUrl: p.user.profile?.avatarUrl ?? null,
        isStaff: !!p.user.profile?.staffTitle,
      })),
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
  }));

  const formattedMentors = mentors.map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    kind: m.user.isAlumni ? ("ALUMNI" as const) : ("STAFF" as const),
    subtitle: m.staffTitle ?? m.industry ?? null,
  }));

  return (
    <SchoolPartnershipsClient
      pairings={formattedPairings}
      students={students}
      mentors={formattedMentors}
      requestQueue={formattedQueue}
      requestHistory={formattedHistory}
    />
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/school/partnerships/SchoolPartnershipsClient.tsx`**

Read the current `app/(dashboard)/school/mentorship/MentorshipClient.tsx` first (it has the already-shipped student/mentor search filters in the "New Pairing" modal — preserve that section unchanged). Then create `app/(dashboard)/school/partnerships/SchoolPartnershipsClient.tsx` as a copy with these changes:

1. Rename the component to `SchoolPartnershipsClient`.
2. Keep `labelStyle`, `filterInputStyle`, `countCaptionStyle`, and the entire "New Pairing" modal section (student/mentor filters, `handleCreate`, calling `POST /api/school/mentorship`) **unchanged** — that's the separate admin-direct-pairing feature, out of scope.
3. Keep `handleEnd` and its `DELETE /api/school/mentorship/${id}` call **unchanged**.
4. Replace the `ConnectionRequestRow` interface, `handleApproveRequest`, and the "1:1 Chat Requests" section with the versions below.
5. Change the page `<h1>` text from `Mentorship` to `Partnerships`, and its subtitle from "Pair students with teacher or alumni mentors yourself into a dedicated group chat, or approve 1:1 requests students sent on their own below." to "Pair students with mentors yourself into a dedicated group chat, or approve partnership requests students sent on their own below." Change the "New Pairing" modal's `<h2>` from `New Mentorship Pairing` to `New Direct Pairing` (distinguishing it from the request queue below, now that the page covers both).

**Important field-name fix:** the existing `UserSummary` interface in this file is:

```ts
interface UserSummary {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}
```

`partnerUserSummary()` (Task 2) returns `{ id, displayName, handle, avatarUrl }` — no `userId` field. Replace `UserSummary` with:

```ts
interface UserSummary {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
}
```

(Nothing in this file reads `.userId` off a `fromUser`/`toUser` object — only `.displayName` — so this rename is safe.)

Replace:

```ts
interface ConnectionRequestRow {
  id: string;
  createdAt: string;
  respondedAt: string | null;
  roomId: string | null;
  message: string | null;
  fromUser: UserSummary;
  toUser: UserSummary;
}
```

with:

```ts
type PartnershipStatus = "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED_EMPTY";

interface InviteeStatus extends UserSummary {
  status: "PENDING" | "ACCEPTED" | "DECLINED";
}

interface PartnershipRequestRow {
  id: string;
  status: PartnershipStatus;
  createdAt: string;
  finalizedAt: string | null;
  roomId: string | null;
  message: string | null;
  fromUser: UserSummary;
  acceptedInvitees: UserSummary[];
  otherInvitees: InviteeStatus[];
}

function historyStatusLabel(status: PartnershipStatus): string {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Declined";
    case "EXPIRED_EMPTY":
      return "Expired — nobody eligible accepted";
    default:
      return status;
  }
}
```

Update the `Props` interface's `requestQueue`/`requestHistory` field types from `ConnectionRequestRow[]` to `PartnershipRequestRow[]`.

Replace `handleApproveRequest` and add a reject handler:

```ts
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const handleApproveRequest = async (id: string) => {
    setApprovingId(id);
    setRequestError(null);
    try {
      const res = await fetch(`/api/school/partnerships/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.error ?? "Failed to create room.");
        return;
      }
      router.refresh();
    } catch {
      setRequestError("Network error. Please try again.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectRequest = async (id: string) => {
    setRejectingId(id);
    setRequestError(null);
    try {
      const res = await fetch(`/api/school/partnerships/${id}/reject`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.error ?? "Failed to decline.");
        return;
      }
      router.refresh();
    } catch {
      setRequestError("Network error. Please try again.");
    } finally {
      setRejectingId(null);
    }
  };
```

(Add the `const [rejectingId, setRejectingId] = useState<string | null>(null);` line next to the existing `const [approvingId, setApprovingId] = useState<string | null>(null);` declaration rather than duplicating it — shown together above for clarity.)

Replace the "1:1 Chat Requests" section (the header, description, `requestQueue.map`, and `requestHistory.map` blocks) with:

```tsx
      {/* Partnership Requests */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--amber)",
          margin: "32px 0 14px",
        }}
      >
        Partnership Requests
      </p>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>
        A student requested a group partnership and at least one eligible alumni/staff member accepted — approve to create the group chat.
      </p>

      {requestError && (
        <p style={{ color: "#e05", fontSize: 13, margin: "0 0 12px", fontFamily: "var(--font-mono)" }}>
          {requestError}
        </p>
      )}

      {requestQueue.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "24px 18px",
            textAlign: "center",
            borderRadius: 0,
            marginBottom: 24,
          }}
        >
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            No partnership requests waiting on approval right now.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {requestQueue.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "16px 18px",
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>
                  <strong>{r.fromUser.displayName}</strong> wants to partner with{" "}
                  <strong>{r.acceptedInvitees.map((u) => u.displayName).join(", ")}</strong>
                </p>
                {r.otherInvitees.length > 0 && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    Also invited (not joining): {r.otherInvitees.map((u) => `${u.displayName} (${u.status.toLowerCase()})`).join(", ")}
                  </p>
                )}
                {r.message && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
                    &ldquo;{r.message}&rdquo;
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => handleRejectRequest(r.id)}
                  disabled={approvingId === r.id || rejectingId === r.id}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#ef4444",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: rejectingId === r.id ? "not-allowed" : "pointer",
                    opacity: rejectingId === r.id ? 0.6 : 1,
                    borderRadius: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {rejectingId === r.id ? "Declining…" : "Decline"}
                </button>
                <button
                  onClick={() => handleApproveRequest(r.id)}
                  disabled={approvingId === r.id || rejectingId === r.id}
                  style={{
                    padding: "8px 16px",
                    background: "var(--amber)",
                    border: "1px solid var(--amber)",
                    color: "#000",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: approvingId === r.id ? "not-allowed" : "pointer",
                    opacity: approvingId === r.id ? 0.6 : 1,
                    borderRadius: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {approvingId === r.id ? "Creating…" : "Create Room"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {requestHistory.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {requestHistory.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "12px 16px",
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
                  {r.fromUser.displayName} &harr; {r.acceptedInvitees.map((u) => u.displayName).join(", ") || "(nobody)"}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>{historyStatusLabel(r.status)}</p>
              </div>
              {r.roomId && (
                <Link
                  href={`/messages?group=${r.roomId}`}
                  style={{
                    padding: "5px 12px",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Open Chat
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 3: Create the redirect stub at the old `/school/mentorship` route**

Replace the full contents of `app/(dashboard)/school/mentorship/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function LegacySchoolMentorshipRedirect() {
  redirect("/school/partnerships");
}
```

- [ ] **Step 4: Delete the old client component**

```bash
git rm "app/(dashboard)/school/mentorship/MentorshipClient.tsx"
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing any file in this task.

- [ ] **Step 6: Manual check**

`npm run dev`. Log in as the `SCHOOL` account. Reset the test `PartnershipRequest` from Task 4 back to `AWAITING_APPROVAL` via Prisma Studio if needed, then go to `/school/partnerships`. Confirm:
- Page title reads "Partnerships".
- "Partnership Requests" section shows the row with the accepted invitee's name and any declined/pending invitee noted separately.
- Clicking "Create Room" approves it, refreshes, and the row moves into history with an "Open Chat" link that opens a working `MENTORSHIP` thread.
- Create a second test request and click "Decline" — confirm it moves to history labeled "Declined", no room.
- The existing "New Pairing" (direct admin pairing) flow still works exactly as before — create one, confirm it appears in the pairings list, open its chat, then "End" it.
- Visit the old URL `/school/mentorship` — confirm it redirects to `/school/partnerships`.

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/school/partnerships "app/(dashboard)/school/mentorship/page.tsx"
git commit -m "feat(partnerships): rename /school/mentorship to /school/partnerships with approval queue"
```

---

### Task 8: Nav labels and remaining links

**Files:**
- Modify: `components/layout/Sidebar.tsx:26,71`
- Modify: `components/layout/SidebarShell.tsx:34,42`
- Modify: `app/(dashboard)/dashboard/WalledDashboardClient.tsx:14`
- Modify: `app/(dashboard)/messages/MessagesClient.tsx:364`
- Modify: `app/(dashboard)/notifications/page.tsx:55,66`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere — final task in this plan besides verification.

- [ ] **Step 1: `components/layout/Sidebar.tsx`**

Replace:

```ts
  { href: "/school/mentorship",   label: "Mentorship",    Icon: UsersRound },
```

with:

```ts
  { href: "/school/partnerships", label: "Partnerships",  Icon: UsersRound },
```

Replace:

```ts
    { href: "/mentorship",    label: "Mentorship",     Icon: HeartHandshake },
```

with:

```ts
    { href: "/partnerships",  label: "Partnerships",   Icon: HeartHandshake },
```

- [ ] **Step 2: `components/layout/SidebarShell.tsx`**

Replace:

```ts
  { href: "/mentorship",    label: "Mentor", Icon: HeartHandshake },
```

with:

```ts
  { href: "/partnerships",  label: "Partner", Icon: HeartHandshake },
```

Replace:

```ts
  { href: "/school/mentorship",   label: "Mentor",       Icon: HeartHandshake },
```

with:

```ts
  { href: "/school/partnerships", label: "Partner",      Icon: HeartHandshake },
```

- [ ] **Step 3: `app/(dashboard)/dashboard/WalledDashboardClient.tsx`**

Replace:

```ts
  { href: "/mentorship", label: "Mentorship", Icon: HeartHandshake, unreadKey: "hasUnreadMentorship" as const, description: "Your mentor thread" },
```

with:

```ts
  { href: "/partnerships", label: "Partnerships", Icon: HeartHandshake, unreadKey: "hasUnreadMentorship" as const, description: "Your partnership requests and chats" },
```

(The `hasUnreadMentorship` prop name is left unchanged — it's plumbed from `layout.tsx` and renaming it is unrelated churn out of scope for this plan.)

- [ ] **Step 4: `app/(dashboard)/messages/MessagesClient.tsx`**

Replace:

```ts
    { label: "Mentorship", items: conversations.filter((c) => c.type === "MENTORSHIP") },
```

with:

```ts
    { label: "Partnerships", items: conversations.filter((c) => c.type === "MENTORSHIP") },
```

- [ ] **Step 5: `app/(dashboard)/notifications/page.tsx`**

Replace:

```ts
        label: c.type === "COMMUNITY" ? (c.communityName ?? "Community Chat") : (c.communityName ?? "Mentorship"),
```

with:

```ts
        label: c.type === "COMMUNITY" ? (c.communityName ?? "Community Chat") : (c.communityName ?? "Partnership"),
```

Replace:

```ts
            : `/mentorship?conversation=${c.id}`,
```

with:

```ts
            : `/partnerships?conversation=${c.id}`,
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing any file in this task.

- [ ] **Step 7: Manual check**

`npm run dev`. Log in as a walled student — confirm the sidebar (desktop) and bottom tab bar (mobile width) both show "Partnerships"/"Partner" linking to `/partnerships`, and `/dashboard`'s card grid shows a "Partnerships" card. Log in as the `SCHOOL` account — confirm its sidebar/bottom-tab both show "Partnerships"/"Partner" linking to `/school/partnerships`. Open `/messages` as the `SCHOOL` account (or any account with a MENTORSHIP thread) and confirm the sidebar grouping label reads "Partnerships". Trigger a notification tied to a MENTORSHIP conversation and confirm its label/link use the new copy and route.

- [ ] **Step 8: Commit**

```bash
git add components/layout/Sidebar.tsx components/layout/SidebarShell.tsx "app/(dashboard)/dashboard/WalledDashboardClient.tsx" "app/(dashboard)/messages/MessagesClient.tsx" "app/(dashboard)/notifications/page.tsx"
git commit -m "feat(partnerships): rename Mentorship nav labels and links to Partnerships"
```

---

### Task 9: End-to-end manual verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full happy-path walkthrough**

`npm run dev`. Using three accounts from the same school (one plain walled student "Requester", one alumni or staff "Mentor", one other plain walled student "Peer"), and the `SCHOOL` admin account for that school:

1. As Requester: go to `/my-school`, click "Request a Partnership", select Mentor + Peer, add a message, send. Confirm the success banner.
2. As Mentor: go to `/partnerships`, see the incoming request with "Also invited: Peer (pending)", accept it.
3. As Peer: go to `/partnerships`, see the same incoming request, accept it.
4. Using Prisma Studio, confirm the `PartnershipRequest.status` is still `PENDING` (window hasn't elapsed) — set `expiresAt` on that row to a past timestamp to simulate the 48h window closing.
5. As Requester: reload `/my-school` (or `/partnerships`) — this triggers `finalizeExpiredPartnershipRequests`. Confirm in Prisma Studio the request is now `AWAITING_APPROVAL`.
6. As SCHOOL admin: go to `/school/partnerships`, see the request in "Partnership Requests" with both Mentor and Peer listed as accepted, click "Create Room".
7. As Requester, Mentor, and Peer: go to `/partnerships`, confirm a new thread appears (named after all three participants), chat messages send/receive, the Idea Board tab works, and (as Mentor, since only alumni/staff can rename) the pencil-rename icon works.

- [ ] **Step 2: Guardrail and expiry-without-acceptance walkthrough**

1. As Requester: send a new partnership request from `/my-school` selecting only Peer and a second plain student (no alumni/staff) — confirm the client shows the "Include at least one alumni or teacher/staff member" error and nothing is created.
2. Send a valid request (Mentor + Peer) again, but have both Mentor and Peer decline it from `/partnerships`.
3. Set that request's `expiresAt` to the past via Prisma Studio, reload a school page to trigger finalize, and confirm it resolves to `EXPIRED_EMPTY` — confirm Requester's "Requests You Sent" panel on `/partnerships` shows "Didn't come together — nobody eligible accepted in time", and it never appears in the SCHOOL admin's approval queue.

- [ ] **Step 3: Regression check on untouched features**

Confirm `/alumni` (site-wide alumni directory) still works end-to-end: an alumni user can request a 1:1 connection with another alumni/staff member via `RequestMentorshipModal`, and it still hits `/api/connections/request` successfully (unaffected by this plan). Confirm the admin's direct "New Pairing" tool on `/school/partnerships` still creates and ends pairings correctly (Task 7, Step 6 already covered this — just re-confirm no regression after Task 8's nav changes).

No commit for this task — it's verification only. If any step fails, fix the relevant task's files and re-run `npx tsc --noEmit` plus the failing manual step before moving on.
