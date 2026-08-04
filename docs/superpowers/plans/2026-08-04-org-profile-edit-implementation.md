# Org Profile Edit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an org owner (e.g. `team@nivarro.dev` viewing its own org page) quickly edit their org's profile from the existing but currently read-only "Settings" tab on `/orgs/[orgId]`, with a form that matches the visual quality of the org-creation wizard instead of plain static text.

**Architecture:** Extract the org-creation wizard's already-well-styled form primitives (`Field`, `inputStyle`, `colorPickerStyle`, `CATEGORIES`) into a shared module so the edit form matches the creation form exactly without duplicating styling. Extend the existing `PATCH /api/orgs/[id]` route with a second branch for org-owner self-edit (the existing platform-admin ownership-transfer branch is untouched). Replace the static Settings tab body in `OrgDetailClient.tsx` with a single-form UI wired to that endpoint, and convert the page's `org` prop usage to local state so a successful save re-renders the public-facing profile immediately.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, NextAuth v5 session via `auth()` (`lib/auth.ts`).

**Design spec:** `docs/superpowers/specs/2026-08-04-org-profile-edit-design.md` (already committed on `main`) — this plan implements it task-by-task.

## Global Constraints

- Scope is limited to the `/orgs/[orgId]` Settings tab (org-owner self-edit) and the shared form-field extraction it depends on. Do **not** touch: image/file upload (logo/banner stay color-picker/gradient-based), the legacy/unwired `Org` fields (`deadline`, `location`, `format`, `minTeamSize`/`maxTeamSize`, `gradeEligibility`, `status`, `socialProof`, `orgType`, `memberCount`, `bannerGradient`, `focusTags`), individual `OrgProject` listing edits, or a multi-step wizard UX (single form instead) — all explicitly out of scope per the design spec.
- `PATCH /api/orgs/[id]` must keep its existing platform-admin ownership-transfer branch (gated on `session.user.email === "team.nivarro@gmail.com"` with `createdById`/`email` in the body) working unchanged — the new org-owner self-edit branch is additive, not a replacement.
- This repo has **no automated test framework** (no `test` script, no jest/vitest config, no `*.test.*` files). Every task's verification step is a manual check. In this sandboxed dev environment, `npm run build` fails on an unrelated Google Fonts network fetch (TLS/schannel revocation-check issue local to this machine) — use `npx tsc --noEmit` as the practical type-check substitute here, and prefer `npm run build` for final confirmation wherever Google Fonts is reachable, plus a manual browser pass and/or `curl` against the local dev server.
- Style values (colors, fonts, spacing) must use the existing CSS variables already used throughout `OrgDetailClient.tsx` / `OrgNewClient.tsx` (`var(--bg)`, `var(--surface)`, `var(--surface2)`, `var(--border)`, `var(--border-md)`, `var(--text)`, `var(--text2)`, `var(--muted)`, `var(--amber)`, `var(--blue)`, `var(--font-mono)`, `var(--font-serif)`) — do not introduce new hard-coded colors beyond the `#f87171` error-red already used in both files.
- Follow this repo's existing convention of leaving PATCH/POST request bodies untyped (implicit `any` from `req.json()`) rather than adding a runtime validation library — matches `app/api/orgs/route.ts`'s existing POST handler.
- `values` is stored as a JSON string on `Org` (`values: String @default("[]")`) — parse to `string[]` for the form, stringify back on submit, matching `OrgNewClient.tsx`'s existing convention exactly.
- The local dev server runs over plain HTTP (`npm run dev` → `http://localhost:3000`), so ordinary `curl` works fine for manual verification here — the "no curl for HTTPS" constraint from prior sessions only applies to deployed Render `https://` endpoints, not localhost.

---

### Task 1: Extract shared org-form field primitives

**Files:**
- Create: `components/org/OrgFormFields.tsx`
- Modify: `app/(dashboard)/orgs/new/OrgNewClient.tsx:1-19` (imports + local `CATEGORIES`/`OrgCategory`), `:407-436` (local `Field`/`inputStyle`/`colorPickerStyle`)

**Interfaces:**
- Consumes: nothing new.
- Produces: named exports from `components/org/OrgFormFields.tsx` — `CATEGORIES` (`readonly ["ACCELERATOR", "FELLOWSHIP", "INTERNSHIP", "COMPETITION", "BOOTCAMP", "RESEARCH", "CLUB"]`), `OrgCategory` (type, `(typeof CATEGORIES)[number]`), `Field` (component, props `{ label: string; required?: boolean; hint?: string; hintOk?: boolean; children: React.ReactNode }`), `inputStyle: React.CSSProperties`, `colorPickerStyle: React.CSSProperties`. Task 3 imports all five by name.

`OrgNewClient.tsx` (the org-creation wizard) already has these fully-styled primitives defined locally. This task moves them to a shared module — verbatim, no behavior change — so Task 3's edit form can reuse the exact same styling without drift.

- [ ] **Step 1: Create the shared module**

Create `components/org/OrgFormFields.tsx`:

```tsx
export const CATEGORIES = [
  "ACCELERATOR", "FELLOWSHIP", "INTERNSHIP", "COMPETITION", "BOOTCAMP", "RESEARCH", "CLUB",
] as const;

export type OrgCategory = (typeof CATEGORIES)[number];

interface FieldProps { label: string; required?: boolean; hint?: string; hintOk?: boolean; children: React.ReactNode; }

export function Field({ label, required, hint, hintOk, children }: FieldProps) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label} {required && <span style={{ color: "#f87171" }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: hintOk ? "var(--amber)" : "var(--muted)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 12px",
  border: "1px solid var(--border-md)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit",
};

export const colorPickerStyle: React.CSSProperties = {
  width: 32, height: 32, border: "1px solid var(--border-md)",
  cursor: "pointer", padding: 2, background: "var(--bg)", flexShrink: 0,
};
```

- [ ] **Step 2: Update `OrgNewClient.tsx`'s imports to pull from the shared module**

Find (lines 1-19):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";

const CATEGORIES = [
  "ACCELERATOR", "FELLOWSHIP", "INTERNSHIP", "COMPETITION", "BOOTCAMP", "RESEARCH", "CLUB",
] as const;

const GENIUS_TYPES = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"] as const;
const GRADES = [9, 10, 11, 12] as const;
const APP_MATERIALS = ["Resume", "Cover Letter", "Portfolio", "Writing Sample", "Video Introduction", "GitHub Profile", "References"];
const FORMATS = ["Remote", "In-Person", "Hybrid"];

type OrgCategory = (typeof CATEGORIES)[number];

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Basics", "Brand", "Mission", "Project Details"];
```

Replace with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { CATEGORIES, type OrgCategory, Field, inputStyle, colorPickerStyle } from "@/components/org/OrgFormFields";

const GENIUS_TYPES = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"] as const;
const GRADES = [9, 10, 11, 12] as const;
const APP_MATERIALS = ["Resume", "Cover Letter", "Portfolio", "Writing Sample", "Video Introduction", "GitHub Profile", "References"];
const FORMATS = ["Remote", "In-Person", "Hybrid"];

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Basics", "Brand", "Mission", "Project Details"];
```

- [ ] **Step 3: Remove the now-duplicate local definitions at the bottom of `OrgNewClient.tsx`**

Find (the end of the file, right after the component's closing `);` and `}`):

```tsx
  );
}

// ── Shared styles ──

interface FieldProps { label: string; required?: boolean; hint?: string; hintOk?: boolean; children: React.ReactNode; }

function Field({ label, required, hint, hintOk, children }: FieldProps) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label} {required && <span style={{ color: "#f87171" }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: hintOk ? "var(--amber)" : "var(--muted)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 12px",
  border: "1px solid var(--border-md)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit",
};

const colorPickerStyle: React.CSSProperties = {
  width: 32, height: 32, border: "1px solid var(--border-md)",
  cursor: "pointer", padding: 2, background: "var(--bg)", flexShrink: 0,
};
```

Replace with just:

```tsx
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors involving `OrgFormFields.tsx` or `OrgNewClient.tsx` (pre-existing unrelated errors in `app/(dashboard)/admin/org-categories/page.tsx`, `app/(dashboard)/orgs/OrgsClient.tsx`, and `prisma/seed-mock.ts` are expected and out of scope for this plan).

- [ ] **Step 5: Manually verify the creation wizard is unchanged**

Run: `npm run dev`, open `http://localhost:3000/orgs/new` while logged in as a non-org account. Confirm all 4 steps (Basics, Brand, Mission, Project Details) render and behave exactly as before — same field styling, same color pickers, same tag-chip value/skill inputs.

- [ ] **Step 6: Commit**

```bash
git add components/org/OrgFormFields.tsx "app/(dashboard)/orgs/new/OrgNewClient.tsx"
git commit -m "refactor(org): extract shared form-field primitives from the org creation wizard"
```

---

### Task 2: Add org-owner self-edit to `PATCH /api/orgs/[id]`

**Files:**
- Modify: `app/api/orgs/[id]/route.ts` (whole file)

**Interfaces:**
- Consumes: `auth()` from `@/lib/auth`; `prisma.org` (Prisma Client).
- Produces: `PATCH /api/orgs/[id]` now also accepts an org-owner profile-edit body — `{ name: string; category: string; website?: string; founded?: string; headquartersLocation?: string; tagline?: string; logoLetter?: string; logoBg?: string; logoColor?: string; accentColor?: string; description?: string; whatWeSeek?: string; whatInternsBuild?: string; contactEmail?: string; values?: string[] }` → `{ org: <updated Org row> }` on 200, `{ error: string }` on 400 (missing name/category) / 401 (no session) / 403 (not the owner, not the platform admin) / 404 (org not found). Task 3 calls this exact shape and reads `org` from the response.

- [ ] **Step 1: Replace the route file**

Find the current `app/api/orgs/[id]/route.ts` in full:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Admin-only: transfer org ownership by email or userId
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== "team.nivarro@gmail.com") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { createdById, email } = body as { createdById?: string; email?: string };

  let targetUserId = createdById;

  if (!targetUserId && email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: `No user found with email ${email}` }, { status: 404 });
    targetUserId = user.id;
  }

  if (!targetUserId) return NextResponse.json({ error: "createdById or email required" }, { status: 400 });

  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.org.update({ where: { id }, data: { createdById: targetUserId } });
  return NextResponse.json({ org: updated, newOwner: targetUserId });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await prisma.org.findUnique({
    where: { id },
    include: {
      opportunities: { orderBy: { createdAt: "desc" } },
      teams: {
        include: {
          members: { include: { profile: { select: { userId: true } } } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ org });
}
```

Replace with:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { OrgCategory } from "@prisma/client";

// Platform admin (team.nivarro@gmail.com): transfer org ownership by email or userId.
// Org owner (org.createdById === session.user.id): edit their own org's profile fields.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (session.user.email === "team.nivarro@gmail.com" && ("createdById" in body || "email" in body)) {
    const { createdById, email } = body as { createdById?: string; email?: string };

    let targetUserId = createdById;

    if (!targetUserId && email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return NextResponse.json({ error: `No user found with email ${email}` }, { status: 404 });
      targetUserId = user.id;
    }

    if (!targetUserId) return NextResponse.json({ error: "createdById or email required" }, { status: 400 });

    const updated = await prisma.org.update({ where: { id }, data: { createdById: targetUserId } });
    return NextResponse.json({ org: updated, newOwner: targetUserId });
  }

  if (org.createdById === session.user.id) {
    const {
      name, category, website, founded, headquartersLocation,
      tagline, logoLetter, logoBg, logoColor, accentColor,
      description, whatWeSeek, whatInternsBuild, contactEmail, values,
    } = body;

    if (!name?.trim() || !category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 });
    }

    const updated = await prisma.org.update({
      where: { id },
      data: {
        name: name.trim(),
        category: category as OrgCategory,
        website, founded, headquartersLocation,
        tagline, logoLetter, logoBg, logoColor, accentColor,
        description, whatWeSeek, whatInternsBuild, contactEmail,
        values: JSON.stringify(values ?? []),
      },
    });
    return NextResponse.json({ org: updated });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await prisma.org.findUnique({
    where: { id },
    include: {
      opportunities: { orderBy: { createdAt: "desc" } },
      teams: {
        include: {
          members: { include: { profile: { select: { userId: true } } } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ org });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `app/api/orgs/[id]/route.ts`.

- [ ] **Step 3: Manually verify both branches against the running dev server**

Run: `npm run dev`. Log in as `team@nivarro.dev` (org owner) in the browser, open devtools, copy the session cookie, find that org's id (visit `/orgs/<orgId>` while logged in as that account, or `GET /api/orgs` and match by name).

Owner self-edit:

```bash
curl -s -X PATCH http://localhost:3000/api/orgs/<orgId> \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste your session cookie here>" \
  -d '{"name":"Nivarro","category":"FELLOWSHIP","tagline":"Test tagline","values":["Curiosity","Craft"]}'
```

Expected: HTTP 200, `{"org": {...}}` with `name: "Nivarro"`, `tagline: "Test tagline"`, `values: "[\"Curiosity\",\"Craft\"]"`.

Missing required field:

```bash
curl -s -X PATCH http://localhost:3000/api/orgs/<orgId> \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste your session cookie here>" \
  -d '{"name":"","category":"FELLOWSHIP"}'
```

Expected: HTTP 400, `{"error":"name and category are required"}`.

Non-owner, non-admin (log in as any other account that neither owns this org nor is `team.nivarro@gmail.com`, use its session cookie):

```bash
curl -s -X PATCH http://localhost:3000/api/orgs/<orgId> \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste a different, non-owning account's session cookie here>" \
  -d '{"name":"Hijacked","category":"FELLOWSHIP"}'
```

Expected: HTTP 403, `{"error":"Forbidden"}`.

Regression — platform-admin ownership transfer (log in as `team.nivarro@gmail.com` instead, use its session cookie, and a throwaway/test org id — do **not** run this against an org you care about, since it changes ownership):

```bash
curl -s -X PATCH http://localhost:3000/api/orgs/<someOrgId> \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste team.nivarro@gmail.com session cookie here>" \
  -d '{"email":"team@nivarro.dev"}'
```

Expected: HTTP 200, `{"org": {...}, "newOwner": "<userId>"}` — same as before this change.

- [ ] **Step 4: Commit**

```bash
git add "app/api/orgs/[id]/route.ts"
git commit -m "feat(orgs): let org owners self-edit their profile via PATCH /api/orgs/[id]"
```

---

### Task 3: Build the editable Settings tab UI

**Files:**
- Modify: `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx` (imports, state, hero/About render, Settings tab body)

**Interfaces:**
- Consumes: `Field`, `inputStyle`, `colorPickerStyle`, `CATEGORIES`, `OrgCategory` from Task 1's `@/components/org/OrgFormFields`; `PATCH /api/orgs/[orgId]` from Task 2 (`{ name, category, ... }` → `{ org }`).
- Produces: nothing new for other tasks — this closes out the feature.

- [ ] **Step 1: Add the `Loader2`/`Plus`/`X` icons and the shared form-field import**

Find (lines 1-10):

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import { ExternalLink, Save, Users, MapPin, CheckCircle2, XCircle, Clock, Sparkles, Star } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";
```

Replace with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import { ExternalLink, Save, Users, MapPin, CheckCircle2, XCircle, Clock, Sparkles, Star, Loader2, Plus, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";
import { Field, inputStyle, colorPickerStyle, CATEGORIES, type OrgCategory } from "@/components/org/OrgFormFields";
```

- [ ] **Step 2: Add local `orgState` + settings-form state**

Find (lines 212-224):

```tsx
  const [saved, setSaved] = useState(initialSaved);
  const [adminTab, setAdminTab] = useState<"overview" | "projects" | "applications" | "settings">("overview");
  const [appStatuses, setAppStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(applications.map((a) => [a.id, a.status]))
  );
  const [closingProject, setClosingProject] = useState<string | null>(null);
  const [apiKeyState, setApiKeyState] = useState<string | null>(apiKey);
  const [projectStatuses, setProjectStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(projects.map((p) => [p.id, p.listingStatus]))
  );
  const [projectOutcomeNotes, setProjectOutcomeNotes] = useState<Record<string, string>>(
    () => Object.fromEntries(projects.map((p) => [p.id, p.outcomeNote ?? ""]))
  );
```

Replace with:

```tsx
  const [saved, setSaved] = useState(initialSaved);
  const [adminTab, setAdminTab] = useState<"overview" | "projects" | "applications" | "settings">("overview");
  const [appStatuses, setAppStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(applications.map((a) => [a.id, a.status]))
  );
  const [closingProject, setClosingProject] = useState<string | null>(null);
  const [apiKeyState, setApiKeyState] = useState<string | null>(apiKey);
  const [projectStatuses, setProjectStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(projects.map((p) => [p.id, p.listingStatus]))
  );
  const [projectOutcomeNotes, setProjectOutcomeNotes] = useState<Record<string, string>>(
    () => Object.fromEntries(projects.map((p) => [p.id, p.outcomeNote ?? ""]))
  );

  // Org profile self-edit (Settings tab)
  const [orgState, setOrgState] = useState(org);
  const [settingsForm, setSettingsForm] = useState({
    name: org.name,
    category: org.category as OrgCategory,
    website: org.website ?? "",
    founded: org.founded ?? "",
    headquartersLocation: org.headquartersLocation ?? "",
    tagline: org.tagline ?? "",
    logoLetter: org.logoLetter ?? "",
    logoBg: org.logoBg ?? "#0a1535",
    logoColor: org.logoColor ?? "#ffffff",
    accentColor: org.accentColor ?? "#E8893A",
    description: org.description ?? "",
    whatWeSeek: org.whatWeSeek ?? "",
    whatInternsBuild: org.whatInternsBuild ?? "",
    contactEmail: org.contactEmail ?? "",
    values: JSON.parse(org.values || "[]") as string[],
  });
  const [newSettingsValue, setNewSettingsValue] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  async function handleSaveSettings() {
    if (!settingsForm.name.trim() || !settingsForm.category) return;
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const res = await fetch(`/api/orgs/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settingsForm.name.trim(),
          category: settingsForm.category,
          website: settingsForm.website.trim() || undefined,
          founded: settingsForm.founded.trim() || undefined,
          headquartersLocation: settingsForm.headquartersLocation.trim() || undefined,
          tagline: settingsForm.tagline.trim() || undefined,
          logoLetter: settingsForm.logoLetter || undefined,
          logoBg: settingsForm.logoBg,
          logoColor: settingsForm.logoColor,
          accentColor: settingsForm.accentColor,
          description: settingsForm.description.trim() || undefined,
          whatWeSeek: settingsForm.whatWeSeek.trim() || undefined,
          whatInternsBuild: settingsForm.whatInternsBuild.trim() || undefined,
          contactEmail: settingsForm.contactEmail.trim() || undefined,
          values: settingsForm.values,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSettingsError(data.error ?? "Something went wrong."); return; }
      setOrgState((prev) => ({ ...prev, ...data.org }));
    } catch {
      setSettingsError("Network error. Please try again.");
    } finally {
      setSettingsSaving(false);
    }
  }
```

- [ ] **Step 3: Wire the computed `accentColor`/`values` and the hero identity row to `orgState`**

Find (lines 226, 228):

```tsx
  const accentColor = org.accentColor ?? CATEGORY_COLORS[org.category] ?? "#1060d8";
```
```tsx
  const values: string[] = JSON.parse(org.values || "[]");
```

Replace with:

```tsx
  const accentColor = orgState.accentColor ?? CATEGORY_COLORS[orgState.category] ?? "#1060d8";
```
```tsx
  const values: string[] = JSON.parse(orgState.values || "[]");
```

Find (lines 259-277, the logo + name/tagline block):

```tsx
        <div
          className="w-16 h-16 rounded-xl border-4 flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={{
            background: org.logoBg ?? accentColor,
            color: org.logoColor ?? "#fff",
            borderColor: "#030609",
            fontFamily: "var(--font-serif)",
          }}
        >
          {org.logoLetter ?? org.name[0]}
        </div>
        <div className="pb-1">
          <p
            className="font-semibold text-xl"
            style={{ color: "var(--text)", fontFamily: "var(--font-serif)" }}
          >
            {org.name}
          </p>
          {org.tagline && <p className="text-sm" style={{ color: "var(--text2)" }}>{org.tagline}</p>}
```

Replace with:

```tsx
        <div
          className="w-16 h-16 rounded-xl border-4 flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={{
            background: orgState.logoBg ?? accentColor,
            color: orgState.logoColor ?? "#fff",
            borderColor: "#030609",
            fontFamily: "var(--font-serif)",
          }}
        >
          {orgState.logoLetter ?? orgState.name[0]}
        </div>
        <div className="pb-1">
          <p
            className="font-semibold text-xl"
            style={{ color: "var(--text)", fontFamily: "var(--font-serif)" }}
          >
            {orgState.name}
          </p>
          {orgState.tagline && <p className="text-sm" style={{ color: "var(--text2)" }}>{orgState.tagline}</p>}
```

- [ ] **Step 4: Replace the static Settings tab body with the editable form**

Find (lines 372-395):

```tsx
      {/* Admin: settings tab */}
      {isAdmin && adminTab === "settings" && (
        <div
          className="rounded-xl p-5 space-y-4 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Org Name</p>
            <p className="text-sm" style={{ color: "var(--text)" }}>{org.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Description</p>
            <p className="text-sm" style={{ color: "var(--text2)" }}>{org.description || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Contact Email</p>
            <p className="text-sm" style={{ color: "var(--text2)" }}>{org.contactEmail || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>What Interns Build</p>
            <p className="text-sm" style={{ color: "var(--text2)" }}>{org.whatInternsBuild || "—"}</p>
          </div>
        </div>
      )}
```

Replace with:

```tsx
      {/* Admin: settings tab */}
      {isAdmin && adminTab === "settings" && (
        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Basics</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <Field label="Organization name" required>
                  <input value={settingsForm.name} onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Category" required>
                  <select value={settingsForm.category} onChange={(e) => setSettingsForm((f) => ({ ...f, category: e.target.value as OrgCategory }))} style={inputStyle}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                  </select>
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <Field label="Website">
                    <input value={settingsForm.website} onChange={(e) => setSettingsForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://example.com" type="url" style={inputStyle} />
                  </Field>
                  <Field label="Founded year">
                    <input value={settingsForm.founded} onChange={(e) => setSettingsForm((f) => ({ ...f, founded: e.target.value }))} placeholder="e.g. 2022" maxLength={4} style={inputStyle} />
                  </Field>
                </div>
                <Field label="Headquarters / Location">
                  <input value={settingsForm.headquartersLocation} onChange={(e) => setSettingsForm((f) => ({ ...f, headquartersLocation: e.target.value }))} placeholder="e.g. San Francisco, CA or Remote" style={inputStyle} />
                </Field>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Brand</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div className="flex items-center gap-4">
                  <div style={{ background: settingsForm.logoBg, color: settingsForm.logoColor, width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
                    {settingsForm.logoLetter || settingsForm.name[0] || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{settingsForm.name || "Your Org"}</p>
                    <p className="text-[11px]" style={{ color: "var(--muted)", marginTop: 2 }}>Logo preview</p>
                  </div>
                </div>
                <Field label="Logo letter">
                  <input value={settingsForm.logoLetter} onChange={(e) => setSettingsForm((f) => ({ ...f, logoLetter: e.target.value.slice(0, 1).toUpperCase() }))} placeholder={settingsForm.name[0]?.toUpperCase() || "A"} maxLength={1} style={{ ...inputStyle, maxWidth: 80 }} />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                  {[
                    { label: "Logo background", value: settingsForm.logoBg, set: (v: string) => setSettingsForm((f) => ({ ...f, logoBg: v })) },
                    { label: "Letter color", value: settingsForm.logoColor, set: (v: string) => setSettingsForm((f) => ({ ...f, logoColor: v })) },
                    { label: "Accent color", value: settingsForm.accentColor, set: (v: string) => setSettingsForm((f) => ({ ...f, accentColor: v })) },
                  ].map(({ label, value, set }) => (
                    <Field key={label} label={label}>
                      <div className="flex items-center gap-2 mt-1">
                        <input type="color" value={value} onChange={(e) => set(e.target.value)} style={colorPickerStyle} />
                        <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{value}</span>
                      </div>
                    </Field>
                  ))}
                </div>
                <Field label="Tagline">
                  <input value={settingsForm.tagline} onChange={(e) => setSettingsForm((f) => ({ ...f, tagline: e.target.value }))} placeholder="One sentence that says what makes you different." style={inputStyle} maxLength={120} />
                </Field>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Mission</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <Field label="Description">
                  <textarea value={settingsForm.description} onChange={(e) => setSettingsForm((f) => ({ ...f, description: e.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical", minHeight: 96 }} />
                </Field>
                <Field label="What we look for in students">
                  <textarea value={settingsForm.whatWeSeek} onChange={(e) => setSettingsForm((f) => ({ ...f, whatWeSeek: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} />
                </Field>
                <Field label="What students actually build here">
                  <textarea value={settingsForm.whatInternsBuild} onChange={(e) => setSettingsForm((f) => ({ ...f, whatInternsBuild: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} />
                </Field>
                <Field label="Core values">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {settingsForm.values.map((v) => (
                      <span key={v} className="inline-flex items-center gap-1 text-xs px-2 py-1" style={{ background: "rgba(232,137,58,0.1)", border: "1px solid rgba(232,137,58,0.25)", color: "var(--amber)" }}>
                        {v}
                        <button onClick={() => setSettingsForm((f) => ({ ...f, values: f.values.filter((x) => x !== v) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newSettingsValue}
                      onChange={(e) => setNewSettingsValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newSettingsValue.trim()) {
                          setSettingsForm((f) => ({ ...f, values: [...f.values, newSettingsValue.trim()] }));
                          setNewSettingsValue("");
                        }
                      }}
                      placeholder="Add a value (press Enter)"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => {
                        if (newSettingsValue.trim()) {
                          setSettingsForm((f) => ({ ...f, values: [...f.values, newSettingsValue.trim()] }));
                          setNewSettingsValue("");
                        }
                      }}
                      className="btn-ghost"
                      style={{ flexShrink: 0 }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </Field>
                <Field label="Contact email">
                  <input value={settingsForm.contactEmail} onChange={(e) => setSettingsForm((f) => ({ ...f, contactEmail: e.target.value }))} placeholder="hello@example.com" type="email" style={inputStyle} />
                </Field>
              </div>
            </div>

            {settingsError && <p style={{ fontSize: 13, color: "#f87171" }}>{settingsError}</p>}

            <div className="flex justify-end pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving || !settingsForm.name.trim() || !settingsForm.category}
                className="btn-primary flex items-center gap-1.5"
                style={{ opacity: settingsSaving || !settingsForm.name.trim() || !settingsForm.category ? 0.5 : 1, cursor: settingsSaving ? "default" : "pointer" }}
              >
                {settingsSaving && <Loader2 size={13} className="animate-spin" />}
                {settingsSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Wire the public-facing About/Mission/facts sections to `orgState`**

Find (lines 472-485):

```tsx
          {org.description && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>About</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{org.description}</p>
            </div>
          )}

          {/* What students work on (public) */}
          {(whatInternsBuild ?? org.whatInternsBuild) && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>What students work on</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{whatInternsBuild ?? org.whatInternsBuild}</p>
            </div>
          )}
```

Replace with:

```tsx
          {orgState.description && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>About</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{orgState.description}</p>
            </div>
          )}

          {/* What students work on (public) */}
          {(orgState.whatInternsBuild ?? whatInternsBuild) && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>What students work on</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{orgState.whatInternsBuild ?? whatInternsBuild}</p>
            </div>
          )}
```

Find (lines 500-503):

```tsx
          {org.whatWeSeek && (
            <div className="border-l-4 pl-4 py-2" style={{ borderColor: accentColor }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>What we&apos;re looking for</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{org.whatWeSeek}</p>
            </div>
          )}
```

Replace with:

```tsx
          {orgState.whatWeSeek && (
            <div className="border-l-4 pl-4 py-2" style={{ borderColor: accentColor }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>What we&apos;re looking for</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{orgState.whatWeSeek}</p>
            </div>
          )}
```

Find (line 509):

```tsx
            {org.founded && <div><span style={{ color: "var(--muted)" }}>Founded: </span>{org.founded}</div>}
```

Replace with:

```tsx
            {orgState.founded && <div><span style={{ color: "var(--muted)" }}>Founded: </span>{orgState.founded}</div>}
```

Find (lines 511-516):

```tsx
            {org.headquartersLocation && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted)" }} />
                {org.headquartersLocation}
              </div>
            )}
```

Replace with:

```tsx
            {orgState.headquartersLocation && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted)" }} />
                {orgState.headquartersLocation}
              </div>
            )}
```

Find (lines 524-531):

```tsx
            {org.website && (
              <div>
                <a href={`https://${org.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline" style={{ color: "var(--blue)" }}>
                  <ExternalLink className="w-3.5 h-3.5" /> {org.website}
                </a>
              </div>
            )}
```

Replace with:

```tsx
            {orgState.website && (
              <div>
                <a href={`https://${orgState.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline" style={{ color: "var(--blue)" }}>
                  <ExternalLink className="w-3.5 h-3.5" /> {orgState.website}
                </a>
              </div>
            )}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `OrgDetailClient.tsx` (same pre-existing unrelated errors as before are fine). Pay particular attention to any leftover bare `org.` reference among the fields this task made editable — that would mean the public view goes stale after a save.

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run dev`, log in as `team@nivarro.dev` (or any org owner), open `http://localhost:3000/orgs/<yourOrgId>`, click the **Settings** tab.

1. Confirm the tab now shows a styled form (Basics/Brand/Mission sections) pre-filled with the org's current values, instead of the old plain-text block.
2. Change the tagline, add a core value via the "Add a value" input + Enter, change the accent color, and click **Save changes**. Confirm the button shows "Saving…" then returns to "Save changes".
3. Switch to the **Overview** tab (or reload) and confirm the hero identity row (logo, name, tagline), the About section, and the Values list all reflect the new data immediately — no page reload needed for the in-session update.
4. Clear the "Organization name" field. Confirm **Save changes** becomes disabled.
5. Log out and confirm `/orgs/<yourOrgId>` for a **different** org (one you don't own) shows no Settings tab at all (unchanged `isAdmin` gating).

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx"
git commit -m "feat(orgs): replace static Settings tab with an editable org profile form"
```
