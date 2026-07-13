# Nivarro Design System Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four concrete design bugs identified in the delivered "Nivarro Design System" handoff (`~/Downloads/Nivarro Design System.zip`) — two competing accent colors (gold + "backward compat" blue), a serif font that silently falls back to Times New Roman, inconsistent card/modal corner radii, and raw hex scattered outside the token system — by adopting the handoff's final token values in the real Goal-APP codebase.

**Architecture:** Goal-APP already routes almost all color/shadow/border styling through CSS custom properties defined once in `app/globals.css` (`:root`, `body.day`) and consumed via `var(--x)` everywhere, plus a "legacy Tailwind overrides" block that force-maps old raw-hex arbitrary Tailwind classes (e.g. `bg-[#c9a84c]`) onto those same custom properties. That means the highest-leverage fix is rewriting the token *values* at the root, not renaming every `var(--blue)` call site across 50+ files. Four remaining bugs need per-component touch-ups: two Tailwind-arbitrary hex pairs that aren't covered by the legacy override block, four `rounded-xl/2xl/3xl` usages that bypass the radius tokens entirely, and one missing web font.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (CSS-first `@import "tailwindcss"`), `next/font/google`, plain CSS custom properties (no CSS-in-JS design token library).

## Global Constraints

- Source of truth for exact values: `tokens_colors.css`, `tokens_spacing.css`, `tokens_typography.css`, `tokens_fonts.css` inside the extracted handoff (`design_handoff_nivarro/`). Values there are marked "final" — recreate exactly, do not round.
- Do not rename existing CSS custom properties that are consumed in dozens of components (`--blue`, `--amber`, `--gold`, `--n-bg`, etc.) — repoint their *values* to the new spec instead. Introduce the new canonical names (`--accent`, `--accent-hover`, `--accent-dim`, `--on-accent`) alongside them as aliases.
- Semantic status colors (`--success`, `--warning`, `--error`, `--info`) and the trait/genius-type categorical palette are explicitly **out of scope** — the handoff says treat them as data-viz, not brand, and no bug was reported against them.
- The Field Dossier hero background motif, the `Toggle` component, the `Icon` (lucide-static CDN) wrapper, and the full pixel-perfect Student Dashboard UI-kit recreation are **out of scope for this plan** — they are new components/treatments, not fixes to the 4 reported bugs. Flagged as a possible follow-up plan at the end.
- Never touch `.claude/worktrees/org-communities-browse-apply-pay/` — that's a separate in-progress branch in its own worktree.
- This is a solo Windows dev environment (PowerShell/Bash tools) with no automated visual regression suite — verification is manual via the dev server + browser.

---

### Task 1: Rewrite root color tokens to the single-navy-accent system

**Files:**
- Modify: `app/globals.css:8-79` (`:root` token block)
- Modify: `app/globals.css:85-116` (`body.day` override block)
- Modify: `app/globals.css:558-617` (legacy Tailwind override block — repoint gold hex mappings from `var(--blue)` to `var(--accent)`)
- Modify: `tailwind.config.ts:28-34` (`colors.amber`), `tailwind.config.ts:69-74` (`boxShadow`)

**Interfaces:**
- Produces: `--accent`, `--accent-hover`, `--accent-dim`, `--on-accent`, `--accent-glow` (new canonical names, per spec) plus repointed values for the existing `--blue`, `--blue-bright`, `--blue-dim`, `--blue-glow`, `--amber`, `--amber-dim`, `--gold`, `--gold-glow`, `--glow-blue*` variables so every existing call site renders the new navy without being renamed.
- Consumes: nothing (root of the cascade).

- [ ] **Step 1: Replace the `:root` token block**

In `app/globals.css`, replace lines 8-79 with:

```css
:root {
  --font-body:    'Inter', sans-serif;
  --font-display: 'Anton', sans-serif;
  --font-mono:    'JetBrains Mono', monospace;
  --font-serif:   'Playfair Display', Georgia, serif;

  /* ── Single brand accent — navy (retires the separate gold + blue systems) ── */
  --accent:       #4A80F0;
  --accent-hover: #6A9FFF;
  --accent-dim:   #0B3155;
  --accent-glow:  rgba(74,128,240,0.5);
  --on-accent:    #0B0B0D;

  /* ── Legacy accent variable names — repointed to the same navy so every
       existing var(--blue)/var(--amber)/var(--gold) call site updates for
       free without a mass rename across components ── */
  --amber:         var(--accent);
  --amber-dim:     var(--accent-dim);
  --gold:          var(--accent);
  --gold-light:    var(--accent-hover);
  --gold-dim:      #6B6560;
  --gold-glow:     var(--accent-glow);
  --cream:         #F2EDE4;
  --ink-mute:      #6B6560;
  --hairline:      rgba(74,128,240,.22);

  --blue:        var(--accent);
  --blue-bright: var(--accent-hover);
  --blue-dim:    var(--accent-dim);
  --blue-glow:   var(--accent-glow);

  /* ── Category accents (data-viz only, untouched) ── */
  --cat-design:    #A78BFA;
  --cat-eng:       #22D3EE;
  --cat-ent:       #E8893A;
  --cat-impact:    #4ADE80;
  --cat-health:    #38BDF8;
  --cat-community: #FB923C;

  /* ── Warm near-black surfaces → cool near-black per spec ── */
  --n-bg:       #08080A;
  --n-bg2:      #0B0B0D;
  --n-surface:  #111113;
  --n-surface2: #17171A;
  --n-surface3: #1E1E22;
  --n-border:   rgba(255,255,255,0.08);
  --n-border-md:rgba(255,255,255,0.14);
  --n-text:     #ECECEF;
  --n-text2:    #B4B4C0;
  --n-muted:    #838394;

  /* ── Active (dark default) ── */
  --bg:        var(--n-bg);
  --bg2:       var(--n-bg2);
  --surface:   var(--n-surface);
  --surface2:  var(--n-surface2);
  --surface3:  var(--n-surface3);
  --border:    var(--n-border);
  --border-md: var(--n-border-md);
  --text:      var(--n-text);
  --text2:     var(--n-text2);
  --muted:     var(--n-muted);

  /* ── Glow system ── */
  --glow-blue:        0 0 24px rgba(74,128,240,0.5), 0 0 6px rgba(74,128,240,0.3);
  --glow-blue-strong: 0 0 40px rgba(74,128,240,0.7), 0 0 12px rgba(74,128,240,0.5);
  --glow-blue-sm:     0 0 12px rgba(74,128,240,0.35);
  --glow-card:        0 0 0 1px rgba(74,128,240,0.15), 0 8px 32px rgba(0,0,0,0.8);
  --glow-text:        0 0 20px rgba(74,128,240,0.7);

  /* ── Sidebar width (JS-driven for collapse) ── */
  --sidebar-w: 220px;

  /* ── Radius & shadow — soft-by-default per final tokens; sharp reticle
       (.bracket-card) stays reserved for 1-2 hero moments per screen ── */
  --radius-none: 0px;
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  14px;
  --radius-full: 9999px;
  --shadow-sm:  0 1px 4px rgba(0,0,0,0.9);
  --shadow-md:  0 4px 20px rgba(0,0,0,0.9);
  --shadow-lg:  0 16px 48px rgba(0,0,0,0.95);
}
```

- [ ] **Step 2: Replace the `body.day` override block**

Replace lines 85-116 (now shifted slightly by Step 1's edit — locate by the `body.day {` selector immediately following the LIGHT MODE comment) with:

```css
body.day {
  --accent:       #14507F;
  --accent-hover: #0B3155;
  --accent-dim:   #0B3155;
  --accent-glow:  rgba(74,128,240,0.24);
  --on-accent:    #FFFFFF;

  --amber: var(--accent);
  --gold:  var(--accent);
  --gold-light: var(--accent-hover);
  --gold-dim:   #DBEAFE;
  --gold-glow:  var(--accent-glow);

  --blue:        var(--accent);
  --blue-bright: var(--accent-hover);
  --blue-dim:    #DBEAFE;
  --blue-glow:   var(--accent-glow);

  --bg:        #FDFCFA;
  --bg2:       #F6F3EC;
  --surface:   #FFFFFF;
  --surface2:  #F2EEE4;
  --surface3:  #E8E1D0;
  --border:    rgba(20,16,8,0.10);
  --border-md: rgba(20,16,8,0.16);
  --text:      #1A1712;
  --text2:     #4A4536;
  --muted:     #8A8270;

  --glow-blue:        0 2px 12px rgba(74,128,240,0.2);
  --glow-blue-strong: 0 4px 24px rgba(74,128,240,0.3);
  --glow-blue-sm:     0 1px 6px rgba(74,128,240,0.14);
  --glow-card:        0 8px 28px rgba(20,16,8,0.1);
  --glow-text:        none;

  --shadow-sm:  0 1px 3px rgba(0,0,0,0.07);
  --shadow-md:  0 4px 16px rgba(0,0,0,0.09);
  --shadow-lg:  0 16px 48px rgba(0,0,0,0.12);
}
```

- [ ] **Step 3: Repoint the legacy Tailwind gold-hex overrides from blue to accent**

In the `LEGACY TAILWIND OVERRIDES` section (originally lines 563-617), every rule that currently maps a gold hex (`#c9a84c`, `#e3c06a`) to `var(--blue)`/`var(--blue-bright)` already resolves correctly because Step 1 made `--blue` an alias of `--accent` — **no edit needed there**. Instead, extend the block so the two alpha-hex variants used in `ProfileCard.tsx`/`SkillCard.tsx` that are *not* currently covered also resolve, by adding these two lines directly after the existing `.bg-\[#c9a84c10\]...` rule (originally line 608):

```css
.bg-\[#c9a84c20\] { background-color: rgba(74,128,240,0.13) !important; }
.ring-\[#c9a84c30\] { --tw-ring-color: rgba(74,128,240,0.19) !important; }
```

(Task 4 below replaces these specific classes at the component level anyway, but keeping the safety-net override means any other undiscovered usage of the same arbitrary classes elsewhere in the codebase is covered too.)

- [ ] **Step 4: Update `tailwind.config.ts` accent color + confirm shadow tokens**

In `tailwind.config.ts`, replace the `amber` block (lines 29-34):

```ts
        // Brand accent (single navy accent — replaces the old gold system)
        amber: {
          DEFAULT: "#4A80F0",
          light: "#6A9FFF",
          dark: "#14507F",
          subtle: "rgba(74,128,240,0.10)",
        },
```

Leave `boxShadow.card-hover` and `boxShadow["amber-glow"]` (lines 69-74) unchanged — they already use `rgba(74,128,240,...)`, which now matches `globals.css` instead of conflicting with it.

- [ ] **Step 5: Verify no CSS parse errors**

Run: `cd "C:\Users\thoma\Goal-APP" && npx next lint --dir app --dir components 2>&1 | head -n 40`
Expected: no new errors introduced (pre-existing lint warnings unrelated to this change are fine).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tailwind.config.ts
git commit -m "fix: unify gold+blue accent systems into single navy token"
```

---

### Task 2: Fix the broken serif font (the literal "hard to read font" bug)

**Files:**
- Modify: `app/layout.tsx:1-15`

**Interfaces:**
- Consumes: `tailwind.config.ts`'s existing `fontFamily.serif = ["var(--font-playfair)", "Georgia", "serif"]` (already correct — untouched).
- Produces: a real `--font-playfair` CSS variable populated by `next/font/google`, so any `font-serif` Tailwind class (and any inline `font-family: var(--font-serif)`, once Task 1's `--font-serif` token is in place) renders actual Playfair Display instead of falling back to the browser's default Times New Roman.

- [ ] **Step 1: Import and configure Playfair Display**

In `app/layout.tsx`, change the import on line 2:

```ts
import { Anton, Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
```

- [ ] **Step 2: Add the font loader**

After the `jetbrainsMono` const block (originally lines 24-29), add:

```ts
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
```

- [ ] **Step 3: Wire the variable onto `<html>`**

Change line 43 (the `<html className=...>` line) from:

```tsx
    <html lang="en" className={`${anton.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
```

to:

```tsx
    <html lang="en" className={`${anton.variable} ${inter.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable}`}>
```

- [ ] **Step 4: Verify the font actually loads**

Run: `cd "C:\Users\thoma\Goal-APP" && npm run dev` (background), then open `http://localhost:3000/login` in a browser and inspect the page title / mission-statement text that uses `font-serif` — it should render as an elegant serif with visible ligature/contrast styling (Playfair Display), not a plain Times New Roman fallback. Use the `browse`/`run` skill or DevTools "Computed" panel on the element to confirm `font-family` resolves to `"Playfair Display"` and the Network tab shows the Google Fonts request succeeding.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "fix: load Playfair Display so --font-serif actually renders"
```

---

### Task 3: Normalize corner radius — replace stray `rounded-xl/2xl/3xl` with the token scale

**Files:**
- Modify: `components/AnimalArchetypeCard.tsx:352`, `components/AnimalArchetypeCard.tsx:378`
- Modify: `components/ui/ApplyModal.tsx:102`, `components/ui/ApplyModal.tsx:196`, `components/ui/ApplyModal.tsx:292`
- Modify: `components/layout/AccountMenu.tsx:54`

**Interfaces:**
- Consumes: `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (14px) from Task 1.
- Produces: nothing consumed elsewhere — purely visual normalization. `rounded-full` usages (avatars, dots, pill filters, glow blobs) are correct as-is and must NOT be changed.

- [ ] **Step 1: Fix `AnimalArchetypeCard.tsx` compact row and full card**

Line 352, change:
```tsx
        className="flex items-center gap-3 rounded-xl px-3 py-2"
```
to:
```tsx
        className="flex items-center gap-3 px-3 py-2"
        style={{
          borderRadius: "var(--radius-md)",
```
(merge into the existing `style={{` object that already starts two lines below it — i.e. the final block reads `background: animal.bgColor, border: ..., borderRadius: "var(--radius-md)"`.)

Line 378, change:
```tsx
      className="rounded-2xl overflow-hidden flex flex-col"
```
to:
```tsx
      className="overflow-hidden flex flex-col"
      style={{
        borderRadius: "var(--radius-lg)",
```
(again merging into the existing adjacent `style={{` object.)

- [ ] **Step 2: Fix `ApplyModal.tsx` shell, list row, and submit button**

Line 102, change:
```tsx
        className="relative w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col"
```
to:
```tsx
        className="relative w-full sm:max-w-lg overflow-hidden flex flex-col"
        style={{
          borderRadius: "var(--radius-lg)",
```
(merge into the existing `style={{ background: "var(--surface)", ...` object two lines below.)

Line 196, change:
```tsx
                          "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors",
```
to:
```tsx
                          "w-full flex items-center gap-3 p-2.5 text-left transition-colors",
```
and add `style={{ borderRadius: "var(--radius-md)" }}` to that row's JSX element (it currently has no `style` prop — add one alongside the `className`).

Line 292, change:
```tsx
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
```
to:
```tsx
              className="flex-1 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
```
and add `borderRadius: "var(--radius-md)"` into the existing `style={{ background: "var(--blue)", color: "#05080F" }}` object on the next line.

(Leave `ApplyModal.tsx:162` and `:226`, both `rounded-full`, unchanged — they are a filter pill and a radio circle, both legitimate circles.)

- [ ] **Step 3: Fix `AccountMenu.tsx` dropdown panel**

Line 54, change:
```tsx
          className="absolute bottom-full left-3 right-3 mb-2 rounded-xl p-4 z-50"
```
to:
```tsx
          className="absolute bottom-full left-3 right-3 mb-2 p-4 z-50"
```
and add `borderRadius: "var(--radius-lg)"` into the existing `style={{ background: "var(--surface)", ...` object below it.

- [ ] **Step 4: Visual check**

Run the dev server (`npm run dev` in `C:\Users\thoma\Goal-APP`) and open `/dashboard` (any demo scholar account, see project memory for credentials), open the account menu dropdown, open an "Apply" modal from a project card, and view a profile with an animal archetype badge — all four should now show a consistent soft 10-14px corner radius instead of Tailwind's default `0.75rem`/`1rem`/`1.5rem` values.

- [ ] **Step 5: Commit**

```bash
git add components/AnimalArchetypeCard.tsx components/ui/ApplyModal.tsx components/layout/AccountMenu.tsx
git commit -m "fix: normalize card/modal corner radius to design tokens"
```

---

### Task 4: Replace raw gold hex not covered by the token system

**Files:**
- Modify: `components/profile/ProfileCard.tsx:34-43`
- Modify: `components/profile/SkillCard.tsx:60`, `components/profile/SkillCard.tsx:66`

**Interfaces:**
- Consumes: `--accent`, `--surface`, `--border`, `--text`, `--radius-md` from Task 1.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Rewrite `ProfileCard.tsx`'s hardcoded shell + avatar classes**

Line 34, change:
```tsx
    <div className="group bg-[#0d0d0e] border border-[#1c1c20] rounded-[10px] p-5 flex flex-col gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_0_1px_rgba(74,128,240,0.15)] hover:border-[#28282e] transition-all duration-200">
```
to:
```tsx
    <div
      className="group p-5 flex flex-col gap-4 transition-all duration-200"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
```

This element's hover state was previously carried entirely by inline Tailwind `hover:` classes; since those are removed, add the existing global `card` class name (already defined in `app/globals.css:223-235`, with its own `:hover` border/shadow/lift rule) so the same behavior is restored for free:

```tsx
      className="group card p-5 flex flex-col gap-4 transition-all duration-200"
```

Line 37, change:
```tsx
        <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold bg-[#c9a84c20] text-[#c9a84c] ring-1 ring-[#c9a84c30]">
```
to:
```tsx
        <div
          className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
          style={{
            background: "rgba(74,128,240,0.13)",
            color: "var(--accent)",
            boxShadow: "0 0 0 1px rgba(74,128,240,0.19)",
          }}
        >
```

- [ ] **Step 2: Rewrite `SkillCard.tsx`'s two avatar variants**

Line 60, change:
```tsx
              className={`rounded-full object-cover ring-1 ring-[#c9a84c30] ${
```
to:
```tsx
              className={`rounded-full object-cover ${
```
and add `style={{ boxShadow: "0 0 0 1px rgba(74,128,240,0.19)" }}` onto that `<img>` element.

Line 66, change:
```tsx
              className={`rounded-full flex items-center justify-center font-bold bg-[#c9a84c20] text-[#c9a84c] ring-1 ring-[#c9a84c30] ${
```
to:
```tsx
              className={`rounded-full flex items-center justify-center font-bold ${
```
and add
```tsx
              style={{
                background: "rgba(74,128,240,0.13)",
                color: "var(--accent)",
                boxShadow: "0 0 0 1px rgba(74,128,240,0.19)",
              }}
```
onto that `<div>` element.

- [ ] **Step 2: Visual check**

Open `/profile/[handle]` for a seeded demo scholar (e.g. `priya`) and a team/community listing that renders `SkillCard` — both avatar badges and the ProfileCard shell should render navy, not gold, and match the hover-lift behavior of other `.card` elements in the app.

- [ ] **Step 3: Commit**

```bash
git add components/profile/ProfileCard.tsx components/profile/SkillCard.tsx
git commit -m "fix: replace hardcoded gold hex with navy accent tokens"
```

---

### Task 5: Full-app visual regression pass

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `cd "C:\Users\thoma\Goal-APP" && npm run dev`

- [ ] **Step 2: Walk the core screens**

Using a browser (or the `browse`/`run` skill), visit and screenshot, comparing against the handoff's `ui_kit_student-dashboard/index.bundled.html` reference where applicable:
- `/login` — check the serif mission line and single navy CTA/focus ring (no gold anywhere)
- `/dashboard` — sidebar active state, project cards, community cards
- `/profile/[handle]` — ProfileCard, SkillCard, AnimalArchetypeCard
- Any org/school screens touched incidentally by the token change (spot check `/orgs/[orgId]`)

Confirm: no element shows `#E8893A`/`#C9A84C`/`#E6BE7A` (old gold hex) via DevTools color picker; all card/modal corners are visibly rounded (6-14px) rather than sharp 0px or Tailwind's oversized defaults; serif text is genuinely serif, not Times New Roman.

- [ ] **Step 3: Push and trigger deploy (only if requested by user)**

Per project convention: commit → push to GitHub → trigger Render deploy hook via Node.js (see project memory `Render Deploy Hook` and `Nivarro Dev Patterns` — do not use curl/PowerShell for the HTTPS call). Do not push/deploy without explicit user confirmation.

---

## Out of scope / possible follow-up plan

The handoff also specifies a `Toggle` component, an `Icon` wrapper for CDN-hosted Lucide glyphs, a `BriefingHeader`/`HudSectionHeader` pair, and the "Field Dossier" duotone hero background motif (circular collage + geometric-cut variants) applied to the dashboard hero and login screen. None of these fix a *reported* bug — they're new visual treatments from the UI kit recreation. If the user wants the fuller pixel-perfect dashboard recreation shown in `ui_kit_student-dashboard/`, that should be scoped as a separate plan after this one lands and is confirmed visually correct.
