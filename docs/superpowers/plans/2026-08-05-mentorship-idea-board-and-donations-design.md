# Mentorship Idea Board + Student Donations — Design

**Date:** 2026-08-05
**Scope:** Paragraph 4 only ("mentorship tab" fixes) from the 2026-08-05 multi-paragraph feedback dump. Paragraphs 1/2/3/5 are being handled by other concurrent agents on this repo — out of scope here, do not touch their files.

## Context

Current mentorship implementation (verified against code, not the stale outside-plan assumption in [[Nivarro Account Overlap]]/[[Mentorship HQ Reality]]):
- A mentorship pairing **is** a `Conversation` row with `type: MENTORSHIP` — no separate pairing model.
- School admins create pairings at `/school/mentorship` (student(s) + mentor(s), staff or alumni).
- Students see their pairings at `/mentorship` (`MentorshipClient.tsx`) — a thread list + single chat panel. Empty state: "You haven't been paired with a mentor yet."
- Mentors (staff/alumni) do **not** use `/mentorship` — they chat via the general `/messages?group=id` page. Out of scope to change that in this pass.

User's ask (paragraph 4, cleaned up from dictation): the mentorship view needs an idea board (sticky-note style, animated) alongside chat, and — per follow-up correction — a **separate, top-level Donate tab** (not nested under mentorship) with a real fee-calculated, Stripe-ready mock checkout.

## Part A — Idea Board (inside a mentorship pairing)

Adds a second surface to the *existing* per-pairing chat panel in `MentorshipClient.tsx`. Does not touch the deep-link (`?conversation=`) logic a concurrent session is currently adding to that file — new tab strip wraps around it.

**Data model** — new `IdeaNote`, following the codebase's existing pattern of bolting type-specific fields/rows onto `Conversation` rather than a new pairing entity:

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

**API:**
- `GET /api/mentorship/[conversationId]/ideas` — list notes, participant-only.
- `POST /api/mentorship/[conversationId]/ideas` — create a note, participant-only.
- `DELETE /api/mentorship/[conversationId]/ideas/[ideaId]` — author-only delete.

**UI:** `MentorshipClient.tsx` gets a small tab strip (Chat / Idea Board) above the existing right-hand panel. Idea Board is a wrapping grid of sticky-note `<div>`s (warm color cycling via `colorIndex`, slight random rotation per note via a deterministic hash of the note id so it doesn't jitter on re-render). New notes animate in with a CSS keyframe (scale up + settle + slight rotate, ~250ms) on add. A small textarea + "Pin idea" button adds a note. No drag-and-drop positioning (YAGNI) — notes lay out in creation order.

## Part B — Donate tab (new, top-level, student-only)

Separate from mentorship entirely. New sidebar nav item in the `walledNav` array (`components/layout/Sidebar.tsx`) — school-affiliated student accounts only, same nav that currently has Dashboard/My School/Community Chat/Mentorship/Notifications.

**Data model** — new standalone `Donation` model (deliberately *not* reusing `Campaign`/`CampaignPledge`, which is an unrelated school-level pledge-capture form with no payment math):

```prisma
model Donation {
  id               String   @id @default(cuid())
  recipientUserId  String
  donorName        String?
  donorEmail       String?
  amountCents      Int      // net amount intended for the recipient, >= 100
  feeCents         Int      // platform fee charged on top
  totalCents       Int      // amountCents + feeCents, what the donor actually pays
  status           String   @default("MOCK_COMPLETED") // future: PENDING | COMPLETED | FAILED
  stripeSessionId  String?  // unused until real Stripe wiring lands
  createdAt        DateTime @default(now())

  recipient User @relation(fields: [recipientUserId], references: [id], onDelete: Cascade)
}
```

**Fee math** — single source of truth, used identically client- and server-side so the displayed total can never drift from what's actually recorded:

```ts
// lib/payments/donationFees.ts
export const MIN_DONATION_CENTS = 100;       // $1.00
export const FEE_PERCENT = 0.05;             // 5%
export const FEE_FIXED_CENTS = 30;           // $0.30

export function calculateDonationFee(amountCents: number) {
  const feeCents = Math.round(amountCents * FEE_PERCENT) + FEE_FIXED_CENTS;
  return { feeCents, totalCents: amountCents + feeCents };
}
```

Example: donor wants $100 to reach the recipient → fee = round(10000*0.05)+30 = 530 → total = 10530 = **$105.30**. Matches the user's stated example exactly.

**Stripe-readiness** — one seam, `lib/payments/processDonation.ts`:

```ts
export async function processDonation(input: {
  recipientUserId: string;
  amountCents: number;
  donorName?: string;
  donorEmail?: string;
}) {
  if (input.amountCents < MIN_DONATION_CENTS) throw new Error("Minimum donation is $1.00");
  const { feeCents, totalCents } = calculateDonationFee(input.amountCents);
  // TODO(stripe): replace this immediate-complete with a Checkout Session create,
  // persist status "PENDING" + stripeSessionId, flip to "COMPLETED" via webhook.
  return prisma.donation.create({
    data: { ...input, feeCents, totalCents, status: "MOCK_COMPLETED" },
  });
}
```

Nothing in the UI or fee math needs to change when real Stripe lands — only this function's body.

**API:** `POST /api/donations` — validates + calls `processDonation`, returns the created record (amount/fee/total). No auth required (donors are often not logged in).

**Pages:**
- `/donate` (authenticated, `(dashboard)` group, walled-student-only, mirrors the `isWalledStudent` gate `mentorship/page.tsx` already uses) — shows the student's shareable link (`{origin}/give/[handle]`) with a Copy button, and the same donate widget embedded inline below it so the student can see exactly what supporters will see.
- `/give/[handle]` (public, **no** `(dashboard)` layout — new top-level route, mirrors the existing public `app/c/[slug]/page.tsx` pattern) — fetches the recipient by `Profile.handle`, renders the shared `DonationWidget` component for anyone to use, no login required.

**`DonationWidget` component** (shared by both pages): preset amount buttons ($10/$25/$50/$100) + custom input, live fee breakdown line, "Donate $X" button. Enforces the $1 minimum client-side (mirrors server validation). On submit, calls `POST /api/donations`, then shows a mock success state ("Thanks! This is a demo — real payments launch soon.").

## Out of scope (explicitly, to prevent creep)
- No changes to the mentor/admin side of mentorship (`/school/mentorship`, `MentorshipClient.tsx` under `school/`).
- No real Stripe integration — mock completion only.
- No donation history/leaderboard UI — `Donation` rows are recorded for future use but not surfaced as a list anywhere yet.
- No drag-and-drop on the idea board.

## Migration
New Prisma models require a hand-written SQL migration file (per [[Nivarro Dev Patterns]] — `prisma generate` alone doesn't create one, and Render runs `prisma migrate deploy` at startup) at `prisma/migrations/<timestamp>_add_idea_notes_and_donations/migration.sql`.
