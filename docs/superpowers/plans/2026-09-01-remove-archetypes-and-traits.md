# Remove Animal Archetypes and Traits/Skill-Assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully remove two features from the Nivarro app: (1) the "Animal Archetype" system (gorilla/tiger/cheetah/lion/hyena/owl/wolf/shark AI-generated personality types on profiles) and (2) the "Traits"/skill-assessment system (the `/quiz` skill quiz, the 50-trait taxonomy, Skill Cards, and peer trait endorsements) — leaving zero functional or type references anywhere in the main worktree, and the corresponding DB columns/tables dropped.

**Architecture:** Remove in dependency order, schema last, mirroring the prior `2026-08-11-remove-genius-type.md` plan's approach (already executed on this repo — `GeniusType` is fully gone). First strip every code reference to `Trait`/`ProfileTrait`/`PeerEndorsement`/`PeerEndorsedTrait`/`Profile.animalArchetypes`/`Profile.archetypeAnalysis`/`Profile.archetypeUpdatedAt` across UI, API routes, and seed scripts while the Prisma schema still has these tables/columns (so the app keeps compiling and running against the live DB at every checkpoint). Only after nothing in the codebase reads or writes them does the final schema task drop them. Discovered during investigation: the peer-endorsement feature (`PeerEndorsement`/`PeerEndorsedTrait`, `/api/endorsements`, the endorsement UI in `ProjectDetail.tsx`) exists *solely* to endorse traits on teammates — with traits gone it has no remaining purpose, so this plan removes it too rather than leaving a feature that endorses nothing. Likewise `components/profile/SkillCard.tsx` and `components/profile/TraitBadge.tsx` have exactly one caller each (`ProjectDetail.tsx`), both trait-only in purpose, and are deleted rather than kept as empty shells. Also discovered: `app/(dashboard)/people/SmartSearch.tsx`, `app/(dashboard)/people/PeopleSearch.tsx`, and `app/api/search/route.ts` are dead code — `/people` (`app/(dashboard)/people/page.tsx`) unconditionally redirects to `/peers` and nothing else imports these three files or calls this route — so rather than mechanically stripping trait references from unreachable code, this plan deletes them.

**Tech Stack:** Next.js 15/16 App Router, TypeScript, Prisma 7.8.0 / PostgreSQL, NextAuth v5, React 19. No test framework is configured (no jest/vitest/playwright in `package.json`) — verification is `npx tsc --noEmit`, `npm run lint`, `npm run build`, and manual QA against the dev server (this project's own convention).

**Spec:** No separate design doc — scope and constraints were confirmed directly with the user in chat on 2026-09-01 (remove both systems fully; agent API: remove the term/field, do not invent a replacement signal, let the contract change be a breaking version bump like the prior genius-type removal).

## Global Constraints

- **Scope:** `C:\Users\thoma\Goal-APP` main worktree ONLY. Do not touch anything under `C:\Users\thoma\Goal-APP\.claude\worktrees\*` — those are separate in-progress branches that each carry their own copy of these files. **After this plan lands on main, each of those worktrees will need this change rebased/merged in separately — flag this to the user, do not attempt it as part of this plan.**
- **Genius Type is already removed** (separate, completed 2026-08-11 plan) — this plan is orthogonal to it. Do not re-touch anything already cleaned of `geniusType`.
- **Verification gate:** every task ends with `npx tsc --noEmit` returning zero errors before you commit. Tasks 1-11 must ALSO leave `npm run build` succeeding against the *current* (unmigrated) schema — do not drop schema tables/columns before Task 12.
- **Commit per task**, using `git add <specific files>` (never `-A`), with a message describing what was removed.
- **Public API contract:** `app/api/agent/openapi/route.ts` is served publicly at `/api/agent/openapi` and documented at `/docs/api` for third-party AI agent consumers. Removing the `traitLinks` field from the Scholar schema/response is a breaking change to that contract even though traits were never part of the agent API's *scoring* (verified during investigation — `traitLinks` is fetched and returned as display data only in `app/api/agent/search/route.ts` and `app/api/agent/project/[id]/candidates/route.ts`, never scored). Task 9 must update the OpenAPI spec and the `/docs/api` page copy together, and bump `package.json`'s `version` field (currently `0.3.0` — bump to `0.4.0`) to signal the break.
- **No score redistribution:** for `app/api/search/route.ts` (deleted as dead code in Task 4, so moot there) — no other live route currently scores on trait-match, confirmed by reading `app/api/agent/search/route.ts` and `app/api/agent/project/[id]/candidates/route.ts` in full: both score only on org-review count, keyword/skill overlap, and profile completeness. Do not add a replacement scoring term for the removed `traitLinks` field anywhere.
- **PeerEndorsement/PeerEndorsedTrait removal is a schema-level deletion**, not a soft-disable. Confirmed via repo-wide search that `PeerEndorsement.completedAt` and every other field on both models exist only to support trait endorsement — there is no non-trait use to preserve.

---

## Task 1: Delete the Traits skill-assessment quiz flow entirely

**Files:**
- Delete: `app/(dashboard)/quiz/page.tsx`
- Delete: `app/(dashboard)/quiz/TraitQuizClient.tsx`
- Delete: `app/api/quiz/traits/route.ts`
- Delete: `app/api/quiz/traits/apply/route.ts`
- Delete: `data/traitQuiz.ts`

**Interfaces:**
- Produces: `/quiz` no longer exists as a route (the whole page was the traits quiz — confirmed by reading `app/(dashboard)/quiz/page.tsx` in full, it renders nothing but `TraitQuizClient`). Any link to `/quiz` elsewhere in the app becomes a 404 until fixed in later tasks (Tasks 5 and 7 remove those links).
- Consumes: nothing — this is the top of the dependency graph for the Traits system.

- [ ] **Step 1: Delete the quiz page and its client component**

Delete `app/(dashboard)/quiz/page.tsx` (63 lines) and `app/(dashboard)/quiz/TraitQuizClient.tsx` (356 lines) entirely. Confirm via `git status` that the now-empty `app/(dashboard)/quiz/` directory has no other files before leaving it (if any other file remains there, stop and investigate — the inventory found none).

- [ ] **Step 2: Delete the trait-quiz API routes**

Delete `app/api/quiz/traits/route.ts` (140 lines — scores quiz answers, calls Claude to pick 5 traits) and `app/api/quiz/traits/apply/route.ts` (52 lines — writes the chosen `ProfileTrait` rows) entirely.

- [ ] **Step 3: Delete the quiz question bank**

Delete `data/traitQuiz.ts` (402 lines, `TRAIT_QUIZ_QUESTIONS`) entirely — its only consumer was `app/api/quiz/traits/route.ts`, just deleted.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: **zero errors.** Next.js page/route files are entry points, not imported by other modules, and `TraitQuizClient.tsx`/`data/traitQuiz.ts` were only ever consumed by the files deleted in this same task — so this deletion is self-contained and should not produce any typecheck fallout elsewhere. (Other files — `TutorialWidget.tsx`, `DashboardClient.tsx`, `ProfileEditor.tsx`, etc. — still link to or reference traits, but only as string hrefs or separate imports from `data/traits.ts`, neither of which this task touches; they're cleaned up in their own later tasks, not as a side effect of this one.) If you see any error here, stop and investigate before proceeding — it means something imports one of the deleted files that this plan's research missed.

- [ ] **Step 5: Commit**

```bash
git rm "app/(dashboard)/quiz/page.tsx" "app/(dashboard)/quiz/TraitQuizClient.tsx" "app/api/quiz/traits/route.ts" "app/api/quiz/traits/apply/route.ts" "data/traitQuiz.ts"
git commit -m "Delete the Traits skill-assessment quiz flow (/quiz, trait-quiz API routes, question bank)"
```

---

## Task 2: Remove the Animal Archetype feature from profile pages and lib

**Files:**
- Delete: `lib/animalArchetypes.ts`
- Delete: `lib/runArchetypeAnalysis.ts`
- Delete: `components/AnimalArchetypeCard.tsx`
- Delete: `app/api/profile/[handle]/analyze-archetype/route.ts`
- Modify: `app/(dashboard)/profile/[handle]/ProfileClient.tsx`
- Modify: `app/(dashboard)/profile/[handle]/page.tsx`

**Interfaces:**
- Produces: public profile pages no longer render an "Animal Archetypes" section, no longer offer an "Analyze now" action, and no longer select/pass `animalArchetypes`/`archetypeAnalysis`/`archetypeUpdatedAt`.
- Consumes: nothing new. This task does not touch the `Profile.animalArchetypes`/`archetypeAnalysis`/`archetypeUpdatedAt` schema columns — those are dropped in Task 12.

- [ ] **Step 1: Delete the Animal Archetype lib/data/component/route**

Delete `lib/animalArchetypes.ts` (117 lines — the 8-animal data table), `lib/runArchetypeAnalysis.ts` (109 lines — calls Claude to assign 2-3 archetypes from org reviews), `components/AnimalArchetypeCard.tsx` (435 lines — the pixel-art sprite cards), and `app/api/profile/[handle]/analyze-archetype/route.ts` (52 lines — the "Analyze now" endpoint) entirely.

- [ ] **Step 2: Strip the Animal Archetypes section from `ProfileClient.tsx`**

Read `app/(dashboard)/profile/[handle]/ProfileClient.tsx` in full (502 lines). Remove `import AnimalArchetypeCard from "@/components/AnimalArchetypeCard";` and `import type { AnimalKey } from "@/lib/animalArchetypes";`. Remove `animalArchetypes: string;`, `archetypeAnalysis: string | null;`, and `archetypeUpdatedAt: string | null;` from whatever local profile-shape interface carries them. Remove the `analyzingArchetype`/`archetypeError`/`archetypes`/`archetypeAnalysis` state (the four `useState` calls that parse `profile.animalArchetypes` and seed from `profile.archetypeAnalysis`) and the `analyzeArchetype` async function that calls `/api/profile/${profile.handle}/analyze-archetype`. Delete the entire "Animal Archetypes" rendered section — the `{(archetypes.length > 0 || isOwn) && ( ... )}` block, including its "Analyze now"/"Re-analyze" button, the `archetypeError` message, the `<AnimalArchetypeCard>` grid, the analysis text paragraph, and the empty-state copy ("Your animal archetypes haven't been discovered yet…", including its reference to the org-review unlock threshold). Also check the reviews section's closing copy line ("Once you have 3, your animal archetypes are automatically assigned.") and simplify it to describe only that reviews are visible to the profile owner, since the archetype-unlock mechanic it describes no longer exists.

- [ ] **Step 3: Fix `page.tsx`'s data fetch**

Read `app/(dashboard)/profile/[handle]/page.tsx` in full. Remove `animalArchetypes: true`, `archetypeAnalysis: true`, and `archetypeUpdatedAt: true` from both `select` blocks that include them (the main profile fetch and the `myProfile` fetch — confirmed at two call sites during investigation). Remove the `archetypeUpdatedAt: profile.archetypeUpdatedAt?.toISOString() ?? null` and the equivalent `myProfile` passthrough line, along with whatever prop object property they feed into `<ProfileClient ... />`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in `ProfileClient.tsx` and `page.tsx`. No errors anywhere else should reference the four deleted files — confirm with a repo-wide search for `animalArchetypes\|AnimalArchetype\|runArchetypeAnalysis\|archetypeAnalysis\|archetypeUpdatedAt` (excluding `.claude/worktrees` and `prisma/schema.prisma`, which still has the columns until Task 12) returning zero hits in `app/`, `components/`, `lib/`.

- [ ] **Step 5: Manual QA**

With the dev server running, visit a demo scholar's public profile that previously had archetypes assigned (e.g. `thomas@piacentine.dev` or `diego.ramirez@nivarro.demo`, per the seed data) and confirm no "Animal Archetypes" section, no "Analyze" button, and no console errors. Visit your own profile and confirm the same.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/profile/[handle]/ProfileClient.tsx" "app/(dashboard)/profile/[handle]/page.tsx"
git rm "lib/animalArchetypes.ts" "lib/runArchetypeAnalysis.ts" "components/AnimalArchetypeCard.tsx" "app/api/profile/[handle]/analyze-archetype/route.ts"
git commit -m "Remove the Animal Archetype feature from profile pages"
```

---

## Task 3: Remove peer trait-endorsement (fully trait-dependent) and replace Skill Cards with a plain member card

**Files:**
- Delete: `app/api/endorsements/route.ts`
- Delete: `components/profile/SkillCard.tsx`
- Delete: `components/profile/TraitBadge.tsx`
- Modify: `app/(dashboard)/projects/[id]/ProjectDetail.tsx`
- Modify: `app/(dashboard)/projects/[id]/page.tsx`

**Interfaces:**
- Produces: the project workspace still shows a "Team Members" grid (avatar, name, headline, strength summary, "View" link) — it just no longer shows traits, peer-endorsed traits, an "Endorse" button, or the endorsement modal. `ProjectDetail` no longer accepts `peerTraitsByUser`, `pendingEndorsees`, or `allTraits` props.
- Consumes: nothing new.

- [ ] **Step 1: Delete the endorsements API route**

Delete `app/api/endorsements/route.ts` (126 lines — GET pending endorsements, POST submit endorsement) entirely. Its only caller was `ProjectDetail.tsx`, fixed below.

- [ ] **Step 2: Rewrite `ProjectDetail.tsx` to drop endorsements and replace `SkillCard` with an inline member card**

Read `app/(dashboard)/projects/[id]/ProjectDetail.tsx` in full (382 lines) before editing — the exact boundaries below were confirmed against the current file.

Replace the top of the file (imports through the `Props` interface and component signature):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getInitials } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    profile: {
      displayName: string;
      headline: string | null;
      avatarUrl: string | null;
      strengthSummary: string | null;
    } | null;
  };
}

interface Props {
  project: {
    id: string;
    name: string;
    goal: string | null;
    description: string | null;
    status: string;
    members: Member[];
  };
  isOwner: boolean;
  currentUserId: string;
}

export default function ProjectDetail({
  project,
  isOwner,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { userId: string; displayName: string; headline: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);

  const otherMembers = project.members.filter(
    (m) => m.userId !== currentUserId
  );

  async function markComplete() {
    if (!confirm("Mark this project as complete?")) return;
    setCompleting(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    setCompleting(false);
    router.refresh();
  }

  async function searchPeople(q: string) {
    setAddMemberQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/people?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearching(false);
    // Filter out existing members
    const existingIds = new Set(project.members.map((m) => m.userId));
    setSearchResults(
      (data.profiles ?? []).filter(
        (p: { userId: string }) => !existingIds.has(p.userId)
      )
    );
  }

  async function addMember(userId: string) {
    await fetch(`/api/projects/${project.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setAddMemberQuery("");
    setSearchResults([]);
    router.refresh();
  }

  const isCompleted = project.status === "COMPLETED";
```

This removes the `Trait`/`PeerTrait` interfaces, `SkillCard`/`TraitCategory` imports, the `endorseFor`/`selectedTraits`/`submitting` state, `toggleTrait`, and `submitEndorsement` — none of these exist anymore since the endorsement feature is gone. `markComplete`'s confirm-dialog copy drops its "This will trigger the peer endorsement flow" clause since that flow no longer exists. `UserPlus`, `CheckCircle2`, and `X` are dropped from the `lucide-react` import since they were only used by the deleted endorsement prompt, button, and modal (confirm no other use of these three icons elsewhere in the file before removing — the inventory found none). `getInitials` is added from `@/lib/utils` for the new inline avatar fallback (Step 3 below) — confirm this export exists there (it's already used the same way in `components/profile/SkillCard.tsx`, being deleted in Step 4, so the import path and usage pattern are proven).

Leave everything from the `return (` statement through the `{/* Project header */}` block (project name/status/goal/description, the "Mark Complete" button) unchanged — none of it references traits or endorsements.

- [ ] **Step 3: Delete the endorsement prompt block, replace the Skill Card grid with a plain member card, and delete the endorsement modal**

Immediately after the project header's closing `</div>`, delete the entire "Endorsement prompt (completed projects only)" block:

```tsx
      {/* Endorsement prompt (completed projects only) */}
      {isCompleted && pendingEndorsees.length > 0 && (
        <div className="bg-[#4ADE8010] border border-[#4ADE8030] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#4ADE80] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-[#eaeaea] mb-1">
                Project complete — endorse your teammates
              </div>
              <p className="text-xs text-[#909098]">
                Select up to 5 traits that each teammate genuinely displayed during
                this project. Your endorsements appear on their Skill Cards.
              </p>
            </div>
          </div>
        </div>
      )}
```

In the "Member Skill Cards" section, rename the heading comment to "Member cards" and replace the entire `project.members.map((member) => { ... })` body with a version that drops `peerTraits`/`isPending`/the "Endorse" button and renders a self-contained member card instead of `<SkillCard>`:

```tsx
      {/* Member cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#eaeaea] uppercase tracking-wider">
            Team Members ({otherMembers.length + 1})
          </h2>
          {isOwner && !isCompleted && (
            <div className="relative">
              <input
                value={addMemberQuery}
                onChange={(e) => searchPeople(e.target.value)}
                placeholder="Add member..."
                className="text-sm py-1.5 px-3 pr-8 w-48"
              />
              {searching && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#58586a] animate-spin" />
              )}
              {searchResults.length > 0 && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-[#131315] border border-[#1c1c20] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-20 py-1">
                  {searchResults.map((p) => (
                    <button
                      key={p.userId}
                      onClick={() => addMember(p.userId)}
                      className="w-full text-left px-3 py-2.5 hover:bg-[#1c1c20] transition-colors"
                    >
                      <div className="text-sm text-[#eaeaea]">{p.displayName}</div>
                      {p.headline && (
                        <div className="text-xs text-[#58586a] truncate">
                          {p.headline}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {project.members.map((member) => {
            const profile = member.user.profile;
            if (!profile) return null;

            return (
              <div
                key={member.id}
                className="bg-[#0d0d0e] border border-[#1c1c20] rounded-[10px] p-5 flex flex-col gap-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatarUrl}
                        alt={profile.displayName}
                        className="w-12 h-12 rounded-full object-cover"
                        style={{ boxShadow: "0 0 0 1px rgba(74,128,240,0.19)" }}
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{
                          background: "rgba(74,128,240,0.13)",
                          color: "var(--accent)",
                          boxShadow: "0 0 0 1px rgba(74,128,240,0.19)",
                        }}
                      >
                        {getInitials(profile.displayName)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[#eaeaea] text-sm truncate">
                      {profile.displayName}
                    </h3>
                    {profile.headline && (
                      <p className="text-xs text-[#909098] truncate mt-0.5">
                        {profile.headline}
                      </p>
                    )}
                  </div>
                </div>

                {profile.strengthSummary && (
                  <p className="text-xs text-[#909098] leading-relaxed line-clamp-3 border-t border-[#1c1c20] pt-3">
                    {profile.strengthSummary}
                  </p>
                )}

                <Link
                  href={`/people/${member.userId}`}
                  className="text-center text-xs font-medium text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md py-1.5 transition-colors mt-auto"
                >
                  View
                </Link>
              </div>
            );
          })}
        </div>
      </div>
```

Immediately after this section's closing `</div>`, delete the entire "Endorsement modal" block (`{endorseFor && ( ... )}`, running through its final closing `)}` — the modal with "Endorse traits" heading, trait chip grid, and "Submit endorsement" button).

- [ ] **Step 4: Delete the now-orphaned `SkillCard.tsx` and `TraitBadge.tsx`**

Confirm via repo-wide search (excluding `.claude/worktrees`) that no file still imports `@/components/profile/SkillCard` or `@/components/profile/TraitBadge` after Step 2-3's edit — both had exactly one caller (`ProjectDetail.tsx`, just rewritten). Then delete `components/profile/SkillCard.tsx` (167 lines) and `components/profile/TraitBadge.tsx` (35 lines) entirely.

- [ ] **Step 5: Fix `app/(dashboard)/projects/[id]/page.tsx`**

Read the file in full (101 lines). Replace it with:

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProjectDetail from "./ProjectDetail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const isMember = project.members.some((m) => m.userId === userId);
  if (!isMember) notFound();

  const isOwner = project.members.some(
    (m) => m.userId === userId && m.role === "OWNER"
  );

  return (
    <ProjectDetail
      project={project}
      isOwner={isOwner}
      currentUserId={userId}
    />
  );
}
```

This drops the `traitLinks` include, the `peerEndorsement` fetches (`endorsements`, `myEndorsements`), the `peerTraitsByUser` map-building loop, `pendingEndorsees`, and `allTraits` — none of these exist anymore since Steps 1-4 removed every consumer.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in `ProjectDetail.tsx` and its `page.tsx`. Errors may remain elsewhere for files not yet touched by this plan (Tasks 5-11) — confirm any remaining errors are confined to those.

- [ ] **Step 7: Manual QA**

With the dev server running, open an existing demo team project's workspace page (`/projects/<id>`). Confirm: the project header, "Mark Complete" button (if owner and active), and member grid all render; each member card shows avatar/initials, name, headline, and strength summary with no trait badges; the "Add member" search still works for the owner; no "Endorse" button or endorsement modal appears anywhere, even on a completed project.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/projects/[id]/ProjectDetail.tsx" "app/(dashboard)/projects/[id]/page.tsx"
git rm "app/api/endorsements/route.ts" "components/profile/SkillCard.tsx" "components/profile/TraitBadge.tsx"
git commit -m "Remove peer trait-endorsement feature; replace Skill Cards with a plain member card"
```

---

## Task 4: Delete the dead orphaned people-search chain

**Files:**
- Delete: `app/(dashboard)/people/SmartSearch.tsx`
- Delete: `app/(dashboard)/people/PeopleSearch.tsx`
- Delete: `app/api/search/route.ts`

**Interfaces:**
- Produces: nothing changes at runtime — these three files have zero live callers today.

- [ ] **Step 1: Confirm these files are genuinely unreachable before deleting**

Run a repo-wide search (excluding `.claude/worktrees`) for `SmartSearch`, `PeopleSearch`, and a literal `/api/search` (not `/api/search/` prefix matches like `/api/searches`) fetch call. Expected: `SmartSearch` and `PeopleSearch` each appear only in their own file plus historical `docs/` plans; `/api/search` appears only inside `app/(dashboard)/people/SmartSearch.tsx` itself. Also confirm `app/(dashboard)/people/page.tsx` is a one-line unconditional `redirect("/peers")` with no import of either component (already verified during investigation — re-verify since this is a destructive step). If anything contradicts this, stop and investigate rather than deleting.

- [ ] **Step 2: Delete the three files**

Delete `app/(dashboard)/people/SmartSearch.tsx`, `app/(dashboard)/people/PeopleSearch.tsx`, and `app/api/search/route.ts` entirely.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero new errors (this code was unreachable, so nothing should regress).

- [ ] **Step 4: Commit**

```bash
git rm "app/(dashboard)/people/SmartSearch.tsx" "app/(dashboard)/people/PeopleSearch.tsx" "app/api/search/route.ts"
git commit -m "Delete dead orphaned people-search components and API route"
```

---

## Task 5: Remove traits from the own-profile editor and profile API

**Files:**
- Modify: `app/(dashboard)/profile/ProfileEditor.tsx`
- Modify: `app/(dashboard)/profile/page.tsx`
- Modify: `app/api/profile/route.ts`

**Interfaces:**
- Produces: the profile edit page no longer shows a trait picker; the profile PATCH endpoint no longer accepts or writes `traitIds`.

- [ ] **Step 1: Strip the trait picker from `ProfileEditor.tsx`**

Read `app/(dashboard)/profile/ProfileEditor.tsx` in full (307 lines). Remove `import TraitBadge from "@/components/profile/TraitBadge";`, the `TRAIT_CATEGORY_LABELS`/`TRAITS_BY_CATEGORY` import and `import type { TraitCategory } from "@/data/traits";` from `@/data/traits`. Remove the local `Trait` interface, `traitIds` from whatever `initialProfile` prop type carries it, and the `allTraits: Trait[]` prop. Remove the `selectedTraitIds` state, `traitById`, `categories`, and `toggleTrait`. Remove `traitIds: selectedTraitIds` from the submit body. Delete the entire "Traits selector" section (the `{/* Traits selector */}` block: the `MAX_TRAITS` counter header, the selected-trait-chips row, and the "Trait grid by category" block that maps `categories`/`TRAITS_BY_CATEGORY`/`allTraits`). Confirm no other prop or state in the file still references `allTraits`/`selectedTraitIds`/`MAX_TRAITS` before finishing (re-read the file after edits).

- [ ] **Step 2: Fix `app/(dashboard)/profile/page.tsx`**

Read the file in full. Remove the `traitLinks` include/select and the `prisma.trait.findMany(...)` call feeding `allTraits`. Remove `traitIds: profile.traitLinks.map((l) => l.traitId)` from whatever object is passed as `initialProfile`, and remove the `allTraits={allTraits}` prop passed to `<ProfileEditor ... />` (that prop no longer exists on the component as of Step 1).

- [ ] **Step 3: Fix `api/profile/route.ts`**

Read the file in full. Remove `traitIds: z.array(z.string()).max(5),` from the zod schema. Remove `traitIds` from the destructure of the parsed body. Remove the "Replace trait links" block (`await prisma.profileTrait.deleteMany(...)` followed by the conditional `prisma.profileTrait.createMany(...)`). Remove the `traitLinks` include/select from whatever query builds the response returned to the client.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all three files.

- [ ] **Step 5: Manual QA**

With the dev server running, visit `/profile` (your own profile edit page) and confirm no trait picker appears anywhere, and saving the form (display name / headline / bio changes) still works.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/profile/ProfileEditor.tsx" "app/(dashboard)/profile/page.tsx" "app/api/profile/route.ts"
git commit -m "Remove Traits picker from the profile editor and profile API"
```

---

## Task 6: Remove traits from /api/people, /api/projects, /api/projects/[id], and the people/[userId] page

**Files:**
- Modify: `app/api/people/route.ts`
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/projects/[id]/route.ts`
- Modify: `app/(dashboard)/people/[userId]/page.tsx`

**Interfaces:**
- Produces: `/api/people` no longer supports a `category` (trait-category) filter or returns `selfTraits`; `/api/projects` and `/api/projects/[id]` no longer select `traitLinks`; a scholar's public-facing people/[userId] page no longer renders a "Traits" section.

- [ ] **Step 1: Rewrite `app/api/people/route.ts`**

Replace the full contents with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  const profiles = await prisma.profile.findMany({
    where: {
      userId: { not: session.user.id },
      ...(q
        ? {
            OR: [
              { displayName: { contains: q } },
              { headline: { contains: q } },
              { strengthSummary: { contains: q } },
            ],
          }
        : {}),
    },
    take: 50,
  });

  const formatted = profiles.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    headline: p.headline,
    avatarUrl: p.avatarUrl,
    strengthSummary: p.strengthSummary,
  }));

  return NextResponse.json({ profiles: formatted });
}
```

This drops the `category` query param and its `traitLinks` filter, the `traitLinks` include, and `selfTraits` from the response shape — this route's only remaining live caller (`ProjectDetail.tsx`'s "Add member" search, per Task 3) only ever reads `userId`/`displayName`/`headline` from the response.

- [ ] **Step 2: `app/api/projects/route.ts`**

Read the file. Remove `traitLinks: { ..., include: { trait: true } }` from whatever `select`/`include` block includes it (confirmed present at one call site during investigation).

- [ ] **Step 3: `app/api/projects/[id]/route.ts`**

Read the file. Remove the equivalent `traitLinks: { ..., include: { trait: true } }` block (confirmed present at one call site during investigation).

- [ ] **Step 4: `app/(dashboard)/people/[userId]/page.tsx`**

Read the file in full. Remove `import TraitBadge from "@/components/profile/TraitBadge";` and `import type { TraitCategory } from "@/data/traits";` (both are now dangling imports of deleted files/exports — `TraitBadge` was deleted in Task 3). Remove the `traitLinks` include/select from the profile fetch. Delete the "Traits" rendered section (`{/* Traits */}` block: the `profile.traitLinks.length > 0 &&` conditional, the "Traits" heading, and the `.map` that renders `<TraitBadge>` for each link).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all four files.

- [ ] **Step 6: Manual QA**

With the dev server running: from within a project workspace, use "Add member" search and confirm it still finds and adds a real demo user. Visit `/people/<userId>` for a demo scholar and confirm the page renders with no "Traits" section and no console errors.

- [ ] **Step 7: Commit**

```bash
git add "app/api/people/route.ts" "app/api/projects/route.ts" "app/api/projects/[id]/route.ts" "app/(dashboard)/people/[userId]/page.tsx"
git commit -m "Remove Traits from people/projects APIs and the people/[userId] page"
```

---

## Task 7: Remove traits from workflow + tutorial-status APIs; simplify TutorialWidget and DashboardClient

**Files:**
- Modify: `app/api/workflow/route.ts`
- Modify: `app/api/workflow/candidates/route.ts`
- Modify: `app/api/tutorial-status/route.ts`
- Modify: `components/ui/TutorialWidget.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/dashboard/DashboardClient.tsx`

**Interfaces:**
- Produces: `/api/workflow` no longer computes/returns `traitsDone`; `/api/workflow/candidates` no longer selects `traitLinks` (display-only field, never scored — confirmed during investigation); `/api/tutorial-status` no longer returns `traitsDone`; the "Get started on Nivarro" tutorial checklist drops its "Add your traits" step, going from 3 steps to 2 (`Browse organizations`, `Apply to an org project`); the dashboard no longer shows the orange "complete your traits" nudge banner linking to the now-deleted `/quiz`.

- [ ] **Step 1: `app/api/workflow/route.ts`**

Read the file. Remove `_count: { select: { traitLinks: true } },` from the profile `select`, and remove the `const traitsDone = (profile._count?.traitLinks ?? 0) > 0;` line and `traitsDone` from the returned JSON (`return NextResponse.json({ session: workflowSession, traitsDone });` becomes `return NextResponse.json({ session: workflowSession });`).

- [ ] **Step 2: `app/api/workflow/candidates/route.ts`**

Read the file. Remove the `traitLinks: { take: 5, include: { trait: { select: { slug: true, name: true, category: true } } }, orderBy: { order: "asc" } },` block from the `select` in the candidates query.

- [ ] **Step 3: `app/api/tutorial-status/route.ts`**

Replace the full contents with:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      teamMemberships: { select: { id: true }, take: 1 },
    },
  });

  const hasTeam = (profile?.teamMemberships?.length ?? 0) > 0;

  const hasApplied = hasTeam && profile?.id
    ? (await prisma.teamApplication.count({
        where: { team: { members: { some: { profileId: profile.id } } } },
      })) > 0
    : false;

  return NextResponse.json({
    hasTeam,
    hasApplied,
    hasBrowsedOrgs: hasTeam || hasApplied,
  });
}
```

This drops `traitLinks`/`traitsDone` entirely from the response.

- [ ] **Step 4: Simplify `TutorialWidget.tsx` to 2 steps**

Read `components/ui/TutorialWidget.tsx` in full (233 lines). Remove `traitsDone: boolean;` from the `TutorialState` interface. Update the destructure `const { traitsDone, hasApplied, hasBrowsedOrgs } = state;` to `const { hasApplied, hasBrowsedOrgs } = state;`. Delete the first entry of the `steps` array (the "Add your traits" step, `done: traitsDone`, linking to `/quiz`), leaving 2 steps: "Browse organizations" (`done: hasBrowsedOrgs`) and "Apply to an org project" (`done: hasApplied`). In the remaining "Browse organizations" step's `guide` copy, change `"Look at what traits and skills they're seeking — compare with your own profile."` to `"Look at what skills they're seeking — compare with your own profile."`.

- [ ] **Step 5: Fix `dashboard/page.tsx`**

Read the file. Remove `traitLinks: { select: { id: true } },` from the profile `select`. Remove `const traitsDone = (profile?.traitLinks?.length ?? 0) > 0;`. Remove `traitsDone` from both places it's currently passed: the standalone `traitsDone={traitsDone}` prop on `<DashboardClient ... />`, and `traitsDone,` inside the `tutorial={{ ... }}` object (which becomes `tutorial={{ hasTeam, hasApplied, hasBrowsedOrgs: hasTeam || hasApplied }}`).

- [ ] **Step 6: Fix `DashboardClient.tsx`**

Read the file. Remove `traitsDone: boolean;` from both the `TutorialData` interface and the component's own prop-destructure type (`{ profile, spaces, traitsDone, tutorialDismissed, tutorial }: { profile: ProfileData; spaces: SpaceRow[]; traitsDone: boolean; tutorialDismissed?: boolean; tutorial: TutorialData; }` loses `traitsDone` from both the destructure and the type). Remove `traitsDone` from the component signature entirely. Delete the `{!traitsDone && ( <Link href="/quiz" ... > ... </Link> )}` banner block that follows `<TutorialWidget {...tutorial} serverDismissed={tutorialDismissed} />` — read enough further context around that block first to confirm its exact closing tag before deleting, since only its opening lines were inspected during investigation.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all six files.

- [ ] **Step 8: Manual QA**

With the dev server running, log in as a demo student with an incomplete tutorial checklist and confirm: the "Get started on Nivarro" widget shows exactly 2 steps ("Browse organizations", "Apply to an org project"), no orange banner linking to `/quiz` appears on the dashboard, and the widget's progress bar/counts reflect 2 total steps correctly.

- [ ] **Step 9: Commit**

```bash
git add "app/api/workflow/route.ts" "app/api/workflow/candidates/route.ts" "app/api/tutorial-status/route.ts" "components/ui/TutorialWidget.tsx" "app/(dashboard)/dashboard/page.tsx" "app/(dashboard)/dashboard/DashboardClient.tsx"
git commit -m "Remove Traits from workflow/tutorial-status APIs; simplify tutorial checklist to 2 steps"
```

---

## Task 8: Remove traits from the org-projects scholars route

**Files:**
- Modify: `app/api/org-projects/[id]/scholars/route.ts`

**Interfaces:**
- Produces: this org-side scholar-browse endpoint no longer supports a `?trait=` filter or returns trait data.

- [ ] **Step 1: Rewrite the route**

Replace the full contents with:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const where: Prisma.ProfileWhereInput = { onboardingComplete: true };

  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { headline: { contains: q, mode: "insensitive" } },
    ];
  }

  const scholars = await prisma.profile.findMany({
    where,
    take: 20,
    select: {
      id: true,
      displayName: true,
      headline: true,
      avatarUrl: true,
      handle: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ scholars });
}
```

This drops the `?trait=` query param, the `where.traitLinks` filter, and the `traitLinks` select.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in this file.

- [ ] **Step 3: Manual QA**

Whatever org-side UI calls this endpoint (an org scholar-browse widget), confirm it still returns results for a keyword search with no trait filter UI attached.

- [ ] **Step 4: Commit**

```bash
git add "app/api/org-projects/[id]/scholars/route.ts"
git commit -m "Remove Traits filter from the org-projects scholars route"
```

---

## Task 9: Remove Traits from the Agent API (public contract — breaking change)

**Files:**
- Modify: `app/api/agent/search/route.ts`
- Modify: `app/api/agent/project/[id]/candidates/route.ts`
- Modify: `app/api/agent/scholar/[id]/route.ts`
- Modify: `app/api/agent/openapi/route.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `/api/agent/search`, `/api/agent/project/[id]/candidates`, and `/api/agent/scholar/[id]` no longer return `traitLinks` on any Scholar object. The public OpenAPI spec at `/api/agent/openapi` drops the `TraitLink` schema and the `traitLinks` property from `Scholar`. This is a breaking change to a contract third-party AI agents consume — bump the app version. Scoring itself is unaffected (confirmed: `traitLinks` was never a scoring input in these three routes, only a returned display field), so no scoring-ceiling change is needed here (unlike the prior genius-type removal, which did remove a scoring term).

- [ ] **Step 1: `app/api/agent/search/route.ts`**

Read the file (already read in full during plan research). Remove `traitLinks: { trait: { slug: string; name: string; category: string }; order: number; }[];` from the `ScholarRaw` type. Remove the `traitLinks: { take: 5, include: { trait: { select: { slug: true, name: true, category: true } } }, orderBy: { order: "asc" } },` block from the `select` in the `prisma.profile.findMany` call. `scoreScholar` itself already doesn't reference `traitLinks` — no change needed there.

- [ ] **Step 2: `app/api/agent/project/[id]/candidates/route.ts`**

Read the file (already read in full during plan research). Apply the identical removal: drop `traitLinks` from the `ScholarRaw` type and from the `select` block. `scoreCandidate` already doesn't reference `traitLinks` — no change needed there.

- [ ] **Step 3: `app/api/agent/scholar/[id]/route.ts`**

Read the file (already read in full during plan research). Remove the `traitLinks: { include: { trait: { select: { slug: true, name: true, category: true } } }, orderBy: { order: "asc" } },` block from the `select`.

- [ ] **Step 4: Update the public OpenAPI spec — `app/api/agent/openapi/route.ts`**

Read the file (already read in full during plan research). Delete the entire `TraitLink` schema definition (the `TraitLink: { type: "object", properties: { trait: { ... } }, required: ["trait"] }` block under `components.schemas`). Remove the `traitLinks` property from the `Scholar` schema's `properties` (the block with `type: "array", items: { $ref: "#/components/schemas/TraitLink" }, description: "Top traits linked to this scholar's profile"`), and remove `"traitLinks"` from `Scholar`'s `required` array (it currently reads `required: ["id", "displayName", "handle", "traitLinks", "orgReviews"]` — becomes `required: ["id", "displayName", "handle", "orgReviews"]`). The `getScholar` endpoint's description ("Returns the full profile for a specific scholar, including all org reviews and trait links.") loses its "and trait links" clause.

- [ ] **Step 5: Bump the app version**

In `package.json`, change `"version": "0.3.0"` to `"version": "0.4.0"` to signal the breaking change to the public agent API contract.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all four route files.

- [ ] **Step 7: Manual QA**

With the dev server running, fetch `/api/agent/openapi` directly and confirm the JSON is valid and contains no `traitLinks`/`TraitLink` references. Visit `/docs/api` and skim for any prose still mentioning traits (update if so).

- [ ] **Step 8: Commit**

```bash
git add "app/api/agent/search/route.ts" "app/api/agent/project/[id]/candidates/route.ts" "app/api/agent/scholar/[id]/route.ts" "app/api/agent/openapi/route.ts" "package.json"
git commit -m "Remove Traits from Agent API responses and bump version for the breaking contract change"
```

---

## Task 10: Remove trait/archetype seeding from seed scripts

**Files:**
- Modify: `app/api/admin/seed-demo-accounts/route.ts`
- Modify: `prisma/seed.ts`
- Modify: `prisma/seed.mjs`

**Interfaces:**
- Produces: no seed script writes `animalArchetypes`/`archetypeAnalysis`/`archetypeUpdatedAt`, seeds `Trait` rows, or creates `ProfileTrait` links. This must land BEFORE Task 11 (deleting `data/traits.ts`) and Task 12 (schema migration), since these scripts currently import from `data/traits.ts` and write to tables being dropped.

- [ ] **Step 1: `app/api/admin/seed-demo-accounts/route.ts`**

Read the file in full. Remove every `animalArchetypes: JSON.stringify([...])`, `archetypeAnalysis: "..."`, and `archetypeUpdatedAt: new Date(...)` key-value triple from the four Studio 18 team member profile-data objects (Thomas Piacentine, Diego Ramirez, Aiko Tanaka, Jordan Hayes — confirmed present at 4 call sites during investigation). In the seed-summary `note` strings for these same four accounts (e.g. `"...archetypes: shark + lion"`), drop the trailing "archetypes: ..." clause since it no longer describes anything real.

- [ ] **Step 2: `prisma/seed.ts`**

Read the file. Remove `import { TRAITS } from "../data/traits";` and the "Seeding traits..." block that upserts each `TRAITS` entry via `prisma.trait.upsert`.

- [ ] **Step 3: `prisma/seed.mjs`**

Read the file in full (confirmed ~26 trait-related lines during investigation). Remove the inline `TRAIT_SLUGS` array/comment ("Define traits inline for the seed") and the "🌱 Seeding traits..." block that upserts them via `prisma.trait.upsert`. Remove the three near-identical blocks that fetch top traits for Alex/Jordan/Sam (`prisma.trait.findMany` followed by a `for` loop calling `prisma.profileTrait.upsert`) — there are 3 such blocks, one per seeded user. Update the platform-org description string ("Building the core product: profiles, traits, skill cards, projects, and peer endorsements.") to drop "traits, skill cards, ... and peer endorsements" since none of those exist anymore — e.g. "Building the core product: profiles, projects, and org matching." Update the two idea-note strings that reference traits/peer-endorsements ("Best teams mix complementary traits..." and "Peer endorsements are the key differentiator...") — either delete these two idea notes entirely or rewrite them to describe something still true of the product (recommend deleting them, since both are specifically *about* the now-removed features and there's no equivalent replacement point worth making up).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in `seed-demo-accounts/route.ts` and `seed.ts`. `seed.mjs` is plain JS and won't be typechecked — visually verify it by re-reading the diff instead.

- [ ] **Step 5: Re-run the seed and verify**

Run `POST /api/admin/seed-demo-accounts?secret=niv-reset-2026` against the running dev server (per this project's documented reset flow) and confirm it completes without errors against the still-unmigrated schema (the columns/tables are still present, so simply not writing to them is safe).

- [ ] **Step 6: Commit**

```bash
git add "app/api/admin/seed-demo-accounts/route.ts" "prisma/seed.ts" "prisma/seed.mjs"
git commit -m "Remove Traits/Animal Archetype seeding from all seed scripts"
```

---

## Task 11: Delete the core Traits data file and verify zero remaining references

**Files:**
- Delete: `data/traits.ts`

**Interfaces:**
- Consumes: nothing — by this point every file that imported from `data/traits.ts` has been fixed (Tasks 1, 3, 5, 6) or deleted (Tasks 1, 3, 4).
- Produces: nothing left in the codebase imports `TRAITS`/`TRAIT_CATEGORY_LABELS`/`TRAIT_CATEGORY_COLORS`/`TRAITS_BY_CATEGORY`/`TraitCategory`/`TraitDef` from `@/data/traits`.

- [ ] **Step 1: Verify no remaining consumers before deleting**

Run a repo-wide search (excluding `.claude/worktrees`) for `from "@/data/traits"` or `from "../data/traits"`. If Tasks 1-10 were done correctly, this returns zero hits in `app/`, `components/`, `lib/`, `prisma/`. If any hit turns up, stop and fix that file first — it means an earlier task missed a call site.

- [ ] **Step 2: Delete `data/traits.ts`**

Delete the file entirely (780 lines — `TraitCategory`, `TraitDef`, `TRAIT_CATEGORY_LABELS`, `TRAIT_CATEGORY_COLORS`, `TRAITS`, `TRAITS_BY_CATEGORY`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors anywhere in the project. This is the first point in the plan where the ENTIRE codebase should be fully clean of Traits references at the type level (Animal Archetype references were already fully clean as of Task 2).

- [ ] **Step 4: Full-repo grep verification**

Run a case-insensitive search for `\btrait` and separately for `animalArchetype|archetypeAnalysis|archetypeUpdatedAt` across `app/`, `components/`, `lib/`, `data/`, excluding `.claude/worktrees` and `docs/` (docs are historical, not required to be scrubbed) and excluding `prisma/schema.prisma` (Task 12 handles that). Expected: zero results for either search. If anything turns up, fix it before proceeding to the schema migration.

- [ ] **Step 5: Commit**

```bash
git rm "data/traits.ts"
git commit -m "Delete the core Traits data file"
```

---

## Task 12: Drop the Trait/ProfileTrait/PeerEndorsement/PeerEndorsedTrait tables and Animal Archetype columns from the database schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_remove_archetypes_and_traits/migration.sql`

**Interfaces:**
- Produces: `Trait`, `ProfileTrait`, `PeerEndorsement`, and `PeerEndorsedTrait` no longer exist as tables. `Profile` no longer has `animalArchetypes`/`archetypeAnalysis`/`archetypeUpdatedAt` columns. `User.endorsementsGiven`/`endorsementsReceived` relations and `Trait.peerEndorsements`/`profileLinks` are gone.

**This task must run last among the code-changing tasks** — Task 11's Step 4 grep must return zero hits before you start this one, otherwise dropping these tables will break `npx prisma generate`'s consumers immediately.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, remove these three lines from `model Profile`:

```prisma
  animalArchetypes    String      @default("[]")
  archetypeAnalysis   String?
  archetypeUpdatedAt  DateTime?
```

Remove `traitLinks     ProfileTrait[]` from `model Profile` (its relation field to `ProfileTrait`). Remove `endorsementsGiven     PeerEndorsement[]         @relation("EndorsementsGiven")` and `endorsementsReceived  PeerEndorsement[]         @relation("EndorsementsReceived")` from `model User`.

Delete the `model Trait { ... }` block entirely (id, slug, name, description, category, createdAt, profileLinks, peerEndorsements).

Delete the `model ProfileTrait { ... }` block entirely.

Delete the `enum TraitCategory { ... }` block entirely.

Delete the `model PeerEndorsement { ... }` block entirely.

Delete the `model PeerEndorsedTrait { ... }` block entirely.

Re-read the full schema file after these edits to confirm no dangling relation reference remains (e.g. `Project.peerEndorsements` if such a back-relation exists on `Project` — verify by searching the schema for `PeerEndorsement` and `Trait` and `ProfileTrait` once more before generating the migration; any remaining reference must be removed here too, since Prisma will refuse to generate a schema with a dangling relation).

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name remove_archetypes_and_traits --create-only`

This creates `prisma/migrations/<timestamp>_remove_archetypes_and_traits/migration.sql` without applying it yet, following this project's existing migration folder naming convention. Read the generated SQL to confirm it contains `DROP TABLE "ProfileTrait"`, `DROP TABLE "PeerEndorsedTrait"`, `DROP TABLE "PeerEndorsement"`, `DROP TABLE "Trait"` (in an order that respects foreign keys — `ProfileTrait`/`PeerEndorsedTrait` before `Trait`, `PeerEndorsedTrait` before `PeerEndorsement`), `ALTER TABLE "Profile" DROP COLUMN "animalArchetypes"`, `ALTER TABLE "Profile" DROP COLUMN "archetypeAnalysis"`, `ALTER TABLE "Profile" DROP COLUMN "archetypeUpdatedAt"`, and `DROP TYPE "TraitCategory"`. Verify the intent matches rather than hand-editing unless something is wrong.

- [ ] **Step 3: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev`

This applies the pending migration to the local/dev database and regenerates `@prisma/client`. Prisma will prompt about data loss for the dropped tables/columns specifically (existing trait/archetype/endorsement data will be gone) — this is expected and intended, since the whole point is removing this data.

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npm run build`
Expected: succeeds. This is the definitive confirmation that no code anywhere still references the dropped Prisma models/fields (a stale reference would now be a hard TypeScript error against the regenerated client types).

- [ ] **Step 5: Re-run the seed against the migrated schema**

Run: `POST /api/admin/seed-demo-accounts?secret=niv-reset-2026` against the running dev server.
Expected: completes without errors (Task 10 already stopped writing to these tables/columns, so this just re-confirms the full loop works end-to-end post-migration).

- [ ] **Step 6: Commit**

```bash
git add "prisma/schema.prisma" "prisma/migrations"
git commit -m "Drop Animal Archetype columns and Trait/ProfileTrait/PeerEndorsement/PeerEndorsedTrait tables"
```

- [ ] **Step 7: Flag the production deploy step to the user**

This migration must run against the production Render Postgres database via the existing `prisma migrate deploy` step in `scripts/start.js` on the next deploy — do not manually run `prisma migrate deploy` against production yourself as part of this plan; that happens automatically on the next `git push` to the deployed branch, which is an action to confirm with the user separately, not something to do autonomously here.

---

## Task 13: Full-app verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck, lint, and build**

Run: `npx tsc --noEmit` — expected zero errors.
Run: `npm run lint` — expected zero errors (warnings acceptable if pre-existing and unrelated).
Run: `npm run build` — expected success.

- [ ] **Step 2: Final repo-wide grep**

Search case-insensitively for `\btrait`, `animalArchetype`, `archetypeAnalysis`, `archetypeUpdatedAt`, `PeerEndorsement`, and `PeerEndorsedTrait` across the entire repo excluding `.claude/worktrees` and `docs/`. Expected: zero hits in any `.ts`/`.tsx`/`.prisma`/`.sql`/`.json` file.

- [ ] **Step 3: End-to-end manual QA walkthrough**

With the dev server running (`npm run dev`), using the `browse` tool or a real browser, walk through every surface this plan touched:

1. `/quiz` — confirm it now 404s (or redirects, if Next's App Router serves a not-found page for a deleted route segment).
2. `/dashboard` — tutorial checklist shows 2 steps, no orange "complete your traits" banner.
3. `/profile` (own edit page) — no trait picker, saving still works.
4. `/profile/<handle>` and `/people/<userId>` — no "Traits" section, no "Animal Archetypes" section, no "Analyze" button.
5. `/projects/<id>` — an existing team project workspace: member cards render with no trait badges, no "Endorse" button, no endorsement modal even on a completed project; "Add member" search still works.
6. `/orgs/<id>` org-side scholar browse (wherever `/api/org-projects/[id]/scholars` is consumed) — still returns keyword-searchable results with no trait filter.
7. `/docs/api` and `GET /api/agent/openapi` — confirm the public API docs and spec make no mention of traits.
8. `People` sidebar entry / `/people` — confirm it still redirects cleanly to `/peers` with no console error (this route's dead-code siblings were deleted, but the redirect itself is untouched).

- [ ] **Step 4: Report to the user**

Summarize what was removed, confirm the version bump (`0.3.0` → `0.4.0`) and the production-migration deploy step (Task 12 Step 7) are the two items still needing explicit user action, and remind them the `.claude/worktrees/*` branches listed in Global Constraints still need this rebased in separately.
