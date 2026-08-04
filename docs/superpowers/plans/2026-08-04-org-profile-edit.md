# Org Profile Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an org owner edit their own org's profile (name, category, brand colors, tagline, mission text, values, contact) from the Settings tab on `/orgs/[orgId]`, replacing today's 4-field read-only text dump with a styled form matching the org-creation wizard.

**Architecture:** Extract the org-creation wizard's shared form primitives (`Field`, `inputStyle`, `colorPickerStyle`, `CATEGORIES`) into a shared module so both the wizard and the new edit form use identical styling. Extend the existing (currently platform-admin-only) `PATCH /api/orgs/[id]` with a second branch for the org owner to self-edit profile fields. Build a new `OrgSettingsForm` client component that replaces the Settings tab body and reports saved changes back up to `OrgDetailClient`, which now holds the org as local state (seeded from the server prop) so the public-facing profile view re-renders immediately after a save — no page reload.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict), Prisma/PostgreSQL, NextAuth v5, Tailwind + inline styles (existing project convention, not a new pattern).

## Global Constraints

- Editable fields are exactly the ones the org-creation wizard already captures: name, category, website, founded, headquartersLocation, tagline, logoLetter, logoBg, logoColor, accentColor, description, whatWeSeek, whatInternsBuild, contactEmail, values. No other `Org` model fields (deadline, location, format, minTeamSize/maxTeamSize, gradeEligibility, status, socialProof, orgType, memberCount, bannerGradient, focusTags) are touched by this feature.
- No image/file upload — logo stays color+letter, banner stays gradient/URL-string, matching the wizard exactly.
- `name` and `category` are required on save (same validation as org creation); every other field is optional.
- Single scrollable form with one "Save changes" button — no multi-step wizard, no inline click-to-edit.
- No new npm dependencies.
- **Testing note:** this codebase has no unit/integration test runner for the Next.js app (`server/tests` is dead code from an unrelated legacy stack — Mongoose/Express — not wired into `package.json` scripts). Per-task verification uses `npx tsc --noEmit` (strict mode is on) and `npm run lint` as the automated checks, plus explicit manual verification steps (dev server + curl/browser) in place of automated tests. This matches the project's actual testing convention (`CLAUDE.md`: "QA/testing site behavior → invoke /qa", a browser-based tool, not a unit-test suite).

---

### Task 1: Extract shared org-form primitives

**Files:**
- Create: `components/org/OrgFormFields.tsx`
- Modify: `app/(dashboard)/orgs/new/OrgNewClient.tsx`

**Interfaces:**
- Produces: `Field` (component, props `{label: string, required?: boolean, hint?: string, hintOk?: boolean, children: ReactNode}`), `inputStyle: CSSProperties`, `colorPickerStyle: CSSProperties`, `CATEGORIES: readonly string[]`, `OrgCategory` (type) — all exported from `@/components/org/OrgFormFields`.

- [ ] **Step 1: Create the shared module**

Write `components/org/OrgFormFields.tsx`:

```tsx
import type { CSSProperties, ReactNode } from "react";

export const CATEGORIES = [
  "ACCELERATOR", "FELLOWSHIP", "INTERNSHIP", "COMPETITION", "BOOTCAMP", "RESEARCH", "CLUB",
] as const;

export type OrgCategory = (typeof CATEGORIES)[number];

export interface FieldProps { label: string; required?: boolean; hint?: string; hintOk?: boolean; children: ReactNode; }

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

export const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 12px",
  border: "1px solid var(--border-md)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit",
};

export const colorPickerStyle: CSSProperties = {
  width: 32, height: 32, border: "1px solid var(--border-md)",
  cursor: "pointer", padding: 2, background: "var(--bg)", flexShrink: 0,
};
```

- [ ] **Step 2: Point `OrgNewClient.tsx` at the shared module and delete the local copies**

Edit `app/(dashboard)/orgs/new/OrgNewClient.tsx` — remove the local `CATEGORIES`/`OrgCategory` definitions:

```diff
- const CATEGORIES = [
-   "ACCELERATOR", "FELLOWSHIP", "INTERNSHIP", "COMPETITION", "BOOTCAMP", "RESEARCH", "CLUB",
- ] as const;
-
  const GENIUS_TYPES = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"] as const;
  const GRADES = [9, 10, 11, 12] as const;
  const APP_MATERIALS = ["Resume", "Cover Letter", "Portfolio", "Writing Sample", "Video Introduction", "GitHub Profile", "References"];
  const FORMATS = ["Remote", "In-Person", "Hybrid"];
-
- type OrgCategory = (typeof CATEGORIES)[number];
```

Add the import (top of file, alongside the existing `lucide-react` import):

```tsx
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { CATEGORIES, type OrgCategory, Field, inputStyle, colorPickerStyle } from "@/components/org/OrgFormFields";
```

Remove the local `Field`/`inputStyle`/`colorPickerStyle` definitions at the bottom of the file:

```diff
- // ── Shared styles ──
-
- interface FieldProps { label: string; required?: boolean; hint?: string; hintOk?: boolean; children: React.ReactNode; }
-
- function Field({ label, required, hint, hintOk, children }: FieldProps) {
-   return (
-     <div>
-       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
-         <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
-           {label} {required && <span style={{ color: "#f87171" }}>*</span>}
-         </label>
-         {hint && <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: hintOk ? "var(--amber)" : "var(--muted)" }}>{hint}</span>}
-       </div>
-       {children}
-     </div>
-   );
- }
-
- const inputStyle: React.CSSProperties = {
-   width: "100%", boxSizing: "border-box", padding: "8px 12px",
-   border: "1px solid var(--border-md)", background: "var(--bg)",
-   color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit",
- };
-
- const colorPickerStyle: React.CSSProperties = {
-   width: 32, height: 32, border: "1px solid var(--border-md)",
-   cursor: "pointer", padding: 2, background: "var(--bg)", flexShrink: 0,
- };
```

Every other line in the file (the 4-step form itself) stays exactly as-is — this is a pure extraction, no behavior change.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors on `components/org/OrgFormFields.tsx` or `OrgNewClient.tsx`.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, visit `http://localhost:3000/orgs/new` (log in as any account with no existing org — e.g. seed a fresh user, or use `org@nivarro.demo` after deleting its org if already created). Confirm all 4 wizard steps render identically to before (same inputs, color pickers, tag chips) and you can still step through and submit.

- [ ] **Step 6: Commit**

```bash
git add components/org/OrgFormFields.tsx "app/(dashboard)/orgs/new/OrgNewClient.tsx"
git commit -m "Extract shared org-form primitives into components/org/OrgFormFields"
```

---

### Task 2: Add org-owner self-edit branch to the org PATCH endpoint

**Files:**
- Modify: `app/api/orgs/[id]/route.ts`

**Interfaces:**
- Produces: `PATCH /api/orgs/[id]` — when the caller is the org's owner (`session.user.id === org.createdById`) and the body does **not** contain `createdById`/`email` (which routes to the existing platform-admin ownership-transfer path instead), accepts `{name: string, category: OrgCategory, website?, founded?, headquartersLocation?, tagline?, logoLetter?, logoBg?, logoColor?, accentColor?, description?, whatWeSeek?, whatInternsBuild?, contactEmail?, values?: string[]}` and returns `200 {org: Org}` on success, `400 {error: string}` if `name`/`category` missing, `403 {error: string}` if caller is neither the owner nor the platform admin.

- [ ] **Step 1: Replace the PATCH handler**

Read `app/api/orgs/[id]/route.ts` first (to match exact current content for the edit), then replace the existing `PATCH` function with:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { OrgCategory } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Platform admin: transfer org ownership by email or userId
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

  // Org owner: edit own profile
  if (org.createdById === session.user.id) {
    const {
      name, category, website, founded, headquartersLocation,
      tagline, logoLetter, logoBg, logoColor, accentColor,
      description, whatWeSeek, whatInternsBuild, contactEmail, values,
    } = body as {
      name?: string; category?: OrgCategory; website?: string | null; founded?: string | null;
      headquartersLocation?: string | null; tagline?: string | null; logoLetter?: string | null;
      logoBg?: string | null; logoColor?: string | null; accentColor?: string | null;
      description?: string | null; whatWeSeek?: string | null; whatInternsBuild?: string | null;
      contactEmail?: string | null; values?: string[];
    };

    if (!name?.trim() || !category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 });
    }

    const updated = await prisma.org.update({
      where: { id },
      data: {
        name: name.trim(), category, website, founded, headquartersLocation,
        tagline, logoLetter, logoBg, logoColor, accentColor,
        description, whatWeSeek, whatInternsBuild, contactEmail,
        values: JSON.stringify(values ?? []),
      },
    });
    return NextResponse.json({ org: updated });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

Leave the existing `GET` function in the same file completely untouched.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification against the running dev server**

```bash
npm run dev
```

In a browser: log in at `http://localhost:3000/login` as `org@nivarro.demo` / `demo2026`, go to `/orgs`, open "your org", and copy the org id from the URL (`/orgs/<ORG_ID>`). Open DevTools → Application → Cookies → `http://localhost:3000`, copy the value of the `authjs.session-token` cookie.

Positive case (expect `200` and the updated name in the response body):

```bash
curl -i -X PATCH http://localhost:3000/api/orgs/<ORG_ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=<PASTE_COOKIE_VALUE>" \
  -d '{"name":"Test Org Updated","category":"FELLOWSHIP","tagline":"Testing the edit endpoint","values":["Curiosity","Rigor"]}'
```

Negative case — no cookie (expect `401`):

```bash
curl -i -X PATCH http://localhost:3000/api/orgs/<ORG_ID> \
  -H "Content-Type: application/json" \
  -d '{"name":"Should Not Work","category":"FELLOWSHIP"}'
```

Confirm the existing ownership-transfer path still works (expect `403` since you're not `team.nivarro@gmail.com`):

```bash
curl -i -X PATCH http://localhost:3000/api/orgs/<ORG_ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=<PASTE_COOKIE_VALUE>" \
  -d '{"email":"someone@example.com"}'
```

Cross-owner case — log in as a *different* org's owner (`ridgepoint@nivarro.demo` / `ridgepoint2026`), copy that session's `authjs.session-token`, and try to PATCH `org@nivarro.demo`'s org id with profile fields (expect `403`, not the ridgepoint account's own org — someone else's org they don't own):

```bash
curl -i -X PATCH http://localhost:3000/api/orgs/<ORG_ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=<RIDGEPOINT_COOKIE_VALUE>" \
  -d '{"name":"Hijacked Name","category":"FELLOWSHIP"}'
```

- [ ] **Step 5: Commit**

```bash
git add app/api/orgs/[id]/route.ts
git commit -m "Add org-owner self-edit branch to PATCH /api/orgs/[id]"
```

---

### Task 3: Build the `OrgSettingsForm` component

**Files:**
- Create: `app/(dashboard)/orgs/[orgId]/OrgSettingsForm.tsx`
- Modify: `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx` (export the `OrgDetail` interface only — wiring happens in Task 4)

**Interfaces:**
- Consumes: Task 1's `Field`, `inputStyle`, `colorPickerStyle`, `CATEGORIES`, `OrgCategory` from `@/components/org/OrgFormFields`; Task 2's `PATCH /api/orgs/[id]`; `OrgDetail` type from `./OrgDetailClient`.
- Produces: default export `OrgSettingsForm`, props `{org: OrgDetail, onSaved: (fields: OrgProfileUpdate) => void}`; named export `OrgProfileUpdate` type: `{name: string, category: OrgCategory, website: string, founded: string, headquartersLocation: string, tagline: string, logoLetter: string, logoBg: string, logoColor: string, accentColor: string, description: string, whatWeSeek: string, whatInternsBuild: string, contactEmail: string, values: string[]}`.

- [ ] **Step 1: Export `OrgDetail` from `OrgDetailClient.tsx`**

Edit `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx`:

```diff
- interface OrgDetail {
+ export interface OrgDetail {
    id: string;
    name: string;
```

- [ ] **Step 2: Create `OrgSettingsForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Field, inputStyle, colorPickerStyle, CATEGORIES, type OrgCategory } from "@/components/org/OrgFormFields";
import type { OrgDetail } from "./OrgDetailClient";

export interface OrgProfileUpdate {
  name: string; category: OrgCategory; website: string; founded: string; headquartersLocation: string;
  tagline: string; logoLetter: string; logoBg: string; logoColor: string; accentColor: string;
  description: string; whatWeSeek: string; whatInternsBuild: string; contactEmail: string; values: string[];
}

export default function OrgSettingsForm({
  org,
  onSaved,
}: {
  org: OrgDetail;
  onSaved: (fields: OrgProfileUpdate) => void;
}) {
  const [name, setName] = useState(org.name);
  const [category, setCategory] = useState<OrgCategory>(org.category as OrgCategory);
  const [website, setWebsite] = useState(org.website ?? "");
  const [founded, setFounded] = useState(org.founded ?? "");
  const [headquartersLocation, setHeadquartersLocation] = useState(org.headquartersLocation ?? "");

  const [logoLetter, setLogoLetter] = useState(org.logoLetter ?? "");
  const [logoBg, setLogoBg] = useState(org.logoBg ?? "#0a1535");
  const [logoColor, setLogoColor] = useState(org.logoColor ?? "#ffffff");
  const [accentColor, setAccentColor] = useState(org.accentColor ?? "#E8893A");
  const [tagline, setTagline] = useState(org.tagline ?? "");

  const [description, setDescription] = useState(org.description ?? "");
  const [whatWeSeek, setWhatWeSeek] = useState(org.whatWeSeek ?? "");
  const [whatInternsBuild, setWhatInternsBuild] = useState(org.whatInternsBuild ?? "");
  const [contactEmail, setContactEmail] = useState(org.contactEmail ?? "");
  const [values, setValues] = useState<string[]>(() => JSON.parse(org.values || "[]"));
  const [newValue, setNewValue] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const effectiveLogoLetter = logoLetter || name[0] || "?";

  async function handleSave() {
    if (!name.trim() || !category) {
      setError("Organization name and category are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), category, website: website.trim() || null,
          founded: founded.trim() || null, headquartersLocation: headquartersLocation.trim() || null,
          tagline: tagline.trim() || null, logoLetter: effectiveLogoLetter, logoBg, logoColor, accentColor,
          description: description.trim() || null, whatWeSeek: whatWeSeek.trim() || null,
          whatInternsBuild: whatInternsBuild.trim() || null, contactEmail: contactEmail.trim() || null,
          values,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      onSaved({
        name: name.trim(), category, website: website.trim(), founded: founded.trim(),
        headquartersLocation: headquartersLocation.trim(), tagline: tagline.trim(),
        logoLetter: effectiveLogoLetter, logoBg, logoColor, accentColor,
        description: description.trim(), whatWeSeek: whatWeSeek.trim(),
        whatInternsBuild: whatInternsBuild.trim(), contactEmail: contactEmail.trim(), values,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl p-5 space-y-6 mb-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
    >
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Basics</h3>
        <Field label="Organization name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Category" required>
          <select value={category} onChange={(e) => setCategory(e.target.value as OrgCategory)} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Website">
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" type="url" style={inputStyle} />
          </Field>
          <Field label="Founded year">
            <input value={founded} onChange={(e) => setFounded(e.target.value)} maxLength={4} style={inputStyle} />
          </Field>
        </div>
        <Field label="Headquarters / Location">
          <input value={headquartersLocation} onChange={(e) => setHeadquartersLocation(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <div className="space-y-4 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Brand</h3>
        <div className="flex items-center gap-4">
          <div style={{ background: logoBg, color: logoColor, width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
            {effectiveLogoLetter}
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{name || "Your Org"}</p>
        </div>
        <Field label="Logo letter">
          <input value={logoLetter} onChange={(e) => setLogoLetter(e.target.value.slice(0, 1).toUpperCase())} maxLength={1} style={{ ...inputStyle, maxWidth: 80 }} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          {[
            { label: "Logo background", value: logoBg, set: setLogoBg },
            { label: "Letter color", value: logoColor, set: setLogoColor },
            { label: "Accent color", value: accentColor, set: setAccentColor },
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
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} style={inputStyle} />
        </Field>
      </div>

      <div className="space-y-4 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Mission</h3>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical", minHeight: 96 }} />
        </Field>
        <Field label="What we look for in students">
          <textarea value={whatWeSeek} onChange={(e) => setWhatWeSeek(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} />
        </Field>
        <Field label="What students actually build here">
          <textarea value={whatInternsBuild} onChange={(e) => setWhatInternsBuild(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} />
        </Field>
        <Field label="Core values">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {values.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 text-xs px-2 py-1" style={{ background: "rgba(232,137,58,0.1)", border: "1px solid rgba(232,137,58,0.25)", color: "var(--amber)" }}>
                {v}
                <button onClick={() => setValues(values.filter((x) => x !== v))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newValue.trim()) { setValues([...values, newValue.trim()]); setNewValue(""); } }} placeholder="Add a value (press Enter)" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => { if (newValue.trim()) { setValues([...values, newValue.trim()]); setNewValue(""); } }} className="btn-ghost" style={{ flexShrink: 0 }}>
              <Plus size={13} />
            </button>
          </div>
        </Field>
        <Field label="Contact email">
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" style={inputStyle} />
        </Field>
      </div>

      {error && (
        <div className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-1.5"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedFlash && <span className="text-xs" style={{ color: "#4ade80" }}>✓ Saved</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`OrgDetailClient.tsx` won't yet render `OrgSettingsForm` — that's Task 4 — so this only validates the new file compiles standalone against the exported `OrgDetail` type.)

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors on `OrgSettingsForm.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/orgs/[orgId]/OrgSettingsForm.tsx" "app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx"
git commit -m "Add OrgSettingsForm component (not yet wired into the Settings tab)"
```

---

### Task 4: Wire the edit form into the org profile page

**Files:**
- Modify: `app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx`
- Modify: `app/(dashboard)/orgs/[orgId]/page.tsx`

**Interfaces:**
- Consumes: Task 3's `OrgSettingsForm` (default export) and `OrgProfileUpdate` type.

- [ ] **Step 1: Import `OrgSettingsForm` in `OrgDetailClient.tsx`**

```diff
  import Avatar from "@/components/ui/Avatar";
  import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
  import type { GeniusTypeKey } from "@/lib/geniusTypes";
  import { cn } from "@/lib/utils";
+ import OrgSettingsForm from "./OrgSettingsForm";
```

- [ ] **Step 2: Shadow the `org` prop with local state, drop the redundant `whatInternsBuild` prop**

The `whatInternsBuild` top-level prop duplicates `org.whatInternsBuild` (the `org` object already carries it — see `page.tsx`). It's dropped here because after this change `org.whatInternsBuild` is the single source of truth kept in sync by saves; keeping the stale duplicate prop around would make edits to that field not show up in the "What students work on" section.

```diff
  export default function OrgDetailClient({
-   org, projects, myProfileId, myTeamId, isAdmin, applications,
-   adminStats, apiKey, reviewCount, whatInternsBuild, initialSaved,
+   org: initialOrg, projects, myProfileId, myTeamId, isAdmin, applications,
+   adminStats, apiKey, reviewCount, initialSaved,
  }: {
    org: OrgDetail;
    projects: OrgProjectSummary[];
    myProfileId: string | null;
    myTeamId: string | null;
    isAdmin: boolean;
    applications: AdminApplication[];
    adminStats: { activeProjects: number; totalApps: number; pendingCount: number; acceptedCount: number } | null;
    apiKey: string | null;
    reviewCount: number;
-   whatInternsBuild: string | null;
    initialSaved: boolean;
  }) {
+   const [org, setOrg] = useState<OrgDetail>(initialOrg);
    const [saved, setSaved] = useState(initialSaved);
```

Every other reference to `org.*` in this file's render body (`org.name`, `org.description`, `org.accentColor`, `org.logoBg`, etc.) now resolves against the local state variable instead of the static prop — no other line needs to change, since the state variable is still named `org`.

- [ ] **Step 3: Fix the "What students work on" section to read only from `org` state**

```diff
          {/* What students work on (public) */}
-         {(whatInternsBuild ?? org.whatInternsBuild) && (
+         {org.whatInternsBuild && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>What students work on</h2>
-             <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{whatInternsBuild ?? org.whatInternsBuild}</p>
+             <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{org.whatInternsBuild}</p>
            </div>
          )}
```

- [ ] **Step 4: Replace the read-only Settings tab body with `OrgSettingsForm`**

```diff
        {/* Admin: settings tab */}
        {isAdmin && adminTab === "settings" && (
-         <div
-           className="rounded-xl p-5 space-y-4 mb-6"
-           style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
-         >
-           <div>
-             <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Org Name</p>
-             <p className="text-sm" style={{ color: "var(--text)" }}>{org.name}</p>
-           </div>
-           <div>
-             <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Description</p>
-             <p className="text-sm" style={{ color: "var(--text2)" }}>{org.description || "—"}</p>
-           </div>
-           <div>
-             <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Contact Email</p>
-             <p className="text-sm" style={{ color: "var(--text2)" }}>{org.contactEmail || "—"}</p>
-           </div>
-           <div>
-             <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>What Interns Build</p>
-             <p className="text-sm" style={{ color: "var(--text2)" }}>{org.whatInternsBuild || "—"}</p>
-           </div>
-         </div>
+         <OrgSettingsForm
+           org={org}
+           onSaved={(fields) =>
+             setOrg((prev) => ({ ...prev, ...fields, values: JSON.stringify(fields.values) }))
+           }
+         />
        )}
```

- [ ] **Step 5: Remove the redundant `whatInternsBuild` prop pass in `page.tsx`**

```diff
      reviewCount={reviewCount}
-     whatInternsBuild={org.whatInternsBuild ?? null}
      initialSaved={initialSaved}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/orgs/[orgId]/OrgDetailClient.tsx" "app/(dashboard)/orgs/[orgId]/page.tsx"
git commit -m "Wire OrgSettingsForm into the org Settings tab"
```

---

### Task 5: End-to-end manual verification

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Walk through the edit flow as an org owner**

Log in as `org@nivarro.demo` / `demo2026`, go to `/orgs`, open "your org", click the **Settings** tab. Confirm:
- All 14 fields (Basics/Brand/Mission) are pre-filled with the org's current values, not placeholders.
- The logo preview swatch updates live as you change the logo letter/colors.
- Adding a value via the tag-chip input (type + Enter) adds a chip; clicking the `×` on a chip removes it.
- Clicking "Save changes" shows a spinner, then "✓ Saved".

- [ ] **Step 3: Confirm the public profile view updates without a reload**

Switch to the **Overview** tab (still on the same page, no navigation). Confirm the hero/logo, tagline, About section, and Values chips reflect the values just saved.

- [ ] **Step 4: Confirm persistence**

Hard-refresh the page (`Ctrl+Shift+R`). Confirm the saved values are still present (proves the PATCH actually persisted to Postgres, not just local state).

- [ ] **Step 5: Confirm the required-field guard**

Clear the "Organization name" field entirely and click "Save changes". Confirm an inline error appears ("Organization name and category are required.") and no request succeeds (Network tab shows no 200 PATCH, or the previous name is still shown after refresh).

- [ ] **Step 6: Confirm a non-owner can't edit**

Log out, log in as a different org's owner (or a student account), and confirm the Settings tab either isn't visible (non-admin) or — if you navigate directly to another org you don't own — no Settings tab appears (`isAdmin` gate in `page.tsx` already handles this; this step just confirms no regression).
