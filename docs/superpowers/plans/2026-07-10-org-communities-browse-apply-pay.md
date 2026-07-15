# Org Communities: Browse → Apply → Join Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Standard accounts (`role=STUDENT`, no `schoolId`) a browse → apply → instant-access path into org-run communities, while leaving the existing school-code-gated community chat for Student/Alum/School accounts completely untouched.

**Architecture:** One new Prisma model (`Community`) plus one new optional/unique FK (`Conversation.communityId`). Membership/approval reuses the existing `CommunityMembership` join model and the existing `ApplicationStatus` enum (`PENDING/ACCEPTED/REJECTED/WITHDRAWN`) — `ACCEPTED` grants access immediately, no payment or pricing concept at all in this pass. The final "joined" state reuses the exact chat plumbing the school community already uses (`Conversation`/`Message`/`ConversationParticipant`, `/api/conversations/[id]/messages`, the `join_conversation`/`conversation_message` socket events) — extracted into a shared `CommunityChatRoom` component so both flows render chat identically.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, NextAuth v5. No test runner exists in this repo (no jest/vitest configured, no `*.test.*` files anywhere in `app/`) — verification steps use `npx tsc --noEmit`, `npx prisma validate`, `npx prisma generate`, and manual dev-server checks with `curl` (works fine for `localhost` — the SSL cert issue from project memory only affects real HTTPS endpoints, not local HTTP).

## Global Constraints

- **Deviation from spec (2026-07-15, user decision):** the original spec (`docs/superpowers/specs/2026-07-10-org-communities-browse-apply-pay-design.md`) included pricing and a payment stub (`Community.priceCents`, `CommunityMembership.paymentStatus`, `PaymentStatus` enum, `POST /api/communities/[id]/pay`). User decided: instant access for now — an org accepting a join request grants access immediately, no pricing, no payment step, no `PaymentStatus` concept at all. Every task below has already been rewritten to drop pricing/payment entirely rather than stub it — do not reintroduce `priceCents`/`paymentStatus`/`PaymentStatus`/the pay route. Payment can be layered on later as a separate feature when there's a real gateway to wire up.
- Manual SQL migration required for every schema change — `prisma generate` does not create migration files, and Render runs `prisma migrate deploy` at startup. Use `prisma/migrations/YYYYMMDDHHMMSS_description/migration.sql` with `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` guards.
- Spec reference: `docs/superpowers/specs/2026-07-10-org-communities-browse-apply-pay-design.md` (pricing/payment sections superseded by the deviation above).
- **Deviation from spec:** the spec's API table lists `GET /api/communities` for browsing. This plan does not build that route — the Standard branch of `communities/page.tsx` queries Prisma directly instead, matching this codebase's existing convention (every other dashboard page, e.g. `app/(dashboard)/orgs/page.tsx`, `app/(dashboard)/communities/page.tsx`, fetches with Prisma in the server component rather than calling its own API). Building an unused GET route would be dead code. `POST /api/communities` (org creates a community) is the only method on that route.
- Out of scope: pricing/payment (see deviation above — deferred entirely, not stubbed). Community discovery/search/filtering beyond a flat list. Editing or deleting a community after creation. Any change to the existing school-code chat (`SchoolCodeGate`, `AdminCodePanel`, `ensureSchoolGeneralRoom`) beyond extracting its chat-rendering body into a shared component with identical output.
- Follow existing code style in touched files: inline `style={{}}` props using `var(--...)` CSS variables (not Tailwind) in the communities components, matching `CommunitiesClient.tsx`; Tailwind classes + inline `style` for colors in `OrgDetailClient.tsx`, matching its existing panels (`AdminApplicationsPanel`). No comments unless explaining a non-obvious constraint.
- Walled students (`role=STUDENT` with `profile.schoolId` set) must never be able to join an org community, including via direct API call — not just hidden in the UI. Enforced in Task 5 using the existing `lib/accountGate.ts::isWalledStudent` helper.

---

## Task 1: Schema — `Community`, `CommunityMembership`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260710010000_add_communities/migration.sql`

**Interfaces:**
- Produces: `Community` model (`id, orgId, name, description, createdAt`), `CommunityMembership` model (`id, communityId, userId, status: ApplicationStatus, submittedAt, decidedAt`), `Conversation.communityId` (optional, unique). Consumed by Task 2 (`ensureCommunityConversation`), Tasks 4–6 (API routes), Tasks 8–10 (UI).

- [ ] **Step 1: Add the two new models**

In `prisma/schema.prisma`, immediately after the `Conversation` model's closing brace (currently line 318, right before `enum ConversationType`), insert:

```prisma
model Community {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  description String?
  createdAt   DateTime @default(now())

  org          Org                   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  memberships  CommunityMembership[]
  conversation Conversation?

  @@index([orgId])
}

model CommunityMembership {
  id          String            @id @default(cuid())
  communityId String
  userId      String
  status      ApplicationStatus @default(PENDING)
  submittedAt DateTime          @default(now())
  decidedAt   DateTime?

  community Community @relation(fields: [communityId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([communityId, userId])
}

```

**Note:** `ApplicationStatus` (`PENDING/ACCEPTED/REJECTED/WITHDRAWN`) already exists in the schema (currently ~line 629) — reused as-is, not redefined.

- [ ] **Step 2: Add `communityId` to `Conversation`**

Find the `Conversation` model:

```prisma
model Conversation {
  id        String           @id @default(cuid())
  type      ConversationType @default(DIRECT)
  teamId    String?
  schoolId      String?
  isPrivateRoom Boolean  @default(false)
  communityName String?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  participants ConversationParticipant[]
  messages     Message[]
  team         Team?                    @relation(fields: [teamId], references: [id])
}
```

Replace with:

```prisma
model Conversation {
  id        String           @id @default(cuid())
  type      ConversationType @default(DIRECT)
  teamId    String?
  schoolId      String?
  communityId   String?  @unique
  isPrivateRoom Boolean  @default(false)
  communityName String?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  participants ConversationParticipant[]
  messages     Message[]
  team         Team?                    @relation(fields: [teamId], references: [id])
  community    Community?               @relation(fields: [communityId], references: [id])
}
```

- [ ] **Step 3: Add the back-relation on `Org`**

Find, in the `Org` model:

```prisma
  opportunities   Opportunity[]
  teams           Team[]
  projects        OrgProject[]
  reviews         OrgReview[]
  agentCallLogs   AgentCallLog[]
  savedByProfiles SavedOrg[]

  @@index([createdById])
}
```

Replace with:

```prisma
  opportunities   Opportunity[]
  teams           Team[]
  projects        OrgProject[]
  reviews         OrgReview[]
  agentCallLogs   AgentCallLog[]
  savedByProfiles SavedOrg[]
  communities     Community[]

  @@index([createdById])
}
```

- [ ] **Step 4: Add the back-relation on `User`**

Find, in the `User` model:

```prisma
  accounts              Account[]
  sessions              Session[]
  profile               Profile?
  projectMemberships    ProjectMember[]
  notes                 Note[]
  sentMessages          Message[]                 @relation("SentMessages")
  participations        ConversationParticipant[]
  endorsementsGiven     PeerEndorsement[]         @relation("EndorsementsGiven")
  endorsementsReceived  PeerEndorsement[]         @relation("EndorsementsReceived")
  campaigns             Campaign[]                @relation("SchoolCampaigns")
  surveyTokens          SurveyToken[]
  linkedinScanEvents    LinkedinScanEvent[]
}
```

Replace with:

```prisma
  accounts              Account[]
  sessions              Session[]
  profile               Profile?
  projectMemberships    ProjectMember[]
  notes                 Note[]
  sentMessages          Message[]                 @relation("SentMessages")
  participations        ConversationParticipant[]
  endorsementsGiven     PeerEndorsement[]         @relation("EndorsementsGiven")
  endorsementsReceived  PeerEndorsement[]         @relation("EndorsementsReceived")
  campaigns             Campaign[]                @relation("SchoolCampaigns")
  surveyTokens          SurveyToken[]
  linkedinScanEvents    LinkedinScanEvent[]
  communityMemberships  CommunityMembership[]
}
```

- [ ] **Step 5: Write the migration**

Create `prisma/migrations/20260710010000_add_communities/migration.sql`:

```sql
-- CreateTable
CREATE TABLE IF NOT EXISTS "Community" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommunityMembership" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "communityId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Community_orgId_idx" ON "Community"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityMembership_communityId_userId_key" ON "CommunityMembership"("communityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_communityId_key" ON "Conversation"("communityId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Community" ADD CONSTRAINT "Community_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

- [ ] **Step 6: Regenerate the Prisma client and validate**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` with no errors, and `Community`, `CommunityMembership` available in `@prisma/client` types.

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 7: Apply the migration to the local dev database**

Run: `npx prisma migrate deploy`
Expected: `20260710010000_add_communities` listed as applied, no errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260710010000_add_communities
git commit -m "feat: add Community/CommunityMembership schema for org paid communities"
```

---

## Task 2: `ensureCommunityConversation` helper

**Files:**
- Modify: `lib/communities.ts`

**Interfaces:**
- Consumes: `Community`, `Conversation.communityId` (Task 1)
- Produces: `ensureCommunityConversation(communityId: string, userId: string): Promise<{ id: string }>` — consumed by Task 6 (membership accept, grants instant access).

- [ ] **Step 1: Add the helper**

In `lib/communities.ts`, append after `ensureSchoolGeneralRoom`:

```typescript
export async function ensureCommunityConversation(
  communityId: string,
  userId: string
): Promise<{ id: string }> {
  let conv = await prisma.conversation.findUnique({
    where: { communityId },
    select: { id: true },
  });

  if (!conv) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
      select: { name: true },
    });
    conv = await prisma.conversation.create({
      data: {
        type: 'COMMUNITY',
        communityId,
        isPrivateRoom: false,
        communityName: community?.name ?? 'Community',
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/communities.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/communities.ts
git commit -m "feat: add ensureCommunityConversation helper"
```

---

## Task 3: Extract shared `CommunityChatRoom` component

**Files:**
- Create: `components/communities/CommunityChatRoom.tsx`
- Modify: `app/(dashboard)/communities/CommunitiesClient.tsx`

**Interfaces:**
- Produces: `<CommunityChatRoom roomId myUserId roomName memberCount belowHeader? />` — consumed by Task 3's own rewrite of `CommunitiesClient.tsx` and by Task 8 (`StandardCommunitiesClient.tsx`).

This is a pure extraction — the rendered output for the existing school-chat flow must be pixel-identical to today. Nothing about `SchoolCodeGate` or `AdminCodePanel` changes.

- [ ] **Step 1: Create the shared chat component**

Create `components/communities/CommunityChatRoom.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useSocket } from "@/lib/socket";
import { Send } from "lucide-react";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender?: { name: string | null; image: string | null };
}

interface Props {
  roomId: string;
  roomName: string;
  memberCount: number | null;
  myUserId: string;
  belowHeader?: ReactNode;
}

export default function CommunityChatRoom({ roomId, roomName, memberCount, myUserId, belowHeader }: Props) {
  const socket = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMessages(roomId); }, [roomId, loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("join_conversation", roomId);
    const handler = (msg: Message) => {
      if (msg.senderId === myUserId) return;
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("conversation_message", handler);
    return () => { socket.off("conversation_message", handler); socket.emit("leave_conversation", roomId); };
  }, [socket, roomId, myUserId]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
      }
    } finally { setSending(false); }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl" style={{ height: "calc(100vh - 4rem)", border: "1px solid var(--border-md)" }}>
      <div className="flex items-center gap-3 px-5 shrink-0" style={{ height: 56, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--amber)", flexShrink: 0 }} />
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.3px" }}>
          {roomName}
        </p>
        {memberCount != null && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </p>
        )}
      </div>

      {belowHeader}

      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ background: "var(--bg)" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--amber)", borderTopColor: "transparent" }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p style={{ fontSize: 28 }}>👋</p>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>Be the first to say something</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {messages.map((msg, i) => {
              const isMe = msg.senderId === myUserId;
              const grouped = messages[i - 1]?.senderId === msg.senderId;
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, marginTop: grouped ? 2 : 12 }}>
                  {!grouped && !isMe ? (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface3)", color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
                      {msg.sender?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  ) : (
                    <div style={{ width: 28, flexShrink: 0 }} />
                  )}
                  <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                    {!grouped && !isMe && (
                      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3, paddingLeft: 4 }}>
                        {msg.sender?.name ?? "Unknown"}
                      </p>
                    )}
                    <div style={isMe ? {
                      background: "linear-gradient(135deg, var(--amber), #d97706)",
                      color: "#04070F",
                      borderRadius: "13px 13px 3px 13px",
                      padding: "9px 14px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      fontWeight: 500,
                    } : {
                      background: "var(--surface2)",
                      color: "var(--text)",
                      borderRadius: "13px 13px 13px 3px",
                      border: "1px solid var(--border-md)",
                      padding: "9px 14px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      fontWeight: 500,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 12, background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            rows={1}
            placeholder="Message the group…"
            style={{
              flex: 1, resize: "none", borderRadius: 12, fontSize: 14, maxHeight: 120,
              background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)",
              padding: "10px 16px", outline: "none", fontFamily: "inherit", overflowY: "auto",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-md)"; }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            style={{
              padding: 10, borderRadius: 12, background: "var(--amber)", color: "#04070F",
              border: "none", cursor: "pointer", flexShrink: 0,
              opacity: !input.trim() || sending ? 0.4 : 1,
            }}
          >
            <Send style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, paddingLeft: 4 }}>Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `CommunitiesClient.tsx` to use it**

Replace the full contents of `app/(dashboard)/communities/CommunitiesClient.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { Copy, Check, Pencil } from "lucide-react";
import CommunityChatRoom from "@/components/communities/CommunityChatRoom";

interface RoomSummary {
  id: string;
  communityName: string | null;
  isPrivateRoom: boolean;
  memberCount: number;
  lastMessage: { body: string; createdAt: string } | null;
  updatedAt: string;
}

interface Props {
  schoolId: string | null;
  myUserId: string;
  isAdmin: boolean;
  initialRooms: RoomSummary[];
  schoolCode: string | null;
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
      if (!res.ok) { setError(data.error ?? "Invalid code"); return; }
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
          {"Your school admin will give you a code. Once you enter it, you'll be added to your school's private community."}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. lakewood2026"
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, fontSize: 14,
              background: "var(--surface)", border: "1px solid var(--border-md)",
              color: "var(--text)", fontFamily: "var(--font-mono)", outline: "none",
            }}
          />
          <button
            onClick={submit}
            disabled={loading || !code.trim()}
            style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: "var(--amber)", color: "#04070F", border: "none", cursor: "pointer",
              letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "var(--font-display)",
              opacity: loading || !code.trim() ? 0.5 : 1,
            }}
          >
            {loading ? "…" : "Join"}
          </button>
        </div>
        {error && <p style={{ marginTop: 12, fontSize: 13, color: "#ef4444" }}>{error}</p>}
      </div>
    </div>
  );
}

// ── Admin Code Panel ─────────────────────────────────────────────────────────

function AdminCodePanel({ initialCode }: { initialCode: string | null }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [editing, setEditing] = useState(!initialCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const save = async () => {
    if (!code.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/communities/school-code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode: code.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setEditing(false);
    } finally { setSaving(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: "8px 20px", background: "rgba(0,0,0,0.15)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)", margin: 0, flexShrink: 0 }}>
        Invite code
      </p>
      {editing ? (
        <>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="e.g. westsideacademy2026"
            style={{ fontSize: 13, padding: "4px 10px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text)", fontFamily: "var(--font-mono)", outline: "none", width: 200 }}
            autoFocus
          />
          <button
            onClick={save}
            disabled={!code.trim() || saving}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, background: "var(--amber)", color: "#04070F", border: "none", cursor: "pointer", fontWeight: 700, opacity: !code.trim() || saving ? 0.5 : 1 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {error && <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>}
        </>
      ) : (
        <>
          <code style={{ fontSize: 13, padding: "3px 10px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text)", fontFamily: "var(--font-mono)" }}>
            {code}
          </code>
          <button onClick={copy} title="Copy code" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}>
            {copied ? <Check style={{ width: 14, height: 14, color: "var(--amber)" }} /> : <Copy style={{ width: 14, height: 14 }} />}
          </button>
          <button onClick={() => setEditing(true)} title="Edit code" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}>
            <Pencil style={{ width: 13, height: 13 }} />
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Share this with your students to add them</span>
        </>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function CommunitiesClient({ schoolId, myUserId, isAdmin, initialRooms, schoolCode }: Props) {
  const generalRoom = initialRooms.find((r) => !r.isPrivateRoom) ?? null;
  const roomId = generalRoom?.id ?? null;
  const [joined, setJoined] = useState(isAdmin || !!schoolId);

  if (!joined) {
    return <SchoolCodeGate onJoined={() => { setJoined(true); window.location.reload(); }} />;
  }

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh" }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Setting up your school community…</p>
      </div>
    );
  }

  return (
    <CommunityChatRoom
      roomId={roomId}
      roomName={generalRoom?.communityName ?? "General"}
      memberCount={generalRoom?.memberCount ?? null}
      myUserId={myUserId}
      belowHeader={isAdmin ? <AdminCodePanel initialCode={schoolCode} /> : null}
    />
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/communities/CommunityChatRoom.tsx` or `app/(dashboard)/communities/CommunitiesClient.tsx`.

- [ ] **Step 4: Manual smoke test (school flow unchanged)**

Run: `npm run dev`, log in as `student@nivarro.demo` / `demo2026` (blank student, no `schoolId` yet — should hit the browse flow once Task 9 lands, so for this step instead log in as an existing school-affiliated demo account, e.g. one of the Ridgepoint scholars, or as `ridgepoint@nivarro.demo` / `ridgepoint2026` for the admin view) and visit `/communities`.
Expected: identical behavior to before this task — school admins see the invite-code bar and can send/receive messages; school-affiliated students land straight in the chat.

- [ ] **Step 5: Commit**

```bash
git add components/communities/CommunityChatRoom.tsx "app/(dashboard)/communities/CommunitiesClient.tsx"
git commit -m "refactor: extract CommunityChatRoom for reuse by org communities"
```

---

## Task 4: `POST /api/communities` (org creates a community)

**Files:**
- Create: `app/api/communities/route.ts`

**Interfaces:**
- Consumes: `Community` (Task 1)
- Produces: `POST /api/communities` → `{ id, orgId, name, description, createdAt }` — consumed by Task 10 (`OrgCommunitiesPanel`).

- [ ] **Step 1: Write the route**

Create `app/api/communities/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, name, description } = await req.json();
  if (!orgId || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "orgId and name are required" }, { status: 400 });
  }

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { createdById: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });
  if (org.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const community = await prisma.community.create({
    data: {
      orgId,
      name: name.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
    },
  });

  return NextResponse.json(community);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/api/communities/route.ts`.

- [ ] **Step 3: Manual verification**

With the dev server running and logged in as an org account in the browser (to get a valid session cookie), open a second terminal and run, substituting a real `orgId` you own (find it from the URL of your `/orgs/[orgId]` page) and a session cookie copied from devtools:

```bash
curl -s -X POST http://localhost:3000/api/communities \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste your authjs.session-token cookie here>" \
  -d '{"orgId":"<your org id>","name":"Test Community","description":"A test"}'
```

Expected: `200` with a JSON body containing `id`, `name: "Test Community"`.
Also verify: calling with an `orgId` you do not own returns `403`.

- [ ] **Step 4: Commit**

```bash
git add app/api/communities/route.ts
git commit -m "feat: add POST /api/communities for org community creation"
```

---

## Task 5: `POST /api/communities/[id]/apply`

**Files:**
- Create: `app/api/communities/[id]/apply/route.ts`

**Interfaces:**
- Consumes: `Community`, `CommunityMembership` (Task 1), `isWalledStudent` (`lib/accountGate.ts`, pre-existing)
- Produces: `POST /api/communities/[id]/apply` → `CommunityMembership` row — consumed by Task 8 (`StandardCommunitiesClient`).

- [ ] **Step 1: Write the route**

Create `app/api/communities/[id]/apply/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isWalledStudent } from "@/lib/accountGate";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isWalledStudent(session.user.id)) {
    return NextResponse.json({ error: "Not available for school-affiliated accounts" }, { status: 403 });
  }

  const { id } = await params;

  const community = await prisma.community.findUnique({ where: { id }, select: { id: true } });
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

  const existing = await prisma.communityMembership.findUnique({
    where: { communityId_userId: { communityId: id, userId: session.user.id } },
  });
  if (existing) return NextResponse.json({ error: "Already requested" }, { status: 409 });

  const membership = await prisma.communityMembership.create({
    data: { communityId: id, userId: session.user.id },
  });

  return NextResponse.json(membership);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/api/communities/[id]/apply/route.ts`.

- [ ] **Step 3: Manual verification**

Using the community id created in Task 4's verification, and a session cookie for a *different*, Standard (non-org) demo account (e.g. `student@nivarro.demo`):

```bash
curl -s -X POST http://localhost:3000/api/communities/<community id>/apply \
  -H "Cookie: <paste Standard user's session cookie>"
```

Expected: `200` with `status: "PENDING"`.
Run the same command again: expected `409 Already requested`.

- [ ] **Step 4: Commit**

```bash
git add "app/api/communities/[id]/apply/route.ts"
git commit -m "feat: add POST /api/communities/[id]/apply"
```

---

## Task 6: `PATCH /api/communities/[id]/membership` (org accept/reject)

**Files:**
- Create: `app/api/communities/[id]/membership/route.ts`

**Interfaces:**
- Consumes: `CommunityMembership` (Task 1), `ensureCommunityConversation` (Task 2)
- Produces: `PATCH /api/communities/[id]/membership` → `{ id, status, conversationId: string | null }` — consumed by Task 10 (`OrgCommunitiesPanel`).

- [ ] **Step 1: Write the route**

Create `app/api/communities/[id]/membership/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCommunityConversation } from "@/lib/communities";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { userId, status } = await req.json();
  if (!userId || !["ACCEPTED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "userId and a valid status are required" }, { status: 400 });
  }

  const membership = await prisma.communityMembership.findUnique({
    where: { communityId_userId: { communityId: id, userId } },
    include: { community: { select: { id: true, org: { select: { createdById: true } } } } },
  });
  if (!membership) return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  if (membership.community.org.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (membership.status !== "PENDING") {
    return NextResponse.json({ error: "Already decided" }, { status: 409 });
  }

  if (status === "REJECTED") {
    const updated = await prisma.communityMembership.update({
      where: { communityId_userId: { communityId: id, userId } },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    return NextResponse.json({ id: updated.id, status: updated.status, conversationId: null });
  }

  const updated = await prisma.communityMembership.update({
    where: { communityId_userId: { communityId: id, userId } },
    data: { status: "ACCEPTED", decidedAt: new Date() },
  });

  const conv = await ensureCommunityConversation(membership.community.id, userId);

  return NextResponse.json({ id: updated.id, status: updated.status, conversationId: conv.id });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/api/communities/[id]/membership/route.ts`.

- [ ] **Step 3: Manual verification**

Using the org owner's session cookie from Task 4 and the Standard user's id from Task 5:

```bash
curl -s -X PATCH http://localhost:3000/api/communities/<community id>/membership \
  -H "Content-Type: application/json" \
  -H "Cookie: <org owner's session cookie>" \
  -d '{"userId":"<standard user id>","status":"ACCEPTED"}'
```

Expected: `200` with `status: "ACCEPTED"` and a non-null `conversationId` — access is granted immediately, no payment step.
Repeat the same call: expected `409 Already decided`.

- [ ] **Step 4: Commit**

```bash
git add "app/api/communities/[id]/membership/route.ts"
git commit -m "feat: add PATCH /api/communities/[id]/membership for org accept/reject"
```

---

## Task 7 (removed): payment stub

**Removed per the instant-access deviation** — there is no payment step in this pass. Task numbering below keeps Tasks 8–10 as originally named (no renumbering) to avoid drift with the rest of this doc; treat "Task 7" as skipped.

---

## Task 8: `StandardCommunitiesClient` (browse/apply/join UI)

**Files:**
- Create: `app/(dashboard)/communities/StandardCommunitiesClient.tsx`

**Interfaces:**
- Consumes: `CommunityChatRoom` (Task 3), `POST /api/communities/[id]/apply` (Task 5)
- Produces: `<StandardCommunitiesClient myUserId communities />` where `communities: CommunitySummary[]` — consumed by Task 9 (`communities/page.tsx`).

- [ ] **Step 1: Write the component**

Create `app/(dashboard)/communities/StandardCommunitiesClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import CommunityChatRoom from "@/components/communities/CommunityChatRoom";

interface Membership {
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  conversationId: string | null;
}

interface CommunitySummary {
  id: string;
  name: string;
  description: string | null;
  orgName: string;
  membership: Membership | null;
}

interface Props {
  myUserId: string;
  communities: CommunitySummary[];
}

export default function StandardCommunitiesClient({ myUserId, communities }: Props) {
  const [items, setItems] = useState(communities);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = items.find((c) => c.id === openId) ?? null;

  const apply = async (communityId: string) => {
    setBusyId(communityId);
    try {
      const res = await fetch(`/api/communities/${communityId}/apply`, { method: "POST" });
      if (res.ok) {
        setItems((prev) => prev.map((c) => (c.id === communityId ? { ...c, membership: { status: "PENDING", conversationId: null } } : c)));
      }
    } finally { setBusyId(null); }
  };

  if (open) {
    if (open.membership?.status === "ACCEPTED" && open.membership.conversationId) {
      return (
        <div>
          <button
            onClick={() => setOpenId(null)}
            style={{ marginBottom: 12, fontSize: 13, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            ← Back to communities
          </button>
          <CommunityChatRoom
            roomId={open.membership.conversationId}
            roomName={open.name}
            memberCount={null}
            myUserId={myUserId}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh", gap: 20 }}>
        <button
          onClick={() => setOpenId(null)}
          style={{ alignSelf: "flex-start", fontSize: 13, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          ← Back to communities
        </button>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 10px" }}>
            {open.orgName}
          </p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--text)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            {open.name}
          </h2>
          {open.description && (
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 24px", lineHeight: 1.6 }}>{open.description}</p>
          )}

          {!open.membership && (
            <button
              onClick={() => apply(open.id)}
              disabled={busyId === open.id}
              style={{
                padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: "var(--amber)", color: "#04070F", border: "none", cursor: "pointer",
                letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "var(--font-display)",
                opacity: busyId === open.id ? 0.5 : 1,
              }}
            >
              {busyId === open.id ? "…" : "Request to Join"}
            </button>
          )}

          {open.membership?.status === "PENDING" && (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Your request is pending approval.</p>
          )}

          {open.membership?.status === "REJECTED" && (
            <p style={{ fontSize: 13, color: "#ef4444" }}>Your request was not approved.</p>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh" }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No communities yet — check back soon.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)", margin: "0 0 8px" }}>Communities</h2>
      {items.map((c) => (
        <button
          key={c.id}
          onClick={() => setOpenId(c.id)}
          style={{
            textAlign: "left", padding: "16px 20px", borderRadius: 12,
            background: "var(--surface)", border: "1px solid var(--border-md)", cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
          }}
        >
          <div>
            <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 4px" }}>
              {c.orgName}
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>{c.name}</p>
            {c.description && <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{c.description}</p>}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {c.membership?.status === "PENDING" && <p style={{ fontSize: 11, color: "var(--muted)" }}>Pending</p>}
            {c.membership?.status === "REJECTED" && <p style={{ fontSize: 11, color: "#ef4444" }}>Rejected</p>}
            {c.membership?.status === "ACCEPTED" && <p style={{ fontSize: 11, color: "#22c55e" }}>Joined</p>}
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/(dashboard)/communities/StandardCommunitiesClient.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/communities/StandardCommunitiesClient.tsx"
git commit -m "feat: add StandardCommunitiesClient browse/apply/join UI"
```

---

## Task 9: Branch `communities/page.tsx` by account type

**Files:**
- Modify: `app/(dashboard)/communities/page.tsx`

**Interfaces:**
- Consumes: `StandardCommunitiesClient` (Task 8), existing `CommunitiesClient` (Task 3), `Community`/`CommunityMembership` (Task 1)

- [ ] **Step 1: Rewrite the page**

Replace the full contents of `app/(dashboard)/communities/page.tsx` with:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CommunitiesClient from "./CommunitiesClient";
import StandardCommunitiesClient from "./StandardCommunitiesClient";
import { ensureSchoolGeneralRoom } from "@/lib/communities";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Communities — Nivarro" };

export default async function CommunitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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

  const isSchool = user?.role === "SCHOOL";
  const isOrg = user?.role === "ORG" || user?.role === "ADMIN";
  const isStandard = !isSchool && !isOrg && !profile?.schoolId;

  if (isStandard) {
    const communityRows = await prisma.community.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        org: { select: { name: true } },
        conversation: { select: { id: true } },
        memberships: {
          where: { userId: session.user.id },
          select: { status: true },
        },
      },
    });

    const communities = communityRows.map((c) => {
      const membership = c.memberships[0] ?? null;
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        orgName: c.org.name,
        membership: membership
          ? {
              status: membership.status,
              conversationId: membership.status === "ACCEPTED" ? c.conversation?.id ?? null : null,
            }
          : null,
      };
    });

    return <StandardCommunitiesClient myUserId={session.user.id} communities={communities} />;
  }

  // School admin accounts (role=SCHOOL) use their own id as schoolId
  const isAdmin = isSchool;
  const schoolId = isAdmin ? session.user.id : (profile?.schoolId ?? null);

  // Ensure the General Room exists for school admins (handles existing accounts
  // that were created before this feature was added)
  if (isAdmin) {
    await ensureSchoolGeneralRoom(session.user.id, session.user.id);
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/(dashboard)/communities/page.tsx`.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, log in as `student@nivarro.demo` / `demo2026` (Standard account — blank student, no `schoolId`), visit `/communities`.
Expected: the browse list renders (showing any communities created in earlier tasks' manual verification, e.g. "Test Community"). Click a card with no membership yet → detail view with "Request to Join" → click it → status changes to "pending approval". This exercises the full apply path end-to-end through the UI.

Then log back in as `ridgepoint@nivarro.demo` / `ridgepoint2026` (school admin) and re-visit `/communities` — expected: unchanged, invite-code chat as before.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/communities/page.tsx"
git commit -m "feat: branch /communities by account type (Standard gets browse UI)"
```

---

## Task 10: Org-side "Communities" tab

**Files:**
- Create: `app/(dashboard)/orgs/[orgId]/OrgCommunitiesPanel.tsx`
- Modify: `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx`
- Modify: `app/(dashboard)/orgs/[orgId]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/communities` (Task 4), `PATCH /api/communities/[id]/membership` (Task 6)

- [ ] **Step 1: Write the panel**

Create `app/(dashboard)/orgs/[orgId]/OrgCommunitiesPanel.tsx`:

```tsx
"use client";

import { useState } from "react";

interface CommunityMembershipRow {
  id: string;
  userId: string;
  status: string;
  submittedAt: string;
  user: { profile: { displayName: string } | null };
}

interface OrgCommunity {
  id: string;
  name: string;
  description: string | null;
  memberships: CommunityMembershipRow[];
}

export default function OrgCommunitiesPanel({ orgId, communities }: { orgId: string; communities: OrgCommunity[] }) {
  const [items, setItems] = useState(communities);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCommunity = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create community"); return; }
      setItems((prev) => [{ ...data, memberships: [] }, ...prev]);
      setName(""); setDescription(""); setCreating(false);
    } finally { setSaving(false); }
  };

  const decide = async (communityId: string, userId: string, status: "ACCEPTED" | "REJECTED") => {
    setItems((prev) => prev.map((c) => c.id !== communityId ? c : {
      ...c,
      memberships: c.memberships.map((m) => m.userId === userId ? { ...m, status } : m),
    }));
    const res = await fetch(`/api/communities/${communityId}/membership`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((c) => c.id !== communityId ? c : {
        ...c,
        memberships: c.memberships.map((m) => m.userId === userId ? { ...m, status: "PENDING" } : m),
      }));
    }
  };

  return (
    <div className="space-y-6 mb-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          {items.length} communit{items.length === 1 ? "y" : "ies"}
        </p>
        <button
          onClick={() => setCreating((v) => !v)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(74,128,240,0.15)", color: "var(--blue)", border: "1px solid rgba(74,128,240,0.3)" }}
        >
          {creating ? "Cancel" : "+ New Community"}
        </button>
      </div>

      {creating && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Community name"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text)", outline: "none" }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text)", outline: "none" }}
          />
          {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
          <button
            onClick={createCommunity}
            disabled={!name.trim() || saving}
            className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            style={{ background: "var(--amber)", color: "#04070F", border: "none" }}
          >
            {saving ? "Creating…" : "Create Community"}
          </button>
        </div>
      )}

      {items.length === 0 && !creating && (
        <div className="text-center py-16 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--text2)" }}>No communities yet</p>
        </div>
      )}

      {items.map((c) => {
        const pending = c.memberships.filter((m) => m.status === "PENDING");
        return (
          <div key={c.id} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{c.name}</p>
            </div>
            {c.description && <p className="text-xs mb-3" style={{ color: "var(--text2)" }}>{c.description}</p>}
            {pending.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>No pending requests</p>
            ) : (
              <div className="space-y-2">
                {pending.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <span className="text-sm" style={{ color: "var(--text)" }}>{m.user.profile?.displayName ?? "Unknown"}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => decide(c.id, m.userId, "ACCEPTED")}
                        className="text-xs font-semibold px-3 py-1 rounded-lg"
                        style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => decide(c.id, m.userId, "REJECTED")}
                        className="text-xs font-semibold px-3 py-1 rounded-lg"
                        style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire the tab into `OrgDetailClient.tsx`**

In `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx`:

Add the import, near the other local imports at the top of the file:

```typescript
import OrgCommunitiesPanel from "./OrgCommunitiesPanel";
```

Add a `communities` prop to the main component's props type. Find:

```typescript
  applications: AdminApplication[];
  adminStats: { activeProjects: number; totalApps: number; pendingCount: number; acceptedCount: number } | null;
  apiKey: string | null;
  reviewCount: number;
  whatInternsBuild: string | null;
  initialSaved: boolean;
}) {
```

Replace with:

```typescript
  applications: AdminApplication[];
  adminStats: { activeProjects: number; totalApps: number; pendingCount: number; acceptedCount: number } | null;
  apiKey: string | null;
  reviewCount: number;
  whatInternsBuild: string | null;
  initialSaved: boolean;
  communities: {
    id: string;
    name: string;
    description: string | null;
    memberships: { id: string; userId: string; status: string; submittedAt: string; user: { profile: { displayName: string } | null } }[];
  }[];
}) {
```

Extend the tab state. Find:

```typescript
  const [adminTab, setAdminTab] = useState<"overview" | "projects" | "applications" | "settings">("overview");
```

Replace with:

```typescript
  const [adminTab, setAdminTab] = useState<"overview" | "projects" | "applications" | "communities" | "settings">("overview");
```

Extend the tab list. Find:

```typescript
            {(["overview", "projects", "applications", "settings"] as const).map((t) => (
```

Replace with:

```typescript
            {(["overview", "projects", "applications", "communities", "settings"] as const).map((t) => (
```

Add the panel render, right after the existing applications panel block. Find:

```typescript
      {/* Admin: applications review panel */}
      {isAdmin && adminTab === "applications" && (
        <AdminApplicationsPanel
          orgId={org.id}
          applications={applications}
          statuses={appStatuses}
          onDecision={(id, status) => setAppStatuses((prev) => ({ ...prev, [id]: status }))}
        />
      )}
```

Replace with:

```typescript
      {/* Admin: applications review panel */}
      {isAdmin && adminTab === "applications" && (
        <AdminApplicationsPanel
          orgId={org.id}
          applications={applications}
          statuses={appStatuses}
          onDecision={(id, status) => setAppStatuses((prev) => ({ ...prev, [id]: status }))}
        />
      )}

      {/* Admin: communities panel */}
      {isAdmin && adminTab === "communities" && (
        <OrgCommunitiesPanel orgId={org.id} communities={communities} />
      )}
```

Finally, update every call site that renders `<OrgDetailClient ... />` to pass the new `communities` prop — there is exactly one, in `page.tsx` (Step 3 below).

- [ ] **Step 3: Fetch communities server-side in `page.tsx`**

In `app/(dashboard)/orgs/[orgId]/page.tsx`, find the `Promise.all` that fetches `applications` and `adminStats`:

```typescript
  const [applications, adminStats] = await Promise.all([
    isAdmin
      ? prisma.teamApplication.findMany({
```

Replace the whole block (through its closing `]);`) with:

```typescript
  const [applications, adminStats, communities] = await Promise.all([
    isAdmin
      ? prisma.teamApplication.findMany({
          where: { orgProject: { orgId } },
          orderBy: { submittedAt: "desc" },
          include: {
            orgProject: { select: { id: true, title: true } },
            team: {
              include: {
                members: {
                  include: {
                    profile: {
                      select: {
                        id: true, displayName: true, avatarUrl: true, geniusType: true, handle: true,
                        headline: true, bio: true, strengthSummary: true,
                        orgReviews: {
                          select: {
                            id: true, body: true,
                            org: { select: { name: true } },
                            orgProject: { select: { title: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [],
    isAdmin
      ? prisma.$transaction([
          prisma.teamApplication.count({ where: { orgProject: { orgId }, status: "PENDING" } }),
          prisma.teamApplication.count({ where: { orgProject: { orgId }, status: "ACCEPTED" } }),
          prisma.teamApplication.count({ where: { orgProject: { orgId } } }),
          prisma.orgReview.count({ where: { orgId } }),
        ])
      : [0, 0, 0, 0],
    isAdmin
      ? prisma.community.findMany({
          where: { orgId },
          orderBy: { createdAt: "desc" },
          include: {
            memberships: {
              orderBy: { submittedAt: "desc" },
              include: { user: { select: { id: true, profile: { select: { displayName: true } } } } },
            },
          },
        })
      : [],
  ]);
```

Then find where the response is destructured:

```typescript
  const [pendingCount, acceptedCount, totalApps, reviewCount] = adminStats as [number, number, number, number];
```

This line is unaffected (still destructures `adminStats`, now the second element of the outer array) — leave it as-is, since `adminStats` above is already bound by the `Promise.all` destructuring.

Finally, find the `<OrgDetailClient` call and add the `communities` prop. Find:

```typescript
      reviewCount={reviewCount}
      whatInternsBuild={org.whatInternsBuild ?? null}
      initialSaved={initialSaved}
    />
```

Replace with:

```typescript
      reviewCount={reviewCount}
      whatInternsBuild={org.whatInternsBuild ?? null}
      initialSaved={initialSaved}
      communities={communities.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        memberships: c.memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          status: m.status,
          submittedAt: m.submittedAt.toISOString(),
          user: { profile: m.user.profile ? { displayName: m.user.profile.displayName } : null },
        })),
      }))}
    />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `OrgCommunitiesPanel.tsx`, `OrgDetailClient.tsx`, or `orgs/[orgId]/page.tsx`.

- [ ] **Step 5: Full build**

Run: `npm run build`
Expected: build completes successfully with no type errors anywhere in the touched files.

- [ ] **Step 6: Manual end-to-end smoke test**

Run: `npm run dev`. Log in as `ridgepoint@nivarro.demo` / `ridgepoint2026`, go to `/orgs/<their org id>`, click the "Communities" tab, create a new community (e.g. "Fellows Circle"), confirm it appears in the list. Log in as `student@nivarro.demo` in another browser/incognito window, go to `/communities`, find "Fellows Circle", click "Request to Join". Back as the org admin, refresh the Communities tab, confirm the pending request appears, click "Accept". Back as the student, refresh `/communities`, confirm the card now shows "Joined", open it, confirm it lands directly in the chat room (no payment step) and a message can be sent and received.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/orgs/[orgId]/OrgCommunitiesPanel.tsx" "app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx" "app/(dashboard)/orgs/[orgId]/page.tsx"
git commit -m "feat: add org-side Communities tab (create + accept/reject)"
```

---

## Verification Summary

After all tasks (Task 7 skipped, no renumbering): a Standard account can browse org communities at `/communities`, request to join, and land in a real chat room immediately once an org accepts — reusing existing chat infrastructure, no payment step. An org account manages this from a new "Communities" tab on their org dashboard. Student/Alum/School accounts see zero change to their existing code-gated flow. No automated test suite exists in this repo — `npx tsc --noEmit` after every task plus the manual `curl`/browser checks in Tasks 4–10 are the verification gates, consistent with how every other feature in this codebase has been built and verified.
