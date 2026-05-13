# Nivarro — Mobile Responsiveness + Visual Overhaul

**Date:** 2026-05-13  
**Status:** Approved

---

## Problem

1. App is broken on mobile — sidebar is fixed 220px wide with no breakpoint, `pl-[220px]` on main pushes content off-screen on phones.
2. Color palette is "navy on black" — `#04070F` bg with `#0A1020` surfaces has almost no contrast, everything looks muddy.
3. Font is Syne for display — mockup specifies Cormorant Garamond for headings, which gives the premium serif quality the brand needs.
4. Messages is a fixed side-by-side split — unusable on mobile.
5. Card grids are not responsive — everything stays 2-column on tiny screens.

---

## Design

### 1. Color Palette — replace globals.css tokens

Adopt the mockup's palette exactly. Key changes:
- Background stays dark (`#05080F`) but surfaces use more separated values (`#090E1A`, `#0D1525`, `#111C32`) so cards visually lift off the bg
- More contrast between `--bg`, `--surface`, `--surface2`, `--surface3`
- Muted text lightened from `#5A5448` to `#8A8898` for readability

```
--n-bg:       #05080F   (was #04070F)
--n-bg2:      #090E1A   (was #070C18)
--n-surface:  #0D1525   (was #0A1020) ← key fix, more visible
--n-surface2: #111C32   (was #0F1830)
--n-surface3: #162038   (was #141F3A)
--n-text:     #EAE8E0   (was #F0EDE4)
--n-text2:    #8A8898   (was #B8B0A0)
--n-muted:    #5A5570   (was #5A5448)
--n-border:   rgba(201,168,76,0.12)  (was 0.10)
--n-border-md:rgba(201,168,76,0.28)  (was 0.22)
```

Day mode: unchanged — already works well.

### 2. Typography — swap display font

Replace Syne with Cormorant Garamond for `--font-display`. Update `app/layout.tsx`:
- Import `Cormorant_Garamond` instead of `Syne`
- Weights: 300, 400, 500, 600 (normal + italic)
- Keep DM Sans for body, DM Mono for mono
- All existing `font-family: var(--font-display)` refs auto-update — no other files need changes

### 3. Mobile Sidebar — drawer pattern

**Sidebar.tsx** becomes responsive:
- `md+`: current behavior — `fixed left-0 w-[220px]`, always visible
- `< md`: hidden off-screen (`-translate-x-full`), slides in when `open=true`
- State: `const [mobileOpen, setMobileOpen] = useState(false)` inside Sidebar
- Overlay: dark semi-transparent backdrop rendered when `mobileOpen`, click closes drawer
- Close button (`X`) inside the drawer on mobile

**Dashboard layout.tsx**:
- Mobile top bar: `fixed top-0 left-0 right-0 h-14 z-30` — logo left, hamburger right — visible only `< md`
- Main content: `md:pl-[220px] pl-0 md:pt-0 pt-14`
- Pass `onMobileOpen` callback from layout → Sidebar OR use a shared state via context

Implementation choice: use a `MobileHeader` client component that manages its own open state, passing it down to Sidebar via a shared Zustand-style atom — BUT since we're avoiding new libraries, use a simpler approach: make Sidebar self-contained with its own `useState`, and render a separate `MobileMenuButton` that lives in the top bar and triggers an event. Simplest: lift state into a `SidebarShell` client wrapper that renders both the mobile header button and the sidebar drawer.

### 4. Messages — mobile stacked layout

In `MessagesClient.tsx`:
- Add `const [showThread, setShowThread] = useState(false)` 
- On `< md`: render either the list (when `!showThread`) or the thread (when `showThread`) — never both
- Clicking a conversation on mobile: `setActiveId(id); setShowThread(true)`
- Thread header on mobile: add `← Back` button that sets `setShowThread(false)`
- On `md+`: current side-by-side layout unchanged (CSS `hidden md:flex` / `flex md:hidden` pattern)

### 5. Card Grid Responsiveness

All 2-column grids get `grid-cols-1 sm:grid-cols-2`:
- Dashboard stat row: `grid-cols-2 sm:grid-cols-4`
- Org cards grid
- Peers/people grid
- Projects grid

All pages use inline `style` for colors but Tailwind for layout — responsive classes can be added without breaking existing style props.

---

## Files Changed

| File | Change |
|------|--------|
| `app/globals.css` | New color tokens |
| `app/layout.tsx` | Cormorant Garamond instead of Syne |
| `components/layout/Sidebar.tsx` | Mobile drawer + overlay |
| `components/layout/SidebarShell.tsx` | New client wrapper, manages mobile open state |
| `app/(dashboard)/layout.tsx` | Mobile top bar, responsive padding |
| `app/(dashboard)/messages/MessagesClient.tsx` | Mobile stacked view |
| `app/(dashboard)/dashboard/DashboardClient.tsx` | Responsive grid classes |
| `app/(dashboard)/peers/PeersClient.tsx` | Responsive grid |
| `app/(dashboard)/orgs/OrgsClient.tsx` | Responsive grid (if exists) |

---

## Out of Scope

- No new pages or features
- No backend changes
- No animation library additions
- Auth pages already mobile-friendly (centered card layout)
