# Role-Based Tutorial Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive, in-app tooltip/spotlight tour that auto-shows once per role (STUDENT vs STAFF) on first login, adapts staff steps to the viewer's permission tier, can be replayed via a sidebar entry, and doubles as a mechanism for one-off "what's new" feature announcements.

**Architecture:** A single reusable `TutorialTour` overlay component driven by plain-data step lists (`lib/tutorials/studentTour.ts`, `staffTour.ts`, `announcements.ts`). Target elements are marked with `data-tour="<id>"` attributes added to existing pages (a stable, refactor-proof selector — not fragile className/text matching). A `TutorialLauncher` mounted once in the dashboard layout decides what to auto-fire based on three new nullable `Profile` fields. A sidebar footer button lets any user manually replay their role tour.

**Tech Stack:** Next.js 15/16 App Router, TypeScript, Prisma 7.8.0 / PostgreSQL, NextAuth v5, React 19. No test framework configured (no jest/vitest/playwright in `package.json`) — verification is `npx tsc --noEmit`, `npm run lint`, `npm run build`, and manual QA against the dev server, this project's own convention.

**Spec:** `docs/superpowers/plans/2026-09-01-role-based-tutorial-design.md`

## Global Constraints

- **Scope:** `C:\Users\thoma\Goal-APP` main worktree only. Do not touch anything under `.claude/worktrees/*` — those are separate in-progress branches.
- **The "Support" sidebar entry described in `docs/superpowers/plans/2026-08-13-support-tickets.md` does NOT exist on `main`** — verified directly against the current codebase during plan research: no `SupportTicketModal`, no `LifeBuoy` icon usage, no "Support" string anywhere in `components/layout/`. That feature apparently only ever landed on the separate, unmerged `.worktrees/support-tickets` branch. **Do not treat that plan's wiring as a real precedent to mirror.** Task 7 below instead adds the "Take the tour" button directly to `Sidebar.tsx`'s existing footer block (which already renders unconditionally across every nav variant), based on the actual current file.
- **The `data/traits.ts` / Animal Archetype systems referenced nowhere in this plan** — they are being removed by the sibling plan `docs/superpowers/plans/2026-09-01-remove-archetypes-and-traits.md`, executing separately. This plan's student tour profile step intentionally covers only fields confirmed to exist today (`bio`, `interests`, `headline`) — it does NOT mention an "achievements" section, because no such `Profile` field or UI exists yet (confirmed absent from `prisma/schema.prisma`; tracked only as an unscoped future idea in project memory). Do not add one as part of this plan.
- **An existing, unrelated `/api/tutorial/dismiss` and `/api/tutorial-status` already exist** — they belong to the "Get started on Nivarro" dashboard checklist widget (cookie-based dismissal, unrelated data model). This plan's new routes live at `/api/tutorial/complete` and `/api/tutorial/announcement`, siblings under the same `app/api/tutorial/` directory but functionally unrelated — do not conflate or merge the two systems.
- **Verification gate:** every task ends with `npx tsc --noEmit` returning zero errors before you commit. Task 1's migration must succeed and the client must regenerate before any later task can typecheck cleanly against the new fields.
- **Commit per task**, using `git add <specific files>` (never `-A`).
- **`data-tour` selector convention:** every tour/announcement step's `selector` is a `[data-tour="<id>"]` attribute string, never a className or text match. Each task that references a new selector also adds the matching `data-tour` attribute to the real target page in the same task.

---

## Task 1: Add the tutorial-tracking Prisma fields and migrate

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_tutorial_tracking/migration.sql`

**Interfaces:**
- Produces: `Profile.studentTourCompletedAt: Date | null`, `Profile.staffTourCompletedAt: Date | null`, `Profile.seenAnnouncementIds: string` (JSON array, default `"[]"`) — all later tasks read/write these three fields by exactly these names.
- Consumes: nothing.

- [ ] **Step 1: Add the three fields to `model Profile`**

In `prisma/schema.prisma`, find `onboardingComplete  Boolean     @default(false)` inside `model Profile` and add these three lines directly after it:

```prisma
  studentTourCompletedAt DateTime?
  staffTourCompletedAt   DateTime?
  seenAnnouncementIds    String    @default("[]")
```

This follows the exact same nullable-`DateTime`/defaulted-JSON-string pattern already used by `onboardingComplete` and `interests` elsewhere in this same model.

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name add_tutorial_tracking --create-only`

Read the generated `prisma/migrations/<timestamp>_add_tutorial_tracking/migration.sql` and confirm it contains exactly three `ALTER TABLE "Profile" ADD COLUMN` statements: `"studentTourCompletedAt" TIMESTAMP(3)`, `"staffTourCompletedAt" TIMESTAMP(3)`, and `"seenAnnouncementIds" TEXT NOT NULL DEFAULT '[]'`.

- [ ] **Step 3: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev`

This applies the migration and regenerates `@prisma/client` with the three new fields typed.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors (nothing references the new fields yet, so this only confirms the schema/client regeneration itself didn't break anything).

- [ ] **Step 5: Commit**

```bash
git add "prisma/schema.prisma" "prisma/migrations"
git commit -m "Add studentTourCompletedAt, staffTourCompletedAt, seenAnnouncementIds to Profile"
```

---

## Task 2: Build the reusable `TutorialTour` overlay component

**Files:**
- Create: `components/tutorial/TutorialTour.tsx`

**Interfaces:**
- Produces: `interface TourStep { id: string; selector: string; title: string; body: string; route?: string }` and `export default function TutorialTour({ steps, onFinish, onSkip }: { steps: TourStep[]; onFinish: () => void; onSkip: () => void })`. Later tasks (3, 4, 5, 6) import `TourStep` from this file and pass arrays of it; task 7 renders `<TutorialTour>` conditionally.
- Consumes: nothing new — plain React/Next.js APIs only (`useState`, `useEffect`, `next/navigation`'s `useRouter`).

- [ ] **Step 1: Write the component**

Create `components/tutorial/TutorialTour.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface TourStep {
  id: string;
  selector: string;
  title: string;
  body: string;
  route?: string;
}

interface Props {
  steps: TourStep[];
  onFinish: () => void;
  onSkip: () => void;
}

export default function TutorialTour({ steps, onFinish, onSkip }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[index];

  // Navigate to the step's route first, then wait for the target element
  // to exist before measuring it — a step with no selector match (slow
  // render, unexpected layout) is skipped rather than shown with a
  // spotlight pointing at nothing.
  useEffect(() => {
    if (!step) return;

    if (step.route && step.route !== pathname) {
      router.push(step.route);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    function tryMeasure() {
      if (cancelled) return;
      if (!step.selector) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.selector);
      if (el) {
        setRect(el.getBoundingClientRect());
        return;
      }
      attempts += 1;
      if (attempts > 20) {
        // Target never appeared — skip this step rather than show a
        // spotlight over nothing.
        goNext();
        return;
      }
      setTimeout(tryMeasure, 150);
    }

    tryMeasure();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, pathname]);

  function goNext() {
    if (index >= steps.length - 1) {
      onFinish();
      return;
    }
    setIndex((i) => i + 1);
    setRect(null);
  }

  function goBack() {
    if (index === 0) return;
    setIndex((i) => i - 1);
    setRect(null);
  }

  if (!step) return null;

  // A route-only step still waiting for navigation to land renders nothing
  // this tick — the effect above will re-run once `pathname` updates.
  if (step.route && step.route !== pathname) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onSkip}
    >
      {rect && (
        <div
          style={{
            position: "fixed",
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            border: "2px solid var(--blue)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          width: 340,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 20,
          color: "var(--text)",
        }}
      >
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>
          Step {index + 1} of {steps.length}
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>{step.title}</h3>
        <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 16px", lineHeight: 1.5 }}>
          {step.body}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button
            onClick={onSkip}
            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}
          >
            Skip
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {index > 0 && (
              <button
                onClick={goBack}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "var(--text)" }}
              >
                Back
              </button>
            )}
            <button
              onClick={goNext}
              style={{ background: "var(--blue)", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#fff", fontWeight: 600 }}
            >
              {index === steps.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add "components/tutorial/TutorialTour.tsx"
git commit -m "Add reusable TutorialTour spotlight overlay component"
```

---

## Task 3: Student tour step list, and the `data-tour` anchors it targets

**Files:**
- Create: `lib/tutorials/studentTour.ts`
- Modify: `app/(dashboard)/profile/ProfileEditor.tsx`
- Modify: `app/(dashboard)/messages/MessagesClient.tsx`
- Modify: `app/(dashboard)/mentorship/page.tsx`

**Interfaces:**
- Produces: `export function buildStudentTourSteps(isWalledStudent: boolean): TourStep[]` — a 4-step list. Task 7 calls this with the value already computed server-side in `app/(dashboard)/layout.tsx` (via the existing `isWalledStudent` import from `lib/accountGate.ts`, already used there — see that file for its exact usage).
- Consumes: `TourStep` from `components/tutorial/TutorialTour.tsx` (Task 2).

- [ ] **Step 1: Add a `data-tour` anchor to the profile editor**

Read `app/(dashboard)/profile/ProfileEditor.tsx` in full. Find its outermost returned JSX element (the root `<div>` or `<form>` wrapping the whole editor form) and add `data-tour="profile-editor"` to it as a plain string attribute alongside its existing `className`/`style` props — do not otherwise change this file's structure or logic.

- [ ] **Step 2: Add a `data-tour` anchor to the messages inbox**

Read `app/(dashboard)/messages/MessagesClient.tsx` in full. Find its outermost returned JSX element and add `data-tour="messages-inbox"` to it, same pattern as Step 1.

- [ ] **Step 3: Add a `data-tour` anchor to the mentorship page**

Read `app/(dashboard)/mentorship/page.tsx` in full. Find its outermost returned JSX element and add `data-tour="mentorship-inbox"` to it, same pattern as Step 1. (This file is a server component with no separate client file at this path — confirmed by directory listing during plan research; if you find a client component it delegates to instead, add the attribute there and note the actual file touched in your task report.)

- [ ] **Step 4: Write the student tour step list**

Create `lib/tutorials/studentTour.ts`:

```ts
import type { TourStep } from "@/components/tutorial/TutorialTour";

export function buildStudentTourSteps(isWalledStudent: boolean): TourStep[] {
  const inboxStep: TourStep = isWalledStudent
    ? {
        id: "student-mentorship",
        selector: '[data-tour="mentorship-inbox"]',
        title: "Your mentorship pairing",
        body: "This is where you'll message your assigned mentor once a school admin pairs you up.",
        route: "/mentorship",
      }
    : {
        id: "student-messages",
        selector: '[data-tour="messages-inbox"]',
        title: "Messages",
        body: "Message peers, teammates, and organizations you're working with here.",
        route: "/messages",
      };

  return [
    {
      id: "student-profile",
      selector: '[data-tour="profile-editor"]',
      title: "Build your profile",
      body: "Fill in your bio, interests, and headline — this is what organizations and mentors see first.",
      route: "/profile",
    },
    inboxStep,
    {
      id: "student-inbox-detail",
      selector: '[data-tour="' + (isWalledStudent ? "mentorship-inbox" : "messages-inbox") + '"]',
      title: "Read and reply",
      body: "Open any conversation here to read and respond — replies go straight to the other person.",
      route: isWalledStudent ? "/mentorship" : "/messages",
    },
    {
      id: "student-nav-overview",
      selector: "",
      title: "You're all set",
      body: "Everything else you need — Peers, Organizations, Teams — lives in the sidebar. Explore at your own pace.",
      route: "/dashboard",
    },
  ];
}
```

This mirrors the design spec's 4 stops: Profile, the conditional Mentorship-or-Messages stop (computed from `isWalledStudent`, matching the routing gotcha already documented in project memory — walled students are redirected out of `/messages`, non-walled students are redirected out of `/mentorship`), a second stop on the same inbox page for the "read/reply" detail, and a final no-target dashboard overview stop (empty `selector` — `TutorialTour`'s effect treats an empty selector as "skip measurement, render the tooltip with no spotlight").

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all four files.

- [ ] **Step 6: Manual QA**

With the dev server running, log in as a walled demo student (`zoe@nivarro.io` or `priya@nivarro.io`) and confirm `buildStudentTourSteps(true)` would route its second/third stops to `/mentorship`. This task doesn't yet wire the tour into the UI (that's Task 7) — for now, confirm via a temporary console log or React DevTools that the function returns the expected 4-entry array for both `true` and `false` inputs, then remove any temporary debug code before committing.

- [ ] **Step 7: Commit**

```bash
git add "lib/tutorials/studentTour.ts" "app/(dashboard)/profile/ProfileEditor.tsx" "app/(dashboard)/messages/MessagesClient.tsx" "app/(dashboard)/mentorship/page.tsx"
git commit -m "Add student tour step list and its data-tour anchors"
```

---

## Task 4: Staff tour step list (tier-aware), and the `data-tour` anchors it targets

**Files:**
- Create: `lib/tutorials/staffTour.ts`
- Modify: `app/(dashboard)/school/roster/RosterClient.tsx`
- Modify: `app/(dashboard)/school/partnerships/SchoolPartnershipsClient.tsx`
- Modify: `app/(dashboard)/school/staff/PermissionsClient.tsx`

**Interfaces:**
- Produces: `export function buildStaffTourSteps(isCoreAdmin: boolean): TourStep[]` — 3 base steps for all STAFF, plus 2 more appended only when `isCoreAdmin` is true (per `Profile.isCoreAdmin`, which "bypasses the tier system entirely" per its own schema comment — read `lib/facultyPermissions.ts` for how the rest of the app already treats this field as an all-capabilities bypass, e.g. `app/(dashboard)/layout.tsx`'s existing `profile?.isCoreAdmin ? [...CAPABILITIES] : ...` branch).
- Consumes: `TourStep` from `components/tutorial/TutorialTour.tsx` (Task 2).

- [ ] **Step 1: Add a `data-tour` anchor to the roster page**

Read `app/(dashboard)/school/roster/RosterClient.tsx` in full. Find its outermost returned JSX element and add `data-tour="roster-view"` to it.

- [ ] **Step 2: Add a `data-tour` anchor to the mentorship pairing section**

Read `app/(dashboard)/school/partnerships/SchoolPartnershipsClient.tsx` in full. Find the header `<div>` that wraps the "+ New Pairing" button (the block immediately preceding the `{canViewMentorship && (` conditional — confirmed present at this file during plan research) and add `data-tour="mentorship-pairing-tool"` to that `<div>`.

- [ ] **Step 3: Add `data-tour` anchors to the Permissions Switchboard**

Read `app/(dashboard)/school/staff/PermissionsClient.tsx` in full. Find the tab-bar container that renders the People/Groups/Admins tab buttons (confirmed present, gated by `isOwnerOrCoreAdmin` for the Groups/Admins tabs, at this file during plan research) and add `data-tour="permissions-switchboard"` to that container. Then find the specific "Admins" tab `<button>` (the one that sets `tab` to `"admins"`) and add `data-tour="admins-tab"` to that individual button.

- [ ] **Step 4: Write the staff tour step list**

Create `lib/tutorials/staffTour.ts`:

```ts
import type { TourStep } from "@/components/tutorial/TutorialTour";

export function buildStaffTourSteps(isCoreAdmin: boolean): TourStep[] {
  const baseSteps: TourStep[] = [
    {
      id: "staff-nav-overview",
      selector: "",
      title: "Welcome to your school dashboard",
      body: "The sidebar shows only the areas you have permission to use.",
      route: "/dashboard",
    },
    {
      id: "staff-roster",
      selector: '[data-tour="roster-view"]',
      title: "Your school's roster",
      body: "Every student, alum, and staff member linked to your school lives here.",
      route: "/school/roster",
    },
    {
      id: "staff-mentorship-pairing",
      selector: '[data-tour="mentorship-pairing-tool"]',
      title: "Mentorship pairing",
      body: "Pair a student with a mentor here — it creates a shared message thread between them.",
      route: "/school/partnerships",
    },
  ];

  if (!isCoreAdmin) return baseSteps;

  return [
    ...baseSteps,
    {
      id: "staff-permissions-switchboard",
      selector: '[data-tour="permissions-switchboard"]',
      title: "Permissions Switchboard",
      body: "As a Core Admin, you control what every tier of staff can see and do here.",
      route: "/school/staff",
    },
    {
      id: "staff-admins-tab",
      selector: '[data-tour="admins-tab"]',
      title: "Manage other Core Admins",
      body: "Promote or demote other Core Admins from this tab.",
      route: "/school/staff",
    },
  ];
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all four files.

- [ ] **Step 6: Manual QA**

Same approach as Task 3 Step 6 — temporarily confirm `buildStaffTourSteps(false)` returns 3 steps and `buildStaffTourSteps(true)` returns 5, then remove any temporary debug code before committing.

- [ ] **Step 7: Commit**

```bash
git add "lib/tutorials/staffTour.ts" "app/(dashboard)/school/roster/RosterClient.tsx" "app/(dashboard)/school/partnerships/SchoolPartnershipsClient.tsx" "app/(dashboard)/school/staff/PermissionsClient.tsx"
git commit -m "Add tier-aware staff tour step list and its data-tour anchors"
```

---

## Task 5: New-feature announcements list

**Files:**
- Create: `lib/tutorials/announcements.ts`

**Interfaces:**
- Produces: `export interface Announcement extends TourStep {}` and `export const ANNOUNCEMENTS: Announcement[]`. Task 7 filters this array against `Profile.seenAnnouncementIds` to find the first unseen entry.
- Consumes: `TourStep` from `components/tutorial/TutorialTour.tsx` (Task 2).

- [ ] **Step 1: Write the announcements list**

Create `lib/tutorials/announcements.ts`:

```ts
import type { TourStep } from "@/components/tutorial/TutorialTour";

export type Announcement = TourStep;

// One entry per shipped feature worth calling out once. Add a new entry
// here when a feature ships — nothing else needs to change for a new
// announcement to start appearing.
export const ANNOUNCEMENTS: Announcement[] = [];
```

This starts empty by design — the mechanism (Task 7's `TutorialLauncher`) is what this plan builds; the first real announcement entry is added the next time a feature ships, as its own small follow-up change, not as part of this plan.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add "lib/tutorials/announcements.ts"
git commit -m "Add empty new-feature-announcements list and its shared TourStep-based shape"
```

---

## Task 6: Tutorial completion and announcement API routes

**Files:**
- Create: `app/api/tutorial/complete/route.ts`
- Create: `app/api/tutorial/announcement/route.ts`

**Interfaces:**
- Produces: `PATCH /api/tutorial/complete` (body `{ tour: "student" | "staff" }`) sets `studentTourCompletedAt`/`staffTourCompletedAt` to `now()`. `PATCH /api/tutorial/announcement` (body `{ id: string }`) appends `id` to `seenAnnouncementIds` (deduped). Task 7's `TutorialLauncher` calls both.
- Consumes: `Profile.studentTourCompletedAt`/`staffTourCompletedAt`/`seenAnnouncementIds` (Task 1).

- [ ] **Step 1: Write `app/api/tutorial/complete/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const tour = body?.tour;
  if (tour !== "student" && tour !== "staff") {
    return NextResponse.json({ error: "tour must be 'student' or 'staff'" }, { status: 400 });
  }

  const field = tour === "student" ? "studentTourCompletedAt" : "staffTourCompletedAt";

  await prisma.profile.update({
    where: { userId: session.user.id },
    data: { [field]: new Date() },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write `app/api/tutorial/announcement/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { seenAnnouncementIds: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  let seen: string[] = [];
  try {
    seen = JSON.parse(profile.seenAnnouncementIds);
  } catch {
    seen = [];
  }
  if (!seen.includes(id)) seen.push(id);

  await prisma.profile.update({
    where: { userId: session.user.id },
    data: { seenAnnouncementIds: JSON.stringify(seen) },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in both files.

- [ ] **Step 4: Manual QA**

With the dev server running and logged in, `curl` (or a browser fetch from devtools) `PATCH /api/tutorial/complete` with body `{"tour":"student"}` and confirm a 200 response; then query the profile (e.g. via Prisma Studio or an existing profile endpoint) to confirm `studentTourCompletedAt` is now set. Repeat for `PATCH /api/tutorial/announcement` with body `{"id":"test-id"}` and confirm `seenAnnouncementIds` becomes `["test-id"]`, then a second identical call does not duplicate it.

- [ ] **Step 5: Commit**

```bash
git add "app/api/tutorial/complete/route.ts" "app/api/tutorial/announcement/route.ts"
git commit -m "Add tutorial completion and announcement API routes"
```

---

## Task 7: `TutorialLauncher` component, wired into the dashboard layout

**Files:**
- Create: `components/tutorial/TutorialLauncher.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Produces: `<TutorialLauncher role={...} isWalledStudent={...} isCoreAdmin={...} studentTourCompletedAt={...} staffTourCompletedAt={...} seenAnnouncementIds={...} />`, mounted once per dashboard render. Handles auto-firing the role tour, then falling back to the first unseen announcement, and calling the Task 6 API routes on completion/skip.
- Consumes: `TutorialTour` (Task 2), `buildStudentTourSteps` (Task 3), `buildStaffTourSteps` (Task 4), `ANNOUNCEMENTS` (Task 5).

- [ ] **Step 1: Write `TutorialLauncher.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import TutorialTour, { type TourStep } from "./TutorialTour";
import { buildStudentTourSteps } from "@/lib/tutorials/studentTour";
import { buildStaffTourSteps } from "@/lib/tutorials/staffTour";
import { ANNOUNCEMENTS } from "@/lib/tutorials/announcements";

interface Props {
  role: string;
  isWalledStudent: boolean;
  isCoreAdmin: boolean;
  studentTourCompletedAt: string | null;
  staffTourCompletedAt: string | null;
  seenAnnouncementIds: string;
}

export type { Props as TutorialLauncherProps };

function roleSteps(props: Props): { steps: TourStep[]; tour: "student" | "staff" } | null {
  if (props.role === "STUDENT" && !props.studentTourCompletedAt) {
    return { steps: buildStudentTourSteps(props.isWalledStudent), tour: "student" };
  }
  if (props.role === "STAFF" && !props.staffTourCompletedAt) {
    return { steps: buildStaffTourSteps(props.isCoreAdmin), tour: "staff" };
  }
  return null;
}

function firstUnseenAnnouncement(seenAnnouncementIds: string): TourStep | null {
  let seen: string[] = [];
  try {
    seen = JSON.parse(seenAnnouncementIds);
  } catch {
    seen = [];
  }
  return ANNOUNCEMENTS.find((a) => !seen.includes(a.id)) ?? null;
}

async function markComplete(tour: "student" | "staff") {
  try {
    await fetch("/api/tutorial/complete", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour }),
    });
  } catch {
    // Fails silently and is retried next mount — never blocks the UI.
  }
}

async function markAnnouncementSeen(id: string) {
  try {
    await fetch("/api/tutorial/announcement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch {
    // Same silent-retry-next-mount behavior as markComplete.
  }
}

export default function TutorialLauncher(props: Props) {
  const [active, setActive] = useState<
    | { kind: "tour"; tour: "student" | "staff"; steps: TourStep[] }
    | { kind: "announcement"; announcement: TourStep }
    | null
  >(null);

  useEffect(() => {
    const role = roleSteps(props);
    if (role) {
      setActive({ kind: "tour", tour: role.tour, steps: role.steps });
      return;
    }
    const announcement = firstUnseenAnnouncement(props.seenAnnouncementIds);
    if (announcement) {
      setActive({ kind: "announcement", announcement });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!active) return null;

  if (active.kind === "announcement") {
    return (
      <TutorialTour
        steps={[active.announcement]}
        onFinish={() => {
          markAnnouncementSeen(active.announcement.id);
          setActive(null);
        }}
        onSkip={() => {
          markAnnouncementSeen(active.announcement.id);
          setActive(null);
        }}
      />
    );
  }

  return (
    <TutorialTour
      steps={active.steps}
      onFinish={() => {
        markComplete(active.tour);
        setActive(null);
      }}
      onSkip={() => {
        markComplete(active.tour);
        setActive(null);
      }}
    />
  );
}
```

- [ ] **Step 2: Wire it into `app/(dashboard)/layout.tsx`**

Read the current full contents of `app/(dashboard)/layout.tsx` first (it already computes `role`, `isStaff`, `isWalledStudentAccount`, and `profile?.isCoreAdmin` — reuse these exactly, do not recompute them differently).

Add `studentTourCompletedAt: true, staffTourCompletedAt: true, seenAnnouncementIds: true,` to the existing `profile: { select: { ... } }` block inside the `prisma.user.findUnique` call (the same block that already selects `displayName`, `schoolId`, `isCoreAdmin`, etc.).

Add the import:

```tsx
import TutorialLauncher from "@/components/tutorial/TutorialLauncher";
```

Immediately after the closing `</SidebarShell>` tag and before `<main ...>`, add:

```tsx
      <TutorialLauncher
        role={role}
        isWalledStudent={isWalledStudentAccount}
        isCoreAdmin={!!profile?.isCoreAdmin}
        studentTourCompletedAt={profile?.studentTourCompletedAt?.toISOString() ?? null}
        staffTourCompletedAt={profile?.staffTourCompletedAt?.toISOString() ?? null}
        seenAnnouncementIds={profile?.seenAnnouncementIds ?? "[]"}
      />
```

This uses the file's existing `role`, `isWalledStudentAccount`, and `profile` variables exactly as already computed — no new server-side logic beyond the added `select` fields.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in both files.

- [ ] **Step 4: Manual QA**

With the dev server running: log in as a fresh/blank demo student (`student@nivarro.demo`) and confirm the student tour auto-fires on first dashboard load, walks through Profile → Messages/Mentorship (per that account's walled status) → dashboard overview, and does not reappear on a page refresh after clicking "Done." Log in as `teacher-staff@nivarro.demo` (STAFF, Core Admin) and confirm the 5-step staff tour auto-fires with the Permissions Switchboard and Admins-tab steps included.

- [ ] **Step 5: Commit**

```bash
git add "components/tutorial/TutorialLauncher.tsx" "app/(dashboard)/layout.tsx"
git commit -m "Add TutorialLauncher and wire it into the dashboard layout"
```

---

## Task 8: "Take the tour" replay entry in the sidebar footer

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/SidebarShell.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Produces: a "Take the tour" button in `Sidebar.tsx`'s existing footer block (the `{!collapsed && (...)}` block that already renders `<AccountMenu>`), visible across every nav variant since that footer block is unconditional. Clicking it re-fires the viewer's role tour regardless of completion state, without touching the stored completion field.
- Consumes: `TutorialLauncher`'s tour-building logic — rather than duplicating step-list selection logic in `Sidebar.tsx`, this task exposes a small manual-trigger callback threaded down from `TutorialLauncher` through `layout.tsx` → `SidebarShell` → `Sidebar`.

- [ ] **Step 1: Add a manual-replay callback to `TutorialLauncher`**

In `components/tutorial/TutorialLauncher.tsx` (Task 7), add a second exported piece: a module-level mutable holder the sidebar button can call into, since `TutorialLauncher` and `Sidebar` are siblings under `layout.tsx` with no natural parent-to-both callback path other than lifting state up to `layout.tsx` itself — but `layout.tsx` is a server component and cannot hold `useState`. Instead, thread the replay trigger through a tiny client-side event: add this to the bottom of `TutorialLauncher.tsx`:

```tsx
export function replayTour(role: string, isWalledStudent: boolean, isCoreAdmin: boolean) {
  window.dispatchEvent(
    new CustomEvent("nivarro:replay-tour", { detail: { role, isWalledStudent, isCoreAdmin } })
  );
}
```

And inside the `TutorialLauncher` component function, add an effect that listens for this event and starts the appropriate tour on demand:

```tsx
  useEffect(() => {
    function onReplay(e: Event) {
      const detail = (e as CustomEvent).detail as { role: string; isWalledStudent: boolean; isCoreAdmin: boolean };
      if (detail.role === "STUDENT") {
        setActive({ kind: "tour", tour: "student", steps: buildStudentTourSteps(detail.isWalledStudent) });
      } else if (detail.role === "STAFF") {
        setActive({ kind: "tour", tour: "staff", steps: buildStaffTourSteps(detail.isCoreAdmin) });
      }
    }
    window.addEventListener("nivarro:replay-tour", onReplay);
    return () => window.removeEventListener("nivarro:replay-tour", onReplay);
  }, []);
```

Note: replaying does NOT call `markComplete`/`markAnnouncementSeen` any differently than the normal flow — `onFinish`/`onSkip` still fire the same `markComplete` call as any other run of the tour, which is a harmless no-op re-write of the same `completedAt` timestamp (already true per the design spec: "does not reset the stored completion field" means replay doesn't null it out beforehand, not that finishing a replay avoids re-stamping it).

- [ ] **Step 2: Thread `role`/`isWalledStudent`/`isCoreAdmin` down to `Sidebar.tsx`**

In `app/(dashboard)/layout.tsx`, add three props to the existing `<SidebarShell ... />` call: `tourRole={role}` `tourIsWalledStudent={isWalledStudentAccount}` `tourIsCoreAdmin={!!profile?.isCoreAdmin}`.

In `components/layout/SidebarShell.tsx`, add `tourRole?: string; tourIsWalledStudent?: boolean; tourIsCoreAdmin?: boolean;` to `Props`, destructure them in the component signature, and pass them through unchanged to `<Sidebar ... />` as `tourRole={tourRole} tourIsWalledStudent={tourIsWalledStudent} tourIsCoreAdmin={tourIsCoreAdmin}`.

- [ ] **Step 3: Add the button to `Sidebar.tsx`'s footer**

In `components/layout/Sidebar.tsx`, add `tourRole?: string; tourIsWalledStudent?: boolean; tourIsCoreAdmin?: boolean;` to `SidebarProps`, destructure them (with defaults `tourRole = "STUDENT"`, `tourIsWalledStudent = false`, `tourIsCoreAdmin = false`) in the component signature, and add the import:

```tsx
import { replayTour } from "@/components/tutorial/TutorialLauncher";
```

In the Footer block (the `{!collapsed && (<div ...><AccountMenu ... /></div>)}` block), add a button immediately before `<AccountMenu ... />`:

```tsx
          <button
            onClick={() => replayTour(tourRole, tourIsWalledStudent, tourIsCoreAdmin)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              background: "none",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              color: "var(--n-text2)",
              fontSize: 12,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Take the tour
          </button>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors in all three files.

- [ ] **Step 5: Manual QA**

With the dev server running, log in as any demo student or staff account whose tour has already completed once, click "Take the tour" in the sidebar footer, and confirm the role-appropriate tour fires again from step 1 — for a STAFF Core Admin account, confirm the 5-step version fires (not the 3-step base version).

- [ ] **Step 6: Commit**

```bash
git add "components/tutorial/TutorialLauncher.tsx" "components/layout/Sidebar.tsx" "components/layout/SidebarShell.tsx" "app/(dashboard)/layout.tsx"
git commit -m "Add 'Take the tour' manual replay entry to the sidebar footer"
```

---

## Task 9: Full-app verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck, lint, and build**

Run: `npx tsc --noEmit` — expected zero errors.
Run: `npm run lint` — expected zero errors (warnings acceptable if pre-existing and unrelated to this plan's files).
Run: `npm run build` — expected success.

- [ ] **Step 2: End-to-end manual QA walkthrough**

With the dev server running (`npm run dev`), using the `browse` tool or a real browser:

1. Log in as a fresh/blank demo student — confirm the student tour auto-fires, its second/third stops land on `/mentorship` if the account is walled (or `/messages` if not), and it does not reappear after a page refresh once finished.
2. Log in as `teacher-staff@nivarro.demo` (STAFF, Core Admin) — confirm the 5-step tour auto-fires, including the Permissions Switchboard and Admins-tab steps.
3. Log in as a non-Core-Admin STAFF account (if one exists in the seed data; if not, note this gap in your report rather than fabricating one) — confirm only the 3 base steps fire.
4. Click "Take the tour" in the sidebar footer as any already-toured account — confirm it replays from step 1.
5. Manually add one test entry to `lib/tutorials/announcements.ts`'s `ANNOUNCEMENTS` array (a throwaway entry, e.g. targeting `[data-tour="profile-editor"]`), confirm it fires once after the role tour on a fresh-enough account (or one whose role tour is already complete), then revert this test addition — do not commit a placeholder announcement as part of this plan.

- [ ] **Step 3: Report to the user**

Summarize what was built, confirm no production migration action is needed beyond the normal `prisma migrate deploy` step already run at deploy time (per `scripts/start.js`), and flag that `.claude/worktrees/*` branches will need this rebased in separately if any of them touch `Sidebar.tsx`, `SidebarShell.tsx`, or `app/(dashboard)/layout.tsx`.
