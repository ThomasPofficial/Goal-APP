# Campaign Fee Toggle + Share Links Tab — Design

**Date:** 2026-08-06

## Context

Verified against `main` on 2026-08-06. The school-level campaign donation flow (`Campaign`/`CampaignPledge`, public page at `/c/[slug]`, donate/pledge modal `PledgeModal.tsx`) already exists and already has a mock-Stripe fee seam: `CampaignPledge.feeCents`/`totalCents`/`status`/`stripeSessionId`, computed via `lib/payments/donationFees.ts::calculateDonationFee()` (5% + $0.30). Publishing a campaign already works (`CampaignsNewClient.tsx` → `POST /api/campaigns` → live at `/c/[slug]`). A shareable link already exists in two places: `CampaignCard.tsx`'s "Copy Link" button (school admin's `/campaigns` list) and inside `PledgeModal.tsx`'s "Donate Online" tab (shown to public donors).

This is a narrow, two-part follow-up, not a rebuild:

1. **Fee behavior is backwards from what the user wants.** Today the donor always pays the campaign amount *plus* the fee on top (school always receives the full requested amount, no choice). The user wants the opposite default: the fee comes out of the school's cut unless the donor opts in to cover it.
2. **The shareable link is too buried.** It only exists as a small button on each campaign card, or inside the donor-facing modal. The user wants a real, first-class tab for it.

**Explicitly separate from this work:** the brand-new person-to-person donation system (`/donate`, `/give/[handle]`, `Donation` model, `lib/payments/processDonation.ts`) that landed the same day. That system's fee rule (`always add fee on top, no toggle`) was a deliberate, confirmed design choice for that different context (supporting an individual, not a school campaign) and is not touched here. `lib/payments/donationFees.ts::calculateDonationFee()` — used by that system — is left completely unchanged; this design adds a new, separate function instead of modifying it.

**Also explicitly out of scope:** anything in `CampaignEditor.tsx`, `CampaignCanvas.tsx`, `CampaignHero.tsx`, `VersionHistoryDrawer.tsx`, `CampaignsNewClient.tsx`, `CampaignEditClient.tsx`, `api/campaigns/generate`, `api/campaigns/[id]/tweak`, `api/campaigns/[id]/versions*` — a separate concurrent agent session owns active work there.

## Design

### 1. Fee toggle on campaign donations

**New function, not a modification:** `lib/payments/campaignDonationFee.ts`

```ts
import { FEE_PERCENT, FEE_FIXED_CENTS, MIN_DONATION_CENTS } from "./donationFees";

export { MIN_DONATION_CENTS };

export function calculateCampaignDonationFee(amountCents: number, coverFees: boolean) {
  const feeCents = Math.round(amountCents * FEE_PERCENT) + FEE_FIXED_CENTS;
  if (coverFees) {
    // Donor pays extra; campaign receives the full entered amount.
    return { feeCents, totalCents: amountCents + feeCents, netCents: amountCents };
  }
  // Fee comes out of the entered amount; campaign receives the remainder.
  return { feeCents, totalCents: amountCents, netCents: amountCents - feeCents };
}
```

`donationFees.ts` gains no changes beyond exporting `FEE_PERCENT`/`FEE_FIXED_CENTS` (currently local consts) so the new file can reuse the same 5%+$0.30 formula instead of duplicating the numbers.

**`lib/payments/processCampaignDonation.ts`:** accept a new `coverFees: boolean` param. Use `calculateCampaignDonationFee` instead of `calculateDonationFee`. Store `pledgeAmount: netCents / 100` (this is what counts toward the campaign's "raised" total per the existing `raised = manualAdjustment + Σ(pledge.pledgeAmount)` convention — net-of-fee is the correct amount to credit), `feeCents`, `totalCents` (what the donor is actually charged), `status: "MOCK_COMPLETED"` as today.

**`app/api/campaigns/donate/route.ts`:** read `coverFees` (boolean, default `false`) from the request body, pass through to `processCampaignDonation`. The confirmation emails already reference `pledge.totalCents` for "you were not charged $X" — no change needed there, `totalCents` will just mean something slightly different (charged amount, which may now be less than or equal to the entered amount depending on the toggle) and the copy already generically says "not charged $X," which stays accurate.

**`components/campaigns/PledgeModal.tsx`:** in the "Donate Online" tab:
- Add a checkbox, unchecked by default: *"Cover the processing fee so this campaign receives 100% of your donation"*.
- Replace the fee-math derivation (`calculateDonationFee`) with `calculateCampaignDonationFee(amountCents, coverFees)`.
- Update the breakdown line to reflect both states:
  - Unchecked: `"$94.70 of your $100.00 goes to this campaign after the $5.30 processing fee."`
  - Checked: `"$100.00 to this campaign + $5.30 processing fee = $105.30 total."`
- The Donate button's amount and the POST body's `coverFees` field both follow the checkbox state.
- No changes to the "Pledge by Check" tab (unaffected — that's an offline pledge, no online fee involved).

### 2. Share Links tab on the Campaign Hub

`app/(dashboard)/campaigns/CampaignsListClient.tsx` gains a top-level view switch, sibling to (not nested inside) the existing All/Active/Draft filter row:

```
[ Campaigns ]  [ Share Links ]        ← new, above everything else
```

- **"Campaigns" view** (default): today's existing UI unchanged — stats strip, All/Active/Draft filters, sort, card grid.
- **"Share Links" view**: a simple list, one row per *published* campaign (`slug` is set), each showing:
  - Campaign headline
  - A read-only text box with the full `/c/[slug]` URL
  - A "Copy" button (same copy-to-clipboard pattern already used in `CampaignCard.tsx` and `PledgeModal.tsx`)
  - Active/Draft status badge (reuse the existing dot+label pattern from `CampaignCard.tsx`)
  - Unpublished campaigns (no `slug`) are excluded from this view with a one-line note if the list would otherwise be empty ("Publish a campaign to get a shareable link.")

This is purely a new rendering branch inside the existing client component — no new route, no new API endpoint (campaigns are already fetched and held in the component's `campaigns` state).

## Out of scope

- No real Stripe integration — stays mock, matching every other payment surface in the app right now.
- No changes to `lib/payments/donationFees.ts`'s existing `calculateDonationFee` or anything under `/donate`, `/give/[handle]`.
- No changes to campaign creation/editing/AI generation — concurrent agent's territory.
- No QR codes, social share buttons, or email-invite flow for the share tab — just the copyable link, matching what the user asked for.
- No new Prisma fields or migration — `coverFees` is a request-time parameter, not persisted as its own column (the resulting `feeCents`/`totalCents`/`pledgeAmount` already fully capture the outcome).
