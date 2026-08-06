# Profile Donations (Students, Teachers/Staff, Alumni) — Design

**Date:** 2026-08-06

## Context

A person-to-person donation system was already fully designed and built on 2026-08-05, but landed in an unmerged worktree (`worktree-mentorship-idea-board-donations`) and was never surfaced anywhere reachable in the product — its sidebar nav entry (Task 9 of that plan) was never committed. That branch also bundles an unrelated "mentorship idea board" feature (sticky notes inside mentor/student chat threads) from the same planning session, sharing one Prisma migration with the donation models.

User's ask (2026-08-06, dictated): a Stripe-style donation system needs to actually appear on the student page — suggested amounts, automatic fee cover (5% + $0.30, e.g. donate $100 → pay $105.30), an easy copy/paste donation link, and an implementation that's trivial to point at real Stripe once a live key exists. Follow-up: the same thing must work identically for teacher and alumni profiles, not just students.

Reference: existing design doc `2026-08-05-mentorship-idea-board-and-donations-design.md` and its implementation plan `2026-08-05-mentorship-idea-board-and-donations.md` in the worktree — this doc only covers the delta on top of that work, not a re-design of it.

## What already exists (to be merged as-is)

Branch `worktree-mentorship-idea-board-donations`, fully committed:
- `Donation` Prisma model (`recipientUserId`, `amountCents`, `feeCents`, `totalCents`, `status`, `stripeSessionId`) + hand-written migration.
- `lib/payments/donationFees.ts` — `calculateDonationFee(amountCents)`: `feeCents = round(amountCents * 0.05) + 30`, `totalCents = amountCents + feeCents`. Verified: $100.00 → $5.30 fee → $105.30 total, matches the user's own example exactly.
- `lib/payments/processDonation.ts` — creates a `Donation` row with `status: "MOCK_COMPLETED"`. Single `// TODO(stripe)` marker: swap this function's body for a Stripe Checkout Session create + webhook-driven status flip once real keys exist. Nothing else in the system needs to change when that happens.
- `components/donations/DonationWidget.tsx` — preset amounts ($10/$25/$50/$100) + custom input, live fee breakdown line, Donate button, mock success state.
- `app/api/donations/route.ts` — `POST`, public (donors may be logged out), looks up recipient by `Profile.handle`.
- `app/(dashboard)/donate/page.tsx` + `DonateClient.tsx` — authenticated page showing the donor's own `/give/[handle]` link with a Copy button, plus the widget inline.
- `app/give/[handle]/page.tsx` — public, no-login donation page for any handle.
- Bundled but unrelated: `IdeaNote` model + sticky-note UI inside `MentorshipClient.tsx` (mentor/student chat idea board). Merged in as-is since it's already complete and shares the migration; not otherwise touched by this work.

Merge mechanics: `main` has since diverged (added an unrelated school-level `Campaign`/`CampaignPledge` donation system on 2026-08-06, for AI-generated fundraising pages — different model, different purpose, no overlap). `lib/payments/donationFees.ts` exists identically on both branches (same formula, written independently) — expect a trivial/no-op conflict there. One uncommitted `package-lock.json` diff in the worktree is discarded before merging (stale lockfile drift, not real work).

## What's new in this pass

### 1. Inline donate card on the shared profile page

`app/(dashboard)/profile/[handle]/ProfileClient.tsx` is the single component that renders every profile — student, teacher/staff (`Profile.staffTitle` set), and alumni (`User.isAlumni` set) alike. There is no per-role profile page. Adding the card here covers all three account types with zero role-branching.

- **Visitor view** (anyone viewing someone else's profile, logged in or not): the existing `DonationWidget` embedded directly beneath the profile header — amount picker, live fee breakdown, Donate button. No click-through to a separate page required.
- **Owner view** (`isOwn === true`, viewing your own profile): the same slot instead shows your shareable `/give/[handle]` link with a Copy button (identical box to the one already built for `/donate`), so the link is grabbable from the profile itself.

### 2. Finish the sidebar nav entry

`components/layout/Sidebar.tsx` → `walledNav` array never got the planned `{ href: "/donate", label: "Donate", Icon: Gift }` entry (worktree Task 9 was written but never committed). Add it now, positioned after Mentorship. Since `walledNav` renders for anyone `isWalledStudent` is true for — which already includes roster-created teachers/staff and alumni, not just literal students, per the existing account-gating quirk that also makes `/mentorship` work for mentors — this automatically covers all three account types.

### 3. Verify teacher/alumni parity explicitly

Don't infer reachability from the shared component alone (this bit the mentorship idea-board work before). Manually verify, against a demo staff account and a demo alumni account (not just a student):
- The inline donate card renders correctly on their public profile.
- The "Donate" sidebar tab appears and `/donate` + `/give/[handle]` work for them as the recipient.

## Out of scope

- No real Stripe integration (no live key to test against yet) — the mock seam is the deliberate stopping point.
- No fee opt-out toggle — the fee is always added on top ("automatically pay extra to cover" = no choice to skip it), matching the user's own phrasing and the existing widget's behavior.
- No donation history/leaderboard UI.
- No changes to the separate, unrelated school-level Campaign/CampaignPledge donation system already live on `main`.
- No changes to the idea-board feature's own logic beyond merging it in as committed.
