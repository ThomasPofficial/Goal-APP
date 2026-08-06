# Campaign Fee Toggle + Share Links Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the campaign donation fee default (fee comes out of the school's cut unless the donor opts to cover it) and add a first-class "Share Links" tab to the Campaign Hub.

**Architecture:** A new, isolated fee-calculation function (`calculateCampaignDonationFee`) replaces the existing `calculateDonationFee` call sites in the campaign donation path only — the person-to-person `/give/[handle]` donation system's fee function is untouched. The Campaign Hub gets a new top-level view-switch state that renders either the existing campaign grid or a new share-links list, entirely inside the already-existing client component.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 / PostgreSQL, zod-free plain request bodies (matches this route's existing style), lucide-react icons, inline `style={{}}` objects (no Tailwind in these files — match existing convention).

## Global Constraints

- No schema/migration changes. `CampaignPledge.feeCents`/`totalCents`/`pledgeAmount`/`status`/`stripeSessionId` already exist and fully capture the outcome — `coverFees` is a request-time boolean, not a persisted column.
- No automated test runner in this repo (no jest/vitest/playwright in `package.json`). Verification per task is `npx tsc --noEmit` (no new errors) plus the manual check described in each task.
- `lib/payments/donationFees.ts` (`calculateDonationFee`, used by the separate `/give/[handle]` person-donation system) must NOT be modified — its `FEE_PERCENT` and `FEE_FIXED_CENTS` consts are already exported (`export const FEE_PERCENT = 0.05;` / `export const FEE_FIXED_CENTS = 30;` at the top of the file), so the new code imports them, it doesn't need the file changed at all.
- Fee formula (must match exactly, same numbers as the existing system): `feeCents = Math.round(amountCents * 0.05) + 30`.
- `coverFees` defaults to `false` when absent/falsy from a request body — the new default behavior (fee deducted from the entered amount) applies unless the caller explicitly opts in.
- Do not touch: `components/campaigns/CampaignEditor.tsx`, `CampaignCanvas.tsx`, `CampaignHero.tsx`, `VersionHistoryDrawer.tsx`, `app/(dashboard)/campaigns/new/CampaignsNewClient.tsx`, `app/(dashboard)/campaigns/[id]/edit/CampaignEditClient.tsx`, `app/api/campaigns/generate/*`, `app/api/campaigns/[id]/tweak/*`, `app/api/campaigns/[id]/versions*` — a separate concurrent agent session owns active work there.
- Run `git status --porcelain` before starting each task; if you see changes outside this plan's file list, ignore them and stay scoped to the files below (other concurrent sessions are editing this repo).
- Inline `style={{}}` objects using the CSS custom properties already used in each file (`var(--border)`, `var(--muted)`/`var(--n-text2)`, `var(--text)`, `var(--bg)`, `var(--surface)`, `var(--amber)`, `var(--font-mono)`, `var(--font-display)`). None of the touched files use Tailwind classes — don't introduce any.

---

### Task 1: `calculateCampaignDonationFee` — the new fee function

**Files:**
- Create: `lib/payments/campaignDonationFee.ts`

**Interfaces:**
- Consumes: `FEE_PERCENT`, `FEE_FIXED_CENTS`, `MIN_DONATION_CENTS` — already-exported consts from `lib/payments/donationFees.ts` (no changes needed to that file).
- Produces: `calculateCampaignDonationFee(amountCents: number, coverFees: boolean): { feeCents: number; totalCents: number; netCents: number }` and re-exports `MIN_DONATION_CENTS`. Tasks 2 and 4 both import from this file.

- [ ] **Step 1: Write the file**

Create `lib/payments/campaignDonationFee.ts`:

```ts
import { FEE_PERCENT, FEE_FIXED_CENTS, MIN_DONATION_CENTS } from "./donationFees";

export { MIN_DONATION_CENTS };

export function calculateCampaignDonationFee(amountCents: number, coverFees: boolean) {
  const feeCents = Math.round(amountCents * FEE_PERCENT) + FEE_FIXED_CENTS;
  if (coverFees) {
    // Donor pays extra on top; the campaign receives the full entered amount.
    return { feeCents, totalCents: amountCents + feeCents, netCents: amountCents };
  }
  // Fee comes out of the entered amount; the campaign receives the remainder.
  return { feeCents, totalCents: amountCents, netCents: amountCents - feeCents };
}
```

- [ ] **Step 2: Verify the arithmetic manually**

There's no test runner in this repo, so verify by hand against the spec's worked example. For a $100.00 donation (`amountCents = 10000`):
- `feeCents = Math.round(10000 * 0.05) + 30 = 500 + 30 = 530` ($5.30)
- `coverFees = false`: `totalCents = 10000` ($100.00 charged), `netCents = 10000 - 530 = 9470` ($94.70 to the campaign)
- `coverFees = true`: `totalCents = 10000 + 530 = 10530` ($105.30 charged), `netCents = 10000` ($100.00 to the campaign)

Confirm these four numbers (9470, 10000, 10530, 530) appear correctly if you trace through the function by hand — this is the exact worked example the design doc and later manual-QA steps use, so getting it right here matters more than usual.

- [ ] **Step 3: Type-check**

Run (from the plan's own worktree, NOT the shared main checkout — running against the wrong directory checks a different, unrelated file and gives false confidence): `npx tsc --noEmit`
Expected: no errors referencing `lib/payments/campaignDonationFee.ts`.

- [ ] **Step 4: Commit**

```bash
git add "lib/payments/campaignDonationFee.ts"
git commit -m "feat(campaigns): add fee-deducted-by-default donation fee calculation"
```

---

### Task 2: Wire `coverFees` through `processCampaignDonation`

**Files:**
- Modify: `lib/payments/processCampaignDonation.ts`

**Interfaces:**
- Consumes: `calculateCampaignDonationFee` from Task 1.
- Produces: `processCampaignDonation(input: { campaignId: string; amountCents: number; donorName: string; donorEmail: string; coverFees: boolean }): Promise<CampaignPledge>` — the `coverFees` field is new on the input type. Task 3 calls this with the new field.

- [ ] **Step 1: Read the current file**

Current content of `lib/payments/processCampaignDonation.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { calculateDonationFee, MIN_DONATION_CENTS } from "./donationFees";

export async function processCampaignDonation(input: {
  campaignId: string;
  amountCents: number;
  donorName: string;
  donorEmail: string;
}) {
  if (input.amountCents < MIN_DONATION_CENTS) {
    throw new Error(`Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}`);
  }
  const { feeCents, totalCents } = calculateDonationFee(input.amountCents);

  // TODO(stripe): once real payments are wired up, replace this immediate
  // MOCK_COMPLETED create with a Stripe Checkout Session create, persist
  // status "PENDING" + stripeSessionId here, and flip to "COMPLETED" from
  // a webhook handler instead of inline.
  return prisma.campaignPledge.create({
    data: {
      campaignId: input.campaignId,
      donorName: input.donorName,
      donorEmail: input.donorEmail,
      pledgeAmount: input.amountCents / 100,
      feeCents,
      totalCents,
      status: "MOCK_COMPLETED",
    },
  });
}
```

- [ ] **Step 2: Replace it with the `coverFees`-aware version**

```ts
import { prisma } from "@/lib/prisma";
import { calculateCampaignDonationFee, MIN_DONATION_CENTS } from "./campaignDonationFee";

export async function processCampaignDonation(input: {
  campaignId: string;
  amountCents: number;
  donorName: string;
  donorEmail: string;
  coverFees: boolean;
}) {
  if (input.amountCents < MIN_DONATION_CENTS) {
    throw new Error(`Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}`);
  }
  const { feeCents, totalCents, netCents } = calculateCampaignDonationFee(input.amountCents, input.coverFees);

  // TODO(stripe): once real payments are wired up, replace this immediate
  // MOCK_COMPLETED create with a Stripe Checkout Session create, persist
  // status "PENDING" + stripeSessionId here, and flip to "COMPLETED" from
  // a webhook handler instead of inline.
  return prisma.campaignPledge.create({
    data: {
      campaignId: input.campaignId,
      donorName: input.donorName,
      donorEmail: input.donorEmail,
      pledgeAmount: netCents / 100,
      feeCents,
      totalCents,
      status: "MOCK_COMPLETED",
    },
  });
}
```

Note `pledgeAmount` now stores `netCents / 100` (what the campaign actually receives after the fee) instead of the raw entered amount — this is intentional and matches the existing `raised = manualAdjustment + Σ(pledge.pledgeAmount)` convention used elsewhere in the Campaign Hub, so campaign totals stay correct without any changes needed there.

- [ ] **Step 3: Type-check**

Run (from the plan's own worktree, NOT the shared main checkout — running against the wrong directory checks a different, unrelated file and gives false confidence): `npx tsc --noEmit`
Expected: a new error will appear at the call site in `app/api/campaigns/donate/route.ts` (missing `coverFees` property) — that's expected and fixed in Task 3. Confirm no OTHER new errors appear.

- [ ] **Step 4: Commit**

```bash
git add "lib/payments/processCampaignDonation.ts"
git commit -m "feat(campaigns): deduct fee from pledge amount by default, add coverFees option"
```

---

### Task 3: Accept `coverFees` in the donate API route

**Files:**
- Modify: `app/api/campaigns/donate/route.ts`

**Interfaces:**
- Consumes: `processCampaignDonation` from Task 2 (now requires `coverFees: boolean`).
- Produces: `POST /api/campaigns/donate` now accepts an optional `coverFees` boolean in its JSON body (defaults to `false` if absent, `undefined`, or any other falsy value). Task 4 (`PledgeModal.tsx`) sends this field.

- [ ] **Step 1: Update the body destructure and the `processCampaignDonation` call**

In `app/api/campaigns/donate/route.ts`, change:

```ts
  const { campaignId, donorName, donorEmail, amountCents, schoolId } = body;
```

to:

```ts
  const { campaignId, donorName, donorEmail, amountCents, schoolId, coverFees } = body;
```

Change:

```ts
  const pledge = await processCampaignDonation({
    campaignId,
    donorName: donorName.trim(),
    donorEmail: donorEmail.trim(),
    amountCents,
  });
```

to:

```ts
  const pledge = await processCampaignDonation({
    campaignId,
    donorName: donorName.trim(),
    donorEmail: donorEmail.trim(),
    amountCents,
    coverFees: Boolean(coverFees),
  });
```

`Boolean(coverFees)` handles every falsy input (`undefined`, `null`, `false`, missing key) as `false`, and any truthy value as `true` — matching the Global Constraints default.

Nothing else in this file changes — the confirmation email logic already reads `pledge.totalCents` generically ("you were not actually charged $X"), which stays accurate under both fee modes since `totalCents` is still exactly what the donor was charged.

- [ ] **Step 2: Type-check**

Run (from the plan's own worktree, NOT the shared main checkout — running against the wrong directory checks a different, unrelated file and gives false confidence): `npx tsc --noEmit`
Expected: the error flagged in Task 2 Step 3 is now resolved. No errors referencing this file or `processCampaignDonation.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/campaigns/donate/route.ts"
git commit -m "feat(campaigns): accept coverFees in the donate API route"
```

---

### Task 4: Fee-toggle checkbox in `PledgeModal.tsx`

**Files:**
- Modify: `components/campaigns/PledgeModal.tsx`

**Interfaces:**
- Consumes: `calculateCampaignDonationFee`, `MIN_DONATION_CENTS` from `lib/payments/campaignDonationFee.ts` (Task 1). `POST /api/campaigns/donate` now accepts `coverFees` (Task 3).
- Produces: nothing consumed elsewhere — final code task in this plan.

- [ ] **Step 1: Swap the fee-calculation import**

Change the import line:

```tsx
import { calculateDonationFee, MIN_DONATION_CENTS } from "@/lib/payments/donationFees";
```

to:

```tsx
import { calculateCampaignDonationFee, MIN_DONATION_CENTS } from "@/lib/payments/campaignDonationFee";
```

- [ ] **Step 2: Add `coverFees` state**

Immediately after the existing `const [donateResult, setDonateResult] = useState<{ totalCents: number } | "error" | null>(null);` line, add:

```tsx
  const [coverFees, setCoverFees] = useState(false);
```

- [ ] **Step 3: Update the fee derivation to use the new function and `coverFees`**

Change:

```tsx
  const { feeCents, totalCents } = calculateDonationFee(validAmount ? amountCents : 0);
```

to:

```tsx
  const { feeCents, totalCents, netCents } = calculateCampaignDonationFee(validAmount ? amountCents : 0, coverFees);
```

- [ ] **Step 4: Send `coverFees` in the donate request**

In `submitDonation`, change the `fetch` body from:

```tsx
        body: JSON.stringify({
          campaignId,
          donorName: donorName.trim(),
          donorEmail: donorEmail.trim(),
          amountCents,
          schoolId: schoolId ?? undefined,
        }),
```

to:

```tsx
        body: JSON.stringify({
          campaignId,
          donorName: donorName.trim(),
          donorEmail: donorEmail.trim(),
          amountCents,
          coverFees,
          schoolId: schoolId ?? undefined,
        }),
```

- [ ] **Step 5: Add the checkbox and rewrite the breakdown line**

Replace this block (the amount-picker's breakdown paragraph):

```tsx
                  {validAmount ? (
                    <p style={{ color: "var(--n-text2)", fontSize: 12, margin: 0 }}>
                      ${(amountCents / 100).toFixed(2)} to this campaign + ${(feeCents / 100).toFixed(2)} Nivarro fee (5% + $0.30) = <strong style={{ color: "var(--text)" }}>${(totalCents / 100).toFixed(2)}</strong>
                    </p>
                  ) : (
                    <p style={{ color: "var(--n-text2)", fontSize: 12, margin: 0 }}>Minimum donation is $1.00.</p>
                  )}
```

with:

```tsx
                  {validAmount ? (
                    <>
                      <p style={{ color: "var(--n-text2)", fontSize: 12, margin: "0 0 8px" }}>
                        {coverFees ? (
                          <>
                            ${(amountCents / 100).toFixed(2)} to this campaign + ${(feeCents / 100).toFixed(2)} processing fee = <strong style={{ color: "var(--text)" }}>${(totalCents / 100).toFixed(2)} total</strong>
                          </>
                        ) : (
                          <>
                            <strong style={{ color: "var(--text)" }}>${(netCents / 100).toFixed(2)}</strong> of your ${(amountCents / 100).toFixed(2)} goes to this campaign after the ${(feeCents / 100).toFixed(2)} processing fee.
                          </>
                        )}
                      </p>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--n-text2)", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={coverFees}
                          onChange={(e) => setCoverFees(e.target.checked)}
                          style={{ accentColor: "var(--amber)", cursor: "pointer" }}
                        />
                        Cover the processing fee so this campaign receives 100% of your donation
                      </label>
                    </>
                  ) : (
                    <p style={{ color: "var(--n-text2)", fontSize: 12, margin: 0 }}>Minimum donation is $1.00.</p>
                  )}
```

- [ ] **Step 6: Update the Donate button's displayed amount**

The button already reads `Donate $${(totalCents / 100).toFixed(2)}` — no change needed here, since `totalCents` now correctly reflects what the donor is actually charged under either toggle state (the button text updates automatically because `totalCents` is recomputed from the new function).

- [ ] **Step 7: Type-check**

Run (from the plan's own worktree, NOT the shared main checkout — running against the wrong directory checks a different, unrelated file and gives false confidence): `npx tsc --noEmit`
Expected: no errors referencing `PledgeModal.tsx`.

- [ ] **Step 8: Manual check**

`npm run dev`. Open any published campaign's public page (`/c/[slug]`), click the donate CTA to open `PledgeModal`, stay on "Donate Online":
- Enter $100 (or click the $100 preset once presets exist at that value, or type `100` in the custom field). Confirm the breakdown reads "**$94.70** of your $100.00 goes to this campaign after the $5.30 processing fee." and the Donate button reads "Donate $100.00".
- Check the "Cover the processing fee" checkbox. Confirm the breakdown switches to "$100.00 to this campaign + $5.30 processing fee = **$105.30 total**" and the Donate button reads "Donate $105.30".
- Submit with the checkbox unchecked, confirm the "Thanks for donating!" screen shows a not-charged amount matching the unchecked total ($100.00), and check the resulting `CampaignPledge` row (via Prisma Studio or a quick query) has `pledgeAmount = 94.70`, `feeCents = 530`, `totalCents = 10000`.
- Repeat submission with the checkbox checked, confirm `pledgeAmount = 100.00`, `feeCents = 530`, `totalCents = 10530`.

- [ ] **Step 9: Commit**

```bash
git add "components/campaigns/PledgeModal.tsx"
git commit -m "feat(campaigns): add cover-the-fee toggle to the donate flow"
```

---

### Task 5: Share Links tab on the Campaign Hub

**Files:**
- Modify: `app/(dashboard)/campaigns/CampaignsListClient.tsx`

**Interfaces:**
- Consumes: existing `campaigns` prop/state (`CampaignSummary[]`, already has `slug`, `headline`, `active`).
- Produces: nothing consumed elsewhere — final task in this plan. Independent of Tasks 1-4 (touches a completely different file with no shared code).

- [ ] **Step 1: Add view-switch state and icons import**

Change the import line:

```tsx
import { Plus } from "lucide-react";
```

to:

```tsx
import { Plus, Copy, Check, Link2 } from "lucide-react";
```

After the existing `const [sort, setSort] = useState<SortKey>("newest");` line, add:

```tsx
  const [view, setView] = useState<"campaigns" | "share">("campaigns");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyShareLink = (campaignId: string, slug: string) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : "https://app.nivarro.co"}/c/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(campaignId);
    setTimeout(() => setCopiedId((prev) => (prev === campaignId ? null : prev)), 2000);
  };
```

- [ ] **Step 2: Render the view-switch tabs above the existing header**

Directly inside the returned `<div style={{ maxWidth: 960 }}>`, immediately before the existing header `<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ... }}>` block, add:

```tsx
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {([["campaigns", "Campaigns"], ["share", "Share Links"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            aria-pressed={view === key}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--border)",
              background: view === key ? "var(--amber)" : "var(--surface)",
              color: view === key ? "#000" : "var(--n-text2)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
```

- [ ] **Step 3: Wrap the existing body in a `view === "campaigns"` branch and add the share view**

The existing header, stats strip, filters/sort, and card grid (everything from the `<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between"...` header through the closing of the campaign-grid `{...}` block, i.e. everything currently returned after the component's opening `<div style={{ maxWidth: 960 }}>`) gets wrapped:

```tsx
      {view === "campaigns" ? (
        <>
          {/* ...existing header, stats strip, filters/sort, empty-state, and card-grid JSX, completely unchanged... */}
        </>
      ) : (
        <div>
          {(() => {
            const published = campaigns.filter((c) => c.slug);
            if (published.length === 0) {
              return (
                <div style={{ padding: "48px 0", textAlign: "center", border: "1px solid var(--border)", background: "var(--surface)" }}>
                  <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>Publish a campaign to get a shareable link.</p>
                </div>
              );
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {published.map((c) => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : "https://app.nivarro.co"}/c/${c.slug}`;
                  return (
                    <div key={c.id} style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                        <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "-0.01em", color: "var(--text)" }}>{c.headline}</p>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, color: c.active ? "#22c55e" : "var(--n-text2)" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.active ? "#22c55e" : "var(--border)", display: "inline-block" }} />
                          {c.active ? "Active" : "Draft"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--border)", background: "var(--bg)" }}>
                          <Link2 size={13} style={{ flexShrink: 0, color: "var(--n-text2)" }} />
                          <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--n-text2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {url}
                          </span>
                        </div>
                        <button
                          onClick={() => copyShareLink(c.id, c.slug!)}
                          style={{ flexShrink: 0, padding: "8px 14px", border: "1px solid var(--border)", background: "none", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                        >
                          {copiedId === c.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
```

- [ ] **Step 4: Type-check**

Run (from the plan's own worktree, NOT the shared main checkout — running against the wrong directory checks a different, unrelated file and gives false confidence): `npx tsc --noEmit`
Expected: no errors referencing `CampaignsListClient.tsx`.

- [ ] **Step 5: Manual check**

`npm run dev`, log in as a `SCHOOL` account with at least one published and one draft (unpublished) campaign, go to `/campaigns`:
- Confirm "Campaigns" / "Share Links" tabs render above the existing header, and "Campaigns" is selected by default showing the unchanged existing UI.
- Click "Share Links". Confirm it shows one row per *published* campaign only (draft/unpublished campaigns with no `slug` don't appear), each with the full `/c/[slug]` URL and a working Copy button (click it, confirm clipboard content, confirm the button shows "Copied" for ~2 seconds then reverts).
- If a school account has zero published campaigns, confirm the "Publish a campaign to get a shareable link." empty state shows instead of an empty list.
- Switch back to "Campaigns" and confirm the existing stats strip, filters, sort, and card grid still work exactly as before (this catches any accidental breakage from the wrapping in Step 3).

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/campaigns/CampaignsListClient.tsx"
git commit -m "feat(campaigns): add Share Links tab to the Campaign Hub"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Design doc §1 (fee toggle) → Tasks 1-4. Design doc §2 (Share Links tab) → Task 5.
- **Type consistency:** `calculateCampaignDonationFee(amountCents, coverFees)` signature (Task 1) matches call sites in Task 2 (server) and Task 4 (client). `processCampaignDonation`'s `coverFees: boolean` param (Task 2) matches the `Boolean(coverFees)` call in Task 3 and the `coverFees` field sent from Task 4. `pledgeAmount = netCents / 100` (Task 2) matches the manual-QA expected value in Task 4 Step 8 ($94.70 / $100.00).
- **No placeholders:** all steps contain full code, no TODOs beyond the pre-existing `// TODO(stripe)` marker carried over verbatim from the current file (not a new placeholder introduced by this plan).
- **Out-of-scope files:** confirmed no task touches any file in the Global Constraints' do-not-touch list.
