# Support Tickets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every account type (student, walled/school-student, staff, org, school-admin) one consistent "Support" entry point that files a ticket to the Nivarro team, and give the Nivarro team an HQ view to triage and resolve tickets — with the submitter notified (email + in-app) when their ticket is resolved, branded as coming from "Nivarro," never from a named admin.

**Architecture:** New `SupportTicket` Prisma model + two API routes (`POST`/`GET` on the collection, `PATCH` on an item). A single modal component (`SupportTicketModal`) is wired into `Sidebar.tsx`'s footer once, so it reaches all five role-specific nav variants without touching any of them. An HQ-gated admin page lists and resolves tickets. Resolution fires a best-effort email and adds an item to the existing `/notifications` page's on-the-fly aggregation (no new notification infrastructure). This design supersedes and removes the old student-only "Platform Feedback" box.

**Tech Stack:** Next.js App Router (async route params), Prisma/PostgreSQL, NextAuth v5 (`auth()`), Resend (`lib/resend.ts`), Zod validation, `lucide-react` icons, `date-fns`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-13-support-tickets-design.md` — every task below implements a section of it.
- **No test framework exists for this Next.js app** (root `package.json` has no test script; the only `jest.config.js` in the repo belongs to an unrelated legacy `server/` Express service). Per "follow established patterns," this plan does not fabricate a TDD harness — verification steps use `npx tsc --noEmit`, `npm run build`, and manual checks against the running dev server instead of a test runner.
- Every new Prisma field/model needs a **manual migration file** in `prisma/migrations/` — `prisma generate` alone does not create one, and Render runs `prisma migrate deploy` at startup (see [[Nivarro Dev Patterns]]).
- User-facing copy (email subject/body, in-app notification label) must read as coming from **"Nivarro" / "The Nivarro Team,"** never naming or implying an individual admin resolved the ticket.
- Org accounts are explicitly out of scope for the in-app resolution notice (no `/notifications` link in `orgNav` today) — do not add one as part of this plan. They still get the email notice.
- CSS: dashboard-scoped components (modal, notifications) use the `var(--surface)`, `var(--border)`, `var(--text)`, `var(--muted)`, `var(--blue)`, `var(--n-bg2)` token set already used in `ApplyModal.tsx` / `OrgDetailClient.tsx`. The `(hq)` route group uses its own darker `var(--amber)`-accented, square-corner (`borderRadius: 0`) style already established in `app/(hq)/hq/page.tsx` — match whichever area a given file lives in.

---

## Task 1: `SupportTicket` data model

**Files:**
- Modify: `prisma/schema.prisma` (add `supportTickets SupportTicket[]` to `User`; append new enum + model at end of file)
- Create: `prisma/migrations/20260813120000_add_support_tickets/migration.sql`

**Interfaces:**
- Produces: `SupportTicket { id: string, userId: string, subject: string, message: string, path: string | null, status: "OPEN" | "RESOLVED", replyMessage: string | null, createdAt: Date, resolvedAt: Date | null, user: User }`. Every later task in this plan reads/writes this shape via `prisma.supportTicket`.

- [ ] **Step 1: Add the `User` relation**

In `prisma/schema.prisma`, find the `User` model (starts at line 72). The relations block ends with:

```prisma
  campaigns             Campaign[]                @relation("SchoolCampaigns")
  donationsReceived     Donation[]                @relation("DonationsReceived")
}
```

Add a line before the closing `}`:

```prisma
  campaigns             Campaign[]                @relation("SchoolCampaigns")
  donationsReceived     Donation[]                @relation("DonationsReceived")
  supportTickets        SupportTicket[]
}
```

- [ ] **Step 2: Append the enum + model**

At the very end of `prisma/schema.prisma` (after the `ScrapedListing` model and its closing `}`), append:

```prisma

// ─────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────

enum SupportTicketStatus {
  OPEN
  RESOLVED
}

model SupportTicket {
  id           String              @id @default(cuid())
  userId       String
  subject      String
  message      String
  path         String?
  status       SupportTicketStatus @default(OPEN)
  replyMessage String?
  createdAt    DateTime            @default(now())
  resolvedAt   DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
}
```

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 4: Write the manual migration file**

Create `prisma/migrations/20260813120000_add_support_tickets/migration.sql`:

```sql
-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "path" TEXT,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "replyMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Generate the Prisma client and apply locally**

Run: `npx prisma generate`
Expected: `Generated Prisma Client ...` with no errors.

Run: `npx prisma migrate deploy`
Expected: `1 migration found ... Applied migration 20260813120000_add_support_tickets`. (This applies it to whichever database `DATABASE_URL` in your local env points at — same mechanism Render uses in production.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260813120000_add_support_tickets
git commit -m "Add SupportTicket model and migration"
```

---

## Task 2: `POST`/`GET /api/support-tickets`

**Files:**
- Create: `app/api/support-tickets/route.ts`

**Interfaces:**
- Consumes: `SupportTicket` model from Task 1; `auth()` from `lib/auth.ts`; `prisma` from `lib/prisma.ts`; `getResendClient()` from `lib/resend.ts` (existing, returns a `Resend` client).
- Produces: `POST /api/support-tickets` — body `{ subject: string, message: string, path?: string }`, requires session, returns `{ ok: true, id: string }` on success. `GET /api/support-tickets` — ADMIN-only, returns `{ tickets: Array<SupportTicket & { user: { email: string | null, role: string, profile: { displayName: string } | null } }> }`, open tickets first then newest. Task 7 (HQ page) and Task 4 (modal) consume this route.

- [ ] **Step 1: Write the route**

Create `app/api/support-tickets/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getResendClient } from "@/lib/resend";

const createSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  path: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: session.user.id,
      subject: parsed.data.subject,
      message: parsed.data.message,
      path: parsed.data.path ?? null,
    },
  });

  const resend = getResendClient();
  try {
    await resend.emails.send({
      from: "Nivarro Support <support@nivarro.co>",
      to: "team.nivarro@gmail.com",
      subject: `New Support Ticket: ${parsed.data.subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #4A80F0;">New Support Ticket</h2>
          <p><strong>From:</strong> ${session.user.email ?? session.user.id}</p>
          <p><strong>Subject:</strong> ${parsed.data.subject}</p>
          ${parsed.data.path ? `<p><strong>Page:</strong> ${parsed.data.path}</p>` : ""}
          <hr style="border-color: #2a2a33;" />
          <p style="white-space: pre-wrap; font-size: 15px; line-height: 1.6;">${parsed.data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[SUPPORT_TICKET] Email send failed:", err);
  }

  return NextResponse.json({ ok: true, id: ticket.id });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tickets = await prisma.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      user: {
        select: {
          email: true,
          role: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  });

  return NextResponse.json({ tickets });
}
```

Note: `orderBy: [{ status: "asc" }, ...]` sorts by the Postgres enum's declared value order (`OPEN` then `RESOLVED`, per Task 1's `CREATE TYPE` order) — open tickets come first regardless of alphabetical accident.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/api/support-tickets/route.ts`.

- [ ] **Step 3: Manual verification against the dev server**

Start the dev server (`npm run dev`) if not already running. With a logged-in session cookie in your browser (or via the browse/gstack tool), `POST` to `/api/support-tickets` with `{"subject":"test","message":"test"}` and confirm a `200` with `{ ok: true, id: "..." }`. Then confirm a row exists: `npx prisma studio` (or a one-off `node -e` script) and check `SupportTicket` has the new row. Hitting `GET /api/support-tickets` while logged in as a non-admin should return `403`.

- [ ] **Step 4: Commit**

```bash
git add app/api/support-tickets/route.ts
git commit -m "Add POST/GET /api/support-tickets"
```

---

## Task 3: `PATCH /api/support-tickets/[id]` + resolution email

**Files:**
- Create: `app/api/support-tickets/[id]/route.ts`

**Interfaces:**
- Consumes: `SupportTicket` model (Task 1); async dynamic route params (`{ params: Promise<{ id: string }> }>`, matching `app/api/org-projects/[id]/route.ts`'s existing convention).
- Produces: `PATCH /api/support-tickets/[id]` — ADMIN-only, body `{ status: "OPEN" | "RESOLVED", replyMessage?: string }`, returns `{ ok: true, ticket: SupportTicket }`. Task 7's `SupportTicketRow` calls this.

- [ ] **Step 1: Write the route**

Create `app/api/support-tickets/[id]/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getResendClient } from "@/lib/resend";

const patchSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]),
  replyMessage: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolvedAt: parsed.data.status === "RESOLVED" ? new Date() : null,
      ...(parsed.data.status === "RESOLVED" && parsed.data.replyMessage
        ? { replyMessage: parsed.data.replyMessage }
        : {}),
    },
    include: { user: { select: { email: true } } },
  });

  if (parsed.data.status === "RESOLVED" && ticket.user.email) {
    const resend = getResendClient();
    try {
      await resend.emails.send({
        from: "Nivarro Support <support@nivarro.co>",
        to: ticket.user.email,
        subject: "Your Nivarro support ticket has been resolved",
        html: `
          <div style="font-family: sans-serif; max-width: 600px;">
            <h2 style="color: #4A80F0;">Your ticket has been resolved</h2>
            <p><strong>Subject:</strong> ${ticket.subject}</p>
            <p style="white-space: pre-wrap; font-size: 15px; line-height: 1.6;">
              ${ticket.replyMessage ? ticket.replyMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "The Nivarro team has resolved your ticket."}
            </p>
            <p style="margin-top: 24px; color: #666;">— The Nivarro Team</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("[SUPPORT_TICKET] Resolution email failed:", err);
    }
  }

  return NextResponse.json({ ok: true, ticket });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/api/support-tickets/[id]/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/support-tickets/[id]/route.ts"
git commit -m "Add PATCH /api/support-tickets/[id] with resolution email"
```

(Full end-to-end verification of resolve + email + reopen happens in Task 9, once the HQ UI in Task 7 can drive this route.)

---

## Task 4: `SupportTicketModal` component

**Files:**
- Create: `components/support/SupportTicketModal.tsx`

**Interfaces:**
- Consumes: `POST /api/support-tickets` from Task 2.
- Produces: `<SupportTicketModal open: boolean, onClose: () => void />`. Task 5 (`Sidebar.tsx`) renders this.

- [ ] **Step 1: Write the component**

Create `components/support/SupportTicketModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { X, LifeBuoy } from "lucide-react";

interface SupportTicketModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SupportTicketModal({ open, onClose }: SupportTicketModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const valid = subject.trim().length > 0 && message.trim().length > 0;

  const handleClose = () => {
    setSubject("");
    setMessage("");
    setSent(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim(), path: window.location.pathname }),
      });
      if (!res.ok) {
        setError("Something went wrong — please try again.");
        return;
      }
      setSent(true);
      setTimeout(handleClose, 1800);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div
        className="relative w-full sm:max-w-md overflow-hidden flex flex-col"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-md)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div
          className="flex items-start justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4" style={{ color: "var(--blue)" }} />
            <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>Contact Support</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: "var(--muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {sent ? (
            <p className="text-sm py-6 text-center" style={{ color: "#4ade80" }}>
              Ticket sent — we&apos;ll follow up by email.
            </p>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text2)" }}>
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What's this about?"
                  className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none"
                  style={{ background: "var(--n-bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text2)" }}>
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Tell us what's going on…"
                  className="w-full resize-none text-sm rounded-lg px-3 py-2 focus:outline-none"
                  style={{ background: "var(--n-bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
                />
              </div>
              {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={submitting || !valid}
                className="w-full py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--blue)", color: "var(--on-accent)", borderRadius: "var(--radius-md)" }}
              >
                {submitting ? "Sending…" : "Send"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/support/SupportTicketModal.tsx`. (It won't be rendered anywhere yet — that's Task 5 — so this only checks the component compiles in isolation.)

- [ ] **Step 3: Commit**

```bash
git add components/support/SupportTicketModal.tsx
git commit -m "Add SupportTicketModal component"
```

---

## Task 5: Wire "Support" into `Sidebar.tsx`

**Files:**
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `SupportTicketModal` from Task 4.

- [ ] **Step 1: Add the icon import**

In `components/layout/Sidebar.tsx` line 5, add `LifeBuoy` to the `lucide-react` import:

```tsx
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Bell, Briefcase, Megaphone, Globe, GraduationCap, HeartHandshake, School, User, Gift, LifeBuoy } from "lucide-react";
```

- [ ] **Step 2: Import the modal**

Below the existing imports (after `import type { Capability } from "@/lib/facultyPermissions";` at line 9), add:

```tsx
import SupportTicketModal from "@/components/support/SupportTicketModal";
```

- [ ] **Step 3: Add local state**

Inside `export default function Sidebar(...)`, right after `const pathname = usePathname();` (line 62), add:

```tsx
  const [supportOpen, setSupportOpen] = useState(false);
```

This requires `useState` — add it to the React import. Line 1-2 currently:

```tsx
"use client";

import Link from "next/link";
```

Change to:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
```

- [ ] **Step 4: Add the Support button, above the collapse toggle**

Find the "Collapse toggle — desktop only" button block (starts at line 200):

```tsx
      {/* Collapse toggle — desktop only */}
      <button
        onClick={onToggleCollapse}
```

Insert a new button immediately before it:

```tsx
      {/* Support */}
      <button
        onClick={() => setSupportOpen(true)}
        className="flex items-center flex-shrink-0"
        title={collapsed ? "Support" : undefined}
        style={{
          height: 36,
          gap: collapsed ? 0 : 10,
          padding: collapsed ? "0" : "0 10px",
          justifyContent: collapsed ? "center" : "flex-start",
          margin: collapsed ? "8px 0 0" : "8px 8px 0",
          background: "none",
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          paddingTop: 8,
          cursor: "pointer",
          color: "var(--n-text2)",
          fontFamily: "var(--font-body)",
          fontSize: 13,
        }}
      >
        <LifeBuoy className="flex-shrink-0" size={15} />
        {!collapsed && <span>Support</span>}
      </button>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={onToggleCollapse}
```

- [ ] **Step 5: Render the modal**

Find the closing of the component's returned `<aside>` (the last lines of the file, around line 227-230):

```tsx
      )}
    </aside>
  );
}
```

Change to:

```tsx
      )}
    </aside>
    <SupportTicketModal open={supportOpen} onClose={() => setSupportOpen(false)} />
  );
}
```

Wait — `<aside>` and `<SupportTicketModal>` are two sibling top-level elements, which JSX doesn't allow without a wrapper. Instead, wrap the existing `return (...)` in a fragment. Find:

```tsx
  return (
    <aside
```

Change to:

```tsx
  return (
    <>
    <aside
```

And change the final:

```tsx
      )}
    </aside>
    <SupportTicketModal open={supportOpen} onClose={() => setSupportOpen(false)} />
  );
}
```

to:

```tsx
      )}
    </aside>
    <SupportTicketModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/layout/Sidebar.tsx`.

- [ ] **Step 7: Manual verification**

Run `npm run dev`, log in as any demo account (e.g. `student@nivarro.demo` / `demo2026`), confirm a "Support" row appears at the bottom of the sidebar above the collapse toggle, clicking it opens the modal, and submitting a ticket shows the "Ticket sent" confirmation and auto-closes. Repeat with an org account (`org@nivarro.demo` / `demo2026`) and a school account (`ridgepoint@nivarro.demo`'s counterpart or any `SCHOOL`-role login) to confirm it shows regardless of which of the five nav arrays is active. Also toggle the sidebar to collapsed state and confirm the Support icon still renders and still opens the modal.

- [ ] **Step 8: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "Wire Support entry point into Sidebar for all roles"
```

---

## Task 6: Remove the old "Platform Feedback" widget

**Files:**
- Modify: `app/(dashboard)/dashboard/DashboardClient.tsx`
- Delete: `app/api/feedback/route.ts`

**Interfaces:**
- None — this is a removal, no other task depends on `sendFeedback`/`app/api/feedback`.

- [ ] **Step 1: Remove state and handler**

In `app/(dashboard)/dashboard/DashboardClient.tsx`, remove these two state lines (currently lines 89-90):

```tsx
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
```

Remove the `sendFeedback` handler (currently lines 115-119):

```tsx
  const sendFeedback = async () => {
    if (!feedback.trim()) return;
    await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: feedback }) });
    setFeedback(""); setFeedbackSent(true); setTimeout(() => setFeedbackSent(false), 3000);
  };
```

- [ ] **Step 2: Remove the JSX block**

Remove the "Feedback" section (currently lines 282-306):

```tsx
      {/* ── Feedback ──────────────────────────────── */}
      <div className="bracket-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "24px" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 12 }}>
          ▸ Platform Feedback
        </p>
        {feedbackSent ? (
          <p style={{ fontSize: 15, color: "#4ade80", fontFamily: "var(--font-body)" }}>Transmission received.</p>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={feedback} onChange={(e) => setFeedback(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendFeedback()} placeholder="Report anomaly or missing asset…" style={{
              flex: 1, fontSize: 14, padding: "10px 14px",
              background: "var(--surface2)", border: "1px solid var(--border-md)",
              color: "#FFFFFF", fontFamily: "var(--font-body)", outline: "none",
            }} />
            <button onClick={sendFeedback} style={{
              padding: "10px 20px", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: "700",
              letterSpacing: "0.12em", textTransform: "uppercase",
              background: "var(--amber)", color: "#000", border: "none", cursor: "pointer",
            }}>
              Send
            </button>
          </div>
        )}
      </div>

```

(Leave the closing `</section>` above it and the `<div>`/`</>` structure below it intact — only the feedback block itself is removed.)

- [ ] **Step 3: Delete the orphaned route**

Delete `app/api/feedback/route.ts` (confirm nothing else references it first):

Run: `grep -rn "/api/feedback" --include="*.tsx" --include="*.ts" app components lib`
Expected: no output (the only caller was the code just removed in Step 2).

Then delete the file.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `DashboardClient.tsx` (confirms no dangling references to `feedback`/`feedbackSent`/`sendFeedback`).

- [ ] **Step 5: Manual verification**

Run `npm run dev`, log in as a standard student account, load `/dashboard`, confirm the "Platform Feedback" box is gone and the rest of the dashboard renders normally.

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/dashboard/DashboardClient.tsx
git rm app/api/feedback/route.ts
git commit -m "Remove old Platform Feedback widget, superseded by Support"
```

---

## Task 7: HQ admin support view

**Files:**
- Create: `app/(hq)/hq/support/page.tsx`
- Create: `app/(hq)/hq/support/SupportTicketRow.tsx`
- Modify: `app/(hq)/layout.tsx`

**Interfaces:**
- Consumes: `PATCH /api/support-tickets/[id]` from Task 3; `SupportTicket` shape from Task 1.
- Produces: `<SupportTicketRow ticket: TicketData />` where `TicketData = { id: string, subject: string, message: string, path: string | null, status: "OPEN" | "RESOLVED", replyMessage: string | null, createdAt: string, submitterEmail: string | null, submitterRole: string, submitterName: string | null }`.

- [ ] **Step 1: Write the row component**

Create `app/(hq)/hq/support/SupportTicketRow.tsx`:

```tsx
"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface TicketData {
  id: string;
  subject: string;
  message: string;
  path: string | null;
  status: "OPEN" | "RESOLVED";
  replyMessage: string | null;
  createdAt: string;
  submitterEmail: string | null;
  submitterRole: string;
  submitterName: string | null;
}

export default function SupportTicketRow({ ticket: initialTicket }: { ticket: TicketData }) {
  const [ticket, setTicket] = useState(initialTicket);
  const [replyDraft, setReplyDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const setStatus = async (status: "OPEN" | "RESOLVED") => {
    setSaving(true);
    const res = await fetch(`/api/support-tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        status === "RESOLVED" ? { status, replyMessage: replyDraft.trim() || undefined } : { status }
      ),
    });
    if (res.ok) {
      setTicket((prev) => ({
        ...prev,
        status,
        replyMessage: status === "RESOLVED" ? (replyDraft.trim() || prev.replyMessage) : prev.replyMessage,
      }));
      setReplyDraft("");
    }
    setSaving(false);
  };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{ticket.subject}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {ticket.submitterName ?? ticket.submitterEmail ?? "Unknown"} · {ticket.submitterRole}
            {ticket.path ? ` · ${ticket.path}` : ""} · {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
          </div>
        </div>
        <span
          style={{
            fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em",
            color: ticket.status === "OPEN" ? "var(--amber)" : "#4ade80",
            flexShrink: 0, height: "fit-content",
          }}
        >
          {ticket.status}
        </span>
      </div>

      <p style={{ fontSize: 14, color: "var(--text)", marginTop: 12, whiteSpace: "pre-wrap" }}>{ticket.message}</p>

      {ticket.replyMessage && (
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>
          Reply sent: &ldquo;{ticket.replyMessage}&rdquo;
        </p>
      )}

      {ticket.status === "OPEN" ? (
        <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            rows={2}
            placeholder="Reply (optional)…"
            style={{ flex: 1, minWidth: 220, fontSize: 13, padding: "8px 10px", background: "var(--n-bg2)", border: "1px solid var(--border)", color: "var(--text)", resize: "none" }}
          />
          <button
            onClick={() => setStatus("RESOLVED")}
            disabled={saving}
            style={{ padding: "9px 16px", fontSize: 12, fontWeight: 600, background: "var(--amber)", color: "#000", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {saving ? "Resolving…" : "Resolve"}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setStatus("OPEN")}
            disabled={saving}
            style={{ padding: "9px 16px", fontSize: 12, fontWeight: 600, background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border-md)", cursor: "pointer" }}
          >
            {saving ? "Reopening…" : "Reopen"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

Create `app/(hq)/hq/support/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SupportTicketRow from "./SupportTicketRow";

export default async function HQSupportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") redirect("/dashboard");

  const tickets = await prisma.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      user: {
        select: {
          email: true,
          role: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  });

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.1 }}>
          Support
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
          Tickets filed by users across the app.
        </p>
      </div>

      {tickets.length === 0 ? (
        <div style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: "48px 32px", textAlign: "center", borderRadius: 0 }}>
          <p style={{ color: "var(--muted)", fontSize: 15, margin: 0 }}>No tickets yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tickets.map((ticket) => (
            <SupportTicketRow
              key={ticket.id}
              ticket={{
                id: ticket.id,
                subject: ticket.subject,
                message: ticket.message,
                path: ticket.path,
                status: ticket.status,
                replyMessage: ticket.replyMessage,
                createdAt: ticket.createdAt.toISOString(),
                submitterEmail: ticket.user.email,
                submitterRole: ticket.user.role,
                submitterName: ticket.user.profile?.displayName ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the nav link**

In `app/(hq)/layout.tsx`, find:

```tsx
            <Link href="/hq" className="hq-nav-link">
              Schools
            </Link>
```

Add immediately after:

```tsx
            <Link href="/hq" className="hq-nav-link">
              Schools
            </Link>
            <Link href="/hq/support" className="hq-nav-link">
              Support
            </Link>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing the new files or `app/(hq)/layout.tsx`.

- [ ] **Step 5: Manual verification**

Log in as `team.nivarro@gmail.com` / `nivarro2026`, navigate to `/hq/support`. Confirm the ticket(s) created during Task 2/5's manual verification appear, open first. Click Resolve with a short reply message on one; confirm it moves to resolved (green "RESOLVED" tag, reply text shown, "Reopen" button appears). Click Reopen; confirm it goes back to "OPEN" with the resolve form again, and note that the reply text is preserved even after reopening (per spec: reopening does not clear `replyMessage`).

- [ ] **Step 6: Commit**

```bash
git add "app/(hq)/hq/support" "app/(hq)/layout.tsx"
git commit -m "Add HQ support ticket triage view"
```

---

## Task 8: In-app resolution notice on `/notifications`

**Files:**
- Modify: `app/(dashboard)/notifications/page.tsx`
- Modify: `app/(dashboard)/notifications/NotificationsClient.tsx`
- Modify: `app/(dashboard)/notifications/WalledNotificationsClient.tsx`

**Interfaces:**
- Consumes: `SupportTicket` model from Task 1.

- [ ] **Step 1: Query resolved tickets in `page.tsx`**

In `app/(dashboard)/notifications/page.tsx`, after the existing `donations` fetch (ends at line 21 with `});`), add:

```ts
  const supportTickets = await prisma.supportTicket.findMany({
    where: { userId: session.user.id, status: "RESOLVED" },
    orderBy: { resolvedAt: "desc" },
    take: 20,
  });
```

- [ ] **Step 2: Build the shared item shape**

Immediately after the existing `donationItems` mapping (ends at line 31 with `}));`), add:

```ts
  const supportItems = supportTickets.map((t) => ({
    id: `support-${t.id}`,
    kind: "support" as const,
    label: `Nivarro resolved your ticket: ${t.subject}`,
    lastMessage: t.replyMessage,
    updatedAt: (t.resolvedAt ?? t.createdAt).toISOString(),
    unread: false,
    href: "/dashboard",
  }));
```

- [ ] **Step 3: Include it in the walled/school branch**

Find (currently line 70):

```ts
    const items = [...donationItems, ...chatItems].sort(
```

Change to:

```ts
    const items = [...donationItems, ...chatItems, ...supportItems].sort(
```

- [ ] **Step 4: Include it in the standard branch**

Find the `<NotificationsClient ... />` return (currently lines 131-155) and add a `supportTickets` prop:

```tsx
  return (
    <NotificationsClient
      requests={requests.map((r) => ({
        ...r,
        type: "recruitment" as const,
        sortDate: r.createdAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
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
      donations={donations.map((d) => ({
        id: d.id,
        type: "donation" as const,
        sortDate: d.createdAt.toISOString(),
        amountCents: d.amountCents,
        donorName: d.donorName,
      }))}
      supportTickets={supportTickets.map((t) => ({
        id: t.id,
        type: "support" as const,
        sortDate: (t.resolvedAt ?? t.createdAt).toISOString(),
        subject: t.subject,
        replyMessage: t.replyMessage,
      }))}
    />
  );
```

- [ ] **Step 5: Extend `NotificationsClient.tsx`**

Add a `SupportItem` interface and extend the union type. Find (line 32-40):

```tsx
interface DonationItem {
  id: string;
  type: "donation";
  sortDate: string;
  amountCents: number;
  donorName: string | null;
}

type NotifItem = RecruitmentItem | DecisionItem | DonationItem;
```

Change to:

```tsx
interface DonationItem {
  id: string;
  type: "donation";
  sortDate: string;
  amountCents: number;
  donorName: string | null;
}

interface SupportItem {
  id: string;
  type: "support";
  sortDate: string;
  subject: string;
  replyMessage: string | null;
}

type NotifItem = RecruitmentItem | DecisionItem | DonationItem | SupportItem;
```

Add the `LifeBuoy` icon to the import (line 6):

```tsx
import { Gift, LifeBuoy } from "lucide-react";
```

Add the `supportTickets` prop. Find (lines 42-50):

```tsx
export default function NotificationsClient({
  requests,
  applications,
  donations = [],
}: {
  requests: RecruitmentItem[];
  applications: DecisionItem[];
  donations?: DonationItem[];
}) {
```

Change to:

```tsx
export default function NotificationsClient({
  requests,
  applications,
  donations = [],
  supportTickets = [],
}: {
  requests: RecruitmentItem[];
  applications: DecisionItem[];
  donations?: DonationItem[];
  supportTickets?: SupportItem[];
}) {
```

Include it in `allItems`. Find (lines 64-68):

```tsx
  const allItems: NotifItem[] = [
    ...requests.map((r) => ({ ...r, status: recruitStatuses[r.id] ?? r.status })),
    ...applications,
    ...donations,
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
```

Change to:

```tsx
  const allItems: NotifItem[] = [
    ...requests.map((r) => ({ ...r, status: recruitStatuses[r.id] ?? r.status })),
    ...applications,
    ...donations,
    ...supportTickets,
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
```

Render it in the `earlier` list. Find (lines 110-118):

```tsx
            {earlier.map((item) =>
              item.type === "recruitment" ? (
                <RecruitCard key={item.id} req={item} status={recruitStatuses[item.id]} onRespond={respond} />
              ) : item.type === "donation" ? (
                <DonationCard key={item.id} item={item} />
              ) : (
                <DecisionCard key={item.id} item={item} />
              )
            )}
```

Change to:

```tsx
            {earlier.map((item) =>
              item.type === "recruitment" ? (
                <RecruitCard key={item.id} req={item} status={recruitStatuses[item.id]} onRespond={respond} />
              ) : item.type === "donation" ? (
                <DonationCard key={item.id} item={item} />
              ) : item.type === "support" ? (
                <SupportCard key={item.id} item={item} />
              ) : (
                <DecisionCard key={item.id} item={item} />
              )
            )}
```

Add the `SupportCard` component. Add it after `DonationCard` (after its closing `}` at line 142):

```tsx
function SupportCard({ item }: { item: SupportItem }) {
  return (
    <div className="border p-4" style={{ borderColor: "rgba(74,128,240,0.3)", background: "rgba(74,128,240,0.06)" }}>
      <div className="flex items-start gap-3">
        <LifeBuoy size={16} style={{ color: "var(--blue)", flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Nivarro resolved your ticket: {item.subject}
          </p>
          {item.replyMessage && (
            <p className="text-xs mt-1" style={{ color: "var(--text2)" }}>{item.replyMessage}</p>
          )}
          <p className="text-xs mt-1 font-mono" style={{ color: "var(--muted)" }}>
            {formatDistanceToNow(new Date(item.sortDate), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Extend `WalledNotificationsClient.tsx`**

Add `LifeBuoy` to the import (line 5):

```tsx
import { Globe, HeartHandshake, Gift, LifeBuoy } from "lucide-react";
```

Extend the `kind` union (line 9):

```tsx
  kind: "community" | "mentorship" | "donation" | "support";
```

Add the icon branch. Find (lines 35-41):

```tsx
          {item.kind === "community" ? (
            <Globe size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
          ) : item.kind === "mentorship" ? (
            <HeartHandshake size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
          ) : (
            <Gift size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 2 }} />
          )}
```

Change to:

```tsx
          {item.kind === "community" ? (
            <Globe size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
          ) : item.kind === "mentorship" ? (
            <HeartHandshake size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
          ) : item.kind === "support" ? (
            <LifeBuoy size={16} style={{ color: "var(--blue)", flexShrink: 0, marginTop: 2 }} />
          ) : (
            <Gift size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 2 }} />
          )}
```

Update the border/background style. Find (lines 29-31):

```tsx
            border: item.kind === "donation" ? "1px solid rgba(34,197,94,0.35)" : "1px solid var(--border)",
            background: item.kind === "donation" ? "rgba(34,197,94,0.08)" : item.unread ? "rgba(232,137,58,0.08)" : "var(--surface)",
            textDecoration: "none",
```

Change to:

```tsx
            border: item.kind === "donation" ? "1px solid rgba(34,197,94,0.35)" : item.kind === "support" ? "1px solid rgba(74,128,240,0.35)" : "1px solid var(--border)",
            background: item.kind === "donation" ? "rgba(34,197,94,0.08)" : item.kind === "support" ? "rgba(74,128,240,0.08)" : item.unread ? "rgba(232,137,58,0.08)" : "var(--surface)",
            textDecoration: "none",
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing any of the three modified files.

- [ ] **Step 8: Manual verification**

As the same demo account used in Task 7 to resolve a ticket (whichever one you used — check whether it's a standard student, SCHOOL, or walled-student account, since that determines which branch/component renders), load `/notifications` and confirm the resolved ticket shows up as an item with the LifeBuoy icon, the "Nivarro resolved your ticket: ..." label, and the reply text if one was given. Confirm it does **not** show while the ticket is still `OPEN` (only appears after Task 7's Resolve step).

- [ ] **Step 9: Commit**

```bash
git add app/\(dashboard\)/notifications
git commit -m "Surface resolved support tickets on /notifications"
```

---

## Task 9: End-to-end verification and full build

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: zero errors across the whole project.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: build completes successfully (`prisma generate && next build`), including the new `/api/support-tickets`, `/api/support-tickets/[id]`, and `/hq/support` routes in the route manifest.

- [ ] **Step 3: Full manual walkthrough**

Using the dev server and demo accounts from `[[Nivarro Project State]]`:
1. As `zoe@nivarro.io` (standard student), open Support from the sidebar, submit a ticket with a distinctive subject.
2. As `team.nivarro@gmail.com`, go to `/hq/support`, confirm the ticket appears, resolve it with a reply message ("Thanks for flagging — fixed!").
3. Confirm an email arrived at `team.nivarro@gmail.com` for the original submission, and confirm a second resolution email would have gone to `zoe@nivarro.io` (check Resend's dashboard/logs if inbox access isn't available for that demo address).
4. As `zoe@nivarro.io` again, load `/notifications`, confirm the resolved ticket with its reply text appears.
5. Repeat step 1 with `org@nivarro.demo` (ORG role) just for the submission half, confirming the Support entry point is present and working in the `orgNav` sidebar variant too.
6. For the `SCHOOL_NAV` variant, find a `role: SCHOOL` demo login by reading `app/api/admin/seed-demo-accounts/route.ts` (source of truth per [[Nivarro Project State]] — it also seeds a Westside Academy school account whose exact credentials aren't in memory), log in as it, and repeat step 1's submission half.

- [ ] **Step 4: Update memory**

If everything passes, update `project_nivarro_state.md`'s "Pending Tasks" / "Key Files Added/Changed" sections to reflect this feature (per this project's own memory-keeping habit) — not required for the feature to be "done," but keeps the memory file from going stale.
