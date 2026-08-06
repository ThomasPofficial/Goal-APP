# Profile Donations (Students, Teachers/Staff, Alumni) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the already-built-but-unmerged person-to-person donation system into `main`, and make it actually reachable — as an inline "Support" card on every profile page (student, teacher/staff, and alumni alike, since they share one component) — plus a completed sidebar nav entry.

**Architecture:** Step 1 merges branch `worktree-mentorship-idea-board-donations` into `main` wholesale (it's fully committed and self-contained: `Donation` Prisma model, fee math, mock-but-Stripe-ready processing seam, `DonationWidget` component, `/donate` and `/give/[handle]` pages, plus a bundled unrelated mentorship idea-board feature). Steps 2-3 are the actual gap: embed the existing `DonationWidget` directly into `ProfileClient.tsx` (the one component that renders every profile regardless of account type) and finish the sidebar nav entry that was planned but never committed.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, NextAuth v5, inline `style={{}}` for the donation components (matches their existing style), Tailwind classes for `ProfileClient.tsx` (matches its existing style — do not convert either file's styling approach).

**Verification approach:** This repo has no automated test harness for API routes or React components. Every task is verified manually against the running dev server (`npm run dev`) using the browser and `curl`, matching the convention already established in the referenced 2026-08-05 plan this work builds on.

## Global Constraints

- Money fields are integer cents (`Int`), never floats.
- Fee formula (already implemented, do not change): `feeCents = Math.round(amountCents * 0.05) + 30`, `totalCents = amountCents + feeCents`. $100.00 donation → $105.30 total.
- Every new Prisma model change needs a hand-written SQL migration file — already present on the branch being merged; no new migration needed in this plan.
- CSS variables in use: `var(--bg)`, `var(--surface)`, `var(--border)`, `var(--text)`, `var(--muted)`, `var(--amber)`, `var(--font-mono)`, `var(--font-display)`.
- Do not modify the separate, unrelated `Campaign`/`CampaignPledge` school-fundraising donation system already on `main` (`app/api/campaigns/*`, `components/campaigns/PledgeModal.tsx`, `app/c/[slug]/*`).
- Do not modify the mentorship idea-board code beyond merging it in as already committed — it is out of scope for review/changes in this plan.

---

## File Structure

- Merge (no new files from this plan in step 1 — brings in the branch's existing files: `prisma/schema.prisma`, `prisma/migrations/20260805000000_add_idea_notes_and_donations/migration.sql`, `lib/payments/donationFees.ts`, `lib/payments/processDonation.ts`, `components/donations/DonationWidget.tsx`, `app/api/donations/route.ts`, `app/(dashboard)/donate/page.tsx` + `DonateClient.tsx`, `app/give/[handle]/page.tsx`, plus the idea-board files).
- Modify: `app/(dashboard)/profile/[handle]/ProfileClient.tsx` — add the inline donate card.
- Modify: `components/layout/Sidebar.tsx` — add the `Donate` nav entry.

---

## Task 1: Merge the donation + idea-board branch into main

**Files:**
- Merge commit touching all files listed in `git diff main worktree-mentorship-idea-board-donations --stat` (schema, migration, `lib/payments/*`, `components/donations/*`, `app/api/donations/*`, `app/(dashboard)/donate/*`, `app/give/*`, idea-board files under `app/api/mentorship/*/ideas/*` and `app/(dashboard)/mentorship/MentorshipClient.tsx`).

**Interfaces:**
- Produces (for Task 2 to consume): `components/donations/DonationWidget.tsx` exporting `default function DonationWidget({ recipientHandle: string, recipientName: string })`. `lib/payments/donationFees.ts` exporting `calculateDonationFee(amountCents: number): { feeCents: number; totalCents: number }` and `MIN_DONATION_CENTS`.

- [ ] **Step 1: Discard the stray uncommitted diff in the worktree**

The worktree at `C:\Users\thoma\Goal-APP\.claude\worktrees\mentorship-idea-board-donations` has one uncommitted change (`package-lock.json` drift, not real work). Discard it so the merge is clean:

```bash
cd "C:/Users/thoma/Goal-APP/.claude/worktrees/mentorship-idea-board-donations"
git status --porcelain
git checkout -- package-lock.json
git status --porcelain
```

Expected: second `git status --porcelain` prints nothing.

- [ ] **Step 2: Merge into main**

```bash
cd "C:/Users/thoma/Goal-APP"
git checkout main
git pull
git merge worktree-mentorship-idea-board-donations --no-edit
```

Expected: merge succeeds. If `lib/payments/donationFees.ts` conflicts (both branches independently created an identical file — same `MIN_DONATION_CENTS`/`FEE_PERCENT`/`FEE_FIXED_CENTS`/`calculateDonationFee` — this is the only file likely to conflict), resolve by keeping either side's content since they're byte-identical in logic:

```bash
git diff --name-only --diff-filter=U
```

If it lists `lib/payments/donationFees.ts`, open it and confirm both `<<<<<<<`/`=======`/`>>>>>>>` blocks contain the same `MIN_DONATION_CENTS = 100`, `FEE_PERCENT = 0.05`, `FEE_FIXED_CENTS = 30`, and identical `calculateDonationFee` body, then:

```bash
git checkout --ours lib/payments/donationFees.ts
git add lib/payments/donationFees.ts
```

Resolve any other conflicts by inspecting the two sides directly — none are expected given the branches touch disjoint files otherwise.

- [ ] **Step 3: Finish the merge and regenerate the Prisma client**

```bash
git status --porcelain
```

Expected: clean (or only the merge commit pending if conflicts were resolved — commit if so with `git commit --no-edit`).

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 4: Manually verify the merged donate flow still works standalone**

```bash
npm run dev
```

In the browser: log in as `priya@nivarro.io` / `demo2026`, visit `/donate`. Expected: shows a `/give/priya` (or whatever her handle is — check via `/profile/priya` first if unsure) link with a Copy button, and the `DonationWidget` below it computes fees live. Then open that `/give/<handle>` URL in an incognito window and submit a $25 donation — expect the mock success message and no error.

- [ ] **Step 5: Push**

```bash
git push
```

---

## Task 2: Inline donate card on the shared profile page

**Files:**
- Modify: `app/(dashboard)/profile/[handle]/ProfileClient.tsx`

**Interfaces:**
- Consumes: `DonationWidget` (`components/donations/DonationWidget.tsx`, from Task 1) — `<DonationWidget recipientHandle={string} recipientName={string} />`.
- Consumes: existing `Props.profile.handle: string | null`, `Props.profile.displayName: string | null`, `Props.isOwn: boolean` (already defined in this file).

- [ ] **Step 1: Add the import**

At the top of `app/(dashboard)/profile/[handle]/ProfileClient.tsx`, alongside the existing component imports (after the `AnimalArchetypeCard` import on line 9):

```tsx
import DonationWidget from "@/components/donations/DonationWidget";
```

- [ ] **Step 2: Add copy-link state to the component**

Inside `export default function ProfileClient(...)`, alongside the other `useState` declarations (after the `archetypeAnalysis` state on line 71), add:

```tsx
  const [linkCopied, setLinkCopied] = useState(false);
  const giveLink = profile.handle
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/give/${profile.handle}`
    : null;
  const copyGiveLink = () => {
    if (!giveLink) return;
    navigator.clipboard.writeText(giveLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };
```

- [ ] **Step 3: Render the card**

In the returned JSX, insert a new section immediately after the closing `</div>` of the Hero block (after line 194, before the `{/* Interests */}` comment on line 197). Only render anything if `profile.handle` is set (donations require a handle to route to):

```tsx
      {/* Support */}
      {profile.handle && (
        <div className="mb-6">
          {isOwn ? (
            <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>Your donation link</p>
              <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                Share this so anyone can support you directly. This is exactly what visitors to your profile see below.
              </p>
              <div className="flex gap-2 mb-4">
                <input
                  readOnly
                  value={giveLink ?? ""}
                  className="flex-1 text-xs px-3 py-2 rounded-lg"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
                />
                <button
                  onClick={copyGiveLink}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--amber)", color: "#000", border: "none", cursor: "pointer" }}
                >
                  {linkCopied ? "Copied!" : "Copy link"}
                </button>
              </div>
              <DonationWidget recipientHandle={profile.handle} recipientName={profile.displayName ?? "this person"} />
            </div>
          ) : (
            <DonationWidget recipientHandle={profile.handle} recipientName={profile.displayName ?? "this person"} />
          )}
        </div>
      )}
```

- [ ] **Step 4: Manually verify — student profile**

```bash
npm run dev
```

Log in as `priya@nivarro.io` / `demo2026`, visit your own profile (`/profile/priya` or whatever her handle is per `/profile` redirect). Expected: the "Your donation link" box appears with a working Copy button, and the `DonationWidget` renders below it and computes fees live when you pick an amount.

Then, while still logged in as priya, visit a *different* student's public profile (e.g. `/profile/<zoe's handle>`). Expected: no copy-link box, just the plain `DonationWidget` ("Support Zoe Kim"), and submitting a donation shows the mock success state.

- [ ] **Step 5: Manually verify — teacher/staff profile**

Visit `/profile/drpatel` (Dr. Aisha Patel, AP Computer Science & Robotics teacher, seeded via `app/api/admin/seed-demo-accounts/route.ts`) while logged in as a different account. Expected: same "Support Dr. Aisha Patel" card renders identically to the student case — no code branches on `staffTitle`, so this should just work, but confirm visually since this is the specific gap the user flagged.

- [ ] **Step 6: Manually verify — alumni profile**

Visit `/profile/priya` while logged in as a *different* account (priya was marked `isAlumni: true` in the seed data). Expected: same card renders identically. Also confirm logged out (incognito) — the card should still render since `DonationWidget`'s underlying `POST /api/donations` requires no auth.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/profile/[handle]/ProfileClient.tsx"
git commit -m "Add inline donate card to profile pages"
```

---

## Task 3: Finish the sidebar Donate nav entry

**Files:**
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing new — pure nav config change on the existing `walledNav` array (line 66-73).

- [ ] **Step 1: Add the `Gift` icon import**

In `components/layout/Sidebar.tsx` line 5, add `Gift` to the existing `lucide-react` import list:

```tsx
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Bell, Briefcase, Megaphone, Globe, GraduationCap, HeartHandshake, School, User, Link2, Gift } from "lucide-react";
```

- [ ] **Step 2: Add the nav entry**

In the `walledNav` array (line 66-73), insert a `Donate` entry after `Mentorship`:

```tsx
  const walledNav = [
    { href: "/dashboard",     label: "Dashboard",      Icon: LayoutDashboard },
    { href: "/my-school",     label: "My School",      Icon: School },
    { href: "/communities",   label: "Community Chat", Icon: Globe },
    { href: "/mentorship",    label: "Mentorship",     Icon: HeartHandshake },
    { href: "/donate",        label: "Donate",         Icon: Gift },
    ...(isAlumni ? [{ href: "/profile", label: "Profile", Icon: User }] : []),
    { href: "/notifications", label: "Notifications",  Icon: Bell },
  ];
```

- [ ] **Step 3: Manually verify across all three account types**

`npm run dev`. Log in as each of these and confirm the "Donate" tab appears in the left sidebar between Mentorship and Notifications (or Profile, for alumni), and clicking it loads `/donate` correctly showing that account's own link:
- `priya@nivarro.io` / `demo2026` (alumni)
- `teacher@westside.demo` / `demo2026` (staff — if this password doesn't work, check `app/api/admin/seed-demo-accounts/route.ts` for the actual staff password and use that instead)
- any plain walled student account, e.g. `elena@nivarro.demo` / `demo2026`

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "Add Donate to sidebar navigation"
```

---

## Task 4: End-to-end regression check

**Files:** none (verification only).

- [ ] **Step 1: Full donate flow as a real visitor**

As a logged-out (incognito) visitor: visit `/profile/drpatel` (teacher), donate $50 via the inline card. Confirm the fee breakdown shown before submitting reads `$50.00 to Dr. Aisha Patel + $2.80 Nivarro fee (5% + $0.30) = $52.80` (verify: `round(5000*0.05)+30 = 280`, total `5280`), and the mock success message appears after submitting.

- [ ] **Step 2: Confirm untouched surfaces still work**

Confirm `/campaigns` (the separate, unrelated school-level Campaign donation system) still works unchanged — visit it and confirm the page loads and its own donate flow (`PledgeModal`) still functions. Confirm `/mentorship` idea board (merged in Task 1) works: open a mentorship pairing, switch to the "Idea Board" tab, pin a note, confirm it persists on refresh.

- [ ] **Step 3: Final status check**

```bash
git status --porcelain
git log --oneline -10
```

Confirm all commits from Tasks 1-3 are present and no unrelated files were modified.
