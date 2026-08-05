# Remove Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force dark as the app's only theme by deleting the light-mode CSS, the toggle UI, and the persistence/FOUC logic that supports switching to it, and fix two screens whose Tailwind `dark:` classes currently render the wrong (light) colors.

**Architecture:** This is a pure deletion/cleanup — no new components, no new state, no new dependencies. Dark is already the default (the `:root` block in `app/globals.css` defines it unconditionally); light mode exists only as an opt-in `body.day` CSS override activated by a toggle component and persisted to `localStorage`. Removing that opt-in path leaves the app rendering exactly as it already does for every user who never touched the toggle.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, plain CSS custom properties (no theming library).

## Global Constraints

- Dark remains the app's only theme. The `:root` block in `app/globals.css` (lines 8–94) is not modified — it already holds every value the app needs.
- No new npm dependencies.
- No file outside the ones listed in this plan's tasks is touched (per the design spec's blast-radius scan: `ThemeToggle.tsx`, its two consumers, `app/layout.tsx`'s FOUC script, `app/globals.css`'s light-mode blocks, and two files with inert `dark:` Tailwind classes are the entire surface area).
- This codebase has no unit/integration test runner (the only `tests/` directory is dead legacy code from an unrelated stack, not wired into `package.json`). Verification is `npx tsc --noEmit`, `npm run lint`, and targeted `grep` checks for dead references — not live tests.
- Pre-existing baseline, NOT this plan's concern: `npx tsc --noEmit` has 8 pre-existing errors unrelated to theming (`app/(dashboard)/admin/org-categories/page.tsx`, `app/(dashboard)/orgs/OrgsClient.tsx`, `prisma/seed-mock.ts` ×6); `npm run lint` has 135 pre-existing problems (mostly dead `server/tests/**` code). None touch any file this plan modifies. Each task's bar is: no NEW errors/warnings beyond this baseline in the files it touches.

---

### Task 1: Remove light-mode CSS

**Files:**
- Modify: `app/globals.css`

**Interfaces:** None — pure CSS deletion, no code consumes or produces anything here.

- [ ] **Step 1: Remove the inert `@variant dark` declaration**

Read `app/globals.css` first to confirm current content, then apply:

```diff
 @import "tailwindcss";
-@variant dark (&:is(.dark *));
 
 /* ─────────────────────────────────────────
    FONT TOKENS
```

- [ ] **Step 2: Remove the `body.day` variable-override block**

```diff
-/* ─────────────────────────────────────────
-   LIGHT MODE
-───────────────────────────────────────── */
-
-body.day {
-  --accent:       #14507F;
-  --accent-hover: #0B3155;
-  --accent-dim:   #0B3155;
-  --accent-glow:  rgba(74,128,240,0.24);
-  --on-accent:    #FFFFFF;
-
-  --amber: var(--accent);
-  --gold:  var(--accent);
-  --gold-light: var(--accent-hover);
-  --gold-dim:   #DBEAFE;
-  --gold-glow:  var(--accent-glow);
-
-  --blue:        var(--accent);
-  --blue-bright: var(--accent-hover);
-  --blue-dim:    #DBEAFE;
-  --blue-glow:   var(--accent-glow);
-
-  --bg:        #FDFCFA;
-  --bg2:       #F6F3EC;
-  --surface:   #FFFFFF;
-  --surface2:  #F2EEE4;
-  --surface3:  #E8E1D0;
-  --border:    rgba(20,16,8,0.10);
-  --border-md: rgba(20,16,8,0.16);
-  --text:      #1A1712;
-  --text2:     #4A4536;
-  --muted:     #8A8270;
-
-  --glow-blue:        0 2px 12px rgba(74,128,240,0.2);
-  --glow-blue-strong: 0 4px 24px rgba(74,128,240,0.3);
-  --glow-blue-sm:     0 1px 6px rgba(74,128,240,0.14);
-  --glow-card:        0 8px 28px rgba(20,16,8,0.1);
-  --glow-text:        none;
-
-  --shadow-sm:  0 1px 3px rgba(0,0,0,0.07);
-  --shadow-md:  0 4px 16px rgba(0,0,0,0.09);
-  --shadow-lg:  0 16px 48px rgba(0,0,0,0.12);
-}
-
 /* ─────────────────────────────────────────
    BASE
 ───────────────────────────────────────── */
```

- [ ] **Step 3: Remove the `body.day .card:hover` override**

Delete the entire `body.day .card:hover { ... }` rule (all 5 lines including its braces) and the blank line after it, keeping the `GLOW UTILITIES` comment header immediately following it.

Before:
```css
body.day .card:hover {
  border-color: rgba(15,23,42,0.14);
  box-shadow: var(--glow-card);
  transform: translateY(-1px);
}

/* ─────────────────────────────────────────
   GLOW UTILITIES
───────────────────────────────────────── */
```

After:
```css
/* ─────────────────────────────────────────
   GLOW UTILITIES
───────────────────────────────────────── */
```

- [ ] **Step 4: Remove the `body.day input[...]` color-scheme override**

Before:
```css
body.day input[type="date"],
body.day input[type="time"],
body.day input[type="datetime-local"] { color-scheme: light; }

/* ─────────────────────────────────────────
   SPY / HUD UTILITIES
───────────────────────────────────────── */
```

After:
```css
/* ─────────────────────────────────────────
   SPY / HUD UTILITIES
───────────────────────────────────────── */
```

- [ ] **Step 5: Verify no light-mode CSS remains**

Run: `grep -n "body\.day\|@variant dark" app/globals.css`
Expected: no output (empty).

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: only the 8 pre-existing baseline errors listed in Global Constraints, none new (CSS changes don't affect TypeScript, but run this to confirm nothing else regressed).

Run: `npm run lint`
Expected: only the 135 pre-existing baseline problems, none new.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css
git commit -m "Remove light-mode CSS overrides from globals.css"
```

---

### Task 2: Delete the theme toggle and its persistence logic

**Files:**
- Delete: `components/layout/ThemeToggle.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/SidebarShell.tsx`
- Modify: `app/layout.tsx`

**Interfaces:** None — `ThemeToggle` is a leaf UI component with no exports consumed elsewhere beyond the two render sites removed in this task.

- [ ] **Step 1: Delete `ThemeToggle.tsx`**

Delete the file `components/layout/ThemeToggle.tsx` entirely.

- [ ] **Step 2: Remove `ThemeToggle` from `Sidebar.tsx`**

Read `components/layout/Sidebar.tsx` first to confirm current content, then apply these two edits:

Remove the import:
```diff
 import AccountMenu from "./AccountMenu";
-import ThemeToggle from "./ThemeToggle";
 import NivarroMark from "@/components/ui/NivarroMark";
```

Remove both render sites (the expanded-footer wrapper div and the collapsed-state block):

Before:
```tsx
      {/* Footer */}
      {!collapsed && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} className="md:pb-0 pb-[60px]">
          <div className="px-2 pt-2 pb-0">
            <ThemeToggle />
          </div>
          <AccountMenu
            userName={userName}
            userEmail={userEmail}
            geniusType={geniusType}
            isSchool={isSchool}
          />
        </div>
      )}
      {collapsed && (
        <div className="flex flex-col items-center gap-1 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <ThemeToggle compact />
        </div>
      )}
```

After:
```tsx
      {/* Footer */}
      {!collapsed && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} className="md:pb-0 pb-[60px]">
          <AccountMenu
            userName={userName}
            userEmail={userEmail}
            geniusType={geniusType}
            isSchool={isSchool}
          />
        </div>
      )}
```

(The collapsed-state block is removed entirely — its only content was the toggle.)

- [ ] **Step 3: Remove `ThemeToggle` from `SidebarShell.tsx`**

Read `components/layout/SidebarShell.tsx` first, then apply:

Remove the import:
```diff
 import Sidebar from "./Sidebar";
-import ThemeToggle from "./ThemeToggle";
 import type { GeniusType } from "@/data/traits";
```

Remove the render site:
```diff
         <div className="flex items-center gap-2">
-          <ThemeToggle compact />
           <button
             onClick={() => setMobileOpen(true)}
```

- [ ] **Step 4: Remove the FOUC-prevention script from `app/layout.tsx`**

Read `app/layout.tsx` first, then apply:

```diff
       <body className="antialiased" style={{ background: "var(--bg)", color: "var(--text)" }}>
-        <script
-          dangerouslySetInnerHTML={{
-            __html: `try{if(localStorage.getItem('nivarro-theme')==='light')document.body.classList.add('day')}catch(e){}`,
-          }}
-        />
         <PostHogProvider>
```

- [ ] **Step 5: Verify no dangling references**

Run: `grep -rn "ThemeToggle\|nivarro-theme" app/ components/ --include="*.tsx" --include="*.ts"`
Expected: no output (empty) — confirms the deleted component, its two render sites, and the localStorage key are fully gone.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: only the 8 pre-existing baseline errors, none new — critically, no "Cannot find module './ThemeToggle'" errors in `Sidebar.tsx` or `SidebarShell.tsx`, which would indicate a leftover reference.

Run: `npm run lint`
Expected: only the 135 pre-existing baseline problems, none new.

- [ ] **Step 7: Commit**

```bash
git add components/layout/ThemeToggle.tsx components/layout/Sidebar.tsx components/layout/SidebarShell.tsx app/layout.tsx
git commit -m "Delete theme toggle and its localStorage/FOUC persistence logic"
```

---

### Task 3: Fix inert `dark:` Tailwind classes rendering the wrong colors

**Files:**
- Modify: `app/(onboarding)/onboarding/OnboardingClient.tsx`
- Modify: `app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx`

**Interfaces:** None — pure className string edits, no props or exports change.

**Context:** Tailwind's `dark:` variant only activates when an ancestor has the `.dark` class. After Task 2, nothing in the app will ever add `.dark` (nothing did before either — this was already true). These two files use classes shaped `text-gray-400 dark:text-[#9898a8]`, meaning the app currently renders `text-gray-400` (a light-mode color) on every screen, in an app whose CSS variables are dark-only. The fix: keep only the `dark:`-prefixed value (the one actually written for a dark app) and drop both the light-mode value and the `dark:` prefix.

- [ ] **Step 1: Fix `OnboardingClient.tsx`**

Read the file first, then apply these 14 replacements. Each `old_string` occurs multiple times in the file with identical text — use a global find-and-replace for each pair (i.e. replace every occurrence, not just the first):

| Old | New |
|---|---|
| `text-gray-400 dark:text-[#9898a8]` | `text-[#9898a8]` |
| `text-gray-600 dark:text-[#9898a8]` | `text-[#9898a8]` |
| `text-gray-500 dark:text-[#9898a8]` | `text-[#9898a8]` |
| `border-gray-200 dark:border-[#2a2a33]` | `border-[#2a2a33]` |
| `bg-white dark:bg-[#16161a]` | `bg-[#16161a]` |
| `text-gray-900 dark:text-[#e8e8ec]` | `text-[#e8e8ec]` |
| `placeholder-gray-400 dark:placeholder-[#5a5a6a]` | `placeholder-[#5a5a6a]` |
| `text-gray-400 dark:text-[#5a5a6a]` | `text-[#5a5a6a]` |
| `hover:text-gray-600 dark:hover:text-[#e8e8ec]` | `hover:text-[#e8e8ec]` |
| `text-gray-500 dark:text-[#5a5a6a]` | `text-[#5a5a6a]` |
| `bg-gray-100 dark:bg-[#1e1e24]` | `bg-[#1e1e24]` |
| `hover:border-gray-300 dark:hover:border-[#2a2a33]` | `hover:border-[#2a2a33]` |
| `border-gray-300 dark:border-[#2a2a33]` | `border-[#2a2a33]` |
| `hover:border-gray-300 dark:hover:border-[#3a3a44]` | `hover:border-[#3a3a44]` |

Apply each row as a replace-all across the whole file (14 total find-and-replace operations; some patterns occur once, others up to 5 times — replace every occurrence of each). After all 14 replacements, the file should contain zero occurrences of the substring `dark:`.

- [ ] **Step 2: Fix `TeamWorkspaceClient.tsx`**

Read the file first, then apply:

```diff
-          <div className="mt-2 text-[11px] text-green-600 dark:text-green-400 font-semibold">✓ Complete</div>
+          <div className="mt-2 text-[11px] text-green-400 font-semibold">✓ Complete</div>
```

- [ ] **Step 3: Verify no `dark:` classes remain in either file**

Run: `grep -n "dark:" "app/(onboarding)/onboarding/OnboardingClient.tsx" "app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx"`
Expected: no output (empty).

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: only the 8 pre-existing baseline errors, none new.

Run: `npm run lint`
Expected: only the 135 pre-existing baseline problems, none new.

- [ ] **Step 5: Commit**

```bash
git add "app/(onboarding)/onboarding/OnboardingClient.tsx" "app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx"
git commit -m "Fix inert dark: Tailwind classes rendering wrong colors in onboarding and team workspace"
```

---

### Task 4: End-to-end manual verification

**Files:** none — verification only.

- [ ] **Step 1: Final grep sweep**

Run: `grep -rn "body\.day\|nivarro-theme\|ThemeToggle\|@variant dark" app/ components/ --include="*.tsx" --include="*.ts" --include="*.css"`
Expected: no output (empty) — confirms every piece of the light-mode/toggle mechanism is gone from the codebase.

- [ ] **Step 2: Full build check**

Run: `npx tsc --noEmit` and `npm run lint` one more time across the whole branch.
Expected: both match the pre-existing baseline exactly (8 tsc errors, 135 lint problems), zero new issues anywhere.

- [ ] **Step 3: Manual visual check (requires a local `.env`/`DATABASE_URL`, not guaranteed available)**

If a working local dev environment is available: `npm run dev`, then check:
- Any regular page loads and renders identically to how it already looked (dark) — no visible change expected.
- The sidebar footer (desktop, expanded and collapsed) no longer shows a theme toggle button.
- The mobile top bar no longer shows a theme toggle button.
- `/onboarding` renders with dark colors throughout (previously showed light-gray text/backgrounds in a few spots).
- A team workspace page's "✓ Complete" indicator renders in dark-green (`#4ade80`-family), not the lighter `text-green-600`.

If no local `.env` is available, note this step as skipped/deferred to the user, consistent with how the prior branch handled the same environment constraint — do not skip Tasks 1–3's grep/tsc/lint verification, only this manual visual pass.
