# School Side: Destinations → Fundraising Campaign Hub — Design

**Date:** 2026-08-06
**Scope:** Paragraph 1 only from the 2026-08-06 multi-paragraph feedback dump ("get rid of destinations... focusing on fundraising... managing fundraising campaigns... full overhaul"). Paragraphs 2/3/4/5/6/7 (alumni tab, community, survey removal, AI campaign generator advanced editing, mentorship search, connections) are being handled by other concurrent agents on this repo — out of scope here, do not touch their files.

## Context

Verified against `main` on 2026-08-06:

- **Destinations** (`/school/destinations`) is a self-contained page — a college-destinations map + stats + a "Brochure Curation" panel — gated to `SCHOOL`/`ADMIN` roles. It's the current `homeHref` for school accounts in `Sidebar.tsx`.
- **Fundraising already exists.** A full `Campaign` system (`Campaign`, `CampaignPledge`, `CampaignVersion` models) is live: `/campaigns` list, `/campaigns/new` (AI-generated page via Claude Haiku), `/campaigns/[id]/edit`, public pledge page at `/c/[slug]`, admin manual-adjustment endpoint. Already in `SCHOOL_NAV` as "Fundraise."
- A **separate concurrent agent** (worktree `campaign-generator-advanced-editing`, plan: `2026-07-16-campaign-generator-advanced-design.md`) is actively rebuilding the *individual campaign editor* — AI tweak-in-place, hero visual redesign, inline field editing, version history labeling. It touches: `CampaignEditor.tsx`, `CampaignCanvas.tsx`, `CampaignHero.tsx`, `VersionHistoryDrawer.tsx`, `api/campaigns/generate`, `api/campaigns/[id]/tweak`, `api/campaigns/[id]/route.ts` (PATCH body fields), `api/campaigns/[id]/versions*`, `CampaignsNewClient.tsx`, `CampaignEditClient.tsx`, `CampaignPublicClient.tsx`, and the `CampaignVersion` schema. **This design does not touch any of those files.**
- **"Brochure Curation"** (button + panel on the Destinations page) turned out to be a full subsystem, not a small widget: PDF generation (`@react-pdf/renderer`), testimonials CRUD, per-school visibility settings, and an annual "send survey emails" reminder. Its testimonials/settings side (`SchoolBrochureSettings`, `BrochureTestimonial` models) is school-admin-only and self-contained. Its *data source* (`StudentBrochureData`, fed by `POST /api/student/brochure-data`) is written by the student-facing Survey page (`app/(dashboard)/profile/survey/SurveyClient.tsx`) — Survey removal is paragraph 4, owned by a different concurrent agent, out of scope here. Per explicit user decision: delete the school-admin brochure subsystem (panel/button/PDF/testimonials/settings/reminder-email), but leave `StudentBrochureData` and `/api/student/brochure-data` untouched so the still-live Survey page doesn't break before its own removal lands.

## Goals

- Remove Destinations entirely from the school experience (nav + route + exclusive components).
- Remove the school-admin Brochure Curation subsystem entirely (confirmed by user, accepting the survey-adjacency noted above).
- Make `/campaigns` ("Fundraise") the new home tab for school accounts, and overhaul it from a plain grid into a real campaign-management hub: totals, progress, filtering, sorting.

## Non-goals

- No changes to individual campaign creation/editing/AI generation/hero visuals — that's the concurrent agent's active scope.
- No "campaign lead" / staff-assignment concept (considered, explicitly declined).
- No changes to `StudentBrochureData`, `/api/student/brochure-data`, or the Survey page/tab.
- No changes to `Profile.intendedCollege` / `Profile.confirmedCollege` fields — still used by roster, alumni directory, and survey.

## Design

### 1. Remove Destinations

Delete:
- `app/(dashboard)/school/destinations/page.tsx`
- `app/(dashboard)/school/destinations/DynamicComponents.tsx`
- `components/school/DestinationsMap.tsx`
- `lib/colleges.json` (only ever imported by the destinations page)

`components/layout/Sidebar.tsx`:
- Remove the `{ href: "/school/destinations", label: "Destinations", Icon: MapPin }` entry from `SCHOOL_NAV`.
- Change `homeHref` for `isSchool` from `"/school/destinations"` to `"/campaigns"`.
- Drop the now-unused `MapPin` icon import if nothing else in the file uses it.

### 2. Remove the Brochure Curation subsystem

Delete:
- `components/school/BrochureCurationPanel.tsx`, `components/school/BrochureButton.tsx`, `components/school/BrochureDocument.tsx`
- `app/api/school/brochure/route.ts` (PDF generation)
- `app/api/school/brochure/testimonials/route.ts` and `testimonials/[id]/route.ts`
- `app/api/school/brochure/settings/route.ts`
- `app/api/school/brochure/students/route.ts`
- `app/api/school/brochure/send-survey-emails/route.ts`
- `lib/collegeLogos.ts` (only used by the PDF route)

Prisma schema: remove `model SchoolBrochureSettings` and `model BrochureTestimonial`. Leave `model StudentBrochureData` and its `Profile.brochureData` relation exactly as-is (Survey page still writes to it via `/api/student/brochure-data`, which is also left as-is).

Migration: hand-written SQL dropping the two tables (`prisma migrate deploy` runs at startup, so `prisma generate` alone isn't enough — per established project pattern).

### 3. Campaign Hub — the new school home

`app/(dashboard)/campaigns/page.tsx` (server component): alongside the existing campaign fetch, include each campaign's pledges (`select: { pledgeAmount: true }`). Compute per campaign:

```
raised = manualAdjustment + Σ(pledge.pledgeAmount for pledges where pledgeAmount is not null)
```

(`manualAdjustment` and `pledgeAmount` are `Decimal(10,2)` dollar amounts, matching the existing `/api/campaigns/[id]/adjust` convention — not cents.)

and pass `raised`, `goalAmount` through to the client, plus an overall total across all campaigns.

`app/(dashboard)/campaigns/CampaignsListClient.tsx`:
- New stats strip above the grid (same visual pattern as the old Destinations stats strip): **Total Raised**, **Active Campaigns**, **Total Pledges**.
- Filter tabs: All / Active / Draft (client-side filter over the existing `campaigns` state).
- Sort control: Newest (default, matches current `orderBy: createdAt desc`) / Most Raised / Most Pledges (client-side sort).
- Heading stays "My Campaigns" — this is a data/filtering upgrade, not a rename.

`components/campaigns/CampaignCard.tsx`:
- Add a raised-dollar line under the headline.
- If `goalAmount` is set, render a thin progress bar (`raised / goalAmount`, clamped to 100%) beneath it. If no goal is set, show just the raised amount with no bar.
- Existing actions (Edit / Copy Link / Toggle Active / Delete) unchanged.

No changes to `app/api/campaigns/route.ts` beyond what's already needed to support the above (it already includes `_count.pledges`; will extend the `include` to also select `pledges.pledgeAmount` and `goalAmount`, `manualAdjustment` on the `Campaign` select — additive only, doesn't change existing response fields other code depends on).

## Testing

Manual QA via a `SCHOOL`-role demo account:
- Destinations no longer appears in the sidebar; visiting `/school/destinations` directly no longer 404s the whole app (route is gone — Next.js serves its default 404).
- Home tab (clicking the logo, or landing after login) goes to the new Campaign Hub at `/campaigns`.
- Stats strip totals match manual arithmetic against seeded campaign/pledge data.
- Filter and sort controls behave correctly with 0, 1, and multiple campaigns.
- Progress bars render correctly for campaigns with and without a `goalAmount`.
- Roster, Alumni, Survey pages still function unchanged (spot-check — confirms no accidental breakage from the Brochure deletion boundary).
- `npm run build` passes (catches any dangling imports from deleted files).

## Out of scope (explicit, to prevent creep)

- Anything in `CampaignEditor`, `CampaignCanvas`, `CampaignHero`, `VersionHistoryDrawer`, `campaigns/new`, `campaigns/[id]/edit`, `app/c/[slug]`, `api/campaigns/generate`, `api/campaigns/[id]/tweak`, `api/campaigns/[id]/versions*` — concurrent agent's territory.
- Survey page/tab and `StudentBrochureData` — different concurrent agent's territory (paragraph 4).
- Alumni Net, Community, Mentorship, Connections tabs — other concurrent agents (paragraphs 2/3/6/7).
