# Alum Account Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `STUDENT` accounts with `schoolId` set (Student and Alum, per `docs/account-types-design.md`) a walled-off nav showing only Community Chat, Mentorship, Notifications — plus Profile (alumni destination fields + mentor toggle) for Alum specifically — and close the server-side gating gaps that currently let any account reach Peers/Orgs/Teams/Messages/Quiz.

**Architecture:** Reuse existing infra wherever it already exists (Profile already has all alumni destination fields; `/api/conversations/[id]/messages` is already generic and participant-gated). Add one new `ConversationType.MENTORSHIP` value so mentor↔mentee threads are identifiable, a small admin-side pairing UI to create those threads, and a shared `isWalledStudent` gate used by both the sidebar and every page that must stay off-limits.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, NextAuth v5, zod. No test runner exists in this repo (no jest/vitest configured) — verification steps use `npx tsc --noEmit`, `npx prisma validate`, and manual dev-server/curl checks, matching the project's existing convention (no `*.test.*` files anywhere in `app/`).

## Global Constraints

- Manual SQL migration required for every schema change — `prisma generate` does not create migration files, and Render runs `prisma migrate deploy` at startup (per project convention). Use `prisma/migrations/YYYYMMDDHHMMSS_description/migration.sql` with `IF NOT EXISTS` guards.
- Out of scope (per `docs/account-types-design.md`): ORG role changes, the site-wide ADMIN/ORG nav-conflation bug, Standard account tab renames (already shipped separately), CSV import vocabulary, and the quiz on/off admin toggle.
- **Concurrent work notice:** as of this plan's execution, a separate, actively-worked session has *uncommitted* changes in the main `Goal-APP` checkout (not this worktree) building Admin/Teacher-side features that overlap this plan: `ConversationType.MENTORSHIP` on the schema, a `getSchoolSession()` helper (`lib/school-auth.ts`), and a group-based mentorship pairing API at `app/api/school/mentorship/route.ts` + `app/api/school/mentorship/[conversationId]/route.ts` (GET/POST/DELETE), plus roster management and a quiz-toggle setting (both genuinely out of scope here). Per direction from the project owner: **do not touch or duplicate that work.** This plan's tasks below are already adjusted to build only what that work does not cover — the student/alum-facing side, the nav wall-off, the alumni profile tab, and notifications — while still building the one piece that work is missing: the `/school/mentorship` page UI, written against that existing API's actual contract (documented in Task 4). This branch necessarily adds its own copy of the `MENTORSHIP` schema value (Task 1) since this worktree forked before that change was committed anywhere — it's a one-line, idempotent (`IF NOT EXISTS`) addition and will converge harmlessly whenever the two lines of work eventually merge.
- Mentor can be part of an Org — ambiguity from the design doc is not resolved here and is irrelevant to this plan; no Org-eligibility check is added to mentor pairing.
- Follow existing code style: no comments unless explaining a non-obvious constraint, inline `style={{}}` props (not Tailwind) in dashboard components that already use that pattern (Sidebar, SchoolHubClient), Tailwind classes where the file already uses them (ProfileEditor).

---

## Task 1: Add `MENTORSHIP` conversation type to this branch

**Files:**
- Modify: `prisma/schema.prisma` (ConversationType enum, ~line 317)
- Create: `prisma/migrations/20260709000000_add_mentorship_conversation_type/migration.sql`

**Interfaces:**
- Produces: `ConversationType.MENTORSHIP` — consumed by Task 3 (my-threads route) and Task 5 (notifications).

- [ ] **Step 1: Edit the enum**

In `prisma/schema.prisma`, find:

```prisma
enum ConversationType {
  DIRECT
  GROUP
  TEAM
  COMMUNITY
}
```

Replace with:

```prisma
enum ConversationType {
  DIRECT
  GROUP
  TEAM
  COMMUNITY
  MENTORSHIP
}
```

- [ ] **Step 2: Write the migration**

Create `prisma/migrations/20260709000000_add_mentorship_conversation_type/migration.sql`:

```sql
ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'MENTORSHIP';
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` with no errors, and `ConversationType.MENTORSHIP` available in `@prisma/client` types.

- [ ] **Step 4: Verify schema validity**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260709000000_add_mentorship_conversation_type
git commit -m "feat: add MENTORSHIP conversation type"
```

---

## Task 2: Shared walled-student gate helper

**Files:**
- Create: `lib/accountGate.ts`

**Interfaces:**
- Produces: `isWalledStudent(userId: string): Promise<boolean>` — consumed by Task 5 (nav), Task 6 (page guards), Task 8 (profile branching), Task 9 (notifications).

- [ ] **Step 1: Write the helper**

Create `lib/accountGate.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export async function isWalledStudent(userId: string): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, profile: { select: { schoolId: true } } },
  });
  return dbUser?.role === "STUDENT" && !!dbUser.profile?.schoolId;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/accountGate.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/accountGate.ts
git commit -m "feat: add isWalledStudent gate helper"
```

---

## Task 3: Student/alum mentorship threads API

**Files:**
- Create: `app/api/mentorship/my-threads/route.ts`

**Interfaces:**
- Consumes: `ConversationType.MENTORSHIP` (Task 1)
- Produces: `GET /api/mentorship/my-threads` — consumed by Task 5's client component.

This is intentionally the *only* new mentorship API route in this plan. Admin-side pairing already exists (uncommitted, elsewhere) at `/api/school/mentorship` — see the Global Constraints note. This route is the one piece missing from that work: letting the student/alum/mentor themselves list their own mentorship conversations. A mentorship conversation can have more than two participants (the existing admin API always includes the school admin's own account plus any number of selected students/mentors), so this returns every other participant, not a single "other user."

- [ ] **Step 1: Write the route**

Create `app/api/mentorship/my-threads/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
      otherUsers: c.participants
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. While logged in as any account, hit `GET http://localhost:3000/api/mentorship/my-threads` (browser dev tools Network tab, or open the URL directly if session cookie applies).
Expected: `{"threads":[]}` for an account with no mentorship conversations, `401` when logged out.

- [ ] **Step 4: Commit**

```bash
git add app/api/mentorship
git commit -m "feat: add student/alum mentorship threads API"
```

---

## Task 4: Admin/Teacher mentorship pairing UI

**Files:**
- Create: `app/(dashboard)/school/mentorship/page.tsx`
- Create: `app/(dashboard)/school/mentorship/MentorshipPairingClient.tsx`
- Modify: `components/layout/Sidebar.tsx` (`SCHOOL_NAV`, ~line 33)

**Interfaces:**
- Consumes the **existing** admin pairing API (not built by this plan — see Global Constraints): `GET /api/school/mentorship` → `{ pairings: { id, createdAt, participants: { userId, displayName, avatarUrl, isStaff }[], lastMessage }[], students: { userId, displayName, graduationYear }[], mentors: { userId, displayName, kind: "ALUMNI"|"STAFF", subtitle }[] }`; `POST /api/school/mentorship` body `{ studentIds: string[], mentorIds: string[] }` → `{ id }`; `DELETE /api/school/mentorship/[conversationId]` → `{ ok: true }`.
- Produces: `/school/mentorship` route, reachable from `SCHOOL_NAV`.

This task builds the missing UI layer on top of an API that already exists (uncommitted elsewhere) — do not create or modify any `app/api/school/mentorship*` files.

- [ ] **Step 1: Write the server page**

Create `app/(dashboard)/school/mentorship/page.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import MentorshipPairingClient from "./MentorshipPairingClient";

export default async function SchoolMentorshipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");

  return <MentorshipPairingClient />;
}
```

- [ ] **Step 2: Write the client component**

Create `app/(dashboard)/school/mentorship/MentorshipPairingClient.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { HeartHandshake, Trash2 } from "lucide-react";

interface Student {
  userId: string;
  displayName: string;
  graduationYear: number | null;
}

interface Mentor {
  userId: string;
  displayName: string;
  kind: "ALUMNI" | "STAFF";
  subtitle: string | null;
}

interface Pairing {
  id: string;
  createdAt: string;
  participants: { userId: string; displayName: string; avatarUrl: string | null; isStaff: boolean }[];
  lastMessage: { body: string; createdAt: string } | null;
}

export default function MentorshipPairingClient() {
  const [students, setStudents] = useState<Student[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedMentors, setSelectedMentors] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/school/mentorship")
      .then((r) => r.json())
      .then((data) => {
        setStudents(data.students ?? []);
        setMentors(data.mentors ?? []);
        setPairings(data.pairings ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  async function handleCreate() {
    if (selectedStudents.size === 0 || selectedMentors.size === 0 || saving) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/school/mentorship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: [...selectedStudents], mentorIds: [...selectedMentors] }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create pairing");
      return;
    }
    setSelectedStudents(new Set());
    setSelectedMentors(new Set());
    load();
  }

  async function handleRemove(id: string) {
    await fetch(`/api/school/mentorship/${id}`, { method: "DELETE" });
    setPairings((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return <p style={{ color: "var(--n-text2)", fontSize: 14 }}>Loading…</p>;
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>
        Mentorship Pairing
      </h1>
      <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 24px" }}>
        Pick one or more students and one or more mentors (staff or alumni who have opened mentorship) to create a shared messaging thread.
      </p>

      <div style={{ padding: "20px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: "1 1 260px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--n-muted)", margin: "0 0 8px" }}>
              Students ({selectedStudents.size} selected)
            </p>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)" }}>
              {students.map((s) => (
                <label key={s.userId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 13, color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                  <input type="checkbox" checked={selectedStudents.has(s.userId)} onChange={() => toggle(selectedStudents, setSelectedStudents, s.userId)} />
                  {s.displayName}{s.graduationYear ? ` ('${String(s.graduationYear).slice(-2)})` : ""}
                </label>
              ))}
            </div>
          </div>
          <div style={{ flex: "1 1 260px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--n-muted)", margin: "0 0 8px" }}>
              Mentors ({selectedMentors.size} selected)
            </p>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)" }}>
              {mentors.map((m) => (
                <label key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 13, color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                  <input type="checkbox" checked={selectedMentors.has(m.userId)} onChange={() => toggle(selectedMentors, setSelectedMentors, m.userId)} />
                  {m.displayName} <span style={{ color: "var(--n-muted)", fontSize: 11 }}>({m.kind === "ALUMNI" ? "Alumni" : m.subtitle ?? "Staff"})</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={selectedStudents.size === 0 || selectedMentors.size === 0 || saving}
          style={{ padding: "9px 18px", border: "1px solid var(--amber)", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: selectedStudents.size === 0 || selectedMentors.size === 0 || saving ? "default" : "pointer", opacity: selectedStudents.size === 0 || selectedMentors.size === 0 || saving ? 0.5 : 1 }}
        >
          {saving ? "Pairing…" : "Create Pairing"}
        </button>
        {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 12px" }}>
        Existing Pairings
      </p>
      {pairings.length === 0 ? (
        <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
          <HeartHandshake size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
          <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No mentorship pairings yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pairings.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13, color: "var(--text)" }}>
              <span>{p.participants.map((pt) => pt.displayName).join(" ↔ ")}</span>
              <button onClick={() => handleRemove(p.id)} title="Remove pairing" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--n-muted)", padding: 0, display: "flex" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add nav entry**

In `components/layout/Sidebar.tsx`, find `SCHOOL_NAV`:

```typescript
const SCHOOL_NAV = [
  { href: "/school/destinations", label: "Destinations",  Icon: MapPin },
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/communities",         label: "Community",     Icon: Globe },
  { href: "/school/survey",       label: "Survey",        Icon: ClipboardList },
  { href: "/campaigns",           label: "Fundraise",     Icon: HeartHandshake },
];
```

Replace with:

```typescript
const SCHOOL_NAV = [
  { href: "/school/destinations", label: "Destinations",  Icon: MapPin },
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/communities",         label: "Community",     Icon: Globe },
  { href: "/school/mentorship",   label: "Mentorship",    Icon: HeartHandshake },
  { href: "/school/survey",       label: "Survey",        Icon: ClipboardList },
  { href: "/campaigns",           label: "Fundraise",     Icon: HeartHandshake },
];
```

> If, by the time this task is implemented, the `/school/mentorship` nav entry already exists here (the parallel work's Sidebar.tsx edit landed first), skip this step — do not create a duplicate entry.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, log in as a `SCHOOL` demo account, click "Mentorship" in the sidebar, confirm student/mentor checklists populate and creating a pairing with at least one of each shows up under "Existing Pairings" with a working remove button.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/school/mentorship" components/layout/Sidebar.tsx
git commit -m "feat: add admin mentorship pairing UI"
```

---

## Task 5: Student/Alum mentorship messaging page

**Files:**
- Create: `app/(dashboard)/mentorship/page.tsx`
- Create: `app/(dashboard)/mentorship/MentorshipClient.tsx`

**Interfaces:**
- Consumes: `GET /api/mentorship/my-threads` (Task 3), `GET/POST /api/conversations/[id]/messages` (existing, generic, participant-gated — no changes needed), `isWalledStudent` (Task 2)
- Produces: `/mentorship` route, added to walled nav in Task 7.

- [ ] **Step 1: Write the server page**

Create `app/(dashboard)/mentorship/page.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isWalledStudent } from "@/lib/accountGate";
import MentorshipClient from "./MentorshipClient";

export default async function MentorshipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await isWalledStudent(session.user.id))) redirect("/dashboard");

  return <MentorshipClient myUserId={session.user.id} />;
}
```

- [ ] **Step 2: Write the client component**

Create `app/(dashboard)/mentorship/MentorshipClient.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { HeartHandshake, Send } from "lucide-react";

interface OtherUser {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
}

interface Thread {
  id: string;
  otherUsers: OtherUser[];
  lastMessage: { body: string; createdAt: string } | null;
  updatedAt: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string | null };
}

function threadLabel(thread: Thread): string {
  if (thread.otherUsers.length === 0) return "Mentorship";
  return thread.otherUsers.map((u) => u.displayName).join(", ");
}

export default function MentorshipClient({ myUserId }: { myUserId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mentorship/my-threads")
      .then((r) => r.json())
      .then((data) => {
        setThreads(data.threads ?? []);
        setActiveId(data.threads?.[0]?.id ?? null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/conversations/${activeId}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []));
  }, [activeId]);

  async function send() {
    if (!activeId || !draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    const res = await fetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (res.ok) setMessages((prev) => [...prev, data.message]);
  }

  if (loading) {
    return <p style={{ color: "var(--n-text2)", fontSize: 14 }}>Loading…</p>;
  }

  if (threads.length === 0) {
    return (
      <div style={{ maxWidth: 600, padding: "40px 32px", border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
        <HeartHandshake size={28} style={{ color: "var(--n-text2)", margin: "0 auto 12px" }} />
        <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
          You haven&apos;t been paired with a mentor yet. Your school admin sets up mentorship pairings.
        </p>
      </div>
    );
  }

  const active = threads.find((t) => t.id === activeId);

  return (
    <div style={{ display: "flex", gap: 16, maxWidth: 900, height: "70vh" }}>
      <div style={{ width: 220, flexShrink: 0, border: "1px solid var(--border)", background: "var(--surface)", overflowY: "auto" }}>
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "12px 14px",
              background: t.id === activeId ? "rgba(232,137,58,0.12)" : "transparent",
              border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer",
              color: "var(--text)", fontSize: 13,
            }}
          >
            {threadLabel(t)}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          {active ? threadLabel(active) : "Mentorship"}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender.id === myUserId ? "flex-end" : "flex-start",
                maxWidth: "70%", padding: "8px 12px",
                background: m.sender.id === myUserId ? "var(--amber)" : "var(--bg)",
                color: m.sender.id === myUserId ? "#000" : "var(--text)",
                fontSize: 13, border: "1px solid var(--border)",
              }}
            >
              {m.content}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message…"
            style={{ flex: 1, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
          <button onClick={send} style={{ padding: "8px 14px", background: "var(--amber)", border: "none", color: "#000", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/mentorship"
git commit -m "feat: add student/alum mentorship messaging page"
```

---

## Task 6: Auto-join school community room for walled accounts

**Files:**
- Modify: `app/(dashboard)/communities/page.tsx`

**Interfaces:**
- Consumes: `ensureSchoolGeneralRoom` (existing, `lib/communities.ts`)

Currently `ensureSchoolGeneralRoom` only runs `if (isAdmin)`. A Student/Alum whose `profile.schoolId` is set by an admin roster import is never made a `ConversationParticipant`, so their Community Chat tab loads with zero rooms and no way to join (no self-serve code entry for this account type, by design). Fix: also auto-join school-affiliated non-admin accounts.

- [ ] **Step 1: Edit the page**

In `app/(dashboard)/communities/page.tsx`, find:

```typescript
  const isAdmin = user?.role === "SCHOOL";
  const schoolId = isAdmin ? session.user.id : (profile?.schoolId ?? null);

  // Ensure the General Room exists for school admins (handles existing accounts
  // that were created before this feature was added)
  if (isAdmin) {
    await ensureSchoolGeneralRoom(session.user.id, session.user.id);
  }
```

Replace with:

```typescript
  const isAdmin = user?.role === "SCHOOL";
  const schoolId = isAdmin ? session.user.id : (profile?.schoolId ?? null);

  // Ensure the General Room exists and the current user is a participant —
  // for admins (their own school) and for any school-affiliated student/alum
  // (who has no self-serve code-entry path into their school's room).
  if (schoolId) {
    await ensureSchoolGeneralRoom(schoolId, session.user.id);
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Log in as a demo student/alumni account with `schoolId` set on their profile, visit `/communities`, confirm the school's "General" room now appears without needing a code.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/communities/page.tsx"
git commit -m "fix: auto-join school-affiliated students to their community room"
```

---

## Task 7: Wall off the sidebar nav

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/SidebarShell.tsx`

**Interfaces:**
- Produces: `isWalledStudent` / `isAlumni` booleans flow from layout → SidebarShell → Sidebar, gating which nav array renders.

> **Baseline note:** as of this plan's execution, these three files already carry an `isStandard` split (commit `6cf89e4`, "give Standard accounts their own nav") that gives `schoolId`-less STUDENT accounts their own `STANDARD_NAV` and renamed "Orgs" → "Organizations". That commit's own message says Student/Alum accounts are deliberately left on the old `STUDENT_NAV_BASE` "until their walled-off nav ships separately" — this task is that follow-up. Do not touch `isStandard`/`STANDARD_NAV` logic; add the walled branch alongside it. The snippets below match the current file contents exactly.

- [ ] **Step 1: Add isAlumni + isWalledStudent to the layout**

In `app/(dashboard)/layout.tsx`, find:

```typescript
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      profile: { select: { displayName: true, geniusType: true, schoolId: true } },
    },
  });

  const role = dbUser?.role ?? "STUDENT";
  const isSchool = role === "SCHOOL";
  const isOrg = role === "ORG" || role === "ADMIN";
  const isNivarroAdmin = role === "ADMIN";
  const profile = dbUser?.profile ?? null;
  // Standard account = STUDENT role with no school affiliation (open self-serve signup).
  // Student/Alum accounts (profile.schoolId set) keep the existing nav until their
  // walled-off nav (school chat, mentorship messaging) is built separately.
  const isStandard = !isSchool && !isOrg && !profile?.schoolId;
```

Replace with:

```typescript
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
  // Standard account = STUDENT role with no school affiliation (open self-serve signup).
  const isStandard = !isSchool && !isOrg && !profile?.schoolId;
  // Student/Alum account = STUDENT role with a school affiliation — walled-off nav.
  const isWalledStudent = role === "STUDENT" && !!profile?.schoolId;
  const isAlumni = !!dbUser?.isAlumni;
```

- [ ] **Step 2: Pass the new props to SidebarShell**

In the same file, find:

```typescript
      <SidebarShell
        userName={profile?.displayName ?? session.user.name}
        userEmail={session.user.email}
        geniusType={(profile?.geniusType as GeniusType | null) ?? null}
        myOrgId={myOrg?.id ?? null}
        myOrgName={myOrg?.name ?? null}
        isOrg={isOrg}
        isNivarroAdmin={isNivarroAdmin}
        isSchool={isSchool}
        isStandard={isStandard}
      />
```

Replace with:

```typescript
      <SidebarShell
        userName={profile?.displayName ?? session.user.name}
        userEmail={session.user.email}
        geniusType={(profile?.geniusType as GeniusType | null) ?? null}
        myOrgId={myOrg?.id ?? null}
        myOrgName={myOrg?.name ?? null}
        isOrg={isOrg}
        isNivarroAdmin={isNivarroAdmin}
        isSchool={isSchool}
        isStandard={isStandard}
        isWalledStudent={isWalledStudent}
        isAlumni={isAlumni}
      />
```

- [ ] **Step 3: Add the walled nav branch to Sidebar.tsx**

In `components/layout/Sidebar.tsx`, add `User` to the lucide-react import. Find:

```typescript
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Bell, Briefcase, Megaphone, Globe, MapPin, GraduationCap, HeartHandshake, School, ClipboardList } from "lucide-react";
```

Replace with:

```typescript
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Bell, Briefcase, Megaphone, Globe, MapPin, GraduationCap, HeartHandshake, School, ClipboardList, User } from "lucide-react";
```

Then find the `SidebarProps` interface and function signature:

```typescript
interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  myOrgId?: string | null;
  myOrgName?: string | null;
  isOrg?: boolean;
  isNivarroAdmin?: boolean;
  isSchool?: boolean;
  isStandard?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ userName, userEmail, geniusType, mobileOpen = false, onMobileClose, myOrgId, myOrgName, isOrg, isNivarroAdmin = false, isSchool = false, isStandard = false, collapsed = false, onToggleCollapse }: SidebarProps) {
```

Replace with:

```typescript
interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  myOrgId?: string | null;
  myOrgName?: string | null;
  isOrg?: boolean;
  isNivarroAdmin?: boolean;
  isSchool?: boolean;
  isStandard?: boolean;
  isWalledStudent?: boolean;
  isAlumni?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ userName, userEmail, geniusType, mobileOpen = false, onMobileClose, myOrgId, myOrgName, isOrg, isNivarroAdmin = false, isSchool = false, isStandard = false, isWalledStudent = false, isAlumni = false, collapsed = false, onToggleCollapse }: SidebarProps) {
```

Then find:

```typescript
  const studentNav = [
    ...(isStandard ? STANDARD_NAV : STUDENT_NAV_BASE),
    ...(isNivarroAdmin ? SCHOOL_NAV : []),
  ];

  const navItems = isSchool ? SCHOOL_NAV : isOrg ? orgNav : studentNav;
```

Replace with:

```typescript
  const studentNav = [
    ...(isStandard ? STANDARD_NAV : STUDENT_NAV_BASE),
    ...(isNivarroAdmin ? SCHOOL_NAV : []),
  ];

  const walledNav = [
    { href: "/dashboard",     label: "Dashboard",      Icon: LayoutDashboard },
    { href: "/communities",   label: "Community Chat", Icon: Globe },
    { href: "/mentorship",    label: "Mentorship",     Icon: HeartHandshake },
    ...(isAlumni ? [{ href: "/profile", label: "Profile", Icon: User }] : []),
    { href: "/notifications", label: "Notifications",  Icon: Bell },
  ];

  const navItems = isSchool ? SCHOOL_NAV : isOrg ? orgNav : isWalledStudent ? walledNav : studentNav;
```

- [ ] **Step 4: Add the props + walled bottom tabs to SidebarShell.tsx**

In `components/layout/SidebarShell.tsx`, find:

```typescript
import { Menu, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Briefcase } from "lucide-react";
```

Replace with:

```typescript
import { Menu, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Briefcase, Bell, HeartHandshake, Globe } from "lucide-react";
```

Find the `Props` interface, `STUDENT_BOTTOM_TABS`, and function signature:

```typescript
interface Props {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
  myOrgId?: string | null;
  myOrgName?: string | null;
  isOrg?: boolean;
  isNivarroAdmin?: boolean;
  isSchool?: boolean;
  isStandard?: boolean;
}

const STUDENT_BOTTOM_TABS = [
  { href: "/dashboard", label: "Home",         Icon: LayoutDashboard },
  { href: "/peers",     label: "Peers",        Icon: Users },
  { href: "/orgs",      label: "Organizations", Icon: Building2 },
  { href: "/teams",     label: "Teams",        Icon: UsersRound },
  { href: "/messages",  label: "Messages",     Icon: MessageSquare },
];

export default function SidebarShell({ userName, userEmail, geniusType, myOrgId, myOrgName, isOrg, isNivarroAdmin, isSchool, isStandard }: Props) {
```

Replace with:

```typescript
interface Props {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
  myOrgId?: string | null;
  myOrgName?: string | null;
  isOrg?: boolean;
  isNivarroAdmin?: boolean;
  isSchool?: boolean;
  isStandard?: boolean;
  isWalledStudent?: boolean;
  isAlumni?: boolean;
}

const STUDENT_BOTTOM_TABS = [
  { href: "/dashboard", label: "Home",         Icon: LayoutDashboard },
  { href: "/peers",     label: "Peers",        Icon: Users },
  { href: "/orgs",      label: "Organizations", Icon: Building2 },
  { href: "/teams",     label: "Teams",        Icon: UsersRound },
  { href: "/messages",  label: "Messages",     Icon: MessageSquare },
];

const WALLED_BOTTOM_TABS = [
  { href: "/dashboard",     label: "Home",   Icon: LayoutDashboard },
  { href: "/communities",   label: "Chat",   Icon: Globe },
  { href: "/mentorship",    label: "Mentor", Icon: HeartHandshake },
  { href: "/notifications", label: "Alerts", Icon: Bell },
];

export default function SidebarShell({ userName, userEmail, geniusType, myOrgId, myOrgName, isOrg, isNivarroAdmin, isSchool, isStandard, isWalledStudent, isAlumni }: Props) {
```

Find:

```typescript
  const bottomTabs = isOrg ? ORG_BOTTOM_TABS : STUDENT_BOTTOM_TABS;
```

Replace with:

```typescript
  const bottomTabs = isOrg ? ORG_BOTTOM_TABS : isWalledStudent ? WALLED_BOTTOM_TABS : STUDENT_BOTTOM_TABS;
```

Find the `<Sidebar ... />` call:

```typescript
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        geniusType={geniusType}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        myOrgId={myOrgId}
        myOrgName={myOrgName}
        isOrg={isOrg}
        isNivarroAdmin={isNivarroAdmin}
        isSchool={isSchool}
        isStandard={isStandard}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
```

Replace with:

```typescript
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        geniusType={geniusType}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        myOrgId={myOrgId}
        myOrgName={myOrgName}
        isOrg={isOrg}
        isNivarroAdmin={isNivarroAdmin}
        isSchool={isSchool}
        isStandard={isStandard}
        isWalledStudent={isWalledStudent}
        isAlumni={isAlumni}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Log in as: (a) a demo student with no `schoolId` — nav unchanged (Standard nav); (b) a demo student with `schoolId` set and `isAlumni=false` — sidebar shows only Dashboard/Community Chat/Mentorship/Notifications; (c) same but `isAlumni=true` — sidebar additionally shows Profile. Check mobile width (bottom tab bar) for case (b)/(c) too.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/layout.tsx" components/layout/Sidebar.tsx components/layout/SidebarShell.tsx
git commit -m "feat: wall off nav for school-affiliated student/alum accounts"
```

---

## Task 8: Server-side guards on off-limits pages

**Files:**
- Modify: `app/(dashboard)/peers/page.tsx`
- Modify: `app/(dashboard)/orgs/page.tsx`
- Modify: `app/(dashboard)/teams/page.tsx`
- Modify: `app/(dashboard)/messages/page.tsx`
- Modify: `app/(dashboard)/quiz/page.tsx`

**Interfaces:**
- Consumes: `isWalledStudent` (Task 2)

`peers/page.tsx` and `orgs/page.tsx` currently have **zero** auth/role gating (confirmed in this session — both are one-line pass-throughs to a client component). This task closes that gap for every account type, not just walled students, since there was no gate there at all before.

- [ ] **Step 1: Guard peers/page.tsx**

Current full file `app/(dashboard)/peers/page.tsx`:

```typescript
import PeersClient from "./PeersClient";

export default function PeersPage() {
  return <PeersClient />;
}
```

Replace with:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isWalledStudent } from "@/lib/accountGate";
import PeersClient from "./PeersClient";

export default async function PeersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (await isWalledStudent(session.user.id)) redirect("/dashboard");

  return <PeersClient />;
}
```

- [ ] **Step 2: Guard orgs/page.tsx**

Current full file `app/(dashboard)/orgs/page.tsx`:

```typescript
import OrgsClient from "./OrgsClient";

export default function OrgsPage() {
  return <OrgsClient />;
}
```

Replace with:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isWalledStudent } from "@/lib/accountGate";
import OrgsClient from "./OrgsClient";

export default async function OrgsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (await isWalledStudent(session.user.id)) redirect("/dashboard");

  return <OrgsClient />;
}
```

- [ ] **Step 3: Guard teams/page.tsx**

In `app/(dashboard)/teams/page.tsx`, find:

```typescript
export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
```

Replace with:

```typescript
export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (await isWalledStudent(session.user.id)) redirect("/dashboard");
```

Add the import near the top of the same file, next to the existing imports:

```typescript
import { isWalledStudent } from "@/lib/accountGate";
```

- [ ] **Step 4: Guard messages/page.tsx**

In `app/(dashboard)/messages/page.tsx`, find:

```typescript
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ dm?: string; group?: string; open?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
```

Replace with:

```typescript
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ dm?: string; group?: string; open?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (await isWalledStudent(session.user.id)) redirect('/dashboard');
```

Add the import near the top of the same file:

```typescript
import { isWalledStudent } from '@/lib/accountGate';
```

- [ ] **Step 5: Guard quiz/page.tsx**

In `app/(dashboard)/quiz/page.tsx`, find the start of the component body:

```typescript
export default async function QuizPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
```

Replace with:

```typescript
export default async function QuizPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (await isWalledStudent(session.user.id)) redirect("/dashboard");

  const searchParams = await props.searchParams;
```

Add the imports near the top of the same file:

```typescript
import { redirect } from "next/navigation";
import { isWalledStudent } from "@/lib/accountGate";
```

(`auth` is already imported in this file.)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors across all five files.

- [ ] **Step 7: Manual verification**

Log in as a walled student/alum demo account and navigate directly (via URL bar) to `/peers`, `/orgs`, `/teams`, `/messages`, `/quiz` — each must redirect to `/dashboard`. Log in as a Standard (no `schoolId`) demo account and confirm all five pages still load normally.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/peers/page.tsx" "app/(dashboard)/orgs/page.tsx" "app/(dashboard)/teams/page.tsx" "app/(dashboard)/messages/page.tsx" "app/(dashboard)/quiz/page.tsx"
git commit -m "fix: gate peers/orgs/teams/messages/quiz behind isWalledStudent + add missing auth checks"
```

---

## Task 9: Extend the profile API for alumni destination fields

**Files:**
- Modify: `app/api/profile/route.ts`

**Interfaces:**
- Produces: `PATCH /api/profile` now also accepts `linkedinUrl`, `employer`, `jobTitle`, `confirmedCollege`, `confirmedMajor`, `isAvailableToMentor` — consumed by Task 10's `AlumniProfileEditor`.

- [ ] **Step 1: Extend the zod schema**

In `app/api/profile/route.ts`, find:

```typescript
const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  currentFocus: z.string().max(120).optional(),
  interests: z.array(z.string()).max(10).optional(),
  grade: z.number().int().min(1).max(20).nullable().optional(),
  schoolName: z.string().max(200).optional(),
  isFirstGen: z.boolean().optional(),
  isHomeschooled: z.boolean().optional(),
  isInternational: z.boolean().optional(),
  handle: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
  onboardingComplete: z.boolean().optional(),
  geniusType: z.enum(["DYNAMO", "BLAZE", "TEMPO", "STEEL"]).nullable().optional(),
  secondaryGeniusType: z.enum(["DYNAMO", "BLAZE", "TEMPO", "STEEL"]).nullable().optional(),
});
```

Replace with:

```typescript
const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  currentFocus: z.string().max(120).optional(),
  interests: z.array(z.string()).max(10).optional(),
  grade: z.number().int().min(1).max(20).nullable().optional(),
  schoolName: z.string().max(200).optional(),
  isFirstGen: z.boolean().optional(),
  isHomeschooled: z.boolean().optional(),
  isInternational: z.boolean().optional(),
  handle: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
  onboardingComplete: z.boolean().optional(),
  geniusType: z.enum(["DYNAMO", "BLAZE", "TEMPO", "STEEL"]).nullable().optional(),
  secondaryGeniusType: z.enum(["DYNAMO", "BLAZE", "TEMPO", "STEEL"]).nullable().optional(),
  linkedinUrl: z.string().max(300).optional(),
  employer: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  confirmedCollege: z.string().max(200).optional(),
  confirmedMajor: z.string().max(200).optional(),
  isAvailableToMentor: z.boolean().optional(),
});
```

- [ ] **Step 2: Extend the update mapping**

Find:

```typescript
  const updateData: Record<string, unknown> = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.currentFocus !== undefined) updateData.currentFocus = data.currentFocus;
  if (data.interests !== undefined) updateData.interests = JSON.stringify(data.interests);
  if (data.grade !== undefined) updateData.grade = data.grade;
  if (data.schoolName !== undefined) updateData.schoolName = data.schoolName;
  if (data.isFirstGen !== undefined) updateData.isFirstGen = data.isFirstGen;
  if (data.isHomeschooled !== undefined) updateData.isHomeschooled = data.isHomeschooled;
  if (data.isInternational !== undefined) updateData.isInternational = data.isInternational;
  if (handle) updateData.handle = handle;
  if (data.onboardingComplete !== undefined) updateData.onboardingComplete = data.onboardingComplete;
  if (data.geniusType !== undefined) updateData.geniusType = data.geniusType;
  if (data.secondaryGeniusType !== undefined) updateData.secondaryGeniusType = data.secondaryGeniusType;
```

Replace with:

```typescript
  const updateData: Record<string, unknown> = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.currentFocus !== undefined) updateData.currentFocus = data.currentFocus;
  if (data.interests !== undefined) updateData.interests = JSON.stringify(data.interests);
  if (data.grade !== undefined) updateData.grade = data.grade;
  if (data.schoolName !== undefined) updateData.schoolName = data.schoolName;
  if (data.isFirstGen !== undefined) updateData.isFirstGen = data.isFirstGen;
  if (data.isHomeschooled !== undefined) updateData.isHomeschooled = data.isHomeschooled;
  if (data.isInternational !== undefined) updateData.isInternational = data.isInternational;
  if (handle) updateData.handle = handle;
  if (data.onboardingComplete !== undefined) updateData.onboardingComplete = data.onboardingComplete;
  if (data.geniusType !== undefined) updateData.geniusType = data.geniusType;
  if (data.secondaryGeniusType !== undefined) updateData.secondaryGeniusType = data.secondaryGeniusType;
  if (data.linkedinUrl !== undefined) updateData.linkedinUrl = data.linkedinUrl;
  if (data.employer !== undefined) updateData.employer = data.employer;
  if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
  if (data.confirmedCollege !== undefined) updateData.confirmedCollege = data.confirmedCollege;
  if (data.confirmedMajor !== undefined) updateData.confirmedMajor = data.confirmedMajor;
  if (data.isAvailableToMentor !== undefined) updateData.isAvailableToMentor = data.isAvailableToMentor;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/profile/route.ts
git commit -m "feat: accept alumni destination fields in profile PATCH"
```

---

## Task 10: Alum-only Profile tab

**Files:**
- Create: `app/(dashboard)/profile/AlumniProfileEditor.tsx`
- Modify: `app/(dashboard)/profile/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/profile` (Task 9)

- [ ] **Step 1: Write the alumni editor component**

Create `app/(dashboard)/profile/AlumniProfileEditor.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  initialProfile: {
    linkedinUrl: string;
    employer: string;
    jobTitle: string;
    confirmedCollege: string;
    confirmedMajor: string;
    isAvailableToMentor: boolean;
  };
}

export default function AlumniProfileEditor({ initialProfile }: Props) {
  const router = useRouter();
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile.linkedinUrl);
  const [employer, setEmployer] = useState(initialProfile.employer);
  const [jobTitle, setJobTitle] = useState(initialProfile.jobTitle);
  const [confirmedCollege, setConfirmedCollege] = useState(initialProfile.confirmedCollege);
  const [confirmedMajor, setConfirmedMajor] = useState(initialProfile.confirmedMajor);
  const [isAvailableToMentor, setIsAvailableToMentor] = useState(initialProfile.isAvailableToMentor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedinUrl, employer, jobTitle, confirmedCollege, confirmedMajor, isAvailableToMentor }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save profile.");
    } else {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#eaeaea]">Alumni Profile</h1>
        <p className="text-sm text-[#909098] mt-1">
          Keep your destination info current so your school can track outcomes, and open yourself up for mentorship.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
            Destination
          </h2>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              LinkedIn URL
            </label>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Employer
            </label>
            <input
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              placeholder="Company name"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Job Title
            </label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Your role"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Confirmed College
            </label>
            <input
              value={confirmedCollege}
              onChange={(e) => setConfirmedCollege(e.target.value)}
              placeholder="Where you ended up"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Confirmed Major
            </label>
            <input
              value={confirmedMajor}
              onChange={(e) => setConfirmedMajor(e.target.value)}
              placeholder="What you studied"
              className="w-full"
            />
          </div>
        </div>

        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
            Mentorship
          </h2>
          <label className="flex items-center gap-2 text-sm text-[#eaeaea]">
            <input
              type="checkbox"
              checked={isAvailableToMentor}
              onChange={(e) => setIsAvailableToMentor(e.target.checked)}
            />
            Open to being paired as a mentor to a current student
          </label>
        </div>

        {error && (
          <p className="text-sm text-[#f87171] bg-[#f8717115] border border-[#f8717130] rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-[#4a80f0] hover:bg-[#6a9fff] text-[#080809] font-semibold text-sm rounded-md px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Saving..." : saved ? "Saved!" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Branch profile/page.tsx**

Replace the full contents of `app/(dashboard)/profile/page.tsx` with:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
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

  if (walled && !dbUser?.isAlumni) {
    redirect("/dashboard");
  }

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

  const [profile, allTraits] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      include: {
        traitLinks: {
          orderBy: { order: "asc" },
          include: { trait: true },
        },
      },
    }),
    prisma.trait.findMany({ orderBy: { category: "asc" } }),
  ]);

  return (
    <ProfileEditor
      userId={userId}
      initialProfile={
        profile
          ? {
              displayName: profile.displayName,
              headline: profile.headline ?? "",
              bio: profile.bio ?? "",
              strengthSummary: profile.strengthSummary ?? "",
              traitIds: profile.traitLinks.map((l) => l.traitId),
              dateOfBirth: profile.dateOfBirth
                ? profile.dateOfBirth.toISOString().split("T")[0]
                : "",
            }
          : null
      }
      allTraits={allTraits}
    />
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Log in as a demo alumni account (e.g. `elena@nivarro.demo` if `isAlumni` is set — otherwise flip a demo student to `isAlumni=true` via the existing seed/hq tooling first), visit `/profile`, confirm the alumni editor loads (not the trait quiz editor), fill in LinkedIn/employer/job title/college/major, check the mentor checkbox, save, refresh, confirm values persisted. Then log in as a walled non-alumni student and confirm `/profile` redirects to `/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/profile/AlumniProfileEditor.tsx" "app/(dashboard)/profile/page.tsx"
git commit -m "feat: add alumni destination-fields profile editor"
```

---

## Task 11: Scope Notifications to community + mentorship activity for walled accounts

**Files:**
- Create: `app/(dashboard)/notifications/WalledNotificationsClient.tsx`
- Modify: `app/(dashboard)/notifications/page.tsx`

**Interfaces:**
- Consumes: `isWalledStudent` (Task 2), `Conversation`/`Message`/`ConversationParticipant` (existing)

The current Notifications page pulls `recruitmentRequest` and `teamApplication` data — both belong to the Teams/Organizations flow, which walled Student/Alum accounts can't access. Replace their feed with unread counts from their COMMUNITY and MENTORSHIP conversations instead.

- [ ] **Step 1: Write the walled notifications client**

Create `app/(dashboard)/notifications/WalledNotificationsClient.tsx`:

```typescript
"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Globe, HeartHandshake } from "lucide-react";

interface ActivityItem {
  id: string;
  kind: "community" | "mentorship";
  label: string;
  lastMessage: string | null;
  updatedAt: string;
  unread: boolean;
}

export default function WalledNotificationsClient({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p style={{ color: "var(--n-text2)", fontSize: 14 }}>No activity yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 600 }}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.kind === "community" ? "/communities" : "/mentorship"}
          style={{
            display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
            border: "1px solid var(--border)",
            background: item.unread ? "rgba(232,137,58,0.08)" : "var(--surface)",
            textDecoration: "none",
          }}
        >
          {item.kind === "community" ? (
            <Globe size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
          ) : (
            <HeartHandshake size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: item.unread ? 700 : 400, color: "var(--text)" }}>
              {item.label}
            </p>
            {item.lastMessage && (
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--n-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.lastMessage}
              </p>
            )}
          </div>
          <span style={{ fontSize: 11, color: "var(--n-muted)", flexShrink: 0 }}>
            {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
          </span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Branch notifications/page.tsx**

Replace the full contents of `app/(dashboard)/notifications/page.tsx` with:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";
import WalledNotificationsClient from "./WalledNotificationsClient";
import { isWalledStudent } from "@/lib/accountGate";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (await isWalledStudent(session.user.id)) {
    const conversations = await prisma.conversation.findMany({
      where: {
        type: { in: ["COMMUNITY", "MENTORSHIP"] },
        participants: { some: { userId: session.user.id } },
      },
      include: {
        participants: { where: { userId: session.user.id }, select: { lastReadAt: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    const items = conversations.map((c) => {
      const lastReadAt = c.participants[0]?.lastReadAt ?? null;
      const lastMessageAt = c.messages[0]?.createdAt ?? c.updatedAt;
      return {
        id: c.id,
        kind: (c.type === "COMMUNITY" ? "community" : "mentorship") as "community" | "mentorship",
        label: c.type === "COMMUNITY" ? (c.communityName ?? "Community Chat") : "Mentorship",
        lastMessage: c.messages[0]?.content ?? null,
        updatedAt: c.updatedAt.toISOString(),
        unread: !lastReadAt || lastReadAt < lastMessageAt,
      };
    });

    return <WalledNotificationsClient items={items} />;
  }

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
                id: true,
                title: true,
                orgId: true,
                org: { select: { id: true, name: true } },
              },
            },
            fromProfile: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                geniusType: true,
                handle: true,
              },
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
                id: true,
                title: true,
                orgId: true,
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
        sortDate: (a.decidedAt ?? new Date()).toISOString(),
        decidedAt: a.decidedAt?.toISOString() ?? null,
        team: a.team,
        orgProject: a.orgProject,
      }))}
    />
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Log in as a walled student/alum with an existing community room and (if Task 5 pairing was tested) a mentorship thread, visit `/notifications`, confirm it shows those two activity rows instead of the recruitment/application feed. Log in as a Standard/Org account and confirm `/notifications` is unchanged.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/notifications"
git commit -m "feat: scope notifications to community + mentorship activity for walled accounts"
```

---

## Self-Review Notes

- **Spec coverage:** Community Chat (Task 6 fix + existing `/communities`), Mentorship (Tasks 1, 3–5), Profile/alumni destination fields (Tasks 9–10), Notifications (Task 11), nav wall-off + "No" list enforcement (Tasks 7–8) are all covered. Explicitly out of scope items (ORG, ADMIN/ORG nav bug, Standard renames, CSV vocabulary, quiz toggle) are untouched. The concurrent-work overlap (admin mentorship pairing API, roster, quiz toggle) is called out in Global Constraints and Task 4, and this plan builds only the missing UI on top of that existing API rather than duplicating it.
- **Type consistency:** `isWalledStudent(userId)` signature is identical everywhere it's imported (Tasks 5, 8, 10, 11). `MENTORSHIP` string literal matches the Prisma enum value added in Task 1 everywhere it's used (Tasks 3, 5, 11). Task 3's `otherUsers` array shape matches what Task 5's `MentorshipClient` consumes (both use `{ id, displayName, handle, avatarUrl }[]`). Task 4's client is written strictly against the existing `/api/school/mentorship` response/request shapes recorded in its Interfaces block, not invented.
- **No placeholders:** every step above contains complete, runnable code.
