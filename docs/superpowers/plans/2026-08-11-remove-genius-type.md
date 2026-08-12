# Remove Genius Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully remove the "Genius Type" feature (DYNAMO/BLAZE/TEMPO/STEEL archetypes: the quiz, badges, avatar ring colors, scoring boosts, org project preferences, and the DB columns/enum backing all of it) from the Nivarro app, leaving zero functional or type references anywhere in the main worktree.

**Architecture:** Remove in dependency order, schema last. First strip every code reference to `Profile.geniusType` / `Profile.secondaryGeniusType` / `OrgProject.preferredGeniusTypes` across UI, API routes, scoring algorithms, and seed scripts while the Prisma schema still has the columns (so the app keeps compiling and running against the live DB at every checkpoint). Only after nothing in the codebase reads or writes those fields does the final task drop the columns and the `GeniusType` enum via a migration. The separate "Traits" system (`TRAITS`, `TraitQuizClient`, `/api/quiz/traits*`) and the separate "Animal Archetype" system (`Profile.animalArchetypes`, `archetypeAnalysis`, `lib/runArchetypeAnalysis.ts`) are NOT genius-type and must be left intact except for one incidental line.

**Tech Stack:** Next.js 16.1.6 (App Router), TypeScript, Prisma 7.8.0 / PostgreSQL, NextAuth v5, React 19.2.3. No test framework is configured (no jest/vitest/playwright in `package.json`) — verification is `npx tsc --noEmit`, `npm run lint`, and manual QA against the dev server (this project's own convention per its `/qa` skill).

## Global Constraints

- **Scope:** `C:\Users\thoma\Goal-APP` main worktree ONLY. Do not touch anything under `C:\Users\thoma\Goal-APP\.claude\worktrees\*` — those are separate in-progress branches (`alumni-multi-school`, `faculty-permission-tiers`, `roster-invite-activation`, `mentorship-idea-board-donations`, `onboarding-enforcement`, `org-profile-edit-settings`, `roster-csv-ai-channels`, `campaign-generator-advanced-editing`, `org-communities-instant-access`, `school-staff-accounts`, `org-communities-browse-apply-pay`) that each carry their own copy of these files. **After this plan lands on main, each of those worktrees will need this change rebased/merged in separately — flag this to the user, do not attempt it as part of this plan.**
- **Do not touch** the Traits system: `data/traits.ts`'s `TRAITS`, `TRAIT_CATEGORY_LABELS`, `TRAIT_CATEGORY_COLORS`, `TRAITS_BY_CATEGORY`, `TraitCategory` type, `TraitDef` interface (lines 1-45 and 192-921 of that file); `app/(dashboard)/quiz/TraitQuizClient.tsx`; `/api/quiz/traits` and `/api/quiz/traits/apply` routes; `components/profile/TraitBadge.tsx`.
- **Do not touch** the Animal Archetype system: `Profile.animalArchetypes`, `Profile.archetypeAnalysis`, `Profile.archetypeUpdatedAt` schema fields, `lib/runArchetypeAnalysis.ts` (except the one `geniusType` line named in Task 15).
- **Verification gate:** every task ends with `npx tsc --noEmit` returning zero errors before you commit. Tasks 1-15 must ALSO leave `npm run build` succeeding against the *current* (unmigrated) schema — do not drop schema columns before Task 16.
- **Commit per task**, using `git add <specific files>` (never `-A`), with a message describing what was removed.
- **Public API contract:** `app/api/agent/openapi/route.ts` is served publicly at `/api/agent/openapi` and documented at `/docs/api` for third-party AI agent consumers (per project memory). Removing `geniusType`/`secondaryGeniusType` fields and the ranking-by-genius-type prose is a breaking change to that contract — Task 10 must update the OpenAPI spec and the `/docs/api` page copy together, and bump `package.json`'s `version` field (0.2.0 → 0.3.0) to signal the break.
- **No score redistribution:** for `api/agent/search/route.ts`, `api/agent/project/[id]/candidates/route.ts`, and `api/search/route.ts`, do NOT invent replacement point values for the removed genius-match bonus — simply remove that scoring term and let the ceiling drop (e.g. agent search's max score drops from 100 to 85; the code already clamps with `Math.min(score, 100)` so this is safe). Update the `scoringNote`/doc strings to describe only the remaining signals.

---

## Task 1: Delete the quiz flow and de-gate onboarding

**Files:**
- Delete: `app/(dashboard)/quiz/QuizClient.tsx`
- Delete: `app/api/quiz/route.ts`
- Modify: `app/(dashboard)/quiz/page.tsx`
- Modify: `app/(onboarding)/onboarding/page.tsx`

**Interfaces:**
- Produces: `/quiz` now renders only the Traits quiz (no tab switcher, no genius reveal). `/onboarding` no longer requires a genius type to enter — it becomes the entry point straight after login for any profile with `onboardingComplete: false`.
- Consumes: `TraitQuizClient` (unchanged, `app/(dashboard)/quiz/TraitQuizClient.tsx`), `prisma.profile.findUnique` (Prisma schema unchanged this task — `geniusType` column still exists but no longer selected here).

- [ ] **Step 1: Delete the genius quiz client**

Delete the file `app/(dashboard)/quiz/QuizClient.tsx` entirely (227 lines, genius-quiz-only, no other consumer).

- [ ] **Step 2: Delete the genius quiz API route**

Delete the file `app/api/quiz/route.ts` entirely (39 lines, only ever wrote `geniusType`). Confirm `/api/quiz/traits` and `/api/quiz/traits/apply` are separate files/routes and are untouched.

- [ ] **Step 3: Rewrite the quiz page to be traits-only**

Replace the full contents of `app/(dashboard)/quiz/page.tsx` with:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TraitQuizClient from "./TraitQuizClient";

export default async function QuizPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, profile: { select: { schoolId: true } } },
      })
    : null;

  const isSchoolAffiliatedStudent = dbUser?.role === "STUDENT" && !!dbUser.profile?.schoolId;

  // Student/Alum accounts are walled off from this quiz entirely.
  if (isSchoolAffiliatedStudent) redirect("/dashboard");

  const profile = userId
    ? await prisma.profile.findUnique({
        where: { userId },
        select: {
          id: true,
          strengthSummary: true,
          traitLinks: {
            orderBy: { order: "asc" },
            include: { trait: true },
          },
        },
      })
    : null;

  const workflowSession = profile?.id
    ? await prisma.workflowSession.findUnique({
        where: { profileId: profile.id },
        select: { step: true },
      })
    : null;

  const traitsDone = (profile?.traitLinks?.length ?? 0) > 0;
  const hasActiveWorkflow = !!workflowSession;
  const existingTraits = profile?.traitLinks?.map((l) => ({
    id: l.trait.id,
    slug: l.trait.slug,
    name: l.trait.name,
    category: l.trait.category,
  })) ?? [];

  return (
    <div className="max-w-2xl mx-auto pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e8e8ec] mb-1">Skill Assessment</h1>
        <p className="text-sm text-[#9898a8]">
          A short quiz to build your Skill Card — shown on your profile and matched to opportunities.
        </p>
      </div>

      <TraitQuizClient
        alreadyCompleted={traitsDone}
        existingTraits={existingTraits}
        existingSummary={profile?.strengthSummary ?? null}
        hasActiveWorkflow={hasActiveWorkflow}
      />
    </div>
  );
}
```

This drops the `GENIUS_TYPES_ORDER` array, the `GENIUS_TYPE_INFO`/`GeniusType` imports, the tab switcher, the entire genius-tab branch (old lines 109-159 including `<QuizClient>`), and the `geniusDone` computation. `TraitQuizClient`'s props (`alreadyCompleted`, `existingTraits`, `existingSummary`, `hasActiveWorkflow`) are unchanged from the old traits-tab branch — confirm by reading `app/(dashboard)/quiz/TraitQuizClient.tsx`'s prop signature before finalizing, since this task assumes it matches exactly.

- [ ] **Step 4: De-gate onboarding**

In `app/(onboarding)/onboarding/page.tsx`, replace:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OnboardingClient from "./OnboardingClient";
import type { GeniusTypeKey } from "@/lib/geniusTypes";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { geniusType: true, onboardingComplete: true },
  });

  if (profile?.onboardingComplete) redirect("/dashboard");
  if (!profile?.geniusType) redirect("/quiz");

  return <OnboardingClient geniusType={profile.geniusType as GeniusTypeKey} />;
}
```

with:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { onboardingComplete: true },
  });

  if (profile?.onboardingComplete) redirect("/dashboard");

  return <OnboardingClient />;
}
```

`OnboardingClient` is reworked to take no props in Task 2 — this step and Task 2 must land together (same task-review checkpoint) or `tsc` will fail on the prop mismatch in between. Treat Steps 4 of this task and all of Task 2 as one atomic commit.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: only errors remaining should be inside `app/(onboarding)/onboarding/OnboardingClient.tsx` (still expects a `geniusType` prop) — fixed in Task 2. If you see errors anywhere else, stop and investigate before proceeding.

- [ ] **Step 6: Commit (combined with Task 2 — see Task 2 Step 6)**

Do not commit yet; proceed directly to Task 2 and commit both together.

---

## Task 2: Rework onboarding to drop the Genius Type reveal step

**Files:**
- Modify: `app/(onboarding)/onboarding/OnboardingClient.tsx`

**Interfaces:**
- Consumes: nothing genius-related (no props from Task 1's `page.tsx` anymore).
- Produces: a 3-step onboarding flow (was 4): Current Focus → Interests → Background, using the app's static `--blue` accent instead of per-genius-type Tailwind theming.

- [ ] **Step 1: Remove the genius-type prop, import, and reveal step; renumber remaining steps**

In `app/(onboarding)/onboarding/OnboardingClient.tsx`:

Replace the top of the file (imports through the component signature and `info` derivation):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { INTEREST_TAG_GROUPS, ALL_INTEREST_TAGS } from "@/lib/interestTags";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

const FOCUS_PLACEHOLDERS = [
  "Building a fintech app that helps teens invest…",
  "Writing a short film about first-gen college students…",
  "Researching renewable energy storage solutions…",
  "Launching a tutoring startup in my city…",
];

export default function OnboardingClient({ geniusType }: { geniusType: GeniusTypeKey }) {
  const router = useRouter();
  const { update } = useSession();
  const info = GENIUS_TYPES[geniusType];

  const [step, setStep] = useState<Step>(1);
```

with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { INTEREST_TAG_GROUPS, ALL_INTEREST_TAGS } from "@/lib/interestTags";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

const FOCUS_PLACEHOLDERS = [
  "Building a fintech app that helps teens invest…",
  "Writing a short film about first-gen college students…",
  "Researching renewable energy storage solutions…",
  "Launching a tutoring startup in my city…",
];

export default function OnboardingClient() {
  const router = useRouter();
  const { update } = useSession();

  const [step, setStep] = useState<Step>(1);
```

Delete the entire old Step 1 block (the genius-type reveal, `if (step === 1) { ... }`, roughly lines 34-67 of the original — everything from `// ─── Step 1: Quiz result reveal ───` through its closing `}` right before `// ─── Step 2: Current Focus ───`).

Renumber what was Step 2 (Current Focus) to `step === 1`, what was Step 3 (Interests) to `step === 2`, and what was Step 4 (Background) to the final `step === 3` block (the one after the last `if` — i.e. remove its `if (step === 4)` guard entirely since it's the last step, same as the original did for step 4). Concretely:

- `if (step === 2) {` → `if (step === 1) {`, and inside it change `onClick={() => setStep(3)}` (both buttons) → `onClick={() => setStep(2)}`, and `<StepHeader step={2} ...` → `<StepHeader step={1} ...`.
- `if (step === 3) {` → `if (step === 2) {`, and inside it change `onClick={() => setStep(4)}` → `onClick={() => setStep(3)}`, and `<StepHeader step={3} ...` → `<StepHeader step={2} ...`.
- The final unconditional block (was reached only when `step === 4`) keeps `<StepHeader step={3} label="A bit about you" />` (was `step={4}`).

- [ ] **Step 2: Replace all `info.*` theming references with the static accent color**

Every use of `info.tailwindBg`, `info.tailwindText`, `info.tailwindBorder` in the (renumbered) Interests and Background steps must become static Tailwind classes matching the rest of the app's `#4a80f0` blue accent used elsewhere in this same file (e.g. the "Continue →" buttons already use `bg-[#4a80f0] hover:bg-[#6a9fff] text-[#0f0f11]`).

In the Interests step, replace:

```tsx
                      className={cn(
                        "px-3 py-1 rounded-full text-sm border transition-all",
                        selected
                          ? cn(info.tailwindBg, info.tailwindText, info.tailwindBorder)
                          : "bg-[#1e1e24] text-[#9898a8] border-transparent hover:border-[#2a2a33]"
                      )}
```

with:

```tsx
                      className={cn(
                        "px-3 py-1 rounded-full text-sm border transition-all",
                        selected
                          ? "bg-[#4a80f020] text-[#4a80f0] border-[#4a80f040]"
                          : "bg-[#1e1e24] text-[#9898a8] border-transparent hover:border-[#2a2a33]"
                      )}
```

and replace the freeform-tag chip's:

```tsx
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border",
                      info.tailwindBg,
                      info.tailwindText,
                      info.tailwindBorder
                    )}
```

with:

```tsx
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border bg-[#4a80f020] text-[#4a80f0] border-[#4a80f040]"
```

In the Background step, both grade-button blocks (HS grades 9-12, and College Fr./So./Jr./Sr.) currently have:

```tsx
                    className={cn(
                      "w-12 h-10 rounded-lg border text-sm font-semibold transition-all",
                      grade === g
                        ? cn(info.tailwindBg, info.tailwindText, info.tailwindBorder)
                        : "border-[#2a2a33] text-[#9898a8] hover:border-[#3a3a44]"
                    )}
```

and

```tsx
                    className={cn(
                      "px-3 h-10 rounded-lg border text-sm font-semibold transition-all",
                      grade === g
                        ? cn(info.tailwindBg, info.tailwindText, info.tailwindBorder)
                        : "border-[#2a2a33] text-[#9898a8] hover:border-[#3a3a44]"
                    )}
```

Replace the `grade === g ? cn(info.tailwindBg, info.tailwindText, info.tailwindBorder) : "..."` ternary in both with `grade === g ? "bg-[#4a80f020] text-[#4a80f0] border-[#4a80f040]" : "border-[#2a2a33] text-[#9898a8] hover:border-[#3a3a44]"`.

- [ ] **Step 3: Update `StepHeader`'s "of 4" to "of 3"**

Replace:

```tsx
function StepHeader({ step, label }: { step: number; label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[#5a5a6a]">Step {step} of 4</p>
      <h1 className="text-2xl font-bold text-[#e8e8ec]">{label}</h1>
    </div>
  );
}
```

with:

```tsx
function StepHeader({ step, label }: { step: number; label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[#5a5a6a]">Step {step} of 3</p>
      <h1 className="text-2xl font-bold text-[#e8e8ec]">{label}</h1>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors touching `app/(onboarding)/onboarding/*` or `app/(dashboard)/quiz/*`.

- [ ] **Step 5: Manual QA**

Start the dev server (`npm run dev`) and, using the `browse` tool or a real browser: log in as a fresh/blank demo student (or seed one), confirm `/onboarding` opens directly on "What are you working on?" (no genius reveal screen), all 3 steps complete and save correctly, and `/quiz` shows only the traits quiz with no tab switcher.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/quiz/page.tsx" "app/(onboarding)/onboarding/page.tsx" "app/(onboarding)/onboarding/OnboardingClient.tsx"
git rm "app/(dashboard)/quiz/QuizClient.tsx" "app/api/quiz/route.ts"
git commit -m "Remove genius-type quiz flow; onboarding no longer gated on it"
```

---

## Task 3: Remove the Genius UI atoms (Avatar ring, badge) and their simple display-only callers

**Files:**
- Delete: `components/ui/GeniusTypeBadge.tsx`
- Modify: `components/ui/Avatar.tsx`
- Modify: `components/ui/ApplyModal.tsx`
- Modify: `app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx`
- Modify: `components/profile/SkillCard.tsx`
- Modify: `app/(dashboard)/projects/[id]/ProjectDetail.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `Avatar` no longer accepts a `geniusType` prop — its ring color is always the static gray it already falls back to (`#6B7280`).
- Consumes: nothing new.
- Note: `MessagesClient.tsx`, `NotificationsClient.tsx`, `ProfileClient.tsx`, `PeersClient.tsx`, `SmartSearch.tsx`, `OrgDetailClient.tsx`, and the org-side `ProjectDetailClient.tsx` are handled in their own later tasks (7, 8, 9), not here — they'll fail `tsc` between now and then if run standalone; only run this task's `tsc` check expecting failures in those other files (see Step 6), and don't merge to a shared branch until all touching tasks land.

- [ ] **Step 1: Delete `GeniusTypeBadge.tsx`**

Delete `components/ui/GeniusTypeBadge.tsx` entirely (41 lines).

- [ ] **Step 2: Strip the `geniusType` prop from `Avatar.tsx`**

Read `components/ui/Avatar.tsx` in full first. It currently imports `GENIUS_TYPES, type GeniusTypeKey` from `@/lib/geniusTypes`, accepts a `geniusType?: GeniusTypeKey | null` prop, and computes `const ringColor = geniusType ? GENIUS_TYPES[geniusType].color : "#6B7280";`.

Remove the `import { GENIUS_TYPES, type GeniusTypeKey } from "@/lib/geniusTypes";` line, remove `geniusType` from the props interface, and replace the `ringColor` line with a plain constant:

```tsx
const ringColor = "#6B7280";
```

(Keep the variable name so nothing downstream in this same file that references `ringColor` needs to change.)

- [ ] **Step 3: Fix `ApplyModal.tsx`**

Read `components/ui/ApplyModal.tsx` in full. Remove its `import GeniusTypeBadge from "./GeniusTypeBadge";` and `import type { GeniusTypeKey } from "@/lib/geniusTypes";` lines, remove the `geniusType: GeniusTypeKey | null;` field from its `Peer` (or equivalent) interface, remove the `geniusType={peer.geniusType}` prop passed into its `<Avatar ... />` call, and delete the `{peer.geniusType && <GeniusTypeBadge type={peer.geniusType} size="sm" />}` block entirely.

- [ ] **Step 4: Fix `TeamWorkspaceClient.tsx`**

In `app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx`:

Remove the imports:
```tsx
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
```

Remove `geniusType: GeniusTypeKey | null` from the `Member.profile` inline type and from `ChatMessage.sender.profile`'s inline type.

Change the component signature — remove `myGeniusType` entirely:
```tsx
export default function TeamWorkspaceClient({
  team, applications, msgCount: initialMsgCount, myProfileId, myGeniusType, myUserId,
}: {
  team: TeamData;
  applications: ApplicationSummary[];
  msgCount: number;
  myProfileId: string;
  myGeniusType: GeniusTypeKey | null;
  myUserId: string;
}) {
```
becomes:
```tsx
export default function TeamWorkspaceClient({
  team, applications, msgCount: initialMsgCount, myProfileId, myUserId,
}: {
  team: TeamData;
  applications: ApplicationSummary[];
  msgCount: number;
  myProfileId: string;
  myUserId: string;
}) {
```

Delete the line `const typeInfo = myGeniusType ? GENIUS_TYPES[myGeniusType] : null;` (confirm nothing else in the file reads `typeInfo` — the earlier inventory pass found no other usage; if you find one, keep the derivation but drop `myGeniusType` from the signature only after confirming what replaces it).

Remove `geniusType={m.profile?.geniusType}` from both `<Avatar ... />` calls in the header avatar stack and the member list.

In the chat message rendering, replace:
```tsx
              const senderInfo = msg.sender.profile;
              const senderType = senderInfo?.geniusType as GeniusTypeKey | null;
              const typeColor = senderType ? GENIUS_TYPES[senderType].color : undefined;
```
with:
```tsx
              const senderInfo = msg.sender.profile;
```
and remove `geniusType={senderType}` from the message-thread `<Avatar ... />` call, and remove the `typeColor` usage in the bubble style:
```tsx
                    <div
                      className={cn("px-3 py-2 rounded-2xl text-sm leading-relaxed", isMe ? "rounded-tr-sm" : "rounded-tl-sm")}
                      style={isMe && typeColor ? { background: `${typeColor}18`, color: "inherit" } : undefined}
                    >
```
becomes:
```tsx
                    <div
                      className={cn("px-3 py-2 rounded-2xl text-sm leading-relaxed", isMe ? "rounded-tr-sm" : "rounded-tl-sm")}
                    >
```

The caller of `TeamWorkspaceClient` (`app/(dashboard)/teams/[teamId]/page.tsx`) is fixed in Task 7 — do not fix it here, `tsc` will flag it until Task 7 lands.

- [ ] **Step 5: Fix `SkillCard.tsx` and `ProjectDetail.tsx`**

In `components/profile/SkillCard.tsx`, remove `import { GENIUS_TYPE_INFO } from "@/data/traits";` and drop `GeniusType` from `import type { TraitCategory, GeniusType } from "@/data/traits";` (leave `TraitCategory` imported). Remove the `geniusType?: GeniusType | null;` field from `SkillCardData`. Remove `const genius = data.geniusType ? GENIUS_TYPE_INFO[data.geniusType] : null;`. Delete the rendered badge block (`{genius && ( ... )}`, roughly the "Header: Avatar + Name + Genius type" comment block).

In `app/(dashboard)/projects/[id]/ProjectDetail.tsx`, remove the dead `import { GENIUS_TYPE_INFO } from ...` (or wherever it's imported from — confirm the exact import line by reading the file first), remove the `geniusType` field from whatever local type references `profile.geniusType`, and remove the `geniusType: profile.geniusType as never` prop pass into `<SkillCard ... />`.

- [ ] **Step 6: Remove the CSS rule**

In `app/globals.css`, delete the `GENIUS BADGE` section comment and the `.genius-badge` hover-transition rule that follows it (it only ever styled `GeniusTypeBadge.tsx`, now deleted).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files not yet touched by this plan — specifically `app/(dashboard)/teams/[teamId]/page.tsx` (still passes `myGeniusType` to `TeamWorkspaceClient`), `app/(dashboard)/messages/MessagesClient.tsx`, `app/(dashboard)/notifications/NotificationsClient.tsx`, `app/(dashboard)/profile/[handle]/ProfileClient.tsx`, `app/(dashboard)/peers/PeersClient.tsx`, `app/(dashboard)/people/SmartSearch.tsx`, `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx` — all fixed in Tasks 5, 7, 8, 9. If you see errors in ANY other file, stop and investigate.

- [ ] **Step 8: Commit**

```bash
git add "components/ui/Avatar.tsx" "components/ui/ApplyModal.tsx" "app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx" "components/profile/SkillCard.tsx" "app/(dashboard)/projects/[id]/ProjectDetail.tsx" "app/globals.css"
git rm "components/ui/GeniusTypeBadge.tsx"
git commit -m "Remove Genius Type badge/ring atoms and their display-only callers"
```

---

## Task 4: Remove Genius Type from the sidebar, account menu, and dashboard welcome/tutorial widgets

**Files:**
- Modify: `components/layout/AccountMenu.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/SidebarShell.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `components/ui/WelcomeCard.tsx`
- Modify: `components/ui/TutorialWidget.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/dashboard/DashboardClient.tsx`
- Delete: `components/ui/WorkflowBar.tsx`

**Interfaces:**
- Produces: none of these components accept or pass a `geniusType`/`hasGeniusType` prop anymore.
- Note: a prior turn partially gated `AccountMenu`'s genius section behind `!isOrg` — this task removes that section outright instead (it's no longer conditional, it's just gone).

- [ ] **Step 1: Delete the dead `WorkflowBar.tsx`**

Confirm first with a repo-wide search (excluding `.claude/worktrees`) that nothing in `app/` imports `WorkflowBar` — the earlier inventory found zero import sites. Then delete `components/ui/WorkflowBar.tsx` entirely.

- [ ] **Step 2: Strip `AccountMenu.tsx` down to remove the genius section entirely**

Read the current state of `components/layout/AccountMenu.tsx` (it was edited in a prior turn to gate the genius section behind `isOrg`/`isSchool`). Remove the imports `import { GENIUS_TYPE_INFO } from "@/data/traits";` and `import type { GeniusType } from "@/data/traits";`. Remove the `geniusType?: GeniusType | null;` prop and the `genius`/`showGeniusSection` derivations. Delete the entire genius badge-or-quiz-link JSX block (the `{showGeniusSection && ( ... )}` block containing either the colored genius badge or the `Take the Genius Quiz →` link). Delete the small collapsed-footer genius label (`{genius && (<div ...>{genius.icon} {genius.label}</div>)}`). Keep the `isOrg`/`isSchool` props themselves if anything else in the component still uses them for non-genius purposes (e.g. the "Edit Profile" link gating) — re-read the file to confirm what, if anything, still needs `isOrg`/`isSchool` after the genius block is gone, and only drop those props if truly unused.

- [ ] **Step 3: Remove `geniusType` prop plumbing from `Sidebar.tsx`, `SidebarShell.tsx`, and `layout.tsx`**

In `components/layout/Sidebar.tsx`: remove `import type { GeniusType } from "@/data/traits";`, remove `geniusType?: GeniusType | null;` from `SidebarProps`, remove `geniusType` from the destructured component params, remove `geniusType={geniusType}` from the `<AccountMenu ... />` call (already dropped as a prop in Step 2, so this call site must not pass it).

In `components/layout/SidebarShell.tsx`: remove `import type { GeniusType } from "@/data/traits";`, remove `geniusType?: GeniusType | null;` from `Props`, remove `geniusType` from the destructured params, remove `geniusType={geniusType}` from the `<Sidebar ... />` call.

In `app/(dashboard)/layout.tsx`: remove the `geniusType`-related import (`import type { GeniusType } from "@/data/traits";` or similar — read the file to confirm the exact import), remove `geniusType: true` from whatever `prisma.profile.findUnique`/`findFirst` `select` block populates it, and remove `geniusType={...}` from the `<SidebarShell ... />` call.

- [ ] **Step 4: Simplify `WelcomeCard.tsx`**

Read `components/ui/WelcomeCard.tsx` in full. Delete the local `GENIUS_TYPES` array (the 4-item emoji/label/color/line table). Change the component signature from `export default function WelcomeCard({ hasGeniusType }: { hasGeniusType: boolean }) {` to `export default function WelcomeCard() {`. Delete the entire "Every scholar has a Genius Type" promo block (the `<Zap ... />` heading through the `GENIUS_TYPES.map(...)` grid — the whole `<div className="px-5 pt-4 pb-4" ...>` section between the Mission block and the CTA footer). Simplify the CTA footer from:

```tsx
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <p className="text-xs" style={{ color: "var(--text2)" }}>
          {hasGeniusType
            ? "Your type is set. Keep building."
            : "3-minute quiz. Find out where you fit."}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={dismiss}
            className="text-xs px-3 py-1.5 font-medium transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border-md)", borderRadius: 0, background: "none", cursor: "pointer" }}
          >
            Got it
          </button>
          {!hasGeniusType && (
            <Link
              href="/quiz"
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
              style={{ background: "var(--blue)", color: "#fff", borderRadius: 0, textDecoration: "none" }}
            >
              Take the quiz <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>
```

to:

```tsx
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <p className="text-xs" style={{ color: "var(--text2)" }}>
          Ready to get started?
        </p>
        <button
          onClick={dismiss}
          className="text-xs px-3 py-1.5 font-medium transition-colors"
          style={{ color: "var(--muted)", border: "1px solid var(--border-md)", borderRadius: 0, background: "none", cursor: "pointer" }}
        >
          Got it
        </button>
      </div>
```

Remove the now-unused `ArrowRight` and `Link` imports if nothing else in the file uses them (re-check before removing `Link` — it may still be used elsewhere in the file; `ArrowRight` was only used in the deleted CTA and is safe to drop from the `lucide-react` import list).

- [ ] **Step 5: Simplify `TutorialWidget.tsx`**

Read `components/ui/TutorialWidget.tsx` in full. Remove `hasGeniusType: boolean;` from the `TutorialState` interface. Delete the first entry of the `steps` array (`{ label: "Set up your Genius profile", ... done: hasGeniusType, ... }`), leaving 3 steps instead of 4. Update the destructure `const { hasGeniusType, traitsDone, hasApplied, hasBrowsedOrgs } = state;` to `const { traitsDone, hasApplied, hasBrowsedOrgs } = state;`. In the remaining "Add your traits" step's `guide` copy, change `"Head to the Traits tab on the Quiz page after completing your Genius Type."` to `"Head to the Quiz page and complete the short skill assessment."`. In the "Browse organizations" step's `guide` copy, change `"Look at what Genius Types and traits they're seeking — compare with your own profile."` to `"Look at what traits and skills they're seeking — compare with your own profile."`.

- [ ] **Step 6: Fix `dashboard/page.tsx` and `DashboardClient.tsx`**

In `app/(dashboard)/dashboard/page.tsx`: remove the genius-related import, remove `geniusType: true` (or equivalent) from the profile `select`, remove `hasGeniusType: !!profile?.geniusType` from the `tutorial` object passed to `DashboardClient`.

In `app/(dashboard)/dashboard/DashboardClient.tsx`: remove the genius-related import, remove `geniusType`/`hasGeniusType` fields from whatever local type/interface carries them, change `<WelcomeCard hasGeniusType={tutorial.hasGeniusType} />` to `<WelcomeCard />`. The `<TutorialWidget {...tutorial} serverDismissed={tutorialDismissed} />` spread call needs no change here since `tutorial` itself no longer has `hasGeniusType` after `dashboard/page.tsx` stops setting it — but confirm no local destructure in `DashboardClient.tsx` explicitly names `hasGeniusType`.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all files touched by this task. Errors may remain in files scheduled for later tasks (org-side, teams, messages, notifications, profile, peers, people-search) — confirm any remaining errors are confined to those, not to anything this task touched.

- [ ] **Step 8: Manual QA**

With the dev server running, log in as a demo student and confirm: the sidebar account menu shows no genius badge or quiz link (for both student and org accounts), the dashboard's welcome card no longer shows the "Every scholar has a Genius Type" section or "Take the quiz" CTA, and the "Get started on Nivarro" tutorial checklist has 3 steps starting with "Add your traits."

- [ ] **Step 9: Commit**

```bash
git add "components/layout/AccountMenu.tsx" "components/layout/Sidebar.tsx" "components/layout/SidebarShell.tsx" "app/(dashboard)/layout.tsx" "components/ui/WelcomeCard.tsx" "components/ui/TutorialWidget.tsx" "app/(dashboard)/dashboard/page.tsx" "app/(dashboard)/dashboard/DashboardClient.tsx"
git rm "components/ui/WorkflowBar.tsx"
git commit -m "Remove Genius Type from sidebar, account menu, and dashboard widgets"
```

---

## Task 5: Remove Genius Type from profile pages

**Files:**
- Modify: `app/api/profile/route.ts`
- Modify: `app/api/profile/[handle]/route.ts`
- Modify: `app/(dashboard)/profile/[handle]/page.tsx`
- Modify: `app/(dashboard)/profile/[handle]/ProfileClient.tsx`

**Interfaces:**
- Produces: profile GET/PATCH endpoints and pages no longer read/write/render `geniusType`/`secondaryGeniusType`.

- [ ] **Step 1: `api/profile/route.ts`**

Read the file. Remove the `geniusType`/`secondaryGeniusType` fields from the zod validation schema (around the original lines 17-18), and remove the conditional block that applies them to the Prisma `update` call (around the original lines 87-88).

- [ ] **Step 2: `api/profile/[handle]/route.ts`**

Read the file. Remove `geniusType: true` and `secondaryGeniusType: true` (or however they're named) from the `select` block (around the original lines 14-15).

- [ ] **Step 3: `app/(dashboard)/profile/[handle]/page.tsx`**

Read the file. Remove the genius-related import, remove the `select` fields, and remove any `as GeniusTypeKey` type casts on the fetched profile shape (original lines ~5, 19-20, 43, 71-72, 76).

- [ ] **Step 4: `app/(dashboard)/profile/[handle]/ProfileClient.tsx`**

Read the file. Remove `import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";` and `import type { GeniusTypeKey } from "@/lib/geniusTypes";`. Remove the `geniusType`/`secondaryGeniusType` fields from the local profile type. Remove the `gt` (or similarly named) derivation that looked up `GENIUS_TYPE_INFO`/`GENIUS_TYPES` for display. Remove the `geniusType={...}` prop from the `<Avatar ... />` call, and delete the primary + secondary `<GeniusTypeBadge ... />` render block.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in the four files touched.

- [ ] **Step 6: Manual QA**

Visit a demo scholar's public profile page (e.g. `/profile/priya` if that handle exists, or whichever demo handle is live) and confirm no genius badge renders and the page loads without errors.

- [ ] **Step 7: Commit**

```bash
git add "app/api/profile/route.ts" "app/api/profile/[handle]/route.ts" "app/(dashboard)/profile/[handle]/page.tsx" "app/(dashboard)/profile/[handle]/ProfileClient.tsx"
git commit -m "Remove Genius Type from profile pages and API"
```

---

## Task 6: Remove Genius Type from peer search, filters, and matching scores

**Files:**
- Modify: `app/api/search/route.ts`
- Modify: `app/api/peers/route.ts`
- Modify: `app/(dashboard)/people/SmartSearch.tsx`
- Modify: `app/(dashboard)/peers/PeersClient.tsx`

**Interfaces:**
- Produces: `/api/search` results no longer include `geniusType` or genius-compatibility scoring; `/api/peers` no longer supports a `geniusType` filter param; both `SmartSearch` and `PeersClient` drop their genius filter UI and badge rendering.

- [ ] **Step 1: Rewrite the scoring in `app/api/search/route.ts`**

Replace the full contents of `app/api/search/route.ts` with:

```tsx
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function buildMatchReason({
  traitMatchCount,
  searchedTraitsCount,
  completenessScore,
  activeProjects,
}: {
  traitMatchCount: number;
  searchedTraitsCount: number;
  completenessScore: number;
  activeProjects: number;
}): string {
  const parts: string[] = [];

  if (searchedTraitsCount > 0 && traitMatchCount > 0) {
    parts.push(
      `${traitMatchCount}/${searchedTraitsCount} searched trait${traitMatchCount > 1 ? "s" : ""} matched`
    );
  }

  if (activeProjects > 0) {
    parts.push(
      `${activeProjects} active project${activeProjects > 1 ? "s" : ""}`
    );
  }

  if (completenessScore >= 3) {
    parts.push("complete profile");
  }

  return parts.length > 0 ? parts.join(" · ") : "Profile match";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);

  const q = url.searchParams.get("q") ?? "";
  const traitsParam = url.searchParams.get("traits") ?? "";
  const parsedMinTraits = parseInt(url.searchParams.get("minTraits") ?? "1", 10);
  const minTraits = Math.max(1, isNaN(parsedMinTraits) ? 1 : parsedMinTraits);
  const dobFrom = url.searchParams.get("dobFrom") ?? "";
  const dobTo = url.searchParams.get("dobTo") ?? "";

  const searchedSlugs = traitsParam
    ? traitsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Build WHERE clause — require at least a display name (so empty signups don't appear)
  const where: Prisma.ProfileWhereInput = {
    userId: { not: userId },
    NOT: { displayName: "" },
  };

  // Keyword filter
  if (q) {
    (where as Record<string, unknown>).AND = [
      {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { headline: { contains: q, mode: "insensitive" } },
          { bio: { contains: q, mode: "insensitive" } },
          { strengthSummary: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  // DOB range filter — validate dates before using them
  const dobFromDate = dobFrom ? new Date(dobFrom) : null;
  const dobToDate = dobTo ? new Date(dobTo) : null;
  if (
    (dobFromDate && !isNaN(dobFromDate.getTime())) ||
    (dobToDate && !isNaN(dobToDate.getTime()))
  ) {
    where.dateOfBirth = {};
    if (dobFromDate && !isNaN(dobFromDate.getTime()))
      (where.dateOfBirth as Record<string, unknown>).gte = dobFromDate;
    if (dobToDate && !isNaN(dobToDate.getTime()))
      (where.dateOfBirth as Record<string, unknown>).lte = dobToDate;
  }

  const profiles = await prisma.profile.findMany({
    where,
    include: {
      traitLinks: {
        orderBy: { order: "asc" },
        include: { trait: true },
      },
      user: {
        include: {
          projectMemberships: {
            include: { project: true },
          },
        },
      },
    },
    take: 100,
  });

  // Post-fetch: trait minimum count filter (SQLite lacks HAVING COUNT)
  let filtered = profiles;
  if (searchedSlugs.length > 0) {
    filtered = profiles.filter((p) => {
      const profileSlugs = p.traitLinks.map((l) => l.trait.slug);
      const matchCount = searchedSlugs.filter((slug) =>
        profileSlugs.includes(slug)
      ).length;
      return matchCount >= minTraits;
    });
  }

  // Score and build results
  const results = filtered.map((p) => {
    const profileSlugs = p.traitLinks.map((l) => l.trait.slug);
    const traitMatchCount =
      searchedSlugs.length > 0
        ? searchedSlugs.filter((slug) => profileSlugs.includes(slug)).length
        : 0;

    const projects = p.user.projectMemberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      status: m.project.status,
    }));
    const activeProjects = projects.filter((pr) => pr.status === "ACTIVE").length;

    const completenessScore =
      (p.bio ? 1 : 0) +
      (p.strengthSummary ? 1 : 0) +
      (p.headline ? 1 : 0) +
      (p.avatarUrl ? 1 : 0);

    const score =
      traitMatchCount * 2 +
      completenessScore +
      Math.min(activeProjects, 3);

    const matchReason = buildMatchReason({
      traitMatchCount,
      searchedTraitsCount: searchedSlugs.length,
      completenessScore,
      activeProjects,
    });

    return {
      userId: p.userId,
      displayName: p.displayName,
      headline: p.headline,
      avatarUrl: p.avatarUrl,
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().split("T")[0] : null,
      selfTraits: p.traitLinks.map((l) => ({
        name: l.trait.name,
        slug: l.trait.slug,
        category: l.trait.category,
      })),
      projects,
      matchScore: score,
      matchReason,
    };
  });

  // Sort by score descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  return NextResponse.json({ results, total: results.length });
}
```

This drops the `COMPATIBILITY` matrix, `geniusCompatibility()`, the `geniusComp`/`myGeniusType`/`theirGeniusType` params throughout, the `geniusTypeFilter` query param and its `where.geniusType` filter, the `myProfile` genius-type fetch, `geniusType` from the returned result shape, and the `geniusComp * 3` scoring term (per the Global Constraints "no score redistribution" rule — the composite score is now `traitMatchCount * 2 + completenessScore + min(activeProjects, 3)` only).

- [ ] **Step 2: `app/api/peers/route.ts`**

Read the file. Remove `searchParams.getAll("geniusType")` and the `where.geniusType = { in: ... }` filter it feeds. Confirm whether `select: { ..., geniusType: true }` is still needed for display purposes elsewhere in the response — since `PeersClient.tsx` (Step 4 below) stops rendering genius badges, remove the `geniusType`/`secondaryGeniusType` select fields too.

- [ ] **Step 3: Strip genius filter + badge from `SmartSearch.tsx`**

Read `app/(dashboard)/people/SmartSearch.tsx` in full. Remove `import { GENIUS_TYPE_INFO, TRAIT_CATEGORY_LABELS, TRAIT_CATEGORY_COLORS } from "@/data/traits";`'s `GENIUS_TYPE_INFO` (keep the trait-category imports), and drop `GeniusType` from `import type { TraitCategory, GeniusType } from "@/data/traits";`. Remove `geniusType?: string | null;` from `SearchResult`. Delete the local `const GENIUS_TYPES = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"] as const;` constant. Remove the `geniusType` state (`useState("")`), the `setGenius` handler, and the `geniusType` field from `runSearch`'s params type and `scheduleSearch`'s override calls. Delete the "Genius type filter" `<div className="flex flex-wrap gap-2">...</div>` block entirely (the "All types" button plus the per-type buttons). Update the intro copy `"Find collaborators by keywords, genius type, traits, or age range."` to `"Find collaborators by keywords, traits, or age range."`. In `SearchResultCard`, remove the `geniusInfo` derivation and delete the badge `<span>` block that rendered it.

- [ ] **Step 4: Strip genius filter + badge from `PeersClient.tsx`**

Read `app/(dashboard)/peers/PeersClient.tsx` in full. Remove `import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";`, `import { GENIUS_TYPES } from "@/lib/geniusTypes";`, `import type { GeniusTypeKey } from "@/lib/geniusTypes";`. Remove `geniusType`/`secondaryGeniusType` fields from the local `Peer` interface. Delete `const GENIUS_KEYS: GeniusTypeKey[] = [...]`. Remove the `selectedTypes` state, `toggleType` handler, and the `selectedTypes.forEach(...)` query-param append in `fetchPeers`. Delete the entire "Genius Type" filter `<div>` block in the sidebar (`<p ...>Genius Type</p>` through its `.map` button list). Update `activeFilters` to drop `selectedTypes.length` from its sum (becomes just `selectedGrades.length`). Remove `geniusType={peer.geniusType as GeniusTypeKey | null}` from every `<Avatar ... />` call (there are 3: card, panel small, panel large) and delete every `{peer.geniusType && <GeniusTypeBadge ... />}` block (there are 3: card, panel header, group-modal list row). Delete the compatibility-color `<div>` block in `StudentPanel` that used `borderColor: GENIUS_TYPES[peer.geniusType as GeniusTypeKey].color` — replace `{peer.currentFocus && peer.geniusType && (<div ... style={{borderColor: ...}}>{peer.currentFocus}</div>)}` with a plain `{peer.currentFocus && (<div className="border-l-4 pl-3 py-1 mb-4 text-xs text-[#9898a8] italic leading-relaxed" style={{ borderColor: "var(--border-md)" }}>{peer.currentFocus}</div>)}` so the current-focus quote still renders, just without genius-based coloring.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all four files.

- [ ] **Step 6: Manual QA**

With the dev server running: visit `/people` (SmartSearch), confirm no genius-type filter chips appear and a keyword/trait search still returns ranked results. Visit `/peers`, confirm the sidebar has no "Genius Type" filter section, cards render without badges, and the student detail panel opens cleanly.

- [ ] **Step 7: Commit**

```bash
git add "app/api/search/route.ts" "app/api/peers/route.ts" "app/(dashboard)/people/SmartSearch.tsx" "app/(dashboard)/peers/PeersClient.tsx"
git commit -m "Remove Genius Type from peer search, filters, and matching score"
```

---

## Task 7: Remove Genius Type from teams (mechanical field removal)

**Files:**
- Modify: `app/api/teams/route.ts`
- Modify: `app/api/teams/[id]/route.ts`
- Modify: `app/api/teams/[id]/messages/route.ts`
- Modify: `app/(dashboard)/teams/page.tsx`
- Modify: `app/(dashboard)/teams/[teamId]/page.tsx`

**Interfaces:**
- Consumes: `TeamWorkspaceClient` no longer accepts `myGeniusType` (dropped in Task 3) — `app/(dashboard)/teams/[teamId]/page.tsx` must stop passing it.

- [ ] **Step 1: `app/api/teams/route.ts`, `app/api/teams/[id]/route.ts`, `app/api/teams/[id]/messages/route.ts`**

Read each file. Each has one or more `select: { ..., geniusType: true, ... }` lines feeding member/profile shapes returned to the client — remove `geniusType: true,` (and `secondaryGeniusType: true,` where present) from each.

- [ ] **Step 2: `app/(dashboard)/teams/page.tsx`**

Read the file. Remove `geniusType`/`secondaryGeniusType` from any `select` blocks and from any local type casts or interfaces passed down to child components.

- [ ] **Step 3: `app/(dashboard)/teams/[teamId]/page.tsx`**

Read the file. Remove `geniusType`/`secondaryGeniusType` from the `select` block, remove any type casts, and remove `myGeniusType={...}` from the `<TeamWorkspaceClient ... />` call (that prop no longer exists on the component as of Task 3).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all five files, and this should also clear any remaining `TeamWorkspaceClient`-related errors left over from Task 3.

- [ ] **Step 5: Manual QA**

Open an existing demo team's workspace page (`/teams/<id>`) and confirm chat, member list, and applications tabs all render with no console errors.

- [ ] **Step 6: Commit**

```bash
git add "app/api/teams/route.ts" "app/api/teams/[id]/route.ts" "app/api/teams/[id]/messages/route.ts" "app/(dashboard)/teams/page.tsx" "app/(dashboard)/teams/[teamId]/page.tsx"
git commit -m "Remove Genius Type fields from teams API and pages"
```

---

## Task 8: Remove Genius Type from messaging and notifications

**Files:**
- Modify: `app/(dashboard)/messages/MessagesClient.tsx`
- Modify: `app/(dashboard)/messages/page.tsx`
- Modify: `app/(dashboard)/notifications/NotificationsClient.tsx`
- Modify: `app/(dashboard)/notifications/page.tsx`
- Modify: `app/api/conversations/route.ts`
- Modify: `app/api/contacts/route.ts`
- Modify: `app/api/recruitment-requests/route.ts`

**Interfaces:**
- Produces: none of these render genius badges or select the field.

- [ ] **Step 1: `MessagesClient.tsx`**

Read `app/(dashboard)/messages/MessagesClient.tsx` in full. Remove the `GeniusTypeBadge`/`GENIUS_TYPES`/`GeniusTypeKey` imports. Remove `geniusType`/`secondaryGeniusType` fields from local interfaces. Remove the `myGT` (or similarly named) derivation and confirm what it fed (re-read before deleting — if it colors the compose/header UI similarly to `TeamWorkspaceClient`'s `typeColor`, apply the same fix pattern: drop the color derivation and any conditional `style` that used it). Remove `geniusType={...}` from every `<Avatar ... />` call in the peer list, message thread, and conversation header. Delete every `{x.geniusType && <GeniusTypeBadge ... />}` render block (peer list and conversation header).

- [ ] **Step 2: `app/(dashboard)/messages/page.tsx`**

Read the file. Remove the genius-related import, `select` fields, and the `geniusType: null` default set for the org "profile" fallback shape.

- [ ] **Step 3: `NotificationsClient.tsx`**

Read `app/(dashboard)/notifications/NotificationsClient.tsx` in full. Remove the `GeniusTypeBadge`/`GeniusTypeKey` imports, remove the `geniusType` field from the local type, remove `geniusType={...}` from the `<Avatar ... />` call and delete the `<GeniusTypeBadge ... />` render on recruitment-request notification cards.

- [ ] **Step 4: `app/(dashboard)/notifications/page.tsx`**

Read the file. Remove `geniusType`/`secondaryGeniusType` from `select` and any type casts.

- [ ] **Step 5: `api/conversations/route.ts`, `api/contacts/route.ts`, `api/recruitment-requests/route.ts`**

Read each file. Each has a `select: { ..., geniusType: true, ... }` line — remove it (and `secondaryGeniusType: true` where present).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all seven files.

- [ ] **Step 7: Manual QA**

Open `/messages` and confirm the peer list, an open conversation thread, and the conversation header all render with no genius badges and no console errors. Open `/notifications` and confirm recruitment-request notification cards render cleanly.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/messages/MessagesClient.tsx" "app/(dashboard)/messages/page.tsx" "app/(dashboard)/notifications/NotificationsClient.tsx" "app/(dashboard)/notifications/page.tsx" "app/api/conversations/route.ts" "app/api/contacts/route.ts" "app/api/recruitment-requests/route.ts"
git commit -m "Remove Genius Type from messaging and notifications"
```

---

## Task 9: Remove Genius Type from the org side (signup, project matching, AI applicant analysis)

**Files:**
- Modify: `app/(dashboard)/orgs/new/OrgNewClient.tsx`
- Modify: `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx`
- Modify: `app/(dashboard)/orgs/[orgId]/page.tsx`
- Modify: `app/(dashboard)/orgs/[orgId]/projects/[projectId]/page.tsx`
- Modify: `app/(dashboard)/orgs/[orgId]/projects/[projectId]/ProjectDetailClient.tsx`
- Modify: `app/api/orgs/route.ts`
- Modify: `app/api/org-projects/[id]/route.ts`
- Modify: `app/api/org-projects/[id]/scholars/route.ts`
- Modify: `app/api/orgs/[id]/analyze-applicants/route.ts`
- Modify: `app/api/orgs/[id]/reviews/route.ts`

**Interfaces:**
- Produces: org project creation/editing no longer has a "Preferred Genius Types" field; org-side scholar/project views no longer render genius badges; the AI applicant-analysis prompt no longer mentions genius types; the scholar-search-by-genius-type filter is removed from the org scholar browse endpoint.

- [ ] **Step 1: `OrgNewClient.tsx`**

Read `app/(dashboard)/orgs/new/OrgNewClient.tsx` in full. Delete `const GENIUS_TYPES = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"] as const;`. Remove the `preferredGeniusTypes` state (`useState<string[]>([])`). Remove `preferredGeniusTypes: JSON.stringify(preferredGeniusTypes),` from the submit body. Delete the entire `<Field label="Preferred Genius Types">...</Field>` block (the toggle-button row).

- [ ] **Step 2: `OrgDetailClient.tsx`**

Read `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx` in full. Remove `import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";` and `import type { GeniusTypeKey } from "@/lib/geniusTypes";`. Remove `geniusType`/`secondaryGeniusType`/`preferredGeniusTypes` fields from every local interface that carries them. Remove the `const preferred: string[] = JSON.parse(proj.preferredGeniusTypes || "[]");` line and the `{preferred.map((t) => <GeniusTypeBadge key={t} type={t as GeniusTypeKey} size="sm" />)}` render block on project cards. Remove `geniusType={...}` from both `<Avatar ... />` calls, and delete the `{p.geniusType && <GeniusTypeBadge ... />}` block on the applicant/member row.

- [ ] **Step 3: `app/(dashboard)/orgs/[orgId]/page.tsx`**

Read the file. Remove the genius-related import, remove `geniusType: true` and `preferredGeniusTypes: true` from every `select` block, and remove the `as GeniusTypeKey | null` type casts (there are 2 — member and applicant profile shapes) plus the `preferredGeniusTypes: p.preferredGeniusTypes ?? "[]"` passthrough if it's now dead (only remove that passthrough line if nothing downstream still expects the field — since `ProjectDetailClient.tsx` in Step 5 stops reading it, this becomes safe to drop).

- [ ] **Step 4: `app/(dashboard)/orgs/[orgId]/projects/[projectId]/page.tsx`**

Read the file. Remove the `preferredGeniusTypes: project.preferredGeniusTypes ?? "[]"` passthrough.

- [ ] **Step 5: `ProjectDetailClient.tsx` (org project detail)**

Read `app/(dashboard)/orgs/[orgId]/projects/[projectId]/ProjectDetailClient.tsx` in full. Remove `import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";` and `import type { GeniusTypeKey } from "@/lib/geniusTypes";`. Remove `preferredGeniusTypes: string;` from the project type. Remove `const preferredTypes: string[] = JSON.parse(project.preferredGeniusTypes || "[]");`. Delete the badge-render loop (`{preferredTypes.map((t) => <GeniusTypeBadge key={t} type={t as GeniusTypeKey} size="sm" />)}`) and whatever surrounding "Preferred Genius Types" label/section wraps it.

- [ ] **Step 6: `api/orgs/route.ts`**

Read the file. Remove the `preferredGeniusTypes` destructure from the request body, and remove `preferredGeniusTypes: preferredGeniusTypes ?? "[]",` from the `prisma.orgProject.create` call.

- [ ] **Step 7: `api/org-projects/[id]/route.ts`**

Read the file. Remove `preferredGeniusTypes: true` from the `select` block.

- [ ] **Step 8: `api/org-projects/[id]/scholars/route.ts`**

Read the file. Remove `import type { GeniusType } from "@prisma/client";` (or wherever the type import is). Remove the `geniusType` query-param read (`searchParams.get("geniusType")` or similar). Remove the `where.geniusType = ...` filter it feeds. Remove `geniusType: true` (and `secondaryGeniusType: true` if present) from the `select` block.

- [ ] **Step 9: `api/orgs/[id]/analyze-applicants/route.ts`**

Read the file (already read in full during plan research — see below for the exact diff). Replace:

```ts
  const project = await prisma.orgProject.findFirst({
    where: projectWhere,
    select: {
      id: true,
      title: true,
      requiredSkills: true,
      preferredGeniusTypes: true,
      teamApplications: {
```

with:

```ts
  const project = await prisma.orgProject.findFirst({
    where: projectWhere,
    select: {
      id: true,
      title: true,
      requiredSkills: true,
      teamApplications: {
```

Remove `geniusType: true,` and `secondaryGeniusType: true,` from the nested `profile.select` block. Replace:

```ts
  const requiredSkills: string[] = JSON.parse(project.requiredSkills || "[]");
  const preferredTypes: string[] = JSON.parse(project.preferredGeniusTypes || "[]");
```

with:

```ts
  const requiredSkills: string[] = JSON.parse(project.requiredSkills || "[]");
```

In the per-applicant text block, replace:

```ts
        return `
    Name: ${p.displayName}
    Handle: @${p.handle ?? "none"}
    Genius Type: ${p.geniusType ?? "unknown"}${p.secondaryGeniusType ? ` / ${p.secondaryGeniusType}` : ""}
    Grade: ${p.grade ?? "unknown"} | School: ${p.schoolName ?? "unknown"}
```

with:

```ts
        return `
    Name: ${p.displayName}
    Handle: @${p.handle ?? "none"}
    Grade: ${p.grade ?? "unknown"} | School: ${p.schoolName ?? "unknown"}
```

And in the prompt template, remove the line `Preferred Genius Types: ${preferredTypes.join(", ") || "not specified"}` from:

```ts
  const prompt = `You are an expert talent evaluator for ${org.name}.

PROJECT: "${project.title}"
Required Skills: ${requiredSkills.join(", ") || "not specified"}
Preferred Genius Types: ${preferredTypes.join(", ") || "not specified"}

You are reviewing ${project.teamApplications.length} application(s). ...
```

so it becomes:

```ts
  const prompt = `You are an expert talent evaluator for ${org.name}.

PROJECT: "${project.title}"
Required Skills: ${requiredSkills.join(", ") || "not specified"}

You are reviewing ${project.teamApplications.length} application(s). ...
```

- [ ] **Step 10: `api/orgs/[id]/reviews/route.ts`**

Read the file. Remove `geniusType: true` (or equivalent) from its `select` block.

- [ ] **Step 11: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all ten files.

- [ ] **Step 12: Manual QA**

With the dev server running: go through `/orgs/new` and confirm no "Preferred Genius Types" field appears in the project-creation form. Open an existing demo org's detail page (`/orgs/<id>`) and a project detail page under it, confirm no genius badges render on applicant cards or project cards. If feasible, trigger "Analyze with AI" on an org with pending applications and skim the returned analysis text to confirm it makes no mention of genius types.

- [ ] **Step 13: Commit**

```bash
git add "app/(dashboard)/orgs/new/OrgNewClient.tsx" "app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx" "app/(dashboard)/orgs/[orgId]/page.tsx" "app/(dashboard)/orgs/[orgId]/projects/[projectId]/page.tsx" "app/(dashboard)/orgs/[orgId]/projects/[projectId]/ProjectDetailClient.tsx" "app/api/orgs/route.ts" "app/api/org-projects/[id]/route.ts" "app/api/org-projects/[id]/scholars/route.ts" "app/api/orgs/[id]/analyze-applicants/route.ts" "app/api/orgs/[id]/reviews/route.ts"
git commit -m "Remove Genius Type from org signup, project matching, and AI applicant analysis"
```

---

## Task 10: Remove Genius Type from the Agent API (public contract — breaking change)

**Files:**
- Modify: `app/api/agent/search/route.ts`
- Modify: `app/api/agent/project/[id]/candidates/route.ts`
- Modify: `app/api/agent/scholar/[id]/route.ts`
- Modify: `app/api/agent/schema/route.ts`
- Modify: `app/api/agent/openapi/route.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `/api/agent/search`, `/api/agent/project/[id]/candidates`, and `/api/agent/scholar/[id]` no longer accept, return, or score on `geniusType`/`secondaryGeniusType`. The public OpenAPI spec at `/api/agent/openapi` reflects this. This is a breaking change to a contract third-party AI agents consume — bump the app version.

- [ ] **Step 1: Rewrite `app/api/agent/search/route.ts`**

Replace the full contents with:

```ts
import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Scoring helper
// ---------------------------------------------------------------------------
type ScholarRaw = {
  id: string;
  displayName: string | null;
  handle: string | null;
  headline: string | null;
  bio: string | null;
  strengthSummary: string | null;
  avatarUrl: string | null;
  grade: number | null;
  schoolName: string | null;
  interests: string | null;
  traitLinks: {
    trait: { slug: string; name: string; category: string };
    order: number;
  }[];
  orgReviews: {
    id: string;
    body: string | null;
    createdAt: Date;
    org: { name: string };
    orgProject: { title: string } | null;
  }[];
};

function scoreScholar(
  scholar: ScholarRaw,
  queryKeywords: string[]
): { score: number; matchReasons: string[] } {
  let score = 0;
  const matchReasons: string[] = [];

  // ── Review track record ──────────────────────────────────────────────────
  const reviewCount = scholar.orgReviews.length;
  if (reviewCount > 0) {
    const reviewScore = Math.min(40 + (reviewCount - 1) * 5, 60);
    score += reviewScore;
    matchReasons.push(
      `${reviewCount} org review${reviewCount > 1 ? "s" : ""} from previous work`
    );
  }

  // ── Keyword relevance ─────────────────────────────────────────────────────
  if (queryKeywords.length > 0) {
    const searchableText = [
      scholar.headline ?? "",
      scholar.bio ?? "",
      scholar.interests ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const matchedKeywords: string[] = [];
    for (const kw of queryKeywords) {
      if (searchableText.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
      if (score + matchedKeywords.length * 5 >= score + 15) break; // cap check
    }

    const keywordScore = Math.min(matchedKeywords.length * 5, 15);
    if (keywordScore > 0) {
      score += keywordScore;
      matchReasons.push(
        `Strong keyword overlap: ${matchedKeywords.slice(0, 3).join(", ")}`
      );
    }
  }

  // ── Profile completeness ──────────────────────────────────────────────────
  if (scholar.strengthSummary) {
    score += 5;
    matchReasons.push("Complete profile with strength summary");
  }

  return { score: Math.min(score, 100), matchReasons };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const auth = await requireAgentAuth(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { query, filters = {} } = body as {
    query?: string;
    filters?: {
      minReviews?: number;
      grade?: number;
      interests?: string[];
    };
  };

  const where: Prisma.ProfileWhereInput = { onboardingComplete: true };

  if (filters.grade) where.grade = filters.grade;

  if (query || (filters.interests && filters.interests.length > 0)) {
    const terms = [
      ...(query ? [query] : []),
      ...(filters.interests ?? []),
    ];
    where.OR = terms.flatMap((t) => [
      { displayName: { contains: t, mode: "insensitive" as const } },
      { headline: { contains: t, mode: "insensitive" as const } },
      { bio: { contains: t, mode: "insensitive" as const } },
      { interests: { contains: t, mode: "insensitive" as const } },
    ]);
  }

  const scholars = await prisma.profile.findMany({
    where,
    take: 50,
    select: {
      id: true,
      displayName: true,
      handle: true,
      headline: true,
      bio: true,
      strengthSummary: true,
      avatarUrl: true,
      grade: true,
      schoolName: true,
      interests: true,
      traitLinks: {
        take: 5,
        include: { trait: { select: { slug: true, name: true, category: true } } },
        orderBy: { order: "asc" },
      },
      orgReviews: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          org: { select: { name: true } },
          orgProject: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Apply minReviews filter
  const minReviews = filters.minReviews ?? 0;
  const filtered = minReviews > 0
    ? scholars.filter((s) => s.orgReviews.length >= minReviews)
    : scholars;

  // Extract meaningful query keywords (skip short/stop words)
  const stopWords = new Set(["the", "and", "for", "with", "that", "this", "a", "an", "in", "of"]);
  const queryKeywords = query
    ? query
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z0-9]/gi, ""))
        .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()))
    : [];

  // Score and annotate each scholar
  const scored = filtered.map((scholar) => {
    const { score, matchReasons } = scoreScholar(scholar, queryKeywords);
    return { ...scholar, score, matchReasons };
  });

  // Sort by score descending; ties broken by review count
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.orgReviews.length - a.orgReviews.length;
  });

  const scoringNote =
    "Scholars scored 0-85 based on: org reviews (track record), keyword relevance, profile completeness. Reviews are private org feedback not visible to students.";

  return NextResponse.json(
    { scholars: scored, total: scored.length, scoringNote },
    { headers: { "X-RateLimit-Remaining": String(auth.callsRemaining) } }
  );
}
```

This drops `GENIUS_TYPE_KEYWORDS`, `detectGeniusTypeFromQuery()`, the `targetGeniusType`/genius-match scoring block (was +15/+10), the `filters.geniusType` param, `geniusType`/`secondaryGeniusType` from the `select` and `ScholarRaw` type, and updates `scoringNote` to describe only the remaining signals (max score is now 85: 60 reviews + 15 keywords + 5 completeness + no genius/no bonus, still clamped by `Math.min(score, 100)` defensively).

- [ ] **Step 2: Rewrite `app/api/agent/project/[id]/candidates/route.ts`**

Apply the equivalent removal: remove `import type { GeniusType, Prisma } from "@prisma/client";`'s `GeniusType` (keep whatever else is imported from `@prisma/client` if anything besides types), remove `geniusType`/`secondaryGeniusType` from `ScholarRaw`, remove the `scoreCandidate` function's `preferredTypes: string[]` parameter and its "Preferred genius type match" scoring block (was +15), remove `let preferredTypes: string[] = []; try { preferredTypes = JSON.parse(project.preferredGeniusTypes ?? "[]"); } catch { preferredTypes = []; }`, remove `geniusType`/`secondaryGeniusType` from the `select` block, remove `preferredTypes` from `projectContext`, and update the call site `scoreCandidate(candidate, preferredTypes, requiredSkills)` to `scoreCandidate(candidate, requiredSkills)` (adjusting the function signature to only take `scholar` and `requiredSkills`).

- [ ] **Step 3: `app/api/agent/scholar/[id]/route.ts`**

Read the file. Remove `geniusType: true` and `secondaryGeniusType: true` from its `select` block.

- [ ] **Step 4: `app/api/agent/schema/route.ts`**

Read the file. Remove the one doc-string line describing the `geniusType` filter parameter.

- [ ] **Step 5: Update the public OpenAPI spec — `app/api/agent/openapi/route.ts`**

Read the file. Remove the `geniusType`/`secondaryGeniusType` property definitions from the Scholar schema (originally around lines 89-100). Remove the `geniusType` filter property from the search-filters schema (originally around lines 155-159). Remove `geniusType: "STEEL"` from the example request payload (originally around line 183). Reword the candidates-endpoint description that currently reads roughly *"Candidates matching the project's preferred genius types are ranked first"* to describe only the remaining ranking signals (org reviews and required-skill keyword matches) — e.g. *"Candidates are ranked by prior org review track record and required-skill keyword matches."*

- [ ] **Step 6: Bump the app version**

In `package.json`, change `"version": "0.2.0"` to `"version": "0.3.0"` to signal the breaking change to the public agent API contract.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all five route files.

- [ ] **Step 8: Manual QA**

With the dev server running, fetch `/api/agent/openapi` directly (e.g. `curl http://localhost:3000/api/agent/openapi | head -c 2000` or open it in a browser) and confirm the JSON is valid and contains no `geniusType` references. Visit `/docs/api` and skim for any prose still mentioning genius types (update if so — the earlier inventory didn't flag `/docs/api`'s own page copy specifically, so re-check it here as part of this task, not a separate one).

- [ ] **Step 9: Commit**

```bash
git add "app/api/agent/search/route.ts" "app/api/agent/project/[id]/candidates/route.ts" "app/api/agent/scholar/[id]/route.ts" "app/api/agent/schema/route.ts" "app/api/agent/openapi/route.ts" "package.json"
git commit -m "Remove Genius Type from Agent API and bump version for the breaking contract change"
```

---

## Task 11: Remove Genius Type from the opportunity recommendation scorer

**Files:**
- Modify: `app/api/opportunities/recommended/route.ts`

- [ ] **Step 1: Remove the affinity table and its scoring line**

Read `app/api/opportunities/recommended/route.ts` in full (already read during plan research — the affinity bonus is a small, isolated `+2` term inside a larger scoring function). Remove `import type { OrgCategory } from "@prisma/client";`'s usage tied to genius (keep the import itself since `category` param typing still needs `OrgCategory`). Delete:

```ts
const GENIUS_AFFINITY: Record<string, OrgCategory[]> = {
  DYNAMO: ["COMPETITION", "ACCELERATOR"],
  BLAZE: ["FELLOWSHIP", "CLUB"],
  TEMPO: ["INTERNSHIP", "FELLOWSHIP"],
  STEEL: ["RESEARCH", "BOOTCAMP"],
};
```

Change:

```ts
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { grade: true, interests: true, geniusType: true, savedOpportunities: { select: { opportunityId: true } } },
  });

  const userInterests: string[] = profile?.interests ? JSON.parse(profile.interests) : [];
  const userGrade = profile?.grade;
  const geniusType = profile?.geniusType ?? null;
  const savedIds = new Set((profile?.savedOpportunities ?? []).map((s) => s.opportunityId));
```

to:

```ts
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { grade: true, interests: true, savedOpportunities: { select: { opportunityId: true } } },
  });

  const userInterests: string[] = profile?.interests ? JSON.parse(profile.interests) : [];
  const userGrade = profile?.grade;
  const savedIds = new Set((profile?.savedOpportunities ?? []).map((s) => s.opportunityId));
```

Change:

```ts
  const scored = opportunities.map((opp) => {
    let score = 0;
    if (geniusType && GENIUS_AFFINITY[geniusType]?.includes(opp.category)) score += 2;
    if (userInterests.length > 0 && opp.description) {
```

to:

```ts
  const scored = opportunities.map((opp) => {
    let score = 0;
    if (userInterests.length > 0 && opp.description) {
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in this file.

- [ ] **Step 3: Manual QA**

Visit whichever page consumes `/api/opportunities/recommended` (the org-browsing/opportunities feed) and confirm it still returns a reasonably ranked list (interest-keyword matches still drive most of the score).

- [ ] **Step 4: Commit**

```bash
git add "app/api/opportunities/recommended/route.ts"
git commit -m "Remove Genius Type affinity bonus from opportunity recommendations"
```

---

## Task 12: Remove Genius Type from workflow and tutorial-status APIs

**Files:**
- Modify: `app/api/workflow/route.ts`
- Modify: `app/api/workflow/candidates/route.ts`
- Modify: `app/api/tutorial-status/route.ts`

**Interfaces:**
- Produces: `/api/workflow/candidates` no longer sorts candidates by project-preferred genius type; `/api/tutorial-status` no longer returns `hasGeniusType` (the field was already dropped from its consumer, `TutorialWidget`, in Task 4 — this task cleans up the now-unused backing API).

- [ ] **Step 1: `app/api/workflow/route.ts`**

Read the file. Remove `geniusType`-related `select` fields and remove the `hasGeniusType` computation and its inclusion in the returned response JSON.

- [ ] **Step 2: Rewrite the candidate ordering in `app/api/workflow/candidates/route.ts`**

Replace:

```ts
  // Fetch preferred genius types from project
  let preferredTypes: string[] = [];
  try {
    preferredTypes = JSON.parse(project.preferredGeniusTypes ?? "[]");
  } catch {
    preferredTypes = [];
  }

  // Find candidates not already on the team, ordered by preferred genius type first
  const candidates = await prisma.profile.findMany({
    where: {
      id: { notIn: existingMemberIds },
      onboardingComplete: true,
    },
    take: remaining,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      displayName: true,
      headline: true,
      avatarUrl: true,
      geniusType: true,
      handle: true,
      bio: true,
      strengthSummary: true,
      interests: true,
      grade: true,
      schoolName: true,
      traitLinks: {
        take: 5,
        include: { trait: { select: { slug: true, name: true, category: true } } },
        orderBy: { order: "asc" },
      },
      // Reviews visible in algorithm view — this is the paywall mechanism
      orgReviews: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          org: { select: { name: true, logoLetter: true, logoBg: true, logoColor: true } },
          orgProject: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Sort preferred genius types to the front
  const sorted =
    preferredTypes.length > 0
      ? [
          ...candidates.filter((c) => c.geniusType && preferredTypes.includes(c.geniusType)),
          ...candidates.filter((c) => !c.geniusType || !preferredTypes.includes(c.geniusType)),
        ]
      : candidates;
```

with:

```ts
  // Find candidates not already on the team
  const sorted = await prisma.profile.findMany({
    where: {
      id: { notIn: existingMemberIds },
      onboardingComplete: true,
    },
    take: remaining,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      displayName: true,
      headline: true,
      avatarUrl: true,
      handle: true,
      bio: true,
      strengthSummary: true,
      interests: true,
      grade: true,
      schoolName: true,
      traitLinks: {
        take: 5,
        include: { trait: { select: { slug: true, name: true, category: true } } },
        orderBy: { order: "asc" },
      },
      // Reviews visible in algorithm view — this is the paywall mechanism
      orgReviews: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          org: { select: { name: true, logoLetter: true, logoBg: true, logoColor: true } },
          orgProject: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
```

The variable is renamed to `sorted` directly at the query (rather than a separate `candidates` + reorder step) so every downstream reference in the rest of the file (`sorted.length`, `sorted` in the JSON response) keeps working unchanged — confirm no other code in the file references a variable literally named `candidates` after this point (re-read the rest of the file to check).

- [ ] **Step 3: `app/api/tutorial-status/route.ts`**

Read the file. Remove `geniusType: true` from the `select`, remove the `hasGeniusType` computation, and remove `hasGeniusType` from the response JSON object.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all three files.

- [ ] **Step 5: Manual QA**

If a demo account has an active workflow session at step 3+ (team-building), open its algorithm/candidates view and confirm candidates still load with no console errors and no genius-related ordering artifacts.

- [ ] **Step 6: Commit**

```bash
git add "app/api/workflow/route.ts" "app/api/workflow/candidates/route.ts" "app/api/tutorial-status/route.ts"
git commit -m "Remove Genius Type from workflow candidate ordering and tutorial-status API"
```

---

## Task 13: Remove Genius Type from the people API passthrough

**Files:**
- Modify: `app/api/people/route.ts`

- [ ] **Step 1: Remove the field passthrough**

Read `app/api/people/route.ts` in full. Remove the `geniusType` field from the response shape it builds (a simple passthrough — confirm there's no filter or scoring logic tied to it in this file; the earlier inventory found only a mechanical field-in-response-shape usage here).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "app/api/people/route.ts"
git commit -m "Remove Genius Type field from people API response"
```

---

## Task 14: Remove Genius Type from all seed scripts

**Files:**
- Modify: `app/api/admin/seed-demo-accounts/route.ts`
- Modify: `app/api/admin/seed-ridgepoint/route.ts`
- Modify: `app/api/admin/seed-school-mock/route.ts`
- Modify: `app/api/admin/setup-profile/route.ts`
- Modify: `prisma/seed.ts`
- Modify: `prisma/seed-mock.ts`
- Modify: `prisma/seed.mjs`

**Interfaces:**
- Produces: no seed script writes `geniusType`, `secondaryGeniusType`, or `preferredGeniusTypes` to any created record. This must land BEFORE Task 15 (schema migration), since the schema still has the columns during this task and seed scripts run against the live DB — dropping the writes now is what makes it safe to drop the columns next.

- [ ] **Step 1: `app/api/admin/seed-demo-accounts/route.ts`**

Read the file in full. Remove every `geniusType: "..."` / `secondaryGeniusType: "..."` literal assigned when creating or updating demo profiles (the inventory located these at the original lines 75, 150, 302, 370, 405, 440-441 — re-locate by content since line numbers shift as you edit, don't rely on the numbers staying fixed after earlier edits in this same step). For each `prisma.profile.create`/`update` call site, delete the `geniusType:`/`secondaryGeniusType:` key-value pairs from the data object.

- [ ] **Step 2: `app/api/admin/seed-ridgepoint/route.ts`**

Read the file in full. It has ~15 hits of the same pattern — remove every `geniusType:`/`secondaryGeniusType:` key from every scholar-profile data object it constructs (5 scholars, some with a secondary type per the memory file's roster: Elena STEEL, James STEEL/BLAZE, Amara BLAZE, Noah STEEL, Maya BLAZE/STEEL).

- [ ] **Step 3: `app/api/admin/seed-school-mock/route.ts`**

Read the file. Remove the 2 `geniusType`/`secondaryGeniusType` occurrences.

- [ ] **Step 4: `app/api/admin/setup-profile/route.ts`**

Read the file. This one currently defaults `geniusType` to `"DYNAMO"` when missing (originally around lines 24, 40) — remove that default assignment entirely (delete the lines that set it), don't replace it with anything.

- [ ] **Step 5: `prisma/seed.ts`, `prisma/seed-mock.ts`, `prisma/seed.mjs`**

Read each file. Remove every `geniusType:`/`secondaryGeniusType:` key-value pair from every profile-creation object (5 hits in `seed.ts`, 9 in `seed-mock.ts`, 3 in `seed.mjs`).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors. Note `prisma/seed.mjs` is plain JS and won't be typechecked by `tsc` — visually verify it by reading the diff instead.

- [ ] **Step 7: Re-run the seed and verify**

Run: `npm run seed` (or trigger `POST /api/admin/seed-demo-accounts?secret=niv-reset-2026` against the running dev server, per this project's documented reset flow) and confirm it completes without errors against the still-unmigrated schema (columns are nullable, so simply not writing them is safe).

- [ ] **Step 8: Commit**

```bash
git add "app/api/admin/seed-demo-accounts/route.ts" "app/api/admin/seed-ridgepoint/route.ts" "app/api/admin/seed-school-mock/route.ts" "app/api/admin/setup-profile/route.ts" "prisma/seed.ts" "prisma/seed-mock.ts" "prisma/seed.mjs"
git commit -m "Remove Genius Type assignment from all seed scripts"
```

---

## Task 15: Delete the core Genius Type lib/data and orphaned type references

**Files:**
- Delete: `lib/geniusTypes.ts`
- Modify: `data/traits.ts`
- Modify: `lib/types/profile.ts`
- Modify: `lib/runArchetypeAnalysis.ts`
- Modify: `auth.config.ts`
- Modify: `types/next-auth.d.ts`

**Interfaces:**
- Consumes: nothing — by this point every file that imported from `lib/geniusTypes.ts` or used `data/traits.ts`'s genius exports has been fixed in Tasks 1-14.
- Produces: `data/traits.ts` retains only the Traits system (`TRAITS`, `TRAIT_CATEGORY_LABELS`, `TRAIT_CATEGORY_COLORS`, `TRAITS_BY_CATEGORY`, `TraitCategory`, `TraitDef`) — its `GeniusType` type, `GENIUS_TYPE_INFO`, `QuizQuestion`, and `QUIZ_QUESTIONS` exports are gone.

- [ ] **Step 1: Verify no remaining consumers before deleting**

Run a repo-wide search (excluding `.claude/worktrees`) for any remaining import of `lib/geniusTypes` or of `GENIUS_TYPE_INFO`/`GeniusType`/`QuizQuestion`/`QUIZ_QUESTIONS` from `@/data/traits`. If Tasks 1-14 were done correctly, this returns zero hits in `app/`, `components/`, `lib/` outside the files this task itself is about to touch. If any hit turns up, stop and fix that file first (it means an earlier task missed a call site).

- [ ] **Step 2: Delete `lib/geniusTypes.ts`**

Delete the file entirely (65 lines — the `GENIUS_TYPES` const and `GeniusTypeKey` type).

- [ ] **Step 3: Strip genius exports from `data/traits.ts`**

Read the current state of `data/traits.ts`. Delete `export type GeniusType = "DYNAMO" | "BLAZE" | "TEMPO" | "STEEL";` (original line 54), the entire `GENIUS_TYPE_INFO` const (original lines 56-96), the `QuizQuestion` interface and `QUIZ_QUESTIONS` array (original lines 98-185), and the section-header comment above them ("GENIUS QUIZ / 8 questions × 4 options...", original lines 47-52). Do NOT touch anything from `TRAIT_CATEGORY_LABELS`/`TRAIT_CATEGORY_COLORS` onward through the rest of the file (`TRAITS`, `TRAITS_BY_CATEGORY`) — those are the separate Traits system.

- [ ] **Step 4: `lib/types/profile.ts`**

Read the file. Remove its genius-related import (line 1) and the two `geniusType`/`secondaryGeniusType` fields on `StudentProfile` (originally lines 10-11).

- [ ] **Step 5: `lib/runArchetypeAnalysis.ts`**

Read the file. Remove the single line `- Genius Type: ${profile.geniusType ?? "Unknown"}` from the AI prompt template (originally line 53). This function otherwise belongs to the separate Animal Archetype feature — do not touch anything else in it.

- [ ] **Step 6: Clean up the orphaned `auth.config.ts` and `types/next-auth.d.ts`**

Read `auth.config.ts` in full first and confirm it is not imported anywhere (the earlier inventory found `lib/auth.ts` is the real NextAuth config in use, and `auth.config.ts` is dead code with a `session.user.geniusType` assignment at line 26 that never actually runs). Remove that line. Read `types/next-auth.d.ts` and remove the `geniusType: string | null` field from both the session and JWT type augmentations (originally lines 12 and 27) — confirm via search that nothing reads `session.user.geniusType` or `session?.user?.geniusType` anywhere in `app/`/`components/`/`lib/` before removing (the earlier inventory found zero such reads).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors anywhere in the project. This is the first point in the plan where the ENTIRE codebase should be fully clean of genius-type references at the type level.

- [ ] **Step 8: Full-repo grep verification**

Run a case-insensitive search for `genius` across `app/`, `components/`, `lib/`, `data/`, `types/`, excluding `.claude/worktrees` and the `docs/` folder (docs are historical, not required to be scrubbed). Expected: zero results. If anything turns up, fix it before proceeding — do not move on to the schema migration with live code references still present.

- [ ] **Step 9: Commit**

```bash
git add "data/traits.ts" "lib/types/profile.ts" "lib/runArchetypeAnalysis.ts" "auth.config.ts" "types/next-auth.d.ts"
git rm "lib/geniusTypes.ts"
git commit -m "Delete core Genius Type lib/data and orphaned type references"
```

---

## Task 16: Drop the Genius Type columns and enum from the database schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_remove_genius_type/migration.sql`

**Interfaces:**
- Produces: `Profile` no longer has `geniusType`/`secondaryGeniusType` columns; `OrgProject` no longer has `preferredGeniusTypes`; the `GeniusType` enum no longer exists in the database or the generated Prisma Client.

**This task must run last among the code-changing tasks** — Task 15's Step 8 grep must return zero hits before you start this one, otherwise dropping these columns will break `npx prisma generate`'s consumers immediately.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, remove these two lines from `model Profile`:

```prisma
  geniusType          GeniusType?
  secondaryGeniusType GeniusType?
```

Remove this line from `model OrgProject`:

```prisma
  preferredGeniusTypes String    @default("[]")
```

Delete the enum block entirely:

```prisma
enum GeniusType {
  DYNAMO
  BLAZE
  TEMPO
  STEEL
}
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name remove_genius_type --create-only`

This creates `prisma/migrations/<timestamp>_remove_genius_type/migration.sql` without applying it yet, following this project's existing migration folder naming convention (`YYYYMMDDHHMMSS_description/migration.sql`). Read the generated SQL to confirm it contains `ALTER TABLE "Profile" DROP COLUMN "geniusType"`, `ALTER TABLE "Profile" DROP COLUMN "secondaryGeniusType"`, `ALTER TABLE "OrgProject" DROP COLUMN "preferredGeniusTypes"`, and `DROP TYPE "GeniusType"` (exact statement order and quoting depend on Prisma's generator — verify the intent matches, don't hand-edit unless something is wrong).

- [ ] **Step 3: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev`

This applies the pending migration to the local/dev database and regenerates `@prisma/client`. If this is being run against a database that still has demo data with populated `geniusType`/`secondaryGeniusType` values, confirm the migration is a plain `DROP COLUMN` (destructive to that column's data only, not the rows) — Prisma will prompt about data loss for the dropped columns specifically; this is expected and intended here since the whole point is removing this data.

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npm run build`
Expected: succeeds. This is the definitive confirmation that no code anywhere still references the dropped Prisma fields/enum (a stale reference would now be a hard TypeScript error against the regenerated client types, not just a runtime null).

- [ ] **Step 5: Re-run the seed against the migrated schema**

Run: `npm run seed`
Expected: completes without errors (Task 14 already stopped writing to these fields, so this just re-confirms the full loop works end-to-end post-migration).

- [ ] **Step 6: Commit**

```bash
git add "prisma/schema.prisma" "prisma/migrations"
git commit -m "Drop Genius Type columns and enum from the database schema"
```

- [ ] **Step 7: Flag the production deploy step to the user**

This migration must run against the production Render Postgres database via the existing `prisma migrate deploy` step in `scripts/start.js` on the next deploy (per this project's documented deploy flow) — do not manually run `prisma migrate deploy` against production yourself as part of this plan; that happens automatically on the next `git push` to the deployed branch, which is an action to confirm with the user separately, not something to do autonomously here.

---

## Task 17: Full-app verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck, lint, and build**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npm run lint`
Expected: zero errors (warnings acceptable if pre-existing and unrelated).

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 2: Final repo-wide grep**

Search case-insensitively for `genius` across the entire repo excluding `.claude/worktrees` and `docs/`. Expected: zero hits in any `.ts`/`.tsx`/`.prisma`/`.sql`/`.css`/`.json` file.

- [ ] **Step 3: End-to-end manual QA walkthrough**

With the dev server running (`npm run dev`), using the `browse` tool (or a real browser), walk through every surface this plan touched:

1. Sign up a brand-new student account (or use a blank demo account) end-to-end: login → `/onboarding` (3 steps, no genius reveal) → `/dashboard`.
2. `/quiz` — confirm it's traits-only, complete it, confirm it saves.
3. `/dashboard` — welcome card and tutorial widget render with no genius content.
4. `/people` and `/peers` — search/filter and browse scholars, confirm no genius filters or badges anywhere.
5. `/profile/<handle>` — a public scholar profile, confirm no genius badge.
6. `/teams/<id>` — an existing team workspace, chat + members + applications tabs.
7. `/messages` and `/notifications` — peer list, thread, conversation header, recruitment notifications.
8. `/orgs/new` — create-org flow, confirm no "Preferred Genius Types" field.
9. `/orgs/<id>` and `/orgs/<id>/projects/<id>` — org detail and project detail views, confirm no genius badges/filters, and (if feasible) run "Analyze with AI" once.
10. `/docs/api` and `GET /api/agent/openapi` — confirm the public API docs and spec make no mention of genius types.
11. Sidebar account menu — check both a student account and an org account, confirm no genius badge or quiz link in either.

- [ ] **Step 4: Report to the user**

Summarize what was removed, confirm the version bump (`0.2.0` → `0.3.0`) and the production-migration deploy step (Task 16 Step 7) are the two items still needing explicit user action, and remind them the `.claude/worktrees/*` branches listed in Global Constraints still need this rebased in separately.
