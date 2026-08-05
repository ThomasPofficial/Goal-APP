# Theme Follow-Up Fixes — Design

## Context

The "Remove Light Mode" branch (merged into `main` as commit `b3b686a`) deleted the app's light-mode CSS, toggle UI, and persistence logic. Its final whole-branch review flagged three Minor, non-blocking follow-ups — all pre-existing gaps the removal surfaced rather than caused:

1. Deleting `body.day input[type=date|time|datetime-local] { color-scheme: light; }` left the codebase with **no `color-scheme` declaration anywhere**, so native browser chrome (date pickers, scrollbars, `<select>` dropdowns, autofill) renders light-themed in an otherwise all-dark app. Three components already work around this per-input with an inline `style={{ colorScheme: "dark" }}` (`app/(dashboard)/people/SmartSearch.tsx:387,402`, `app/(dashboard)/profile/ProfileEditor.tsx:148`), but a fourth date input (`app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx:555`) has no such workaround.
2. Removing `@variant dark (&:is(.dark *));` from `app/globals.css` didn't remove Tailwind's `dark:` prefix — Tailwind v4 ships it as a built-in variant defaulting to `@media (prefers-color-scheme: dark)`. Before removal, `dark:` was permanently inert (keyed to a `.dark` class nothing ever applies); after removal, it's live and keyed to the visitor's OS preference instead. Zero `dark:` classes exist in the codebase today (verified), so there's no practical impact yet — but it's a latent footgun: a future `dark:` class would silently render its light-mode value for any visitor whose OS is set to light mode, in an app with no light mode.
3. Running `npm run lint` from the main checkout root (not from inside a worktree) produces 19,519 false problems instead of the real 134, because ESLint's file discovery walks into `.claude/worktrees/`, which physically contains full copies of every sibling git worktree's source tree, and that path isn't in `eslint.config.mjs`'s `globalIgnores`. Confirmed `.claude/` contains nothing else (`ls -d .claude/*/` → only `worktrees/`).

## Goal

Close all three gaps with minimal, targeted changes — no new abstractions, no scope beyond what each gap actually requires.

## Changes

1. **`app/globals.css`** — add `color-scheme: dark;` as the first declaration inside the `:root` block (alongside the existing font/color tokens). This is now the single global source of truth for native widget theming, so the three inline `style={{ colorScheme: "dark" }}` workarounds become redundant and are removed:
   - `app/(dashboard)/people/SmartSearch.tsx:387` and `:402` — drop the `style={{ colorScheme: "dark" }}` prop.
   - `app/(dashboard)/profile/ProfileEditor.tsx:148` — same.
   
   No workaround is added to `TeamWorkspaceClient.tsx:555` — the global declaration covers it automatically.

2. **`app/globals.css`** — restore `@variant dark (&:is(.dark *));` as the first line (immediately after `@import "tailwindcss";`, exactly where it lived before removal). This re-keys `dark:` to a class that is never applied anywhere in the app (confirmed zero `.dark`/`classList` usage exists), making it permanently inert again — for a documented reason this time, not by accident.

3. **`eslint.config.mjs`** — add `".claude/worktrees/**"` to the existing `globalIgnores` array, alongside `.next/**`, `out/**`, `build/**`, `next-env.d.ts`.

## Non-goals

No custom ESLint rule banning `dark:` usage (a code comment + the restored inert `@variant dark` binding is sufficient insurance for a problem that doesn't currently exist). No changes to `tailwind.config.ts`'s color-token loading (flagged as a separate, unrelated, out-of-scope observation in the final review — nothing currently depends on it, not touched here).

## Testing

Same constraint as both prior branches: no local `.env`/`DATABASE_URL` is available in this environment, so live browser verification isn't possible here. Verification is `npx tsc --noEmit` (no impact expected — CSS/config-only changes plus two trivial prop removals) and `npm run lint` scoped correctly (either from inside a worktree, or from the main checkout after fix #3 lands, confirming the true baseline of ~134 problems, not the false 19,519). A manual visual pass — confirming a date input's calendar popup renders dark-themed, and that `SmartSearch`/`ProfileEditor`'s date/time inputs still render correctly without their inline style — is deferred to the user, consistent with prior branches.
