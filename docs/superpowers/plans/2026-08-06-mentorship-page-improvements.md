# Mentorship Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search/count UI to the school-side Mentorship pairing modal, and let alumni/teacher mentors rename their mentorship group chat from inside the messages thread.

**Architecture:** Two independent slices sharing no code: (1) a client-only filter/count addition to the existing `MentorshipClient.tsx` modal — no API changes; (2) wiring an already-existing-but-dead `Conversation.communityName` field through to the messages UI, plus one new `PATCH` route that lets a mentor (alumni or staff) rename a `MENTORSHIP` conversation.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 / PostgreSQL, NextAuth v5, zod, lucide-react icons, inline `style={{}}` objects (this codebase does not use a component library or CSS modules for these pages — match existing inline-style patterns exactly).

## Global Constraints

- No schema/migration changes — `Conversation.communityName String?` already exists (`prisma/schema.prisma:308`) and is reused as the generic conversation name field.
- No automated test runner is configured in this repo (`package.json` has no `test` script, no jest/vitest/playwright dependency). Per established project convention, verification for every task below is: `npx tsc --noEmit` must show no new errors, plus a manual check described in the task. Do not add a test framework as part of this plan — out of scope.
- Follow existing code style exactly: inline `style={{}}` objects using the CSS custom properties already used in each file (`var(--border)`, `var(--muted)`, `var(--text)`, `var(--bg)`, `var(--surface)`, `var(--amber)`, `var(--gold)`, `var(--font-mono)`). Do not introduce Tailwind classes into `MentorshipClient.tsx` (it uses no Tailwind classes today) or inline styles into parts of `MessagesClient.tsx` that currently use Tailwind classes — match each file's existing convention locally.
- Run `git status --porcelain` in the repo root before starting each task. Other concurrent agent sessions are editing this repo; if you see changes outside this plan's file list, ignore them and stay scoped to the files below.
- Dev server: `npm run dev` (Turbopack). If it 500s on a CSS parse error unrelated to your change, that's a known pre-existing issue with unescaped `#` in `app/globals.css` — not something to fix here.

---

### Task 1: Search inputs + counts in the Mentorship pairing modal

**Files:**
- Modify: `app/(dashboard)/school/mentorship/MentorshipClient.tsx`

**Interfaces:**
- Consumes: existing `students: StudentOption[]` and `mentors: MentorOption[]` props (unchanged).
- Produces: nothing consumed by other tasks — this task is self-contained.

- [ ] **Step 1: Add filter state and derived filtered lists**

In `app/(dashboard)/school/mentorship/MentorshipClient.tsx`, inside `MentorshipClient` (after the existing `useState` declarations at lines 52–57), add:

```tsx
  const [studentFilter, setStudentFilter] = useState("");
  const [mentorFilter, setMentorFilter] = useState("");
```

Then, immediately after the `resetModal` function (after line 64, before `toggle`), add:

```tsx
  const filteredStudents = students.filter((s) =>
    s.displayName.toLowerCase().includes(studentFilter.trim().toLowerCase())
  );
  const filteredMentors = mentors.filter((m) =>
    m.displayName.toLowerCase().includes(mentorFilter.trim().toLowerCase())
  );
```

Update `resetModal` to also clear the filters:

```tsx
  const resetModal = () => {
    setSelectedStudents(new Set());
    setSelectedMentors(new Set());
    setStudentFilter("");
    setMentorFilter("");
    setCreateError(null);
    setCreating(false);
  };
```

- [ ] **Step 2: Add a shared filter-input style constant**

Immediately after the existing `labelStyle` constant (after line 48), add:

```tsx
const filterInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  marginBottom: 8,
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 0,
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "inherit",
};

const countCaptionStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  marginBottom: 6,
  display: "block",
};
```

- [ ] **Step 3: Wire the students block to use the filter + show counts**

Replace the students block (original lines 329–361):

```tsx
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Students</label>
              <div style={{ border: "1px solid var(--border)", maxHeight: 160, overflowY: "auto" }}>
                {students.map((s) => (
```

with:

```tsx
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Students</label>
              <input
                type="text"
                placeholder="Filter students…"
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                style={filterInputStyle}
              />
              <span style={countCaptionStyle}>
                {studentFilter.trim()
                  ? `${filteredStudents.length} of ${students.length} students`
                  : `${students.length} student${students.length === 1 ? "" : "s"}`}
              </span>
              <div style={{ border: "1px solid var(--border)", maxHeight: 260, overflowY: "auto" }}>
                {filteredStudents.length === 0 && (
                  <p style={{ margin: 0, padding: "10px 12px", fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                    No students match &quot;{studentFilter}&quot;.
                  </p>
                )}
                {filteredStudents.map((s) => (
```

Keep the rest of that `.map()` body (lines 333–358 in the original: the `<label>` row and its children) unchanged, but update the closing of the `.map()` call — the original has:

```tsx
                ))}
              </div>
            </div>
```

right after the students `.map()` — leave that as-is (it already correctly closes after the map). Just confirm the `students.map((s) =>` at the top of that block is now `filteredStudents.map((s) =>` (done above) and nothing else in the row markup changes.

- [ ] **Step 4: Wire the mentors block the same way**

Replace the mentors block (original lines 363–401):

```tsx
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Mentors</label>
              <div style={{ border: "1px solid var(--border)", maxHeight: 160, overflowY: "auto" }}>
                {mentors.map((m) => (
```

with:

```tsx
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Mentors</label>
              <input
                type="text"
                placeholder="Filter mentors…"
                value={mentorFilter}
                onChange={(e) => setMentorFilter(e.target.value)}
                style={filterInputStyle}
              />
              <span style={countCaptionStyle}>
                {mentorFilter.trim()
                  ? `${filteredMentors.length} of ${mentors.length} mentors`
                  : `${mentors.length} mentor${mentors.length === 1 ? "" : "s"}`}
              </span>
              <div style={{ border: "1px solid var(--border)", maxHeight: 260, overflowY: "auto" }}>
                {filteredMentors.length === 0 && (
                  <p style={{ margin: 0, padding: "10px 12px", fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                    No mentors match &quot;{mentorFilter}&quot;.
                  </p>
                )}
                {filteredMentors.map((m) => (
```

Again, keep the existing `.map()` body and closing tags unchanged — only the source array (`mentors` → `filteredMentors`) and the wrapping filter input/count/empty-state are new.

- [ ] **Step 5: Type-check**

Run: `cd "C:\Users\thoma\Goal-APP" && npx tsc --noEmit`
Expected: no errors referencing `MentorshipClient.tsx`. (Pre-existing unrelated errors elsewhere in the repo, if any from concurrent agent work, are not your concern — only confirm nothing new points at this file.)

- [ ] **Step 6: Manual check**

Run `npm run dev`, sign in as a SCHOOL account (e.g. `westside` demo school account — check `app/api/admin/seed-demo-accounts/route.ts` for current credentials if unsure), go to `/school/mentorship`, click "+ New Pairing", and confirm:
- Typing in the students filter narrows the checkbox list and the count updates (e.g. "3 of 47 students").
- Clearing the filter shows the full list and count again (e.g. "47 students").
- Same for the mentors filter.
- A search with no matches shows the "No students/mentors match" message instead of an empty box.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/school/mentorship/MentorshipClient.tsx"
git commit -m "feat(mentorship): add search filter and counts to pairing modal lists"
```

---

### Task 2: `PATCH /api/conversations/[id]` — rename a mentorship conversation

**Files:**
- Create: `app/api/conversations/[id]/route.ts`

**Interfaces:**
- Consumes: `prisma.conversation`, `prisma.conversationParticipant`, `prisma.profile`, `prisma.user` (existing Prisma models — no schema change).
- Produces: `PATCH /api/conversations/:id` — request body `{ name: string }`, response `{ name: string }` on success, matching status/error shape used by `app/api/conversations/[id]/messages/route.ts` (`{ error: string }` with 400/401/403/404). Task 4 (`MessagesClient.tsx`) calls this endpoint.

- [ ] **Step 1: Write the route file**

Create `app/api/conversations/[id]/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const renameSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, type: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (conversation.type !== "MENTORSHIP") {
    return NextResponse.json({ error: "Only mentorship chats can be renamed" }, { status: 403 });
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [profile, user] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id }, select: { staffTitle: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { isAlumni: true } }),
  ]);
  const isMentor = Boolean(profile?.staffTitle) || Boolean(user?.isAlumni);
  if (!isMentor) {
    return NextResponse.json({ error: "Only mentors can rename this chat" }, { status: 403 });
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { communityName: parsed.data.name },
  });

  return NextResponse.json({ name: parsed.data.name });
}
```

- [ ] **Step 2: Type-check**

Run: `cd "C:\Users\thoma\Goal-APP" && npx tsc --noEmit`
Expected: no errors referencing `app/api/conversations/[id]/route.ts`.

- [ ] **Step 3: Manual check with curl-equivalent (Node, per project convention — see below) or the browser once Task 4 ships the UI**

This route has no UI yet after this task alone, so verify it directly. Per this project's established pattern, avoid `curl`/PowerShell `Invoke-WebRequest` for HTTPS-adjacent auth-cookie testing against the local dev server if it causes issues; a plain local `fetch` from dev tools console while logged in as a mentor works fine over `http://localhost:3000`. Steps:
1. `npm run dev`, log in as an alumni or staff account that is a participant in an existing MENTORSHIP conversation (create one first via `/school/mentorship` if none exist, logged in as the school account).
2. In the browser console (while on the app, so the session cookie is sent), run:
   ```js
   fetch('/api/conversations/<conversationId>', {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ name: 'Test Rename' }),
   }).then(r => r.json()).then(console.log);
   ```
3. Confirm it returns `{ name: "Test Rename" }` with status 200.
4. Repeat while logged in as one of the *student* participants in that same conversation — confirm it returns `{ error: "Only mentors can rename this chat" }` with status 403.
5. Repeat with a non-participant account — confirm 403 `{ error: "Forbidden" }`.

- [ ] **Step 4: Commit**

```bash
git add "app/api/conversations/[id]/route.ts"
git commit -m "feat(messages): add PATCH endpoint for mentors to rename mentorship chats"
```

---

### Task 3: Pass conversation name + rename permission through `messages/page.tsx`

**Files:**
- Modify: `app/(dashboard)/messages/page.tsx`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `MessagesClient` now receives, per conversation object in the `conversations` prop array, `name: string | null` (was always `null` before — now `c.communityName ?? null`) and a new `canRename: boolean` field. Task 4 reads both.

- [ ] **Step 1: Fetch the current user's mentor eligibility alongside the existing profile/org lookup**

In `app/(dashboard)/messages/page.tsx`, replace the existing `Promise.all` block (lines 17–26):

```ts
  const [myProfile, myOrg] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, displayName: true, avatarUrl: true, geniusType: true },
    }),
    prisma.org.findFirst({
      where: { createdById: session.user.id },
      select: { id: true, name: true },
    }),
  ]);
```

with:

```ts
  const [myProfile, myOrg, myUser] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, displayName: true, avatarUrl: true, geniusType: true, staffTitle: true },
    }),
    prisma.org.findFirst({
      where: { createdById: session.user.id },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAlumni: true },
    }),
  ]);
  const isMentor = Boolean(myProfile?.staffTitle) || Boolean(myUser?.isAlumni);
```

- [ ] **Step 2: Fix the dead `name: null` mapping and add `canRename`**

Replace the `serialized` mapping (lines 80–97):

```ts
  const serialized = conversations.map((c) => ({
    id: c.id,
    type: c.type,
    name: null as string | null,
    teamId: c.teamId,
    teamName: c.team?.name ?? null,
    updatedAt: c.updatedAt.toISOString(),
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    participants: c.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      profile: p.user.profile
        ? { ...p.user.profile, geniusType: p.user.profile.geniusType as GeniusTypeKey | null }
        : null,
    })),
  }));
```

with:

```ts
  const serialized = conversations.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.communityName ?? null,
    canRename: c.type === "MENTORSHIP" && isMentor,
    teamId: c.teamId,
    teamName: c.team?.name ?? null,
    updatedAt: c.updatedAt.toISOString(),
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    participants: c.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      profile: p.user.profile
        ? { ...p.user.profile, geniusType: p.user.profile.geniusType as GeniusTypeKey | null }
        : null,
    })),
  }));
```

(`c.communityName` is already available without a query change — the `conversations` query at line 62 uses no `select`, so all scalar `Conversation` fields, including `communityName`, are returned by default.)

- [ ] **Step 3: Type-check**

Run: `cd "C:\Users\thoma\Goal-APP" && npx tsc --noEmit`
Expected: an error will appear from `MessagesClient.tsx`'s `ConvSummary` type not having a `canRename` field yet — that's expected and resolved in Task 4. Confirm the error is specifically about the new `canRename` property (a type mismatch on the `conversations` prop), not something else in `page.tsx` itself.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/messages/page.tsx"
git commit -m "feat(messages): wire conversation name and mentor rename permission through"
```

---

### Task 4: Rename affordance in the messages thread header

**Files:**
- Modify: `app/(dashboard)/messages/MessagesClient.tsx`

**Interfaces:**
- Consumes: `ConvSummary.name: string | null` and new `ConvSummary.canRename: boolean` produced by Task 3.
- Produces: nothing consumed elsewhere — final task in this plan.

- [ ] **Step 1: Add `canRename` to the `ConvSummary` interface**

In `app/(dashboard)/messages/MessagesClient.tsx`, update the `ConvSummary` interface (lines 24–33):

```ts
interface ConvSummary {
  id: string;
  type: string;
  name: string | null;
  teamId: string | null;
  teamName: string | null;
  updatedAt: string;
  lastMessage: { body: string; createdAt: string } | null;
  participants: Participant[];
}
```

to:

```ts
interface ConvSummary {
  id: string;
  type: string;
  name: string | null;
  canRename: boolean;
  teamId: string | null;
  teamName: string | null;
  updatedAt: string;
  lastMessage: { body: string; createdAt: string } | null;
  participants: Participant[];
}
```

- [ ] **Step 2: Import the pencil icon**

Update the lucide-react import (line 10):

```ts
import { Send, Plus, X, Search } from "lucide-react";
```

to:

```ts
import { Send, Plus, X, Search, Pencil, Check } from "lucide-react";
```

- [ ] **Step 3: Add rename state to the main component**

In the `MessagesClient` function body, after the existing state declarations (after line 203, `const bottomRef = useRef<HTMLDivElement>(null);`), add:

```tsx
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
```

- [ ] **Step 4: Add the save handler**

After the existing `sendMessage` function (after line 255), add:

```tsx
  const saveRename = async () => {
    if (!activeId || !renameValue.trim() || savingRename) return;
    setSavingRename(true);
    try {
      const res = await fetch(`/api/conversations/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) => prev.map((c) =>
          c.id === activeId ? { ...c, name: data.name } : c
        ));
        setRenaming(false);
      }
    } finally {
      setSavingRename(false);
    }
  };
```

- [ ] **Step 5: Reset rename UI state when the active conversation changes**

Update the existing effect that loads messages (line 218):

```tsx
  useEffect(() => { if (!activeId) return; loadMessages(activeId); }, [activeId, loadMessages]);
```

to also close any open rename editor for the previous conversation:

```tsx
  useEffect(() => { if (!activeId) return; loadMessages(activeId); setRenaming(false); }, [activeId, loadMessages]);
```

- [ ] **Step 6: Render the rename affordance in the thread header**

Replace the header name block (lines 373–381):

```tsx
              <div>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.3px", color: "var(--text)", lineHeight: 1.1 }}>
                  {convDisplayName(activeConv, myUserId)}
                </p>
                {activeConv.type === "DIRECT" && (() => {
                  const other = activeConv.participants.find((p) => p.userId !== myUserId);
                  return other?.profile?.geniusType ? <GeniusTypeBadge geniusType={other.profile.geniusType} size="sm" /> : null;
                })()}
              </div>
```

with:

```tsx
              <div className="flex-1 min-w-0">
                {renaming ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRenaming(false); }}
                      maxLength={80}
                      className="text-lg"
                      style={{ fontFamily: "var(--font-serif)", fontWeight: 500, color: "var(--text)", background: "var(--bg)", border: "1px solid var(--border)", padding: "2px 8px", minWidth: 180 }}
                    />
                    <button onClick={saveRename} disabled={savingRename || !renameValue.trim()} title="Save">
                      <Check className="w-4 h-4" style={{ color: "var(--gold)" }} />
                    </button>
                    <button onClick={() => setRenaming(false)} title="Cancel">
                      <X className="w-4 h-4" style={{ color: "var(--text2)" }} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.3px", color: "var(--text)", lineHeight: 1.1 }}>
                      {convDisplayName(activeConv, myUserId)}
                    </p>
                    {activeConv.canRename && (
                      <button
                        onClick={() => { setRenameValue(activeConv.name ?? convDisplayName(activeConv, myUserId)); setRenaming(true); }}
                        title="Rename this chat"
                      >
                        <Pencil className="w-3.5 h-3.5" style={{ color: "var(--text2)" }} />
                      </button>
                    )}
                  </div>
                )}
                {activeConv.type === "DIRECT" && (() => {
                  const other = activeConv.participants.find((p) => p.userId !== myUserId);
                  return other?.profile?.geniusType ? <GeniusTypeBadge geniusType={other.profile.geniusType} size="sm" /> : null;
                })()}
              </div>
```

- [ ] **Step 7: Type-check**

Run: `cd "C:\Users\thoma\Goal-APP" && npx tsc --noEmit`
Expected: no errors referencing `MessagesClient.tsx` or `page.tsx` (this resolves the expected error flagged in Task 3, Step 3).

- [ ] **Step 8: Manual check**

`npm run dev`. As the school admin, create a mentorship pairing via `/school/mentorship` if you don't have one, then:
1. Log in as one of the mentor participants (alumni or staff). Open `/messages`, navigate to the mentorship thread (via the mentorship page's "Open Chat" link, or directly if it's already the active conversation). Confirm the pencil icon appears next to the chat title.
2. Click it, type a new name, press Enter. Confirm the title updates immediately and stays updated after a full page reload (`/messages?open=<id>`).
3. Log in as one of the student participants in that same thread. Confirm the custom name displays but no pencil icon appears.
4. Log in as the school admin account and open the same thread (if reachable) — confirm no pencil icon appears for the admin either (matches "give the alumni as well as the teachers the ability" — admin excluded by design).
5. Open a non-MENTORSHIP conversation (e.g. a DIRECT message) as any user — confirm no pencil icon appears there.

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/messages/MessagesClient.tsx"
git commit -m "feat(messages): let mentors rename mentorship group chats"
```

---

### Task 5: Port the rename affordance to the surface mentors actually use (`/mentorship`)

**Added post-hoc, after the final whole-branch review.** Tasks 2-4 built the rename UI on `/messages` + `MessagesClient.tsx`, reasoning from the fact that `Conversation.communityName` and `ConvSummary.name` display support already existed there. The final review caught that this is the wrong surface: `/messages` starts with `if (await isWalledStudent(session.user.id)) redirect('/dashboard')` (`app/(dashboard)/messages/page.tsx:15`), and `isWalledStudent()` (`lib/accountGate.ts`) is `role === "STUDENT" && schoolId set`. Every mentorship-eligible mentor (alumni or staff) is created via the roster with `role: "STUDENT"` (`app/api/school/roster/members/route.ts`, `app/api/school/roster/import/route.ts` — ALUMNI/STAFF are distinguished only by `isAlumni`/`staffTitle`, never by `role`), so every mentor is a walled user and gets redirected out of `/messages` before ever reaching the pencil icon. The surface mentors actually use for mentorship chat is `/mentorship` (`app/(dashboard)/mentorship/MentorshipClient.tsx`, backed by `GET /api/mentorship/my-threads`), which currently builds its thread label purely from participant names and never reads `communityName`.

Task 2's `PATCH /api/conversations/[id]` endpoint is surface-agnostic (it checks conversation type + participant + mentor role, not which page called it) and needs **no changes**. This task only touches the read/display side on `/mentorship`.

**Files:**
- Modify: `app/api/mentorship/my-threads/route.ts`
- Modify: `app/(dashboard)/mentorship/MentorshipClient.tsx`

**Interfaces:**
- Consumes: `PATCH /api/conversations/:id` (Task 2, unchanged) — request `{ name: string }`, response `{ name: string }` on success, `{ error: string }` on failure.
- Produces: nothing consumed elsewhere — final task in this plan.

- [ ] **Step 1: Add `name`/`canRename` to the my-threads GET response**

In `app/api/mentorship/my-threads/route.ts`, the current handler is:

```ts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: { type: "MENTORSHIP", participants: { some: { userId: session.user.id } } },
    include: {
      participants: {
        include: {
          user: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
        },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    threads: conversations.map((c) => ({
      id: c.id,
      otherParticipants: c.participants
        .filter((p) => p.userId !== session.user.id)
        .map((p) => ({
          id: p.userId,
          displayName: p.user.profile?.displayName ?? "Unnamed",
          handle: p.user.profile?.handle ?? null,
          avatarUrl: p.user.profile?.avatarUrl ?? null,
        })),
      lastMessage: c.messages[0]
        ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
        : null,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}
```

Replace it with (adds the same `isMentor` computation used in `app/(dashboard)/messages/page.tsx` and `app/api/conversations/route.ts`, and adds `name`/`canRename` per thread — every thread here is already `type: "MENTORSHIP"` per the query's `where`, so `canRename` is just `isMentor`, no type check needed):

```ts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [conversations, myProfile, myUser] = await Promise.all([
    prisma.conversation.findMany({
      where: { type: "MENTORSHIP", participants: { some: { userId: session.user.id } } },
      include: {
        participants: {
          include: {
            user: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.profile.findUnique({ where: { userId: session.user.id }, select: { staffTitle: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { isAlumni: true } }),
  ]);
  const isMentor = Boolean(myProfile?.staffTitle) || Boolean(myUser?.isAlumni);

  return NextResponse.json({
    threads: conversations.map((c) => ({
      id: c.id,
      name: c.communityName ?? null,
      canRename: isMentor,
      otherParticipants: c.participants
        .filter((p) => p.userId !== session.user.id)
        .map((p) => ({
          id: p.userId,
          displayName: p.user.profile?.displayName ?? "Unnamed",
          handle: p.user.profile?.handle ?? null,
          avatarUrl: p.user.profile?.avatarUrl ?? null,
        })),
      lastMessage: c.messages[0]
        ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
        : null,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}
```

- [ ] **Step 2: Update the `Thread` interface and `threadLabel` in `MentorshipClient.tsx`**

In `app/(dashboard)/mentorship/MentorshipClient.tsx`, update the `Thread` interface:

```ts
interface Thread {
  id: string;
  otherParticipants: Person[];
  lastMessage: { body: string; createdAt: string } | null;
  updatedAt: string;
}
```

to:

```ts
interface Thread {
  id: string;
  name: string | null;
  canRename: boolean;
  otherParticipants: Person[];
  lastMessage: { body: string; createdAt: string } | null;
  updatedAt: string;
}
```

Update `threadLabel`:

```ts
function threadLabel(thread: Thread): string {
  if (thread.otherParticipants.length === 0) return "Mentorship";
  return thread.otherParticipants.map((p) => p.displayName).join(", ");
}
```

to prefer the custom name when set:

```ts
function threadLabel(thread: Thread): string {
  if (thread.name) return thread.name;
  if (thread.otherParticipants.length === 0) return "Mentorship";
  return thread.otherParticipants.map((p) => p.displayName).join(", ");
}
```

- [ ] **Step 3: Add rename state**

After the existing state declarations in `MentorshipClient` (after `const [respondingId, setRespondingId] = useState<string | null>(null);`), add:

```tsx
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
```

- [ ] **Step 4: Reset rename state on thread switch**

Update the existing effect that loads messages for the active thread:

```tsx
  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/conversations/${activeId}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []));
  }, [activeId]);
```

to also close any open rename editor when switching threads:

```tsx
  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/conversations/${activeId}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []));
    setRenaming(false);
  }, [activeId]);
```

- [ ] **Step 5: Add the save handler**

After the existing `send` function, add:

```tsx
  async function saveRename() {
    if (!activeId || !renameValue.trim() || savingRename) return;
    setSavingRename(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/conversations/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setThreads((prev) => prev.map((t) => (t.id === activeId ? { ...t, name: data.name } : t)));
        setRenaming(false);
      } else {
        const err = await res.json().catch(() => null);
        setRenameError(err?.error ?? "Couldn't rename this chat.");
      }
    } finally {
      setSavingRename(false);
    }
  }
```

- [ ] **Step 6: Render the rename affordance in the thread header**

Replace the thread header block:

```tsx
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          {active ? threadLabel(active) : "Mentorship"}
        </div>
```

with:

```tsx
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          {renaming && active ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") { setRenaming(false); setRenameError(null); }
                  }}
                  maxLength={80}
                  style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--text)", background: "var(--bg)", border: "1px solid var(--border)", padding: "4px 8px" }}
                />
                <button
                  type="button"
                  onClick={saveRename}
                  disabled={savingRename || !renameValue.trim()}
                  title="Save"
                  aria-label="Save"
                  style={{ background: "none", border: "none", cursor: savingRename ? "not-allowed" : "pointer", color: "var(--amber)" }}
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => { setRenaming(false); setRenameError(null); }}
                  title="Cancel"
                  aria-label="Cancel"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--n-text2)" }}
                >
                  <X size={16} />
                </button>
              </div>
              {renameError && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{renameError}</p>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                {active ? threadLabel(active) : "Mentorship"}
              </p>
              {active?.canRename && (
                <button
                  type="button"
                  onClick={() => { setRenameValue(active.name ?? threadLabel(active)); setRenaming(true); setRenameError(null); }}
                  title="Rename this chat"
                  aria-label="Rename this chat"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--n-text2)" }}
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
        </div>
```

Note this file already imports `Check` and `X` from `lucide-react` (used by the incoming-requests accept/decline buttons) — add `Pencil` to that same import line.

- [ ] **Step 7: Type-check**

Run: `cd "C:\Users\thoma\Goal-APP\.claude\worktrees\mentorship-page-search-rename" && npx tsc --noEmit`
Expected: no new errors referencing `app/api/mentorship/my-threads/route.ts` or `app/(dashboard)/mentorship/MentorshipClient.tsx`. (This repo's pre-existing baseline error count has been observed to drift as concurrent sessions add files — confirm against a fresh baseline run if unsure, not a fixed number.)

- [ ] **Step 8: Manual check**

`npm run dev`. Log in as a mentor (alumni or staff) participant in an existing mentorship pairing. Go to `/mentorship` (the actual nav item, not `/messages`). Confirm:
- The pencil icon appears next to the thread title in the header.
- Renaming works, persists after reload, and the left-hand thread list picks up the custom name too (since `threadLabel` is shared between the list and the header).
- A student in the same thread sees the custom name but no pencil.
- A failed rename (e.g. simulate by testing after the school admin ends the pairing) shows the error message instead of failing silently.

- [ ] **Step 9: Commit**

```bash
git add "app/api/mentorship/my-threads/route.ts" "app/(dashboard)/mentorship/MentorshipClient.tsx"
git commit -m "feat(mentorship): move rename affordance to the surface mentors actually use"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Design doc section 1 (search+counts) → Task 1. Section 2 (missing students — enlarged list + counts, no backend fix) → covered by Task 1's `maxHeight: 260` change and count captions. Section 3 (rename ability) → Tasks 2–4.
- **Type consistency:** `ConvSummary.canRename` (Task 4) matches `canRename` emitted by `page.tsx` (Task 3). `PATCH /api/conversations/[id]` request `{ name: string }` (Task 2) matches the `fetch` body in `saveRename` (Task 4). Response `{ name: string }` (Task 2) matches `data.name` usage (Task 4).
- **No placeholders:** all steps contain full code, no TODOs.
