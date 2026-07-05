# School Community Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `/communities` placeholder with real, private, school-scoped chat rooms — a general room every school member auto-joins, plus admin-created private rooms for selected subsets.

**Architecture:** Extend the existing `Conversation` model with a `COMMUNITY` type and `schoolId` field. A shared helper `ensureSchoolGeneralRoom` handles auto-join whenever a user links to a school. The `/communities` page becomes a full chat UI (rooms list + thread) backed by the existing `/api/conversations/[id]/messages` message routes.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma + PostgreSQL, NextAuth v5, Zod, socket.io-client (optional real-time)

## Global Constraints

- All new API routes must call `auth()` and return 401 if no session
- School admin = `session.user.role === 'SCHOOL'`; school users identified by `User.role === 'SCHOOL'`
- `profile.schoolId` references `User.id` where `User.role === 'SCHOOL'`
- Community rooms are scoped to a school: `Conversation.schoolId` must match `profile.schoolId`
- Existing `/api/conversations/[id]/messages` GET + POST routes are NOT modified
- CSS variables: `var(--bg)`, `var(--surface)`, `var(--surface2)`, `var(--border)`, `var(--border-md)`, `var(--text)`, `var(--text2)`, `var(--muted)`, `var(--amber)`, `var(--gold)`, `var(--font-mono)`, `var(--font-body)`, `var(--font-serif)`, `var(--font-display)`
- Migrations: write raw SQL to `prisma/migrations/<timestamp>_<name>/migration.sql`, Prisma picks them up on next `prisma migrate deploy`
- No new npm packages

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `COMMUNITY` enum value, `schoolId`/`isPrivateRoom`/`communityName` to Conversation, `phone` to Profile, `schoolCode` to User |
| `prisma/migrations/20260702000000_school_community_rooms/migration.sql` | Create | Raw SQL for all schema changes |
| `lib/communities.ts` | Create | `ensureSchoolGeneralRoom(schoolId, userId)` helper |
| `app/api/communities/enter-school-code/route.ts` | Create | POST — student/alumni enters school code → sets schoolId + auto-joins general room |
| `app/api/communities/rooms/route.ts` | Create | GET list rooms, POST create private room (admin only) |
| `app/api/communities/rooms/[id]/members/route.ts` | Create | GET members with full profile, POST add member, DELETE remove member (admin only) |
| `app/api/alumni/verify/route.ts` | Modify | Call `ensureSchoolGeneralRoom` after alumni verify if profile has schoolId |
| `app/(dashboard)/communities/page.tsx` | Modify | Server component: fetch rooms, pass to client; gate for non-school users |
| `app/(dashboard)/communities/CommunitiesClient.tsx` | Create | Full chat UI: room list, school code gate, admin tools, message thread |

---

## Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260702000000_school_community_rooms/migration.sql`

**Interfaces:**
- Produces: `ConversationType.COMMUNITY`, `Conversation.schoolId`, `Conversation.isPrivateRoom`, `Conversation.communityName`, `Profile.phone`, `User.schoolCode` — all tasks depend on these

- [ ] **Step 1: Update `prisma/schema.prisma`**

In the `ConversationType` enum, add `COMMUNITY`:
```prisma
enum ConversationType {
  DIRECT
  GROUP
  TEAM
  COMMUNITY
}
```

In the `Conversation` model, add three fields after `teamId`:
```prisma
  schoolId      String?
  isPrivateRoom Boolean  @default(false)
  communityName String?
```

In the `Profile` model, add `phone` after `staffTitle`:
```prisma
  phone String?
```

In the `User` model, add `schoolCode` after `createdAt`:
```prisma
  schoolCode String? @unique
```

- [ ] **Step 2: Create the migration directory and SQL file**

Create `prisma/migrations/20260702000000_school_community_rooms/migration.sql` with this exact content:

```sql
-- Add COMMUNITY value to ConversationType enum
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL
ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'COMMUNITY';

-- Add columns to Conversation
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "isPrivateRoom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "communityName" TEXT;

-- Add phone to Profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Add schoolCode to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_schoolCode_key" ON "User"("schoolCode");
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd C:\Users\thoma\Goal-APP
npx prisma generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260702000000_school_community_rooms/migration.sql
git commit -m "feat: schema — add COMMUNITY conversation type, schoolCode, phone

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 2: `ensureSchoolGeneralRoom` Helper

**Files:**
- Create: `lib/communities.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`, `ConversationType.COMMUNITY` (Task 1)
- Produces: `ensureSchoolGeneralRoom(schoolId: string, userId: string): Promise<{ id: string }>` — used by Tasks 3 and 5

- [ ] **Step 1: Create `lib/communities.ts`**

```typescript
import { prisma } from '@/lib/prisma';

/**
 * Finds or creates the school-wide general COMMUNITY conversation for the given
 * school, then upserts the user as a participant. Safe to call multiple times.
 */
export async function ensureSchoolGeneralRoom(
  schoolId: string,
  userId: string
): Promise<{ id: string }> {
  let conv = await prisma.conversation.findFirst({
    where: { type: 'COMMUNITY', schoolId, isPrivateRoom: false },
    select: { id: true },
  });

  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        type: 'COMMUNITY',
        schoolId,
        isPrivateRoom: false,
        communityName: 'General',
      },
      select: { id: true },
    });
  }

  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId: conv.id, userId } },
    create: { conversationId: conv.id, userId },
    update: {},
  });

  return conv;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\thoma\Goal-APP
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add lib/communities.ts
git commit -m "feat: add ensureSchoolGeneralRoom helper

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 3: School Code Entry API

**Files:**
- Create: `app/api/communities/enter-school-code/route.ts`

**Interfaces:**
- Consumes: `ensureSchoolGeneralRoom` from `@/lib/communities` (Task 2)
- Produces: `POST /api/communities/enter-school-code` — body `{ schoolCode: string }` → `{ ok: true }` or `{ error: string }`

- [ ] **Step 1: Create `app/api/communities/enter-school-code/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureSchoolGeneralRoom } from '@/lib/communities';
import { z } from 'zod';

const schema = z.object({ schoolCode: z.string().min(1).max(100) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  // Find the school by its code
  const school = await prisma.user.findFirst({
    where: { schoolCode: parsed.data.schoolCode, role: 'SCHOOL' },
    select: { id: true },
  });
  if (!school) {
    return NextResponse.json({ error: 'School code not found' }, { status: 404 });
  }

  // Link the user's profile to the school
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 });
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: { schoolId: school.id },
  });

  // Auto-join the school's general community room
  await ensureSchoolGeneralRoom(school.id, session.user.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/communities/enter-school-code/route.ts
git commit -m "feat: POST /api/communities/enter-school-code — link user to school

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 4: Community Rooms API

**Files:**
- Create: `app/api/communities/rooms/route.ts`
- Create: `app/api/communities/rooms/[id]/members/route.ts`

**Interfaces:**
- Consumes: `ConversationType.COMMUNITY`, `Conversation.schoolId`, `Conversation.isPrivateRoom`, `Conversation.communityName` (Task 1)
- Produces:
  - `GET /api/communities/rooms` → `{ rooms: RoomSummary[] }`
  - `POST /api/communities/rooms` (admin) → `{ room: { id: string } }`
  - `GET /api/communities/rooms/[id]/members` → `{ members: Member[] }`
  - `POST /api/communities/rooms/[id]/members` (admin) → `{ ok: true }`
  - `DELETE /api/communities/rooms/[id]/members/[userId]` (admin) → `{ ok: true }`

```typescript
// RoomSummary shape (returned by GET /rooms):
interface RoomSummary {
  id: string;
  communityName: string | null;
  isPrivateRoom: boolean;
  memberCount: number;
  lastMessage: { body: string; createdAt: string } | null;
  updatedAt: string;
}

// Member shape (returned by GET /rooms/[id]/members):
interface Member {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  role: 'SCHOOL' | 'STUDENT'; // SCHOOL = admin
  isAlumni: boolean;
}
```

- [ ] **Step 1: Create `app/api/communities/rooms/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// GET — list all community rooms the current user is in (for their school)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { schoolId: true },
  });
  if (!profile?.schoolId) {
    return NextResponse.json({ rooms: [] });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      type: 'COMMUNITY',
      schoolId: profile.schoolId,
      participants: { some: { userId: session.user.id } },
    },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { participants: true } },
    },
    orderBy: [{ isPrivateRoom: 'asc' }, { updatedAt: 'desc' }],
  });

  const rooms = conversations.map((c) => ({
    id: c.id,
    communityName: c.communityName,
    isPrivateRoom: c.isPrivateRoom,
    memberCount: c._count.participants,
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return NextResponse.json({ rooms });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  participantIds: z.array(z.string()).min(1).max(200),
});

// POST — admin creates a private room
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only school admin accounts can create rooms
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== 'SCHOOL') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  // schoolId for a SCHOOL user is their own id
  const schoolId = session.user.id;
  const allIds = [...new Set([session.user.id, ...parsed.data.participantIds])];

  const room = await prisma.conversation.create({
    data: {
      type: 'COMMUNITY',
      schoolId,
      isPrivateRoom: true,
      communityName: parsed.data.name,
      participants: {
        create: allIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ room });
}
```

- [ ] **Step 2: Create `app/api/communities/rooms/[id]/members/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

type Params = Promise<{ id: string }>;

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

// GET — list members with full profile info (school-context: email, phone visible)
export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId } = await params;
  const room = await verifyRoomAccess(session.user.id, roomId);
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: roomId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isAlumni: true,
          profile: { select: { displayName: true, avatarUrl: true, phone: true } },
        },
      },
    },
  });

  const members = participants.map((p) => ({
    userId: p.user.id,
    displayName: p.user.profile?.displayName ?? p.user.email ?? 'Unknown',
    avatarUrl: p.user.profile?.avatarUrl ?? null,
    email: p.user.email ?? null,
    phone: p.user.profile?.phone ?? null,
    role: p.user.role,
    isAlumni: p.user.isAlumni,
  }));

  return NextResponse.json({ members });
}

const addSchema = z.object({ userIds: z.array(z.string()).min(1).max(100) });

// POST — admin adds members to a private room
export async function POST(req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminCheck = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (adminCheck?.role !== 'SCHOOL') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: roomId } = await params;
  const room = await verifyRoomAccess(session.user.id, roomId);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  await prisma.conversationParticipant.createMany({
    data: parsed.data.userIds.map((userId) => ({ conversationId: roomId, userId })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `app/api/communities/rooms/[id]/members/[userId]/route.ts`**

Create `app/api/communities/rooms/[id]/members/[userId]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string; userId: string }>;

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminCheck = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (adminCheck?.role !== 'SCHOOL') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: roomId, userId } = await params;

  await prisma.conversationParticipant.deleteMany({
    where: { conversationId: roomId, userId },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/communities/
git commit -m "feat: community rooms API — list, create, manage members

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 5: Auto-Join on Alumni Verify

**Files:**
- Modify: `app/api/alumni/verify/route.ts`

**Interfaces:**
- Consumes: `ensureSchoolGeneralRoom` from `@/lib/communities` (Task 2)

- [ ] **Step 1: Update `app/api/alumni/verify/route.ts`**

Add the import and the auto-join call after the profile update. The full file becomes:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSchoolGeneralRoom } from "@/lib/communities";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const year = parseInt(body.graduationYear);
  const currentYear = new Date().getFullYear();

  if (!year || year < 1950 || year > currentYear) {
    return NextResponse.json({ error: "Enter a valid graduation year (1950–" + currentYear + ")" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { isAlumni: true },
  });

  const [profile, dbUser] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } }),
  ]);

  if (profile) {
    await prisma.profile.update({ where: { id: profile.id }, data: { graduationYear: year } });
    // Auto-join the school's general community room if the alumni is school-linked
    if (profile.schoolId) {
      await ensureSchoolGeneralRoom(profile.schoolId, session.user.id);
    }
  } else {
    const fallbackName = dbUser?.name ?? dbUser?.email?.split("@")[0] ?? "Alumni";
    await prisma.profile.create({
      data: { userId: session.user.id, displayName: fallbackName, graduationYear: year, onboardingComplete: false },
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/alumni/verify/route.ts
git commit -m "feat: auto-join school general room on alumni verify

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 6: Communities Page + Client

**Files:**
- Modify: `app/(dashboard)/communities/page.tsx`
- Create: `app/(dashboard)/communities/CommunitiesClient.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/communities/rooms` → `RoomSummary[]` (Task 4)
  - `GET /api/communities/rooms/[id]/members` → `Member[]` (Task 4)
  - `POST /api/communities/enter-school-code` (Task 3)
  - `GET /api/conversations/[id]/messages` → `{ messages: Message[] }` (existing)
  - `POST /api/conversations/[id]/messages` body `{ content: string }` → `{ message: Message }` (existing)
  - `POST /api/communities/rooms` body `{ name, participantIds }` → `{ room: { id } }` (Task 4)
- `Message` shape (from existing route): `{ id: string; content: string; createdAt: string; senderId: string; sender?: { name: string | null; image: string | null } }`
- `RoomSummary` shape: `{ id: string; communityName: string | null; isPrivateRoom: boolean; memberCount: number; lastMessage: { body: string; createdAt: string } | null; updatedAt: string }`
- `Member` shape: `{ userId: string; displayName: string; avatarUrl: string | null; email: string | null; phone: string | null; role: string; isAlumni: boolean }`

- [ ] **Step 1: Rewrite `app/(dashboard)/communities/page.tsx`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CommunitiesClient from "./CommunitiesClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Communities — Nivarro" };

export default async function CommunitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // School admin accounts (role=SCHOOL) use their own id as schoolId
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    }),
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { schoolId: true, displayName: true },
    }),
  ]);

  const isAdmin = user?.role === "SCHOOL";
  const schoolId = isAdmin ? session.user.id : (profile?.schoolId ?? null);

  if (!schoolId) {
    // Not linked to a school yet — pass null so client shows the school code gate
    return (
      <CommunitiesClient
        schoolId={null}
        myUserId={session.user.id}
        isAdmin={false}
        initialRooms={[]}
      />
    );
  }

  // Fetch rooms the user is in
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
    />
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/communities/CommunitiesClient.tsx`**

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/lib/socket";
import { Send, Plus, X, Users, Lock, Hash } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

interface RoomSummary {
  id: string;
  communityName: string | null;
  isPrivateRoom: boolean;
  memberCount: number;
  lastMessage: { body: string; createdAt: string } | null;
  updatedAt: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender?: { name: string | null; image: string | null };
}

interface Member {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isAlumni: boolean;
}

interface Props {
  schoolId: string | null;
  myUserId: string;
  isAdmin: boolean;
  initialRooms: RoomSummary[];
}

// ── School Code Gate ──────────────────────────────────────────────────────────

function SchoolCodeGate({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/communities/enter-school-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
      onJoined();
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh", gap: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 10px" }}>
          School Community
        </p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--text)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Enter your school code
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 28px", lineHeight: 1.6 }}>
          Your school admin will give you a code. Once you enter it, you&apos;ll be added to your school&apos;s private community.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="e.g. lakewood2026"
            className="flex-1 text-sm focus:outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text)", padding: "10px 16px", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
          />
          <button
            onClick={submit}
            disabled={loading || !code.trim()}
            className="px-5 py-2.5 text-sm font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", border: "none", cursor: "pointer" }}
          >
            {loading ? "…" : "Join"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm" style={{ color: "#f87171" }}>{error}</p>
        )}
      </div>
    </div>
  );
}

// ── New Private Room Modal ────────────────────────────────────────────────────

function NewRoomModal({
  schoolId,
  onClose,
  onCreate,
}: {
  schoolId: string;
  onClose: () => void;
  onCreate: (room: RoomSummary) => void;
}) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Fetch all school members to pick from
  useEffect(() => {
    const fetchMembers = async () => {
      // Use the general room's members if it exists, else fetch rooms first
      setLoading(true);
      try {
        const roomsRes = await fetch("/api/communities/rooms");
        if (!roomsRes.ok) return;
        const roomsData = await roomsRes.json();
        const generalRoom = (roomsData.rooms as RoomSummary[]).find((r) => !r.isPrivateRoom);
        if (!generalRoom) return;
        const res = await fetch(`/api/communities/rooms/${generalRoom.id}/members`);
        if (!res.ok) return;
        const data = await res.json();
        setMembers(data.members ?? []);
      } finally { setLoading(false); }
    };
    fetchMembers();
  }, []);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const create = async () => {
    if (!name.trim() || selected.size === 0 || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/communities/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), participantIds: Array.from(selected) }),
      });
      if (!res.ok) return;
      const data = await res.json();
      onCreate({
        id: data.room.id,
        communityName: name.trim(),
        isPrivateRoom: true,
        memberCount: selected.size + 1,
        lastMessage: null,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div className="w-full max-w-md flex flex-col overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border-md)", maxHeight: "80vh" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text)", margin: 0 }}>New Private Room</p>
          <button onClick={onClose}><X size={16} style={{ color: "var(--muted)" }} /></button>
        </div>
        {/* Room name */}
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room name…"
            className="w-full text-sm focus:outline-none bg-transparent"
            style={{ color: "var(--text)", border: "none", padding: 0, fontFamily: "var(--font-body)" }}
          />
        </div>
        {/* Member picker */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--amber)", borderTopColor: "transparent" }} />
            </div>
          ) : (
            members.map((m) => {
              const isSelected = selected.has(m.userId);
              return (
                <button
                  key={m.userId}
                  onClick={() => toggle(m.userId)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left"
                  style={{ background: isSelected ? "rgba(232,137,58,0.08)" : "transparent", borderBottom: "1px solid var(--border)" }}
                >
                  <Avatar src={m.avatarUrl} displayName={m.displayName} geniusType={null} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{m.displayName}</p>
                    {m.email && <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{m.email}</p>}
                  </div>
                  <div
                    className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0"
                    style={{ background: isSelected ? "var(--amber)" : "transparent", border: `1px solid ${isSelected ? "var(--amber)" : "var(--border-md)"}` }}
                  >
                    {isSelected && <span style={{ color: "#000", fontSize: 10 }}>✓</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
        {/* Footer */}
        <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={create}
            disabled={!name.trim() || selected.size === 0 || creating}
            className="w-full py-2.5 text-sm font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", border: "none", cursor: "pointer" }}
          >
            {creating ? "Creating…" : `Create Room (${selected.size} selected)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommunitiesClient({ schoolId, myUserId, isAdmin, initialRooms }: Props) {
  const socket = useSocket();
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>(initialRooms);
  const [activeId, setActiveId] = useState<string | null>(initialRooms[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [notLinked, setNotLinked] = useState(!schoolId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeRoom = rooms.find((r) => r.id === activeId) ?? null;

  const loadMessages = useCallback(async (roomId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/conversations/${roomId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally { setLoadingMsgs(false); }
  }, []);

  useEffect(() => { if (!activeId) return; loadMessages(activeId); }, [activeId, loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // WebSocket real-time
  useEffect(() => {
    if (!socket || !activeId) return;
    socket.emit("join_conversation", activeId);
    const handler = (msg: Message) => {
      if (msg.senderId === myUserId) return;
      setMessages((prev) => [...prev, msg]);
      setRooms((prev) => prev.map((r) =>
        r.id === activeId ? { ...r, lastMessage: { body: msg.content, createdAt: msg.createdAt }, updatedAt: msg.createdAt } : r
      ));
    };
    socket.on("conversation_message", handler);
    return () => { socket.off("conversation_message", handler); socket.emit("leave_conversation", activeId); };
  }, [socket, activeId, myUserId]);

  const sendMessage = async () => {
    if (!input.trim() || !activeId || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      });
      if (res.ok) {
        const data = await res.json();
        const msg: Message = data.message;
        setMessages((prev) => [...prev, msg]);
        setRooms((prev) => prev.map((r) =>
          r.id === activeId ? { ...r, lastMessage: { body: msg.content, createdAt: msg.createdAt }, updatedAt: msg.createdAt } : r
        ));
      }
    } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleJoined = () => {
    setNotLinked(false);
    router.refresh();
  };

  if (notLinked) {
    return <SchoolCodeGate onJoined={handleJoined} />;
  }

  return (
    <>
      {showNewRoom && schoolId && (
        <NewRoomModal
          schoolId={schoolId}
          onClose={() => setShowNewRoom(false)}
          onCreate={(room) => {
            setRooms((prev) => [...prev, room]);
            setActiveId(room.id);
            setShowNewRoom(false);
            setShowThread(true);
          }}
        />
      )}

      <div className="flex overflow-hidden rounded-xl" style={{ height: "calc(100vh - 4rem)", border: "1px solid var(--border-md)" }}>

        {/* ── Room List ─────────────────────────────── */}
        <div className={`${showThread ? "hidden md:flex" : "flex"} w-full md:w-64 flex-col shrink-0`} style={{ background: "var(--bg2)", borderRight: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--text)", fontFamily: "var(--font-display)" }}>
              Community
            </h2>
            {isAdmin && (
              <button
                onClick={() => setShowNewRoom(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "var(--amber)", color: "#000" }}
                title="New private room"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs" style={{ color: "var(--muted)" }}>No rooms yet.</p>
              </div>
            ) : (
              <>
                {/* General room pinned first */}
                {rooms.filter((r) => !r.isPrivateRoom).map((room) => (
                  <RoomRow key={room.id} room={room} isActive={room.id === activeId} onSelect={() => { setActiveId(room.id); setShowThread(true); }} />
                ))}
                {/* Private rooms */}
                {rooms.some((r) => r.isPrivateRoom) && (
                  <p className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display)" }}>
                    Private Rooms
                  </p>
                )}
                {rooms.filter((r) => r.isPrivateRoom).map((room) => (
                  <RoomRow key={room.id} room={room} isActive={room.id === activeId} onSelect={() => { setActiveId(room.id); setShowThread(true); }} />
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Thread ───────────────────────────────────── */}
        {activeRoom ? (
          <div className={`flex-1 flex-col min-w-0 ${showThread ? "flex" : "hidden md:flex"}`} style={{ background: "var(--bg)" }}>
            {/* Header */}
            <div className="h-14 flex items-center px-5 gap-3 shrink-0" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => setShowThread(false)} className="md:hidden mr-1 text-sm" style={{ color: "var(--text2)", background: "none", border: "none", cursor: "pointer" }}>
                ←
              </button>
              {activeRoom.isPrivateRoom ? <Lock size={16} style={{ color: "var(--amber)", flexShrink: 0 }} /> : <Hash size={16} style={{ color: "var(--amber)", flexShrink: 0 }} />}
              <div>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 500, color: "var(--text)", lineHeight: 1.1 }}>
                  {activeRoom.communityName ?? (activeRoom.isPrivateRoom ? "Private Room" : "General")}
                </p>
                <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
                  {activeRoom.memberCount} members
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--amber)", borderTopColor: "transparent" }} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-2xl">👋</p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {activeRoom.isPrivateRoom ? "This is a private room." : "Welcome to your school community."} Say hello!
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {messages.map((msg, i) => {
                    const isMe = msg.senderId === myUserId;
                    const grouped = messages[i - 1]?.senderId === msg.senderId;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-3"}`}>
                        {!grouped && !isMe && (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ background: "var(--surface3)", color: "var(--text2)" }}>
                            {msg.sender?.name?.[0] ?? "?"}
                          </div>
                        )}
                        {(grouped || isMe) && <div className="w-7 shrink-0" />}
                        <div
                          className="max-w-[70%] px-3.5 py-2.5 text-sm leading-relaxed"
                          style={isMe ? {
                            background: "linear-gradient(135deg, rgba(232,137,58,0.85), rgba(232,137,58,0.6))",
                            color: "#fff",
                            borderRadius: "13px 13px 3px 13px",
                            fontFamily: "var(--font-body)",
                            fontWeight: 500,
                          } : {
                            background: "var(--surface2)",
                            color: "var(--text)",
                            borderRadius: "13px 13px 13px 3px",
                            border: "1px solid var(--border-md)",
                            fontFamily: "var(--font-body)",
                            fontWeight: 500,
                          }}
                        >
                          {!isMe && !grouped && (
                            <p className="text-xs mb-1 font-semibold" style={{ color: "var(--amber)" }}>
                              {msg.sender?.name ?? "Member"}
                            </p>
                          )}
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 shrink-0" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Message the community…"
                  className="flex-1 resize-none text-sm focus:outline-none max-h-32 overflow-y-auto"
                  style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", padding: "10px 16px" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-md)"; }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="p-2.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{ background: "var(--amber)", color: "#000", border: "none", cursor: "pointer" }}
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-xs mt-1.5 pl-1" style={{ color: "var(--muted)" }}>Enter to send · Shift+Enter for newline</p>
            </div>
          </div>
        ) : (
          <div className={`flex-1 items-center justify-center gap-4 ${showThread ? "flex" : "hidden md:flex"}`} style={{ background: "var(--bg)" }}>
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>No room selected</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Pick a room from the list</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function RoomRow({ room, isActive, onSelect }: { room: RoomSummary; isActive: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 py-2.5 text-left"
      style={{
        background: isActive ? "rgba(232,137,58,0.08)" : "transparent",
        borderLeft: `2px solid ${isActive ? "var(--amber)" : "transparent"}`,
        paddingLeft: isActive ? "10px" : "12px",
        paddingRight: "12px",
        border: "none",
        cursor: "pointer",
      }}
    >
      <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: room.isPrivateRoom ? "rgba(232,137,58,0.15)" : "rgba(232,137,58,0.08)", color: "var(--amber)" }}>
        {room.isPrivateRoom ? <Lock size={13} /> : <Hash size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 600, color: isActive ? "var(--text)" : "var(--text2)" }}>
          {room.communityName ?? (room.isPrivateRoom ? "Private Room" : "General")}
        </p>
        {room.lastMessage ? (
          <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{room.lastMessage.body}</p>
        ) : (
          <p className="text-xs" style={{ color: "var(--muted)" }}>{room.memberCount} members</p>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/communities/page.tsx app/(dashboard)/communities/CommunitiesClient.tsx
git commit -m "feat: communities page — school chat rooms with general + private rooms

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 7: Wire Up School Admin Auto-Join

When the school admin account first activates, they should also be in their own general room. Add a seed/setup helper call.

**Files:**
- Modify: `app/api/admin/setup-profile/route.ts`

**Interfaces:**
- Consumes: `ensureSchoolGeneralRoom` from `@/lib/communities` (Task 2)

- [ ] **Step 1: Read the current `app/api/admin/setup-profile/route.ts`**

Read the file to understand what it does, then add `ensureSchoolGeneralRoom` after any profile/school creation.

```typescript
// At the top of the file, add this import:
import { ensureSchoolGeneralRoom } from "@/lib/communities";

// After the school account is confirmed to exist (wherever the route confirms
// session.user.role === 'SCHOOL'), add:
await ensureSchoolGeneralRoom(session.user.id, session.user.id);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/setup-profile/route.ts
git commit -m "feat: auto-join school admin to general community room on setup

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Self-Review

**Spec coverage:**
- ✅ General room auto-join (Tasks 3, 5, 7)
- ✅ Alumni auto-join on verify (Task 5)
- ✅ Admin creates private rooms (Task 4, 6)
- ✅ Admin selects any users for private room (Task 6 — NewRoomModal)
- ✅ Full profile info (email, phone) visible in rooms (Tasks 1, 4 members endpoint)
- ✅ Non-school users gated (Tasks 1 schema + 6 page)
- ✅ School code entry flow (Task 3 + 6 gate UI)
- ✅ Messages via existing `/api/conversations/[id]/messages` (unchanged)

**Placeholder scan:** None found — all steps have real code.

**Type consistency:**
- `RoomSummary` defined in Task 6 client, consumed only in Task 6 — consistent
- `Member` shape produced by Task 4 members GET, consumed by Task 6 NewRoomModal — consistent
- `ensureSchoolGeneralRoom(schoolId: string, userId: string)` defined Task 2, consumed Tasks 3, 5, 7 — consistent
