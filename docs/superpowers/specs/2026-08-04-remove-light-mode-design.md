# Remove Light Mode — Design

## Context

The app's theming is a custom CSS-variable + body-class system, not a library (`next-themes` is not installed) and not `prefers-color-scheme`-driven. Dark is already the default and only theme most users see:

- `app/globals.css` `:root` (lines 8–94) defines the dark palette unconditionally — this is the active theme with no class needed.
- A `body.day` block (lines 100–138), plus two smaller light-only rules (line 259, 533–535), override the same CSS variable names with light values, activated only when `<body>` has the `day` class.
- `components/layout/ThemeToggle.tsx` is a client component that toggles `body.classList` `"day"` and persists the choice to `localStorage["nivarro-theme"]`. It defaults to `"dark"` on first load — light mode is a manual opt-in, never a system preference.
- `app/layout.tsx` has an inline pre-hydration script that reads `localStorage["nivarro-theme"]` and adds the `day` class before paint, to prevent a flash of the wrong theme.
- `ThemeToggle` is rendered in three places: `components/layout/Sidebar.tsx` (expanded and collapsed states) and `components/layout/SidebarShell.tsx` (mobile top bar).
- `globals.css` also declares `@variant dark (&:is(.dark *));`, wiring Tailwind's `dark:` variant to a `.dark` ancestor class — but nothing in the codebase ever applies `.dark` to any element. This makes the variant permanently inert.

**Pre-existing bug found during investigation (in scope per user decision):** `app/(onboarding)/onboarding/OnboardingClient.tsx` (~20 occurrences) and `app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx` (1 occurrence) use Tailwind classes shaped `text-gray-400 dark:text-[#9898a8]` — a light-mode value with a `dark:`-prefixed dark-mode value. Since `.dark` is never applied, these currently render the light-mode value on every user's screen, regardless of their theme choice — the only two places where the app doesn't actually render dark by default. This is inconsistent with the rest of the app's dark-default design.

## Goal

Force dark as the app's single theme. Remove the toggle UI and the CSS/persistence machinery that supports switching to light. Fix the two files whose Tailwind classes are currently rendering wrong (light) colors, so "removing light mode" doesn't leave two screens that already looked light-mode-ish by accident.

**Non-goals:** changing the dark palette's actual color values (untouched — `:root`'s existing values become the only theme, no visual change for any page that was already rendering correctly); adopting a theming library; touching `tailwind.config.ts`'s hardcoded dark palette (still valid, unrelated to the `body.day` mechanism); any file outside the ones listed below (blast-radius scan found no other light-mode-specific logic).

## Changes

1. **`app/globals.css`** — delete the `body.day { ... }` block (lines 100–138) and the two smaller light-only rules (`body.day .card:hover` at line 259; the `body.day input[type=date/time]` color-scheme rule at lines 533–535). Delete the `@variant dark (&:is(.dark *));` declaration (line 2) since no element will apply `.dark` after step 5 removes the last other dark-mode-adjacent mechanism. The `:root` block is untouched — it already holds every value the app needs, unconditionally.
2. **`components/layout/ThemeToggle.tsx`** — delete the file.
3. **`components/layout/Sidebar.tsx`** — remove both `<ThemeToggle />` render sites (expanded footer and collapsed variant) and the now-unused import.
4. **`components/layout/SidebarShell.tsx`** — remove the `<ThemeToggle compact />` render site (mobile top bar) and the now-unused import.
5. **`app/layout.tsx`** — remove the inline `<script dangerouslySetInnerHTML>` FOUC-prevention snippet that reads `localStorage["nivarro-theme"]` — with only one theme, there's nothing to flash-correct.
6. **`app/(onboarding)/onboarding/OnboardingClient.tsx`** — for each `dark:`-paired class (e.g. `text-gray-400 dark:text-[#9898a8]`), keep only the `dark:`-prefixed value (the one actually written for a dark-default app) and drop both the light-mode value and the `dark:` prefix, so the class becomes e.g. `text-[#9898a8]`.
7. **`app/(dashboard)/teams/[teamId]/TeamWorkspaceClient.tsx`** — same treatment for its one occurrence (`text-green-600 dark:text-green-400` → `text-green-400`).

## Testing

No local `.env`/`DATABASE_URL` is available in this environment (same constraint as the prior branch), so live browser verification isn't possible here — verification is `npx tsc --noEmit` and `npm run lint`, confirming no orphaned imports or dangling references to `ThemeToggle`, `"day"`, or `nivarro-theme` anywhere in the codebase (grep-verified, not just the listed files). A manual visual pass is deferred to whoever has a working local environment: load any page and confirm it renders identically to how dark mode already looked (expected — this change removes an alternate theme, it doesn't change the default one), and specifically check `/onboarding` and a team workspace page, which are the only two screens whose rendered colors actually change.
