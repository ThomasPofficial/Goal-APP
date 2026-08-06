# School Fundraising Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the school-side Destinations tab and the school-admin Brochure Curation subsystem, and turn the existing `/campaigns` page into the school account's new home tab — a "Campaign Hub" with totals, filtering, sorting, and per-campaign progress bars.

**Architecture:** Pure deletion for Destinations/Brochure (no replacement, no data migration of user-facing content). The Campaign Hub upgrade is additive-only: extend the existing server-component query in `campaigns/page.tsx` to compute a dollar `raised` figure per campaign, thread it through `CampaignsListClient.tsx` (new stats/filter/sort UI) and `CampaignCard.tsx` (new progress bar). No new API routes, no new Prisma models for the Hub — only two models (`SchoolBrochureSettings`, `BrochureTestimonial`) are dropped.

**Tech Stack:** Next.js 15 App Router (TypeScript), Prisma ORM / PostgreSQL, no automated test runner configured in this repo (no jest/vitest/playwright — `package.json` only has `dev`/`build`/`lint`/`start`/`seed`).

## Global Constraints

- **Verification command override:** in this sandboxed dev environment, `npm run build` (`next build`) reliably fails at the "Creating an optimized production build" step with `next/font: error: Failed to fetch 'X' from Google Fonts` (TLS/network blocked, unrelated to any code change — confirmed as a pre-existing environment limitation on a totally clean checkout before any task ran). **Do not treat this as a task failure.** Wherever a step says "Run: `npm run build`", instead run `npx tsc --noEmit -p tsconfig.json` — this type-checks the whole app without needing network access, and is the real gate for this plan. That command has **8 pre-existing baseline errors, all unrelated to this plan's files**: `app/(dashboard)/admin/org-categories/page.tsx:33`, `app/(dashboard)/orgs/OrgsClient.tsx:179`, and `prisma/seed-mock.ts:142,158,264,280,373,389`. A task passes verification if `npx tsc --noEmit -p tsconfig.json` produces exactly those 8 errors and nothing new — report any additional or different error as a real failure. If you also have working internet/DNS in your execution environment and `npm run build` completes past the font-fetch step, that is a strictly stronger signal and fine to report instead — the `tsc` baseline is the floor, not a ceiling.
- Do not touch any file under `app/(dashboard)/campaigns/new/`, `app/(dashboard)/campaigns/[id]/edit/`, `app/c/[slug]/`, `components/campaigns/CampaignEditor.tsx`, `CampaignCanvas.tsx`, `CampaignHero.tsx`, `VersionHistoryDrawer.tsx`, `app/api/campaigns/generate/`, `app/api/campaigns/[id]/tweak/`, `app/api/campaigns/[id]/versions*`, or the `CampaignVersion` model — all owned by a concurrent agent's already-merged campaign-editor overhaul.
- Do not touch `StudentBrochureData` (Prisma model) or `app/api/student/brochure-data/route.ts` — a separate concurrent agent's chain of commits (`4431473`, then `fc9fad7` "Remove the alumni outcomes self-report form and annual survey email") has already deleted `app/(dashboard)/profile/survey/` entirely and stripped the "Send Annual Survey" trigger out of `BrochureCurationPanel.tsx`, but explicitly kept `StudentBrochureData` itself — it now also backs `components/school/WhySchoolBanner.tsx`, a "Why {school}" dashboard stat. Since `app/(dashboard)/profile/survey/` no longer exists at all, there is nothing left there to accidentally touch — this line is just documenting why, so no task second-guesses the missing directory.
- `Campaign.manualAdjustment` and `CampaignPledge.pledgeAmount` are `Decimal(10,2)` **dollar** amounts (not cents) — match the existing convention in `app/api/campaigns/[id]/adjust/route.ts` (`parseFloat(x.toString())`).
- Every new Prisma migration must be a hand-written SQL file under `prisma/migrations/<timestamp>_<name>/migration.sql` — `prisma generate` alone does not create one, and `scripts/start.js` runs `prisma migrate deploy` at startup, so a missing migration file means the column/table never gets dropped/added and the deploy crashes.
- Follow existing inline-style conventions in this codebase (no CSS modules / Tailwind classes for one-off component styling — plain `style={{...}}` objects using the `var(--...)` design tokens, as seen throughout `components/campaigns/` and `app/(dashboard)/campaigns/`).

---

### Task 1: Remove the Destinations tab

**Files:**
- Delete: `app/(dashboard)/school/destinations/page.tsx`
- Delete: `app/(dashboard)/school/destinations/DynamicComponents.tsx`
- Delete: `components/school/DestinationsMap.tsx`
- Delete: `lib/colleges.json`
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Produces: `Sidebar.tsx`'s `homeHref` now resolves to `/campaigns` for school accounts — Task 4/5/6 build the page that lands there.

- [ ] **Step 1: Delete the Destinations route and its exclusive components**

```bash
rm -rf "app/(dashboard)/school/destinations"
rm -f components/school/DestinationsMap.tsx
rm -f lib/colleges.json
```

- [ ] **Step 2: Remove the nav entry and update the school home route in Sidebar.tsx**

In `components/layout/Sidebar.tsx`, remove the `MapPin` icon from the `lucide-react` import (it's used nowhere else in this file):

```ts
// Before:
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Bell, Briefcase, Megaphone, Globe, MapPin, GraduationCap, HeartHandshake, School, User, Link2 } from "lucide-react";
// After:
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Bell, Briefcase, Megaphone, Globe, GraduationCap, HeartHandshake, School, User, Link2 } from "lucide-react";
```

Remove the Destinations entry from `SCHOOL_NAV`:

```ts
// Before:
const SCHOOL_NAV = [
  { href: "/school/destinations", label: "Destinations",  Icon: MapPin },
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/communities",         label: "Community",     Icon: Globe },
  { href: "/campaigns",           label: "Fundraise",     Icon: HeartHandshake },
  { href: "/school/mentorship",   label: "Mentorship",    Icon: UsersRound },
  { href: "/school/connections",  label: "Connections",   Icon: Link2 },
  { href: "/school/roster",       label: "Roster",        Icon: Users },
];
// After:
const SCHOOL_NAV = [
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/communities",         label: "Community",     Icon: Globe },
  { href: "/campaigns",           label: "Fundraise",     Icon: HeartHandshake },
  { href: "/school/mentorship",   label: "Mentorship",    Icon: UsersRound },
  { href: "/school/connections",  label: "Connections",   Icon: Link2 },
  { href: "/school/roster",       label: "Roster",        Icon: Users },
];
```

Update `homeHref`:

```ts
// Before:
const homeHref = isSchool ? "/school/destinations" : isOrg && myOrgId ? `/orgs/${myOrgId}` : "/dashboard";
// After:
const homeHref = isSchool ? "/campaigns" : isOrg && myOrgId ? `/orgs/${myOrgId}` : "/dashboard";
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` (see Global Constraints — this replaces `npm run build` in this environment)
Expected: only the 8 pre-existing baseline errors listed in Global Constraints; nothing new, and nothing mentioning `app/(dashboard)/school/destinations`, `DestinationsMap`, or `lib/colleges.json`.

- [ ] **Step 4: Commit**

```bash
git add -A -- "app/(dashboard)/school/destinations" "components/school/DestinationsMap.tsx" "lib/colleges.json" "components/layout/Sidebar.tsx"
git commit -m "Remove school Destinations tab"
```

---

### Task 2: Remove the school-admin Brochure Curation subsystem

**Files:**
- Delete: `components/school/BrochureCurationPanel.tsx`
- Delete: `components/school/BrochureButton.tsx`
- Delete: `components/school/BrochureDocument.tsx`
- Delete: `app/api/school/brochure/route.ts`
- Delete: `app/api/school/brochure/testimonials/route.ts`
- Delete: `app/api/school/brochure/testimonials/[id]/route.ts`
- Delete: `app/api/school/brochure/settings/route.ts`
- Delete: `app/api/school/brochure/students/route.ts`
- Delete: `app/api/school/brochure/send-survey-emails/route.ts`
- Delete: `lib/collegeLogos.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260806010000_remove_brochure_curation/migration.sql`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing — this is a pure deletion, no other task depends on these files. `StudentBrochureData` and `Profile.brochureData` are explicitly NOT touched (see Global Constraints).

- [ ] **Step 1: Delete the components and API routes**

```bash
rm -f components/school/BrochureCurationPanel.tsx components/school/BrochureButton.tsx components/school/BrochureDocument.tsx
rm -rf app/api/school/brochure
rm -f lib/collegeLogos.ts
```

- [ ] **Step 2: Remove the two Prisma models**

In `prisma/schema.prisma`, delete the `SchoolBrochureSettings` and `BrochureTestimonial` models, leaving `StudentBrochureData` untouched:

```prisma
// DELETE this block entirely:
model SchoolBrochureSettings {
  id          String   @id @default(cuid())
  schoolId    String   @unique
  visibility  String   @default("ADMIN_ONLY")
  maxStudents Int?
  excludedIds String   @default("[]")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// DELETE this block entirely:
model BrochureTestimonial {
  id            String   @id @default(cuid())
  schoolId      String
  body          String
  sourceName    String
  sourceContext String?
  sourceType    String   @default("STUDENT")
  approved      Boolean  @default(false)
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([schoolId])
}
```

`model StudentBrochureData { ... }` immediately above these two stays exactly as-is.

- [ ] **Step 3: Write the migration**

Create `prisma/migrations/20260806010000_remove_brochure_curation/migration.sql`:

```sql
-- Remove the school-admin Brochure Curation subsystem (settings + testimonials).
-- Note: does NOT touch StudentBrochureData or Profile.brochureData — that's the
-- alumni "Your Outcomes" survey form's data sink, a separate feature, untouched.

DROP TABLE IF EXISTS "BrochureTestimonial";
DROP TABLE IF EXISTS "SchoolBrochureSettings";
```

- [ ] **Step 4: Regenerate the Prisma client and verify**

Run: `npx prisma generate`
Expected: succeeds, no references to `prisma.schoolBrochureSettings` or `prisma.brochureTestimonial` remain anywhere (they only existed in the files deleted in Step 1).

Run: `npx tsc --noEmit -p tsconfig.json` (see Global Constraints)
Expected: only the 8 pre-existing baseline errors; nothing new.

- [ ] **Step 5: Commit**

```bash
git add -A -- components/school/BrochureCurationPanel.tsx components/school/BrochureButton.tsx components/school/BrochureDocument.tsx app/api/school/brochure lib/collegeLogos.ts prisma/schema.prisma prisma/migrations/20260806010000_remove_brochure_curation
git commit -m "Remove school-admin Brochure Curation subsystem"
```

---

### Task 3: Compute per-campaign raised totals in the server component

**Files:**
- Modify: `app/(dashboard)/campaigns/page.tsx`
- Modify: `app/(dashboard)/campaigns/CampaignsListClient.tsx` (interface only — full UI overhaul is Task 4)

**Interfaces:**
- Consumes: `Campaign.goalAmount` (`Decimal?`), `Campaign.manualAdjustment` (`Decimal`), `CampaignPledge.pledgeAmount` (`Decimal?`) — all pre-existing Prisma fields, unchanged by this plan.
- Produces: `CampaignSummary` type gains `raised: number` and `goalAmount: number | null`, consumed by Task 4 (`CampaignsListClient.tsx` stats/filter/sort) and Task 5 (`CampaignCard.tsx` progress bar).

- [ ] **Step 1: Extend the Prisma query and compute `raised` in `page.tsx`**

Replace the full contents of `app/(dashboard)/campaigns/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CampaignsListClient from "./CampaignsListClient";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") redirect("/dashboard");

  const campaigns = await prisma.campaign.findMany({
    where: { schoolId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { pledges: true } },
      pledges: { select: { pledgeAmount: true } },
    },
  });

  return (
    <CampaignsListClient
      campaigns={campaigns.map((c) => {
        const pledgeSum = c.pledges.reduce(
          (sum, p) => sum + (p.pledgeAmount ? parseFloat(p.pledgeAmount.toString()) : 0),
          0
        );
        return {
          id: c.id,
          slug: c.slug,
          headline: c.headline,
          subheadline: c.subheadline,
          imageParams: c.imageParams as unknown as ImageParams,
          active: c.active,
          pledgeCount: c._count.pledges,
          raised: parseFloat(c.manualAdjustment.toString()) + pledgeSum,
          goalAmount: c.goalAmount ? parseFloat(c.goalAmount.toString()) : null,
          createdAt: c.createdAt.toISOString(),
        };
      })}
    />
  );
}
```

- [ ] **Step 2: Extend the `CampaignSummary` interface in `CampaignsListClient.tsx`**

In `app/(dashboard)/campaigns/CampaignsListClient.tsx`, update just the interface (the rest of the file is fully rewritten in Task 4 — this step only makes the file type-check against the new prop shape from Step 1):

```ts
// Before:
interface CampaignSummary {
  id: string;
  slug: string | null;
  headline: string;
  subheadline: string;
  imageParams: ImageParams;
  active: boolean;
  pledgeCount: number;
  createdAt: string;
}
// After:
interface CampaignSummary {
  id: string;
  slug: string | null;
  headline: string;
  subheadline: string;
  imageParams: ImageParams;
  active: boolean;
  pledgeCount: number;
  raised: number;
  goalAmount: number | null;
  createdAt: string;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` (see Global Constraints)
Expected: only the 8 pre-existing baseline errors; nothing new. (`CampaignCard.tsx` still declares its own local `CampaignSummary` without `raised`/`goalAmount` at this point — that's fine, TypeScript structural typing allows passing an object with extra fields; Task 5 adds them there too.)

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/campaigns/page.tsx" "app/(dashboard)/campaigns/CampaignsListClient.tsx"
git commit -m "Compute per-campaign raised totals in the campaigns query"
```

---

### Task 4: Campaign Hub — stats strip, filter, sort

**Files:**
- Modify: `app/(dashboard)/campaigns/CampaignsListClient.tsx`

**Interfaces:**
- Consumes: `CampaignSummary` (with `raised`/`goalAmount`) from Task 3.
- Produces: passes the same `CampaignSummary` shape into `<CampaignCard campaign={c} .../>` — Task 5 reads `campaign.raised`/`campaign.goalAmount` there.

- [ ] **Step 1: Replace the full contents of `CampaignsListClient.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import CampaignCard from "@/components/campaigns/CampaignCard";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

interface CampaignSummary {
  id: string;
  slug: string | null;
  headline: string;
  subheadline: string;
  imageParams: ImageParams;
  active: boolean;
  pledgeCount: number;
  raised: number;
  goalAmount: number | null;
  createdAt: string;
}

type FilterKey = "all" | "active" | "draft";
type SortKey = "newest" | "raised" | "pledges";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "raised", label: "Most Raised" },
  { key: "pledges", label: "Most Pledges" },
];

export default function CampaignsListClient({ campaigns: initial }: { campaigns: CampaignSummary[] }) {
  const [campaigns, setCampaigns] = useState(initial);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const toggleActive = async (id: string, active: boolean) => {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign and all its pledges? This cannot be undone.")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  const stats = useMemo(() => {
    const totalRaised = campaigns.reduce((sum, c) => sum + c.raised, 0);
    const activeCount = campaigns.filter((c) => c.active).length;
    const totalPledges = campaigns.reduce((sum, c) => sum + c.pledgeCount, 0);
    return { totalRaised, activeCount, totalPledges };
  }, [campaigns]);

  const visible = useMemo(() => {
    let list = campaigns;
    if (filter === "active") list = list.filter((c) => c.active);
    if (filter === "draft") list = list.filter((c) => !c.active);

    list = [...list];
    if (sort === "raised") list.sort((a, b) => b.raised - a.raised);
    else if (sort === "pledges") list.sort((a, b) => b.pledgeCount - a.pledgeCount);
    else list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list;
  }, [campaigns, filter, sort]);

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>My Campaigns</h1>
          <p style={{ fontSize: 14, color: "var(--n-text2)", marginTop: 4, marginBottom: 0 }}>
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/campaigns/new" style={{ padding: "10px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={14} /> New Campaign
        </Link>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Total Raised", value: `$${stats.totalRaised.toLocaleString()}` },
          { label: "Active Campaigns", value: stats.activeCount },
          { label: "Total Pledges", value: stats.totalPledges },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              flex: "1 1 120px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              padding: "14px 18px",
            }}
          >
            <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 32, color: "var(--amber)", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
            <p style={{ margin: "4px 0 0", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--n-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <div style={{ padding: "64px 0", textAlign: "center", border: "1px solid var(--border)", background: "var(--surface)" }}>
          <p style={{ color: "var(--n-text2)", fontSize: 15, margin: "0 0 20px" }}>No campaigns yet.</p>
          <Link href="/campaigns/new" style={{ padding: "10px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>
            Create your first campaign
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: "6px 14px",
                    border: "1px solid var(--border)",
                    background: filter === key ? "var(--amber)" : "var(--surface)",
                    color: filter === key ? "#000" : "var(--n-text2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              style={{
                padding: "7px 10px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {SORTS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", border: "1px solid var(--border)", background: "var(--surface)" }}>
              <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No {filter} campaigns.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {visible.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onToggleActive={(active) => toggleActive(c.id, active)}
                  onDelete={() => deleteCampaign(c.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` (see Global Constraints)
Expected: only the 8 pre-existing baseline errors; nothing new. (`CampaignCard.tsx` doesn't yet render `raised`/`goalAmount` — that's Task 5 — but it type-checks fine since it currently ignores those extra fields.)

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/campaigns/CampaignsListClient.tsx"
git commit -m "Add stats strip, filter, and sort to the Campaign Hub"
```

---

### Task 5: Progress bar and raised amount on each campaign card

**Files:**
- Modify: `components/campaigns/CampaignCard.tsx`

**Interfaces:**
- Consumes: `CampaignSummary.raised: number`, `CampaignSummary.goalAmount: number | null` from Task 3/4.

- [ ] **Step 1: Update the `CampaignSummary` interface and add the progress display**

In `components/campaigns/CampaignCard.tsx`, update the interface:

```ts
// Before:
interface CampaignSummary {
  id: string;
  slug: string | null;
  headline: string;
  subheadline: string;
  imageParams: ImageParams;
  active: boolean;
  pledgeCount: number;
  createdAt: string;
}
// After:
interface CampaignSummary {
  id: string;
  slug: string | null;
  headline: string;
  subheadline: string;
  imageParams: ImageParams;
  active: boolean;
  pledgeCount: number;
  raised: number;
  goalAmount: number | null;
  createdAt: string;
}
```

Insert a raised/progress block between the existing active-toggle row and the action-buttons row (i.e. right before the `<div style={{ display: "flex", gap: 8 }}>` that holds Edit/Copy Link/Delete):

```tsx
        {campaign.goalAmount && campaign.goalAmount > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", fontWeight: 700 }}>
                ${campaign.raised.toLocaleString()} raised
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--n-text2)" }}>
                of ${campaign.goalAmount.toLocaleString()}
              </span>
            </div>
            <div style={{ height: 6, background: "var(--n-bg3)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (campaign.raised / campaign.goalAmount) * 100)}%`,
                  background: "var(--amber)",
                }}
              />
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", fontWeight: 700, margin: "0 0 12px" }}>
            ${campaign.raised.toLocaleString()} raised
          </p>
        )}
```

The full method body around the insertion point should read:

```tsx
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => onToggleActive(!campaign.active)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: campaign.active ? "#22c55e" : "var(--n-text2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: campaign.active ? "#22c55e" : "var(--border)", display: "inline-block" }} />
            {campaign.active ? "Active" : "Draft"}
          </button>
          {!campaign.slug && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--n-text2)" }}>— not published</span>}
        </div>
        {campaign.goalAmount && campaign.goalAmount > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", fontWeight: 700 }}>
                ${campaign.raised.toLocaleString()} raised
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--n-text2)" }}>
                of ${campaign.goalAmount.toLocaleString()}
              </span>
            </div>
            <div style={{ height: 6, background: "var(--n-bg3)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (campaign.raised / campaign.goalAmount) * 100)}%`,
                  background: "var(--amber)",
                }}
              />
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", fontWeight: 700, margin: "0 0 12px" }}>
            ${campaign.raised.toLocaleString()} raised
          </p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` (see Global Constraints)
Expected: only the 8 pre-existing baseline errors; nothing new.

- [ ] **Step 3: Commit**

```bash
git add components/campaigns/CampaignCard.tsx
git commit -m "Show raised amount and goal progress bar on campaign cards"
```

---

### Task 6: Full manual QA pass

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (this runs `next dev`, which does not require the Google Fonts network fetch the way `next build` does — if it does fail on font-fetch too in your environment, note that and rely on the `tsc` results plus static code reading for this task instead of live-browser verification)

- [ ] **Step 2: Log in as a SCHOOL-role demo account**

Use `ridgepoint@nivarro.demo` / `ridgepoint2026` (or any current `SCHOOL`-role account — reseed via `POST /api/admin/seed-demo-accounts?secret=niv-reset-2026` if credentials have drifted).

- [ ] **Step 3: Verify Destinations is gone**

- Sidebar no longer shows "Destinations".
- Navigating directly to `/school/destinations` in the browser shows Next.js's default 404 page, not an app crash.
- Clicking the Nivarro logo (top-left) or otherwise landing on the school "home" route goes to `/campaigns`.

- [ ] **Step 4: Verify the Campaign Hub**

- Stats strip shows correct Total Raised / Active Campaigns / Total Pledges — cross-check against the seeded campaign/pledge data for this account.
- Filter tabs (All/Active/Draft) narrow the grid correctly; the "no X campaigns" empty state appears when a filter has zero matches.
- Sort dropdown reorders correctly for all three options.
- Cards with a `goalAmount` set show a progress bar that visually matches `raised / goalAmount`; cards without a goal show just the raised-dollar line, no bar.
- Existing actions still work: toggling Active/Draft, Copy Link (for published campaigns), Delete (with confirm), and the "New Campaign" button still routes to `/campaigns/new`.

- [ ] **Step 5: Spot-check untouched adjacent features**

- `/school/roster` and `/school/alumni` still load without errors — confirms the Brochure deletion didn't collaterally break anything outside its own subsystem. (Note: `/profile/survey`, the alumni "Your Outcomes" form, was already removed by a separate concurrent change before this plan started — that page's absence is expected and not a regression from this plan; don't flag it.)
- `components/school/WhySchoolBanner.tsx` (a "Why {school}" dashboard stat that reads `StudentBrochureData`, added by that same separate change) still renders wherever it's used — confirms `StudentBrochureData` itself, which this plan does not touch, is unaffected by the Brochure-subsystem deletion.

- [ ] **Step 6: Final verification**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: only the 8 pre-existing baseline errors, confirming all six tasks compose correctly together with no new type errors introduced across the whole branch.
