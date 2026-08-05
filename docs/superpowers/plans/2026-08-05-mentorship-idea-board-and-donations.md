# Mentorship Idea Board + Student Donations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated sticky-note idea board inside each mentorship pairing, and a separate top-level, fee-calculated, Stripe-ready-but-mocked student Donate tab.

**Architecture:** Two independent slices sharing one Prisma migration. (A) `IdeaNote` rows attach to the existing `Conversation` (type `MENTORSHIP`) entity that already represents a pairing; a small tab strip is added inside `MentorshipClient.tsx` alongside the existing chat panel. (B) A standalone `Donation` model + a pure fee-calculation module + one server-side `processDonation` seam (mock now, swappable for real Stripe later) + a shared `DonationWidget` component rendered on both an authenticated `/donate` page and a public `/give/[handle]` page.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, NextAuth v5, Zod, inline `style={{}}` (no Tailwind in this app's dashboard components — confirmed via existing files).

**Verification approach:** This repo has no unit/integration test harness for API routes or React components (no `test` script, no jest/vitest config outside an unrelated `server/` subproject). Every task is verified manually against the running dev server (`npm run dev`) using `curl` (dev server is plain HTTP, so the "no curl for HTTPS" constraint doesn't apply) and the browser — matching how every other feature in this codebase has been verified per project history. Do not introduce a new test framework as part of this plan.

## Global Constraints

- Money fields are integer cents (`Int`), never floats — `amountCents`, `feeCents`, `totalCents`.
- Fee formula (exact, verified against user's own example: net $100 → total $105.30): `feeCents = Math.round(amountCents * 0.05) + 30`, `totalCents = amountCents + feeCents`.
- Minimum donation: `amountCents >= 100` ($1.00).
- Every new Prisma model change needs a hand-written SQL migration file at `prisma/migrations/<timestamp>_<name>/migration.sql` using `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` style — `prisma generate` alone does not create migration files, and Render runs `prisma migrate deploy` at startup (see existing migrations for the exact style, e.g. `prisma/migrations/20260710000000_school_admin_features/migration.sql`).
- Sign-out, auth, and CSS variable conventions are not touched by this plan — don't modify `lib/auth-actions.ts`, `AccountMenu.tsx`, or the "LEGACY TAILWIND OVERRIDES" block in `globals.css`.
- Do not modify `app/(dashboard)/school/mentorship/*` (mentor/admin side) or any file another concurrent session is mid-editing — before each task's first edit, run `git status --porcelain` and skip/re-scope if the target file already shows as modified with unfamiliar changes not made by this plan.
- Colors/styling: reuse existing CSS custom properties already used throughout the dashboard (`var(--bg)`, `var(--surface)`, `var(--border)`, `var(--text)`, `var(--muted)`, `var(--amber)`, `var(--font-mono)`) — do not invent a new palette.

---

## File Structure

- `prisma/schema.prisma` — add `IdeaNote` model, `Donation` model, and their relation fields on `User`/`Conversation`.
- `prisma/migrations/<ts>_add_idea_notes_and_donations/migration.sql` — hand-written SQL for the above.
- `app/api/mentorship/[conversationId]/ideas/route.ts` — GET (list) + POST (create) idea notes, participant-gated.
- `app/api/mentorship/[conversationId]/ideas/[ideaId]/route.ts` — DELETE, author-gated.
- `app/(dashboard)/mentorship/MentorshipClient.tsx` — modify: add Chat/Idea Board tab strip + idea board grid UI + CSS keyframe animation.
- `lib/payments/donationFees.ts` — pure fee-calculation module (client + server safe, no Node-only imports).
- `lib/payments/processDonation.ts` — server-side donation creation seam (imports `prisma`, Node-only).
- `app/api/donations/route.ts` — POST, public (no auth required — donors may be anonymous/logged-out).
- `components/donations/DonationWidget.tsx` — shared client component (amount picker + fee breakdown + submit).
- `app/(dashboard)/donate/page.tsx` — server component: auth + walled-student gate, fetches own handle, renders client wrapper.
- `app/(dashboard)/donate/DonateClient.tsx` — client component: copy-link box + embeds `DonationWidget`.
- `app/give/[handle]/page.tsx` — public page (new top-level route, no `(dashboard)` layout), looks up `Profile.handle`, renders `DonationWidget`.
- `components/layout/Sidebar.tsx` — modify: add `{ href: "/donate", label: "Donate", Icon: HeartHandshake }` (or similar) to the `walledNav` array. Note: `HeartHandshake` is already imported and used for the student `Mentorship` nav item — reuse a different existing lucide icon (`Gift`) for Donate to avoid two identical icons in one nav list.

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<YYYYMMDDHHMMSS>_add_idea_notes_and_donations/migration.sql`

**Interfaces:**
- Produces: `IdeaNote { id, conversationId, authorId, content, colorIndex, createdAt }`, `Donation { id, recipientUserId, donorName?, donorEmail?, amountCents, feeCents, totalCents, status, stripeSessionId?, createdAt }`.

- [ ] **Step 1: Add the two models to `prisma/schema.prisma`**

Add near the `Conversation`/`Message` models (after `Message`, before the "ORGS & OPPORTUNITIES" section comment at line ~350):

```prisma
model IdeaNote {
  id             String       @id @default(cuid())
  conversationId String
  authorId       String
  content        String       @db.Text
  colorIndex     Int          @default(0)
  createdAt      DateTime     @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  author       User         @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
```

Add `ideaNotes IdeaNote[]` to `model Conversation` (alongside the existing `messages Message[]` line) and `ideaNotes IdeaNote[]` to `model User` (alongside `notes Note[]`).

Add near the `Campaign` models (anywhere top-level is fine — put it right after `CampaignPledge`):

```prisma
model Donation {
  id              String   @id @default(cuid())
  recipientUserId String
  donorName       String?
  donorEmail      String?
  amountCents     Int
  feeCents        Int
  totalCents      Int
  status          String   @default("MOCK_COMPLETED")
  stripeSessionId String?
  createdAt       DateTime @default(now())

  recipient User @relation("DonationsReceived", fields: [recipientUserId], references: [id], onDelete: Cascade)
}
```

Add `donationsReceived Donation[] @relation("DonationsReceived")` to `model User`.

- [ ] **Step 2: Write the manual migration SQL**

Pick a timestamp later than the latest existing migration (`20260713000000`) — use `20260805000000`.

`prisma/migrations/20260805000000_add_idea_notes_and_donations/migration.sql`:

```sql
CREATE TABLE IF NOT EXISTS "IdeaNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "colorIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdeaNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "IdeaNote"
  ADD CONSTRAINT "IdeaNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdeaNote"
  ADD CONSTRAINT "IdeaNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Donation" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "donorName" TEXT,
    "donorEmail" TEXT,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MOCK_COMPLETED',
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Donation"
  ADD CONSTRAINT "Donation_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Note: unlike prior migrations in this repo, these are brand-new tables (not columns on existing tables), so `CREATE TABLE IF NOT EXISTS` + separate `ADD CONSTRAINT` (not wrapped in `IF NOT EXISTS`, which Postgres doesn't support for constraints) is correct. If a constraint-already-exists error ever occurs on redeploy, that's a signal the migration already applied — not a bug to fix here.

- [ ] **Step 3: Generate the Prisma client and verify it compiles**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` with no errors. This does not require a live DB connection — it only parses `schema.prisma`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260805000000_add_idea_notes_and_donations/migration.sql
git commit -m "Add IdeaNote and Donation Prisma models"
```

---

## Task 2: Idea board API routes

**Files:**
- Create: `app/api/mentorship/[conversationId]/ideas/route.ts`
- Create: `app/api/mentorship/[conversationId]/ideas/[ideaId]/route.ts`

**Interfaces:**
- Consumes: `prisma.ideaNote`, `prisma.conversationParticipant` (from Task 1's schema), `auth()` from `@/lib/auth`.
- Produces: `GET /api/mentorship/[conversationId]/ideas` → `{ ideas: { id, content, colorIndex, createdAt, author: { id, displayName } }[] }`. `POST` same path, body `{ content: string }` → `{ idea: {...} }`. `DELETE /api/mentorship/[conversationId]/ideas/[ideaId]` → `{ success: true }`.

- [ ] **Step 1: Create the list/create route**

`app/api/mentorship/[conversationId]/ideas/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

async function verifyParticipant(userId: string, conversationId: string) {
  return prisma.conversationParticipant.findFirst({ where: { conversationId, userId } });
}

export async function GET(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  const participant = await verifyParticipant(session.user.id, conversationId);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ideas = await prisma.ideaNote.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, profile: { select: { displayName: true } } } } },
  });

  return NextResponse.json({
    ideas: ideas.map((n) => ({
      id: n.id,
      content: n.content,
      colorIndex: n.colorIndex,
      createdAt: n.createdAt.toISOString(),
      author: { id: n.author.id, displayName: n.author.profile?.displayName ?? "Unnamed" },
    })),
  });
}

const postSchema = z.object({ content: z.string().min(1).max(280) });

export async function POST(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  const participant = await verifyParticipant(session.user.id, conversationId);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const count = await prisma.ideaNote.count({ where: { conversationId } });

  const idea = await prisma.ideaNote.create({
    data: {
      conversationId,
      authorId: session.user.id,
      content: parsed.data.content,
      colorIndex: count % 5,
    },
    include: { author: { select: { id: true, profile: { select: { displayName: true } } } } },
  });

  return NextResponse.json({
    idea: {
      id: idea.id,
      content: idea.content,
      colorIndex: idea.colorIndex,
      createdAt: idea.createdAt.toISOString(),
      author: { id: idea.author.id, displayName: idea.author.profile?.displayName ?? "Unnamed" },
    },
  });
}
```

- [ ] **Step 2: Create the delete route**

`app/api/mentorship/[conversationId]/ideas/[ideaId]/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req: Request, { params }: { params: Promise<{ conversationId: string; ideaId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ideaId } = await params;
  const idea = await prisma.ideaNote.findUnique({ where: { id: ideaId } });
  if (!idea || idea.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.ideaNote.delete({ where: { id: ideaId } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Manually verify against the dev server**

Run: `npm run dev` (background), then in another shell, log in as a demo student with an existing mentorship pairing (e.g. `priya@nivarro.io` / `demo2026` — confirm via `/api/mentorship/my-threads` that they have at least one thread; if not, use whichever demo account does per `app/api/admin/seed-demo-accounts/route.ts`), grab the session cookie from the browser devtools, then:

```bash
curl -s -X POST http://localhost:3000/api/mentorship/<conversationId>/ideas \
  -H "Content-Type: application/json" -H "Cookie: <session cookie>" \
  -d '{"content":"Bake sale idea"}'
curl -s http://localhost:3000/api/mentorship/<conversationId>/ideas -H "Cookie: <session cookie>"
```

Expected: POST returns `{ idea: {...} }` with `colorIndex: 0`; GET returns `{ ideas: [ that idea ] }`.

- [ ] **Step 4: Commit**

```bash
git add app/api/mentorship
git commit -m "Add idea board API routes for mentorship pairings"
```

---

## Task 3: Idea board UI in MentorshipClient

**Files:**
- Modify: `app/(dashboard)/mentorship/MentorshipClient.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/mentorship/[conversationId]/ideas`, `DELETE /api/mentorship/[conversationId]/ideas/[ideaId]` (Task 2).
- Note: as of this writing, a concurrent session has already added `useSearchParams`/`requestedThreadId` deep-link logic to this same file (lines ~1-54). Re-read the file fresh before editing — do not revert that logic; the tab strip and idea board wrap around it, they don't touch the thread-loading `useEffect`.

- [ ] **Step 1: Re-read the current file and add idea-board state + fetch**

Read `app/(dashboard)/mentorship/MentorshipClient.tsx` fresh first. Add below the existing `messages`/`draft` state (do not remove or reorder the existing `requestedThreadId` logic):

```tsx
interface Idea {
  id: string;
  content: string;
  colorIndex: number;
  createdAt: string;
  author: { id: string; displayName: string };
}

const NOTE_COLORS = ["#f5d76e", "#f4a259", "#e8895a", "#8ecae6", "#b8e0d2"];

function noteRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return (hash % 7) - 3; // -3deg..3deg
}
```

Inside the component, add:

```tsx
const [tab, setTab] = useState<"chat" | "ideas">("chat");
const [ideas, setIdeas] = useState<Idea[]>([]);
const [ideaDraft, setIdeaDraft] = useState("");
const [postingIdea, setPostingIdea] = useState(false);

useEffect(() => {
  if (!activeId || tab !== "ideas") return;
  fetch(`/api/mentorship/${activeId}/ideas`)
    .then((r) => r.json())
    .then((data) => setIdeas(data.ideas ?? []));
}, [activeId, tab]);

async function postIdea() {
  if (!activeId || !ideaDraft.trim()) return;
  setPostingIdea(true);
  const res = await fetch(`/api/mentorship/${activeId}/ideas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: ideaDraft.trim() }),
  });
  const data = await res.json();
  setPostingIdea(false);
  if (res.ok) {
    setIdeas((prev) => [...prev, data.idea]);
    setIdeaDraft("");
  }
}

async function deleteIdea(id: string) {
  if (!activeId) return;
  const res = await fetch(`/api/mentorship/${activeId}/ideas/${id}`, { method: "DELETE" });
  if (res.ok) setIdeas((prev) => prev.filter((n) => n.id !== id));
}
```

Reset `tab` to `"chat"` and clear `ideas` when `activeId` changes — add to the existing thread-switch flow: inside the `onClick={() => setActiveId(t.id)}` handler on the thread list button, also call `setTab("chat")`.

- [ ] **Step 2: Add the tab strip and idea board panel to the render**

In the returned JSX, inside the right-hand panel `div` (the one with `flex: 1, display: "flex", flexDirection: "column"`), replace the current header `div` (`{active ? threadLabel(active) : "Mentorship"}`) with a header that also renders two tab buttons, and wrap the existing messages+input block in `{tab === "chat" && ( ... )}`, adding a sibling `{tab === "ideas" && ( ... )}` block:

```tsx
<div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
    {active ? threadLabel(active) : "Mentorship"}
  </span>
  <div style={{ display: "flex", gap: 4 }}>
    {(["chat", "ideas"] as const).map((t) => (
      <button
        key={t}
        onClick={() => setTab(t)}
        style={{
          padding: "4px 10px", fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase",
          letterSpacing: "0.06em", border: "1px solid var(--border)", cursor: "pointer",
          background: tab === t ? "var(--amber)" : "transparent",
          color: tab === t ? "#000" : "var(--text)",
        }}
      >
        {t === "chat" ? "Chat" : "Idea Board"}
      </button>
    ))}
  </div>
</div>

{tab === "chat" && (
  <>
    {/* existing messages list div and input div go here, unchanged */}
  </>
)}

{tab === "ideas" && (
  <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={ideaDraft}
        onChange={(e) => setIdeaDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && postIdea()}
        placeholder="Pin an idea…"
        maxLength={280}
        style={{ flex: 1, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
      />
      <button
        onClick={postIdea}
        disabled={postingIdea || !ideaDraft.trim()}
        style={{ padding: "8px 14px", background: "var(--amber)", border: "none", color: "#000", cursor: postingIdea ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700 }}
      >
        Pin idea
      </button>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {ideas.map((n) => (
        <div
          key={n.id}
          className="idea-note-pop"
          style={{
            width: 180, minHeight: 140, padding: 14, background: NOTE_COLORS[n.colorIndex % NOTE_COLORS.length],
            color: "#1a1500", boxShadow: "2px 3px 8px rgba(0,0,0,0.25)", position: "relative",
            transform: `rotate(${noteRotation(n.id)}deg)`, fontSize: 13, display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          <p style={{ margin: 0, flex: 1, wordBreak: "break-word" }}>{n.content}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, opacity: 0.75 }}>
            <span>{n.author.displayName}</span>
            {n.author.id === myUserId && (
              <button
                onClick={() => deleteIdea(n.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#1a1500", fontSize: 10, padding: 0 }}
              >
                remove
              </button>
            )}
          </div>
        </div>
      ))}
      {ideas.length === 0 && (
        <p style={{ color: "var(--n-text2)", fontSize: 13 }}>No ideas pinned yet — add the first one above.</p>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 3: Add the pop-in animation**

Add a `<style jsx global>` block (this app already renders plain inline styles, but a scoped keyframe needs a `<style>` tag — place it once near the top of the component's returned JSX, as a sibling of the outer `div`) OR, more consistent with this codebase having no `styled-jsx` usage elsewhere, add the keyframe to `app/globals.css` instead:

```css
@keyframes idea-note-pop {
  0%   { transform: scale(0.6) rotate(0deg); opacity: 0; }
  70%  { transform: scale(1.05) rotate(var(--note-rot, 0deg)); opacity: 1; }
  100% { transform: scale(1) rotate(var(--note-rot, 0deg)); opacity: 1; }
}
.idea-note-pop { animation: idea-note-pop 250ms ease-out; }
```

Check `app/globals.css` first for where similar small utility classes/keyframes live (search for `@keyframes`) and add it alongside them, not inside the "LEGACY TAILWIND OVERRIDES" block (per [[Nivarro Dev Patterns]], that block has strict `#`-escaping rules for an unrelated reason — don't add unrelated CSS there).

- [ ] **Step 4: Manually verify in the browser**

`npm run dev`, log in as a demo student with a mentorship pairing, open `/mentorship`, click the "Idea Board" tab, type an idea, click "Pin idea". Expected: note appears with a pop/rotate animation, persists on tab switch away and back (re-fetches from the API), and "remove" only shows on the current user's own notes.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/mentorship/MentorshipClient.tsx" app/globals.css
git commit -m "Add animated idea board tab to mentorship pairings"
```

---

## Task 4: Donation fee math + processing seam

**Files:**
- Create: `lib/payments/donationFees.ts`
- Create: `lib/payments/processDonation.ts`

**Interfaces:**
- Produces: `MIN_DONATION_CENTS`, `calculateDonationFee(amountCents: number): { feeCents: number; totalCents: number }` from `donationFees.ts`. `processDonation(input: { recipientUserId: string; amountCents: number; donorName?: string; donorEmail?: string }): Promise<Donation>` from `processDonation.ts`.

- [ ] **Step 1: Write the fee module**

`lib/payments/donationFees.ts`:

```ts
export const MIN_DONATION_CENTS = 100;
export const FEE_PERCENT = 0.05;
export const FEE_FIXED_CENTS = 30;

export function calculateDonationFee(amountCents: number): { feeCents: number; totalCents: number } {
  const feeCents = Math.round(amountCents * FEE_PERCENT) + FEE_FIXED_CENTS;
  return { feeCents, totalCents: amountCents + feeCents };
}
```

- [ ] **Step 2: Verify the fee math against the user's own example**

Run: `node -e "const {calculateDonationFee}=require('./lib/payments/donationFees.ts')"` won't work directly (TS) — instead verify inline via `npx tsx -e`:

```bash
npx tsx -e "import { calculateDonationFee } from './lib/payments/donationFees'; console.log(calculateDonationFee(10000))"
```

Expected output: `{ feeCents: 530, totalCents: 10530 }` (i.e. $105.30 total on a $100.00 net donation).

- [ ] **Step 3: Write the processing seam**

`lib/payments/processDonation.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { calculateDonationFee, MIN_DONATION_CENTS } from "./donationFees";

export async function processDonation(input: {
  recipientUserId: string;
  amountCents: number;
  donorName?: string;
  donorEmail?: string;
}) {
  if (input.amountCents < MIN_DONATION_CENTS) {
    throw new Error(`Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}`);
  }
  const { feeCents, totalCents } = calculateDonationFee(input.amountCents);

  // TODO(stripe): once real payments are wired up, replace this immediate
  // MOCK_COMPLETED create with a Stripe Checkout Session create, persist
  // status "PENDING" + stripeSessionId here, and flip to "COMPLETED" from
  // a webhook handler instead of inline.
  return prisma.donation.create({
    data: {
      recipientUserId: input.recipientUserId,
      donorName: input.donorName,
      donorEmail: input.donorEmail,
      amountCents: input.amountCents,
      feeCents,
      totalCents,
      status: "MOCK_COMPLETED",
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/payments
git commit -m "Add donation fee calculation and mock processing seam"
```

---

## Task 5: Donations API route

**Files:**
- Create: `app/api/donations/route.ts`

**Interfaces:**
- Consumes: `processDonation` (Task 4).
- Produces: `POST /api/donations` — body `{ recipientHandle: string; amountCents: number; donorName?: string; donorEmail?: string }` → `201 { donation: { id, amountCents, feeCents, totalCents, status } }`, or `400` on validation failure (bad handle, amount too low), `404` if handle not found.

- [ ] **Step 1: Write the route**

```ts
import { prisma } from "@/lib/prisma";
import { processDonation } from "@/lib/payments/processDonation";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  recipientHandle: z.string().min(1),
  amountCents: z.number().int().positive(),
  donorName: z.string().max(120).optional(),
  donorEmail: z.string().email().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const profile = await prisma.profile.findUnique({
    where: { handle: parsed.data.recipientHandle },
    select: { userId: true },
  });
  if (!profile) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  try {
    const donation = await processDonation({
      recipientUserId: profile.userId,
      amountCents: parsed.data.amountCents,
      donorName: parsed.data.donorName,
      donorEmail: parsed.data.donorEmail,
    });
    return NextResponse.json(
      { donation: { id: donation.id, amountCents: donation.amountCents, feeCents: donation.feeCents, totalCents: donation.totalCents, status: donation.status } },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
```

- [ ] **Step 2: Manually verify**

```bash
curl -s -X POST http://localhost:3000/api/donations -H "Content-Type: application/json" \
  -d '{"recipientHandle":"<a real demo profile handle>","amountCents":10000,"donorName":"Test Donor"}'
```

Expected: `201` with `{ donation: { amountCents: 10000, feeCents: 530, totalCents: 10530, status: "MOCK_COMPLETED", ... } }`. Then re-run with `"amountCents":50` and expect `400` (below the $1 minimum).

- [ ] **Step 3: Commit**

```bash
git add app/api/donations
git commit -m "Add POST /api/donations endpoint"
```

---

## Task 6: DonationWidget shared component

**Files:**
- Create: `components/donations/DonationWidget.tsx`

**Interfaces:**
- Consumes: `POST /api/donations` (Task 5), `calculateDonationFee` (Task 4, for the live client-side preview).
- Produces: `<DonationWidget recipientHandle={string} recipientName={string} />` — a fully self-contained client component with no other props required. Consumed by Task 7 and Task 8.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { calculateDonationFee, MIN_DONATION_CENTS } from "@/lib/payments/donationFees";

const PRESETS_CENTS = [1000, 2500, 5000, 10000];

export default function DonationWidget({ recipientHandle, recipientName }: { recipientHandle: string; recipientName: string }) {
  const [selected, setSelected] = useState<number | null>(2500);
  const [customDollars, setCustomDollars] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ totalCents: number } | "error" | null>(null);

  const amountCents = customDollars.trim()
    ? Math.round(parseFloat(customDollars) * 100)
    : selected ?? 0;
  const validAmount = Number.isFinite(amountCents) && amountCents >= MIN_DONATION_CENTS;
  const { feeCents, totalCents } = calculateDonationFee(validAmount ? amountCents : 0);

  async function submit() {
    if (!validAmount) return;
    setSubmitting(true);
    setResult(null);
    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientHandle, amountCents }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setResult({ totalCents: data.donation.totalCents });
    } else {
      setResult("error");
    }
  }

  if (result && result !== "error") {
    return (
      <div style={{ padding: 20, border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
        <p style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>
          Thanks for supporting {recipientName}!
        </p>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
          This is a demo — you were not charged ${(result.totalCents / 100).toFixed(2)}. Real payments launch soon.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <p style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>
        Support {recipientName}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {PRESETS_CENTS.map((c) => (
          <button
            key={c}
            onClick={() => { setSelected(c); setCustomDollars(""); }}
            style={{
              padding: "8px 16px", border: "1px solid var(--border)", cursor: "pointer", fontSize: 13,
              background: selected === c && !customDollars ? "var(--amber)" : "transparent",
              color: selected === c && !customDollars ? "#000" : "var(--text)",
            }}
          >
            ${(c / 100).toFixed(0)}
          </button>
        ))}
        <input
          value={customDollars}
          onChange={(e) => { setCustomDollars(e.target.value); setSelected(null); }}
          placeholder="Custom $"
          style={{ width: 90, padding: "8px 10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
        />
      </div>
      {validAmount ? (
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 14px" }}>
          ${(amountCents / 100).toFixed(2)} to {recipientName} + ${(feeCents / 100).toFixed(2)} Nivarro fee (5% + $0.30) = <strong style={{ color: "var(--text)" }}>${(totalCents / 100).toFixed(2)}</strong>
        </p>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 14px" }}>Minimum donation is $1.00.</p>
      )}
      {result === "error" && (
        <p style={{ color: "#e05", fontSize: 12, margin: "0 0 10px" }}>Something went wrong — try again.</p>
      )}
      <button
        onClick={submit}
        disabled={!validAmount || submitting}
        style={{
          width: "100%", padding: "10px 0", background: "var(--amber)", border: "none", color: "#000",
          fontWeight: 700, fontSize: 13, cursor: !validAmount || submitting ? "not-allowed" : "pointer",
          opacity: !validAmount || submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Processing…" : validAmount ? `Donate $${(totalCents / 100).toFixed(2)}` : "Donate"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/donations
git commit -m "Add shared DonationWidget component"
```

(Verified together with Tasks 7/8, since this component has no standalone page yet.)

---

## Task 7: Authenticated /donate page

**Files:**
- Create: `app/(dashboard)/donate/page.tsx`
- Create: `app/(dashboard)/donate/DonateClient.tsx`

**Interfaces:**
- Consumes: `DonationWidget` (Task 6), `isWalledStudent` gate pattern (copy from `app/(dashboard)/mentorship/page.tsx`).
- Produces: page at `/donate`.

- [ ] **Step 1: Write the server page**

`app/(dashboard)/donate/page.tsx` (mirror `app/(dashboard)/mentorship/page.tsx` exactly, but also fetch/create the profile handle):

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isWalledStudent } from "@/lib/accountGate";
import { prisma } from "@/lib/prisma";
import DonateClient from "./DonateClient";

export default async function DonatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await isWalledStudent(session.user.id))) redirect("/dashboard");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { handle: true, displayName: true },
  });

  if (!profile?.handle) {
    return (
      <div style={{ maxWidth: 500, padding: 32, border: "1px solid var(--border)", background: "var(--surface)" }}>
        <p style={{ color: "var(--text)", fontSize: 14, margin: 0 }}>
          Set a profile handle first (Profile → Edit) to get your donation link.
        </p>
      </div>
    );
  }

  return <DonateClient handle={profile.handle} displayName={profile.displayName} />;
}
```

Check `lib/accountGate.ts` for the exact exported name/signature of `isWalledStudent` before writing this (it's already imported the same way in `app/(dashboard)/mentorship/page.tsx` — copy that import verbatim).

- [ ] **Step 2: Write the client wrapper**

`app/(dashboard)/donate/DonateClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import DonationWidget from "@/components/donations/DonationWidget";

export default function DonateClient({ handle, displayName }: { handle: string; displayName: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/give/${handle}` : `/give/${handle}`;

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
          Donate
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          Share this link so anyone can support you directly.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          readOnly
          value={link}
          style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
        />
        <button
          onClick={copyLink}
          style={{ padding: "10px 16px", background: "var(--amber)", border: "none", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <DonationWidget recipientHandle={handle} recipientName={displayName} />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify**

`npm run dev`, log in as any walled-student demo account with a profile handle set, visit `/donate`. Expected: link box shows `http://localhost:3000/give/<handle>`, Copy link works, the widget below computes fees live as you pick/type an amount, and clicking Donate shows the mock success state.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/donate"
git commit -m "Add authenticated /donate page"
```

---

## Task 8: Public /give/[handle] page

**Files:**
- Create: `app/give/[handle]/page.tsx`

**Interfaces:**
- Consumes: `DonationWidget` (Task 6). Mirrors the existing public-page pattern in `app/c/[slug]/page.tsx` (top-level route, outside any layout group, uses `notFound()`).

- [ ] **Step 1: Write the page**

```tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DonationWidget from "@/components/donations/DonationWidget";

export default async function PublicGivePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  const profile = await prisma.profile.findUnique({
    where: { handle },
    select: { displayName: true },
  });

  if (!profile) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <DonationWidget recipientHandle={handle} recipientName={profile.displayName} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Log out (or use an incognito window), visit `http://localhost:3000/give/<a real demo handle>`. Expected: page renders with no login prompt, no sidebar, just the centered donation widget; submitting a donation succeeds the same as the authenticated page. Visit `/give/nonexistent-handle-xyz` and expect Next's 404 page.

- [ ] **Step 3: Commit**

```bash
git add app/give
git commit -m "Add public /give/[handle] donation page"
```

---

## Task 9: Sidebar nav entry

**Files:**
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing new — pure nav config change.

- [ ] **Step 1: Add the nav item and import**

Re-read the file fresh first (check `git status --porcelain` for this file — if another session is mid-editing it, re-scope this step to a minimal single-line insertion at the exact current line rather than assuming the line numbers below still match). Add `Gift` to the `lucide-react` import list at the top of the file, and add one entry to the `walledNav` array (currently: Dashboard, My School, Community Chat, Mentorship, [Profile if alumni], Notifications) — insert Donate right after Mentorship:

```tsx
{ href: "/mentorship",    label: "Mentorship",     Icon: HeartHandshake },
{ href: "/donate",        label: "Donate",         Icon: Gift },
```

- [ ] **Step 2: Manually verify**

`npm run dev`, log in as a walled-student demo account, confirm "Donate" appears in the left sidebar between Mentorship and Notifications, and clicking it loads `/donate`.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "Add Donate to student sidebar navigation"
```

---

## Task 10: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Idea board full flow**

As a student in an existing mentorship pairing: open `/mentorship`, switch to Idea Board, pin 2-3 ideas, confirm the pop-in animation plays, refresh the page, confirm ideas persist, delete one of your own notes, confirm it's removed. Confirm Chat tab still works exactly as before (send/receive messages) and the deep-link `?conversation=` behavior added by the concurrent session still works.

- [ ] **Step 2: Donate full flow**

As the same student: open `/donate`, copy the link, open it in an incognito window, donate $25 as an anonymous visitor, confirm the fee breakdown shown before submitting matches `calculateDonationFee(2500)` = $1.55 fee, $26.55 total, and the mock success message appears.

- [ ] **Step 3: Regression check on untouched surfaces**

Confirm `/school/mentorship` (admin pairing creation) still works unchanged, and `/campaigns` (unrelated existing Fundraise feature) still works unchanged — this plan should not have touched either.

- [ ] **Step 4: Final status check**

```bash
git status --porcelain
git log --oneline -10
```

Confirm all commits from Tasks 1-9 are present and no unrelated files were modified.
