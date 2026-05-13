# Mobile + Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken mobile layout, increase color contrast between surfaces, and swap display font to Cormorant Garamond to match the mockup's premium visual style.

**Architecture:** Color tokens and font live in `globals.css` / `layout.tsx`. Mobile sidebar is handled by a new `SidebarShell` client wrapper that owns the `mobileOpen` boolean and renders both the mobile top bar and the sidebar drawer. Messages gets a `showThread` toggle for mobile stacking. All other pages just need responsive Tailwind grid classes added.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, CSS custom properties, next/font/google

---

## File Map

| File | Action |
|------|--------|
| `app/globals.css` | Update color tokens — more contrast between surfaces |
| `app/layout.tsx` | Swap Syne → Cormorant Garamond for `--font-display` |
| `components/layout/SidebarShell.tsx` | **New** — client wrapper, owns `mobileOpen` state, renders mobile top bar + passes toggle to Sidebar |
| `components/layout/Sidebar.tsx` | Accept `mobileOpen` + `onClose` props, add drawer + overlay markup |
| `app/(dashboard)/layout.tsx` | Use `SidebarShell`, add `md:pl-[220px] pt-14 md:pt-0` |
| `app/(dashboard)/messages/MessagesClient.tsx` | Add `showThread` mobile state, stacked layout on `< md` |
| `app/(dashboard)/dashboard/DashboardClient.tsx` | Responsive grid classes on stat row and opp cards |
| `app/(dashboard)/orgs/OrgsClient.tsx` | Responsive grid on org cards |
| `app/(dashboard)/peers/PeersClient.tsx` | Responsive grid on peer cards |

---

## Task 1: Update color tokens in globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the `:root` night token block**

Open `app/globals.css`. Replace the entire `:root { ... }` block (lines 1-33) with:

```css
@import "tailwindcss";
@variant dark (&:is(.dark *));

:root {
  --gold: #C9A84C;
  --gold-light: #E8D08A;
  --gold-dim: #8A5F10;
  --gold-glow: rgba(201,168,76,0.18);

  /* NIGHT (default) — more separated surfaces for visibility */
  --n-bg:       #05080F;
  --n-bg2:      #090E1A;
  --n-surface:  #0D1525;
  --n-surface2: #111C32;
  --n-surface3: #162038;
  --n-border:   rgba(201,168,76,0.12);
  --n-border-md:rgba(201,168,76,0.28);
  --n-text:     #EAE8E0;
  --n-text2:    #8A8898;
  --n-muted:    #5A5570;

  /* Active (night default) */
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
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "fix: increase surface contrast in night palette"
```

---

## Task 2: Swap display font to Cormorant Garamond

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace the font imports and variables**

Replace the entire content of `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nivarro — Build your team",
  description:
    "A platform for ambitious people to connect, understand each other's strengths, and build effective teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body className="antialiased" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "fix: swap Syne to Cormorant Garamond for display font"
```

---

## Task 3: Create SidebarShell client wrapper

**Files:**
- Create: `components/layout/SidebarShell.tsx`

This component owns the `mobileOpen` boolean, renders the mobile top bar (hamburger + logo, visible only on `< md`), and passes the state down to Sidebar.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import type { GeniusType } from "@/data/traits";

interface Props {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
}

export default function SidebarShell({ userName, userEmail, geniusType }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar — hidden on md+ */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: 56,
          background: "var(--n-bg2)",
          borderBottom: "1px solid var(--border-md)",
        }}
      >
        <span
          className="text-lg font-black tracking-widest uppercase"
          style={{ fontFamily: "var(--font-display, sans-serif)", color: "var(--gold)", letterSpacing: "0.15em" }}
        >
          NIVARRO
        </span>
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ color: "var(--text2)" }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Overlay — mobile only */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        userName={userName}
        userEmail={userEmail}
        geniusType={geniusType}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/SidebarShell.tsx
git commit -m "feat: add SidebarShell client wrapper with mobile hamburger"
```

---

## Task 4: Update Sidebar for mobile drawer

**Files:**
- Modify: `components/layout/Sidebar.tsx`

Accept `mobileOpen` and `onMobileClose` props. On `md+` the sidebar is fixed as before. On `< md` it slides in from the left.

- [ ] **Step 1: Replace full Sidebar.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import AccountMenu from "./AccountMenu";
import { cn } from "@/lib/utils";
import type { GeniusType } from "@/data/traits";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/peers", label: "Peers" },
  { href: "/orgs", label: "Orgs" },
  { href: "/teams", label: "Teams" },
  { href: "/messages", label: "Messages" },
];

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ userName, userEmail, geniusType, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full w-[220px] flex flex-col z-40 transition-transform duration-300",
        // Desktop: always visible
        "md:translate-x-0",
        // Mobile: slide in/out
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
      style={{
        background: "var(--n-bg2)",
        borderRight: "1px solid var(--border-md)",
      }}
    >
      {/* Logo row — close button on mobile */}
      <div
        className="flex items-center justify-between px-5 h-14 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="text-xl font-black tracking-widest uppercase"
          style={{
            fontFamily: "var(--font-display, 'Cormorant Garamond', sans-serif)",
            color: "var(--gold)",
            letterSpacing: "0.15em",
          }}
        >
          NIVARRO
        </span>
        <button
          onClick={onMobileClose}
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-md"
          style={{ color: "var(--muted)" }}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}
        >
          Navigation
        </p>
        {navItems.map(({ href, label }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all border-l-2",
              )}
              style={{
                borderLeftColor: active ? "var(--gold)" : "transparent",
                background: active ? "rgba(201,168,76,0.07)" : "transparent",
                color: active ? "var(--gold)" : "var(--text2)",
                fontFamily: "var(--font-body, sans-serif)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(201,168,76,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text2)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                }
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Account section */}
      <AccountMenu
        userName={userName}
        userEmail={userEmail}
        geniusType={geniusType}
      />
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: sidebar mobile drawer with slide-in transition"
```

---

## Task 5: Update dashboard layout for mobile

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

Replace `Sidebar` with `SidebarShell`. Add `pt-14 md:pt-0` to push content below the mobile top bar. Change `pl-[220px]` to `md:pl-[220px]`.

- [ ] **Step 1: Replace layout.tsx**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SidebarShell from "@/components/layout/SidebarShell";
import type { GeniusType } from "@/data/traits";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true, geniusType: true },
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <SidebarShell
        userName={profile?.displayName ?? session.user.name}
        userEmail={session.user.email}
        geniusType={(profile?.geniusType as GeniusType | null) ?? null}
      />
      <main className="md:pl-[220px] min-h-screen pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "fix: dashboard layout responsive — mobile top bar offset, no sidebar overlap"
```

---

## Task 6: Messages — mobile stacked view

**Files:**
- Modify: `app/(dashboard)/messages/MessagesClient.tsx`

Add `showThread` state. On mobile, show only the list or only the thread. On `md+`, show both side by side as before.

- [ ] **Step 1: Add showThread state and back button**

Find the `export default function MessagesClient` block. Add `showThread` state right after the other `useState` declarations:

```tsx
const [showThread, setShowThread] = useState(false);
```

- [ ] **Step 2: Update conversation click handler**

Find every `onClick={() => setActiveId(conv.id)}` on conversation list items and replace with:

```tsx
onClick={() => { setActiveId(conv.id); setShowThread(true); }}
```

Also update the `NewMessageModal` `onOpen` callback to set `showThread(true)` after `handleNewConv`:

```tsx
onOpen={(convId) => {
  setShowNewMsg(false);
  handleNewConv(convId);
  setShowThread(true);
}}
```

- [ ] **Step 3: Add mobile back button to thread header**

Find the thread header div (the `h-14 flex items-center px-5 gap-3` div inside the active thread panel). Add a back button as the first child, visible only on mobile:

```tsx
<button
  onClick={() => setShowThread(false)}
  className="md:hidden mr-1 flex items-center gap-1 text-sm"
  style={{ color: "var(--text2)" }}
>
  <span style={{ fontSize: 18 }}>←</span>
</button>
```

- [ ] **Step 4: Wrap the outer flex container with mobile visibility logic**

Find the outer `<div className="flex overflow-hidden rounded-xl" ...>` and replace it with a structure that hides/shows panels based on `showThread` on mobile:

```tsx
<div className="flex overflow-hidden rounded-xl" style={{ height: "calc(100vh - 4rem)", border: "1px solid var(--border-md)" }}>

  {/* Conversation list — hidden on mobile when thread is open */}
  <div
    className={`w-full md:w-64 flex flex-col shrink-0 ${showThread ? "hidden md:flex" : "flex"}`}
    style={{ background: "var(--n-bg2)", borderRight: "1px solid var(--border)" }}
  >
    {/* ... existing list content unchanged ... */}
  </div>

  {/* Thread panel — hidden on mobile when list is shown */}
  {activeConv ? (
    <div className={`flex-1 flex-col min-w-0 ${showThread ? "flex" : "hidden md:flex"}`} style={{ background: "var(--bg)" }}>
      {/* ... existing thread content unchanged ... */}
    </div>
  ) : (
    <div className={`flex-1 flex-col items-center justify-center gap-4 ${showThread ? "flex" : "hidden md:flex"}`} style={{ background: "var(--bg)" }}>
      {/* ... existing empty state unchanged ... */}
    </div>
  )}

</div>
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/messages/MessagesClient.tsx"
git commit -m "feat: messages mobile stacked view with back button"
```

---

## Task 7: Responsive grids — Dashboard

**Files:**
- Modify: `app/(dashboard)/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Find the opportunity cards grid**

Search for a `grid` className used for the opportunity cards. It will look something like `grid grid-cols-2 gap-4` or similar inline style. Change any `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`.

If it uses inline styles with `display: grid; gridTemplateColumns: repeat(2, 1fr)`, add a wrapper class instead:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

- [ ] **Step 2: Find the stat/summary row**

If there is a row of 4 stat cards, change it to:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/DashboardClient.tsx"
git commit -m "fix: dashboard responsive grid — 1 col mobile, 2 col tablet+"
```

---

## Task 8: Responsive grids — Orgs

**Files:**
- Modify: `app/(dashboard)/orgs/OrgsClient.tsx`

- [ ] **Step 1: Find the org cards grid and make it responsive**

Find the grid container for org cards. Change to:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/orgs/OrgsClient.tsx"
git commit -m "fix: orgs responsive grid"
```

---

## Task 9: Responsive grids — Peers

**Files:**
- Modify: `app/(dashboard)/peers/PeersClient.tsx`

- [ ] **Step 1: Find the peer cards grid and make it responsive**

Find the grid container for peer cards. Change to:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/peers/PeersClient.tsx"
git commit -m "fix: peers responsive grid"
```

---

## Task 10: Push and verify

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Check Render deploys automatically** (auto-deploy is enabled)

- [ ] **Step 3: On mobile browser, verify:**
  - Login page shows correctly (centered card, no sidebar)
  - Dashboard shows mobile top bar with hamburger
  - Tapping hamburger slides in sidebar drawer
  - Tapping overlay or nav link closes drawer
  - Messages shows list on mobile, tapping a convo shows thread, back button returns to list
  - Card grids stack to 1 column on narrow screens

---

## Self-Review

**Spec coverage:**
- ✅ Color tokens updated (Task 1)
- ✅ Font swapped to Cormorant Garamond (Task 2)
- ✅ Mobile sidebar drawer (Tasks 3, 4)
- ✅ Dashboard layout responsive padding (Task 5)
- ✅ Messages mobile stacking (Task 6)
- ✅ Card grids responsive (Tasks 7, 8, 9)

**Placeholder scan:** None found.

**Type consistency:** `SidebarShell` passes `mobileOpen: boolean` and `onMobileClose: () => void` to `Sidebar` — both are defined in Task 3 and consumed in Task 4.
