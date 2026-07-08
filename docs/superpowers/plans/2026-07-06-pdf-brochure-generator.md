# PDF Brochure Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a school marketing system: a curated, downloadable PDF of real student outcomes (college, jobs, internships, testimonials), an admin curation panel with auto-sort presets and per-student exclusion controls, and a student-facing "Why [School]?" banner that drives survey + LinkedIn completion.

**Architecture:** Two new Prisma tables store survey responses (`StudentBrochureData`) and per-school brochure config (`SchoolBrochureSettings`). A new `GET /api/school/brochure` route renders the PDF server-side using `@react-pdf/renderer` and streams it back. The existing `BrochureButton` becomes a thin fetch-and-download wrapper. A new `BrochureCurationPanel` client component lives below the destinations map. The student dashboard gains a conditional banner when the school admin enables "Show to students."

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma + PostgreSQL, NextAuth v5, Zod, `@react-pdf/renderer`

## Global Constraints

- All API routes call `auth()` and return 401 if unauthenticated
- School admin check: `dbUser.role === "SCHOOL" || dbUser.role === "ADMIN"`
- Students linked to a school via `profile.schoolId` (references `User.id` where `User.role === "SCHOOL"`)
- Migrations: write raw SQL to `prisma/migrations/<timestamp>_<name>/migration.sql`; Prisma picks them up on `prisma migrate deploy`
- No test scores anywhere in any component or API response
- Genius types are NOT included in the brochure
- CSS variables: `var(--bg)`, `var(--surface)`, `var(--border)`, `var(--text)`, `var(--n-text2)`, `var(--n-muted)`, `var(--amber)`, `var(--font-mono)`, `var(--font-display)`, `var(--blue)` (= `#4a80f0`)
- SCHOOL role users: `session.user.id` IS their schoolId. ADMIN role: pass `?schoolId=` query param.
- Node.js SSL workaround for HTTPS calls: `node --use-system-ca -e "..."`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `StudentBrochureData` + `SchoolBrochureSettings` models; add `brochureData` relation to Profile |
| `prisma/migrations/20260706000000_brochure_tables/migration.sql` | Create | Raw SQL for both new tables |
| `app/api/student/brochure-data/route.ts` | Create | GET (fetch own data) + POST (upsert survey) for logged-in student |
| `app/(dashboard)/profile/survey/page.tsx` | Create | Server component: load existing data, gate to students only |
| `app/(dashboard)/profile/survey/SurveyClient.tsx` | Create | Client form: college, job title, employer, internship title, internship org |
| `app/api/school/brochure/settings/route.ts` | Create | GET (fetch/create defaults) + PATCH (update visibility, cap, exclusions) |
| `app/api/school/brochure/students/route.ts` | Create | GET list of school students with brochure data + completeness score |
| `components/school/BrochureCurationPanel.tsx` | Create | Admin client component: include/exclude toggles, auto-sort presets, visibility toggle, cap |
| `app/(dashboard)/school/destinations/page.tsx` | Modify | Import + render BrochureCurationPanel below the map |
| `components/school/BrochureDocument.tsx` | Create | `@react-pdf/renderer` component: cover strip, stats, outcomes table, testimonials, footer |
| `app/api/school/brochure/route.ts` | Create | GET: auth → fetch settings → apply exclusions/cap → fetch data → renderToBuffer → stream PDF |
| `components/school/BrochureButton.tsx` | Modify | Replace pdfmake logic with `fetch("/api/school/brochure")` → blob download |
| `components/school/WhySchoolBanner.tsx` | Create | Student-facing banner: school name, 3 stat highlights, Take Survey + Update LinkedIn buttons |
| `app/(dashboard)/dashboard/page.tsx` | Modify | Fetch banner data (schoolId + brochure settings + quick stats), render WhySchoolBanner |

---

## Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260706000000_brochure_tables/migration.sql`

**Interfaces:**
- Produces: `StudentBrochureData` model, `SchoolBrochureSettings` model, `Profile.brochureData` relation — all subsequent tasks depend on these

- [ ] **Step 1: Add models to `prisma/schema.prisma`**

Add after the `OrgReview` model block (around line 650):

```prisma
// ─────────────────────────────────────────────
// BROCHURE
// ─────────────────────────────────────────────

model StudentBrochureData {
  id              String   @id @default(cuid())
  profileId       String   @unique
  college         String?
  jobTitle        String?
  employer        String?
  internshipTitle String?
  internshipOrg   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
}

model SchoolBrochureSettings {
  id          String   @id @default(cuid())
  schoolId    String   @unique
  visibility  String   @default("ADMIN_ONLY")
  maxStudents Int?
  excludedIds String   @default("[]")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 2: Add `brochureData` relation to the `Profile` model**

In `prisma/schema.prisma`, find the `Profile` model. After the `orgReviews OrgReview[]` line, add:

```prisma
  brochureData         StudentBrochureData?
```

- [ ] **Step 3: Create the migration directory and SQL file**

Create folder `prisma/migrations/20260706000000_brochure_tables/` and file `migration.sql` with:

```sql
CREATE TABLE IF NOT EXISTS "StudentBrochureData" (
  "id"              TEXT NOT NULL,
  "profileId"       TEXT NOT NULL,
  "college"         TEXT,
  "jobTitle"        TEXT,
  "employer"        TEXT,
  "internshipTitle" TEXT,
  "internshipOrg"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentBrochureData_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentBrochureData_profileId_key"
  ON "StudentBrochureData"("profileId");
ALTER TABLE "StudentBrochureData"
  ADD CONSTRAINT "StudentBrochureData_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SchoolBrochureSettings" (
  "id"          TEXT NOT NULL,
  "schoolId"    TEXT NOT NULL,
  "visibility"  TEXT NOT NULL DEFAULT 'ADMIN_ONLY',
  "maxStudents" INTEGER,
  "excludedIds" TEXT NOT NULL DEFAULT '[]',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolBrochureSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolBrochureSettings_schoolId_key"
  ON "SchoolBrochureSettings"("schoolId");
```

- [ ] **Step 4: Regenerate the Prisma client**

```bash
cd "C:\Users\thoma\Goal-APP"
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260706000000_brochure_tables/
git commit -m "feat: add StudentBrochureData and SchoolBrochureSettings schema

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 2: Student Survey API

**Files:**
- Create: `app/api/student/brochure-data/route.ts`

**Interfaces:**
- Consumes: `StudentBrochureData` Prisma model (Task 1)
- Produces: `GET /api/student/brochure-data` → `{ data: { college, jobTitle, employer, internshipTitle, internshipOrg } | null }` · `POST /api/student/brochure-data` body: same fields → `{ data: {...} }`

- [ ] **Step 1: Create `app/api/student/brochure-data/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const surveySchema = z.object({
  college:         z.string().max(200).optional().nullable(),
  jobTitle:        z.string().max(200).optional().nullable(),
  employer:        z.string().max(200).optional().nullable(),
  internshipTitle: z.string().max(200).optional().nullable(),
  internshipOrg:   z.string().max(200).optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ data: null });

  const data = await prisma.studentBrochureData.findUnique({
    where: { profileId: profile.id },
    select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true, updatedAt: true },
  });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await req.json();
  const parsed = surveySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const data = await prisma.studentBrochureData.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, ...parsed.data },
    update: { ...parsed.data },
  });
  return NextResponse.json({ data });
}
```

- [ ] **Step 2: Verify manually**

Start the dev server (`npm run dev`), then in your browser console or a REST client:

```
GET http://localhost:3000/api/student/brochure-data
```
Expected (no data yet): `{ "data": null }`

```
POST http://localhost:3000/api/student/brochure-data
Body: { "college": "MIT", "jobTitle": "SWE Intern", "employer": "Google" }
```
Expected: `{ "data": { "college": "MIT", "jobTitle": "SWE Intern", "employer": "Google", ... } }`

- [ ] **Step 3: Commit**

```bash
git add app/api/student/brochure-data/route.ts
git commit -m "feat: student brochure survey API (GET + POST)

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 3: Student Survey Page

**Files:**
- Create: `app/(dashboard)/profile/survey/page.tsx`
- Create: `app/(dashboard)/profile/survey/SurveyClient.tsx`

**Interfaces:**
- Consumes: `GET /api/student/brochure-data`, `POST /api/student/brochure-data` (Task 2)
- Produces: `/profile/survey` page accessible to students; linked from the WhySchoolBanner (Task 9)

- [ ] **Step 1: Create `app/(dashboard)/profile/survey/page.tsx`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SurveyClient from "./SurveyClient";

export default async function SurveyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "STUDENT") redirect("/dashboard");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      brochureData: {
        select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true },
      },
    },
  });

  return (
    <SurveyClient
      initial={{
        college:         profile?.brochureData?.college ?? "",
        jobTitle:        profile?.brochureData?.jobTitle ?? "",
        employer:        profile?.brochureData?.employer ?? "",
        internshipTitle: profile?.brochureData?.internshipTitle ?? "",
        internshipOrg:   profile?.brochureData?.internshipOrg ?? "",
      }}
    />
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/profile/survey/SurveyClient.tsx`**

```typescript
"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface SurveyFields {
  college: string;
  jobTitle: string;
  employer: string;
  internshipTitle: string;
  internshipOrg: string;
}

export default function SurveyClient({ initial }: { initial: SurveyFields }) {
  const [form, setForm] = useState<SurveyFields>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof SurveyFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/student/brochure-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const field = (label: string, key: keyof SurveyFields, placeholder: string) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-muted)", marginBottom: 6 }}>
        {label}
      </label>
      <input
        value={form[key]}
        onChange={set(key)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "10px 12px", fontSize: 14,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 0, color: "var(--text)", outline: "none",
        }}
      />
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 32px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 6px" }}>
        Your Outcomes
      </h1>
      <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 28px" }}>
        This feeds the school brochure. Only your name and outcomes appear — no test scores, no genius type.
      </p>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 16px" }}>College</p>
      {field("College / University", "college", "e.g. MIT, Howard University")}

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "16px 0 16px" }}>Job</p>
      {field("Job Title", "jobTitle", "e.g. Software Engineer")}
      {field("Employer", "employer", "e.g. Google, NASA")}

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "16px 0 16px" }}>Internship</p>
      {field("Internship Title", "internshipTitle", "e.g. Research Intern")}
      {field("Internship Org", "internshipOrg", "e.g. Stanford AI Lab")}

      <button
        onClick={save}
        disabled={saving}
        style={{
          marginTop: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600,
          background: "var(--amber)", color: "#1a1a1f", border: "none",
          borderRadius: 0, cursor: saving ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        {saved && <CheckCircle2 size={14} />}
        {saving ? "Saving…" : saved ? "Saved!" : "Save Outcomes"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Log in as `student@nivarro.demo` / `demo2026`, navigate to `/profile/survey`. Fill in fields, click Save. Reload — fields should persist.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/profile/survey/
git commit -m "feat: student outcomes survey page

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 4: Admin Settings + Students List APIs

**Files:**
- Create: `app/api/school/brochure/settings/route.ts`
- Create: `app/api/school/brochure/students/route.ts`

**Interfaces:**
- Consumes: `SchoolBrochureSettings`, `StudentBrochureData`, `Profile` Prisma models (Task 1)
- Produces:
  - `GET /api/school/brochure/settings?schoolId=` → `{ settings: { id, schoolId, visibility, maxStudents, excludedIds: string[] } }`
  - `PATCH /api/school/brochure/settings` body: `{ schoolId, visibility?, maxStudents?, excludedIds? }` → `{ settings }`
  - `GET /api/school/brochure/students?schoolId=` → `{ students: StudentRow[] }` where `StudentRow` = `{ profileId, name, college, jobTitle, employer, internshipTitle, internshipOrg, score, excluded }`

- [ ] **Step 1: Create `app/api/school/brochure/settings/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

async function resolveSchoolId(sessionUserId: string, role: string, qsSchoolId: string | null): Promise<string | null> {
  if (role === "SCHOOL") return sessionUserId;
  if (role === "ADMIN" && qsSchoolId) return qsSchoolId;
  return null;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const schoolId = await resolveSchoolId(session.user.id, dbUser.role, searchParams.get("schoolId"));
  if (!schoolId) return NextResponse.json({ error: "schoolId required" }, { status: 400 });

  const settings = await prisma.schoolBrochureSettings.upsert({
    where: { schoolId },
    create: { schoolId, visibility: "ADMIN_ONLY", excludedIds: "[]" },
    update: {},
    select: { id: true, schoolId: true, visibility: true, maxStudents: true, excludedIds: true },
  });

  return NextResponse.json({ settings: { ...settings, excludedIds: JSON.parse(settings.excludedIds) as string[] } });
}

const patchSchema = z.object({
  schoolId:    z.string(),
  visibility:  z.enum(["ADMIN_ONLY", "STUDENTS"]).optional(),
  maxStudents: z.number().int().min(1).nullable().optional(),
  excludedIds: z.array(z.string()).optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const { schoolId, visibility, maxStudents, excludedIds } = parsed.data;

  if (dbUser.role === "SCHOOL" && schoolId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.schoolBrochureSettings.upsert({
    where: { schoolId },
    create: {
      schoolId,
      visibility: visibility ?? "ADMIN_ONLY",
      maxStudents: maxStudents ?? null,
      excludedIds: excludedIds ? JSON.stringify(excludedIds) : "[]",
    },
    update: {
      ...(visibility !== undefined && { visibility }),
      ...(maxStudents !== undefined && { maxStudents }),
      ...(excludedIds !== undefined && { excludedIds: JSON.stringify(excludedIds) }),
    },
    select: { id: true, schoolId: true, visibility: true, maxStudents: true, excludedIds: true },
  });

  return NextResponse.json({ settings: { ...updated, excludedIds: JSON.parse(updated.excludedIds) as string[] } });
}
```

- [ ] **Step 2: Create `app/api/school/brochure/students/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function scoreStudent(d: { college: string | null; jobTitle: string | null; employer: string | null; internshipTitle: string | null; internshipOrg: string | null } | null): number {
  if (!d) return 0;
  let s = 0;
  if (d.college) s += 1;
  if (d.jobTitle && d.employer) s += 2;
  if (d.internshipTitle && d.internshipOrg) s += 1;
  return s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const schoolId = dbUser.role === "SCHOOL" ? session.user.id : searchParams.get("schoolId");
  if (!schoolId) return NextResponse.json({ error: "schoolId required" }, { status: 400 });

  const [profiles, settings] = await Promise.all([
    prisma.profile.findMany({
      where: { schoolId },
      select: {
        id: true,
        displayName: true,
        brochureData: {
          select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true },
        },
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.schoolBrochureSettings.findUnique({ where: { schoolId }, select: { excludedIds: true } }),
  ]);

  const excluded = new Set<string>(settings ? JSON.parse(settings.excludedIds) : []);

  const students = profiles.map((p) => ({
    profileId:      p.id,
    name:           p.displayName,
    college:        p.brochureData?.college ?? null,
    jobTitle:       p.brochureData?.jobTitle ?? null,
    employer:       p.brochureData?.employer ?? null,
    internshipTitle: p.brochureData?.internshipTitle ?? null,
    internshipOrg:  p.brochureData?.internshipOrg ?? null,
    score:          scoreStudent(p.brochureData ?? null),
    excluded:       excluded.has(p.id),
  }));

  return NextResponse.json({ students });
}
```

- [ ] **Step 3: Verify**

With the dev server running, log in as a SCHOOL account and hit:
```
GET http://localhost:3000/api/school/brochure/settings
```
Expected: `{ "settings": { "visibility": "ADMIN_ONLY", "maxStudents": null, "excludedIds": [] } }`

```
PATCH http://localhost:3000/api/school/brochure/settings
Body: { "schoolId": "<school-user-id>", "visibility": "STUDENTS" }
```
Expected: settings updated with `"visibility": "STUDENTS"`.

- [ ] **Step 4: Commit**

```bash
git add app/api/school/brochure/settings/route.ts app/api/school/brochure/students/route.ts
git commit -m "feat: admin brochure settings + students list APIs

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 5: Admin Curation Panel Component

**Files:**
- Create: `components/school/BrochureCurationPanel.tsx`

**Interfaces:**
- Consumes: `GET /api/school/brochure/settings`, `PATCH /api/school/brochure/settings`, `GET /api/school/brochure/students` (Task 4)
- Produces: `<BrochureCurationPanel schoolId={string} />` — renders below the destinations map in Task 6

- [ ] **Step 1: Create `components/school/BrochureCurationPanel.tsx`**

```typescript
"use client";
import { useEffect, useState, useCallback } from "react";
import { Eye, EyeOff, Users, SortAsc } from "lucide-react";

interface StudentRow {
  profileId: string; name: string;
  college: string | null; jobTitle: string | null; employer: string | null;
  internshipTitle: string | null; internshipOrg: string | null;
  score: number; excluded: boolean;
}

type SortPreset = "top5" | "top10" | "top20" | "bottom5" | "recent" | "alpha" | null;

export default function BrochureCurationPanel({ schoolId }: { schoolId: string }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [visibility, setVisibility] = useState<"ADMIN_ONLY" | "STUDENTS">("ADMIN_ONLY");
  const [cap, setCap] = useState<string>("");
  const [activePreset, setActivePreset] = useState<SortPreset>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const qs = schoolId ? `?schoolId=${schoolId}` : "";

  useEffect(() => {
    Promise.all([
      fetch(`/api/school/brochure/students${qs}`).then((r) => r.json()),
      fetch(`/api/school/brochure/settings${qs}`).then((r) => r.json()),
    ]).then(([{ students: s }, { settings }]) => {
      setStudents(s ?? []);
      setExcluded(new Set(settings?.excludedIds ?? []));
      setVisibility(settings?.visibility ?? "ADMIN_ONLY");
      setCap(settings?.maxStudents ? String(settings.maxStudents) : "");
      setLoading(false);
    });
  }, [qs]);

  const applyPreset = (preset: SortPreset) => {
    setActivePreset(preset);
    if (!preset) return;
    let sorted = [...students];
    if (preset === "top5" || preset === "top10" || preset === "top20") {
      sorted.sort((a, b) => b.score - a.score);
      const n = preset === "top5" ? 5 : preset === "top10" ? 10 : 20;
      const topIds = new Set(sorted.slice(0, n).map((s) => s.profileId));
      setExcluded(new Set(students.filter((s) => !topIds.has(s.profileId)).map((s) => s.profileId)));
      setCap(String(n));
    } else if (preset === "bottom5") {
      sorted.sort((a, b) => a.score - b.score);
      const bottomIds = new Set(sorted.slice(0, 5).map((s) => s.profileId));
      setExcluded(new Set(students.filter((s) => !bottomIds.has(s.profileId)).map((s) => s.profileId)));
      setCap("5");
    } else if (preset === "recent") {
      setStudents([...students].reverse());
    } else if (preset === "alpha") {
      setStudents([...students].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const toggle = (profileId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId); else next.add(profileId);
      return next;
    });
  };

  const saveSettings = useCallback(async () => {
    setSaving(true);
    await fetch("/api/school/brochure/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId,
        visibility,
        maxStudents: cap ? parseInt(cap, 10) : null,
        excludedIds: Array.from(excluded),
      }),
    });
    setSaving(false);
  }, [schoolId, visibility, cap, excluded]);

  if (loading) return <div style={{ padding: 24, color: "var(--n-muted)", fontSize: 13 }}>Loading curation panel…</div>;

  const presets: { key: SortPreset; label: string }[] = [
    { key: "top5", label: "Top 5" },
    { key: "top10", label: "Top 10" },
    { key: "top20", label: "Top 20" },
    { key: "bottom5", label: "Bottom 5" },
    { key: "recent", label: "Most Recent" },
    { key: "alpha", label: "A–Z" },
  ];

  return (
    <div style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 16px" }}>
        Brochure Curation
      </p>

      {/* Controls row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>

        {/* Visibility toggle */}
        <button
          onClick={async () => {
            const next = visibility === "ADMIN_ONLY" ? "STUDENTS" : "ADMIN_ONLY";
            setVisibility(next);
          }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", fontSize: 12, fontWeight: 600,
            background: visibility === "STUDENTS" ? "var(--amber)" : "var(--surface)",
            color: visibility === "STUDENTS" ? "#1a1a1f" : "var(--text)",
            border: "1px solid var(--border)", borderRadius: 0, cursor: "pointer",
          }}
        >
          {visibility === "STUDENTS" ? <Eye size={13} /> : <EyeOff size={13} />}
          {visibility === "STUDENTS" ? "Visible to Students" : "Admin Only"}
        </button>

        {/* Student cap */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Users size={13} style={{ color: "var(--n-muted)" }} />
          <input
            type="number" min="1"
            placeholder="Show all"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            style={{
              width: 90, padding: "7px 10px", fontSize: 12,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 0, color: "var(--text)",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--n-muted)" }}>max students</span>
        </div>

        {/* Save */}
        <button
          onClick={saveSettings}
          disabled={saving}
          style={{
            marginLeft: "auto", padding: "8px 16px", fontSize: 12, fontWeight: 600,
            background: "var(--blue, #4a80f0)", color: "#fff",
            border: "none", borderRadius: 0, cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {/* Auto-sort presets */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <SortAsc size={13} style={{ color: "var(--n-muted)" }} />
        <span style={{ fontSize: 11, color: "var(--n-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>AUTO-SORT:</span>
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key === activePreset ? null : p.key)}
            style={{
              padding: "5px 12px", fontSize: 11, fontWeight: 600,
              background: activePreset === p.key ? "var(--amber)" : "var(--surface)",
              color: activePreset === p.key ? "#1a1a1f" : "var(--n-text2)",
              border: "1px solid var(--border)", borderRadius: 0, cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Student list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {students.map((s) => {
          const isExcluded = excluded.has(s.profileId);
          const outcome = s.jobTitle && s.employer
            ? `${s.jobTitle} @ ${s.employer}`
            : s.internshipTitle && s.internshipOrg
            ? `${s.internshipTitle} @ ${s.internshipOrg}`
            : null;
          return (
            <div
              key={s.profileId}
              onClick={() => toggle(s.profileId)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", cursor: "pointer",
                background: isExcluded ? "transparent" : "var(--surface)",
                border: "1px solid var(--border)",
                opacity: isExcluded ? 0.45 : 1,
                transition: "opacity 0.15s",
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                border: "2px solid var(--border)",
                background: isExcluded ? "transparent" : "var(--amber)",
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.name}</span>
                <span style={{ fontSize: 11, color: "var(--n-text2)", marginLeft: 10 }}>{s.college ?? "—"}</span>
                {outcome && <span style={{ fontSize: 11, color: "var(--n-muted)", marginLeft: 10 }}>· {outcome}</span>}
              </div>
              <span style={{
                fontSize: 10, fontFamily: "var(--font-mono)",
                color: s.score >= 3 ? "var(--amber)" : "var(--n-muted)",
                letterSpacing: "0.1em",
              }}>
                {s.score >= 3 ? "●●●" : s.score === 2 ? "●●○" : s.score === 1 ? "●○○" : "○○○"}
              </span>
            </div>
          );
        })}
        {students.length === 0 && (
          <p style={{ color: "var(--n-muted)", fontSize: 13, padding: "16px 0" }}>
            No students linked to this school yet.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/school/BrochureCurationPanel.tsx
git commit -m "feat: brochure curation panel with auto-sort presets

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 6: Wire Curation Panel Into Destinations Page

**Files:**
- Modify: `app/(dashboard)/school/destinations/DynamicComponents.tsx`
- Modify: `app/(dashboard)/school/destinations/page.tsx`

**Interfaces:**
- Consumes: `<BrochureCurationPanel schoolId={string} />` (Task 5)
- Produces: Destinations page renders the curation panel below the map for SCHOOL/ADMIN users

- [ ] **Step 1: Add `BrochureCurationPanel` to `DynamicComponents.tsx`**

In `app/(dashboard)/school/destinations/DynamicComponents.tsx`, add:

```typescript
export const BrochureCurationPanel = dynamic(
  () => import("@/components/school/BrochureCurationPanel"),
  { ssr: false }
);
```

The full file now reads:

```typescript
"use client";
import dynamic from "next/dynamic";

export const DestinationsMap = dynamic(
  () => import("@/components/school/DestinationsMap"),
  { ssr: false }
);

export const BrochureButton = dynamic(
  () => import("@/components/school/BrochureButton"),
  { ssr: false }
);

export const BrochureCurationPanel = dynamic(
  () => import("@/components/school/BrochureCurationPanel"),
  { ssr: false }
);
```

- [ ] **Step 2: Add the panel to `app/(dashboard)/school/destinations/page.tsx`**

At the top of the file, add `BrochureCurationPanel` to the import from `"./DynamicComponents"`:

```typescript
import { DestinationsMap, BrochureButton, BrochureCurationPanel } from "./DynamicComponents";
```

Then add the school's userId so the panel knows which school to load. In the `DestinationsPage` function, after the `const session = await auth()` block, add:

```typescript
const schoolId = session.user.id;
```

At the bottom of the returned JSX, after the "No college destinations" fallback block, add:

```tsx
<Suspense fallback={null}>
  <BrochureCurationPanel schoolId={schoolId} />
</Suspense>
```

- [ ] **Step 3: Verify**

Log in as `ridgepoint@nivarro.demo` / `ridgepoint2026` (a SCHOOL account), navigate to `/school/destinations`. The curation panel should appear below the destinations grid with the student list, preset buttons, and visibility toggle.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/school/destinations/"
git commit -m "feat: add curation panel to destinations page

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 7: Install @react-pdf/renderer + PDF Document Component

**Files:**
- Modify: `package.json` (via npm install)
- Create: `components/school/BrochureDocument.tsx`

**Interfaces:**
- Produces: `BrochureDocument` React component accepting `BrochureData` — consumed by Task 8

- [ ] **Step 1: Install the package**

```bash
cd "C:\Users\thoma\Goal-APP"
npm install @react-pdf/renderer
```

Expected: package added, `node_modules/@react-pdf/renderer` exists.

- [ ] **Step 2: Create `components/school/BrochureDocument.tsx`**

```typescript
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page:           { paddingTop: 0, paddingBottom: 48, paddingLeft: 48, paddingRight: 48, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  coverStrip:     { backgroundColor: "#1a1a1f", padding: 28, marginLeft: -48, marginRight: -48, marginBottom: 28 },
  coverTitle:     { fontSize: 22, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  coverSub:       { fontSize: 12, color: "#9090a8", marginTop: 6 },
  coverDate:      { fontSize: 9,  color: "#666675", marginTop: 8 },
  statsRow:       { flexDirection: "row", marginBottom: 28 },
  statBox:        { flex: 1, borderWidth: 1, borderColor: "#e5e5ea", borderStyle: "solid", padding: 14, marginRight: 8 },
  statBoxLast:    { flex: 1, borderWidth: 1, borderColor: "#e5e5ea", borderStyle: "solid", padding: 14 },
  statNum:        { fontSize: 26, color: "#4a80f0", fontFamily: "Helvetica-Bold" },
  statLabel:      { fontSize: 8, color: "#9090a8", marginTop: 4, textTransform: "uppercase", letterSpacing: 1 },
  sectionTitle:   { fontSize: 9, color: "#4a80f0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10, fontFamily: "Helvetica-Bold" },
  tableHead:      { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#4a80f0", borderBottomStyle: "solid", paddingBottom: 6, marginBottom: 4 },
  tableRow:       { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e5ea", borderBottomStyle: "solid", paddingTop: 7, paddingBottom: 7 },
  colName:        { width: "30%", fontSize: 10, color: "#1a1a1f" },
  colCollege:     { width: "35%", fontSize: 10, color: "#1a1a1f" },
  colRole:        { width: "35%", fontSize: 10, color: "#1a1a1f" },
  colNameH:       { width: "30%", fontSize: 8, color: "#58586a", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  colCollegeH:    { width: "35%", fontSize: 8, color: "#58586a", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  colRoleH:       { width: "35%", fontSize: 8, color: "#58586a", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  sectionGap:     { marginTop: 24 },
  testimonial:    { marginBottom: 14, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: "#4a80f0", borderLeftStyle: "solid" },
  testimonialText:{ fontSize: 10, color: "#2a2a33", fontFamily: "Helvetica-Oblique", lineHeight: 1.5 },
  testimonialOrg: { fontSize: 8,  color: "#9090a8", marginTop: 3 },
  footer:         { position: "absolute", bottom: 20, left: 48, right: 48, textAlign: "center", fontSize: 8, color: "#9090a8" },
});

export interface StudentRow {
  name: string;
  college: string | null;
  jobTitle: string | null;
  employer: string | null;
  internshipTitle: string | null;
  internshipOrg: string | null;
}

export interface Testimonial {
  body: string;
  orgName: string;
}

export interface BrochureData {
  schoolName: string;
  generatedAt: string;
  totalStudents: number;
  collegesCount: number;
  jobsCount: number;
  students: StudentRow[];
  testimonials: Testimonial[];
}

export function BrochureDocument({ data }: { data: BrochureData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.coverStrip}>
          <Text style={styles.coverTitle}>Nivarro × {data.schoolName}</Text>
          <Text style={styles.coverSub}>Student Outcomes Report</Text>
          <Text style={styles.coverDate}>Generated {data.generatedAt}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{data.totalStudents}</Text>
            <Text style={styles.statLabel}>Students Featured</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{data.collegesCount}</Text>
            <Text style={styles.statLabel}>Colleges</Text>
          </View>
          <View style={styles.statBoxLast}>
            <Text style={styles.statNum}>{data.jobsCount}</Text>
            <Text style={styles.statLabel}>Jobs / Internships</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Student Outcomes</Text>
        <View style={styles.tableHead}>
          <Text style={styles.colNameH}>Name</Text>
          <Text style={styles.colCollegeH}>College</Text>
          <Text style={styles.colRoleH}>Role / Employer</Text>
        </View>
        {data.students.map((s, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colName}>{s.name}</Text>
            <Text style={styles.colCollege}>{s.college ?? "—"}</Text>
            <Text style={styles.colRole}>
              {s.jobTitle && s.employer
                ? `${s.jobTitle} @ ${s.employer}`
                : s.internshipTitle && s.internshipOrg
                ? `${s.internshipTitle} @ ${s.internshipOrg}`
                : "—"}
            </Text>
          </View>
        ))}

        {data.testimonials.length > 0 && (
          <View style={styles.sectionGap}>
            <Text style={styles.sectionTitle}>What Organisations Say</Text>
            {data.testimonials.map((t, i) => (
              <View key={i} style={styles.testimonial}>
                <Text style={styles.testimonialText}>"{t.body}"</Text>
                <Text style={styles.testimonialOrg}>— {t.orgName}</Text>
              </View>
            ))}
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Powered by Nivarro · app.nivarro.co · Generated ${data.generatedAt} · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json components/school/BrochureDocument.tsx
git commit -m "feat: PDF brochure document component (@react-pdf/renderer)

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 8: PDF Brochure API Endpoint

**Files:**
- Create: `app/api/school/brochure/route.ts`

**Interfaces:**
- Consumes: `BrochureDocument`, `BrochureData`, `StudentRow`, `Testimonial` from `components/school/BrochureDocument.tsx` (Task 7); settings API shape from Task 4
- Produces: `GET /api/school/brochure` → `application/pdf` download

- [ ] **Step 1: Create `app/api/school/brochure/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { BrochureDocument } from "@/components/school/BrochureDocument";
import type { BrochureData, StudentRow, Testimonial } from "@/components/school/BrochureDocument";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true, profile: { select: { displayName: true } } },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const schoolId = dbUser.role === "SCHOOL" ? session.user.id : searchParams.get("schoolId");
  if (!schoolId) return NextResponse.json({ error: "schoolId required" }, { status: 400 });

  const schoolUser = dbUser.role === "SCHOOL"
    ? dbUser
    : await prisma.user.findUnique({
        where: { id: schoolId },
        select: { name: true, profile: { select: { displayName: true } } },
      });
  const schoolName = schoolUser?.profile?.displayName ?? schoolUser?.name ?? "Your School";

  const [settings, profiles, reviews] = await Promise.all([
    prisma.schoolBrochureSettings.findUnique({ where: { schoolId } }),
    prisma.profile.findMany({
      where: { schoolId },
      select: {
        id: true,
        displayName: true,
        brochureData: {
          select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true },
        },
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.orgReview.findMany({
      where: { profile: { schoolId } },
      select: { body: true, org: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const excluded = new Set<string>(settings ? JSON.parse(settings.excludedIds) : []);
  const cap = settings?.maxStudents ?? null;

  let included = profiles.filter((p) => !excluded.has(p.id));
  included.sort((a, b) => {
    const score = (d: typeof a.brochureData) => {
      if (!d) return 0;
      return (d.college ? 1 : 0) + (d.jobTitle && d.employer ? 2 : 0) + (d.internshipTitle && d.internshipOrg ? 1 : 0);
    };
    return score(b.brochureData) - score(a.brochureData);
  });
  if (cap) included = included.slice(0, cap);

  const students: StudentRow[] = included.map((p) => ({
    name:           p.displayName,
    college:        p.brochureData?.college ?? null,
    jobTitle:       p.brochureData?.jobTitle ?? null,
    employer:       p.brochureData?.employer ?? null,
    internshipTitle: p.brochureData?.internshipTitle ?? null,
    internshipOrg:  p.brochureData?.internshipOrg ?? null,
  }));

  const testimonials: Testimonial[] = reviews.map((r) => ({ body: r.body, orgName: r.org.name }));

  const collegesCount = new Set(students.map((s) => s.college).filter(Boolean)).size;
  const jobsCount = students.filter((s) => (s.jobTitle && s.employer) || (s.internshipTitle && s.internshipOrg)).length;

  const data: BrochureData = {
    schoolName,
    generatedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    totalStudents: students.length,
    collegesCount,
    jobsCount,
    students,
    testimonials,
  };

  const buffer = await renderToBuffer(React.createElement(BrochureDocument, { data }));

  return new Response(buffer, {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="nivarro-brochure.pdf"`,
      "Cache-Control":       "no-store",
    },
  });
}
```

- [ ] **Step 2: Verify**

With the dev server running, open a browser tab as a SCHOOL account and navigate to:
```
http://localhost:3000/api/school/brochure
```
Expected: browser downloads `nivarro-brochure.pdf`. Open the PDF — confirm cover strip, stats row, outcomes table, and footer appear.

- [ ] **Step 3: Commit**

```bash
git add app/api/school/brochure/route.ts
git commit -m "feat: server-side PDF brochure generation endpoint

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 9: Update BrochureButton

**Files:**
- Modify: `components/school/BrochureButton.tsx`

**Interfaces:**
- Consumes: `GET /api/school/brochure` (Task 8)
- Produces: Button that fetches the PDF and triggers a browser download

- [ ] **Step 1: Replace the full contents of `components/school/BrochureButton.tsx`**

```typescript
"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

export default function BrochureButton() {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/school/brochure");
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nivarro-brochure.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={download}
      disabled={loading}
      style={{
        padding: "8px 16px",
        borderRadius: 0,
        border: "1px solid var(--border)",
        background: "var(--n-bg2)",
        color: "var(--text)",
        fontSize: 13,
        fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.15s",
      }}
    >
      {loading
        ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
        : <FileDown size={14} />}
      {loading ? "Generating…" : "Download Brochure"}
      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </button>
  );
}
```

- [ ] **Step 2: Update the BrochureButton usage in the destinations page**

In `app/(dashboard)/school/destinations/page.tsx`, the `<BrochureButton>` component is currently passed props (`destinations`, `totalStudents`, `states`). Remove those props — the new button takes none:

Find:
```tsx
<BrochureButton destinations={destinations} totalStudents={totalStudents} states={states} />
```
Replace with:
```tsx
<BrochureButton />
```

- [ ] **Step 3: Verify**

On the destinations page as a SCHOOL account, click "Download Brochure". The spinner should appear, then the PDF download triggers automatically. Open the PDF and confirm it reflects the curated student list from the curation panel.

- [ ] **Step 4: Commit**

```bash
git add components/school/BrochureButton.tsx "app/(dashboard)/school/destinations/page.tsx"
git commit -m "feat: simplify BrochureButton to fetch from server endpoint

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 10: Student Dashboard Banner

**Files:**
- Create: `components/school/WhySchoolBanner.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `SchoolBrochureSettings`, `Profile.schoolId`, `StudentBrochureData` aggregates from Prisma
- Produces: Banner at top of student dashboard when visibility = "STUDENTS"; links to `/profile/survey`

- [ ] **Step 1: Create `components/school/WhySchoolBanner.tsx`**

```typescript
"use client";
import Link from "next/link";
import { ArrowRight, ClipboardList, ExternalLink } from "lucide-react";

interface Props {
  schoolName: string;
  studentsCount: number;
  collegesCount: number;
  jobsCount: number;
}

export default function WhySchoolBanner({ schoolName, studentsCount, collegesCount, jobsCount }: Props) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--amber)",
      padding: "20px 24px",
      marginBottom: 28,
    }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 6px" }}>
        Your School
      </p>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 2.5vw, 26px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 12px" }}>
        Why {schoolName}?
      </h2>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { value: studentsCount, label: "Students on Nivarro" },
          { value: collegesCount, label: "Colleges represented" },
          { value: jobsCount,     label: "Jobs & internships secured" },
        ].map(({ value, label }) => (
          <div key={label}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--amber)", letterSpacing: "-0.04em" }}>{value}</span>
            <span style={{ fontSize: 12, color: "var(--n-text2)", marginLeft: 6 }}>{label}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "var(--n-text2)", margin: "0 0 16px" }}>
        Help build this picture for prospective students — update your outcomes and keep your LinkedIn current.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/profile/survey" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 16px", fontSize: 12, fontWeight: 600,
          background: "var(--amber)", color: "#1a1a1f",
          textDecoration: "none", borderRadius: 0,
        }}>
          <ClipboardList size={13} />
          Add Your Outcomes
          <ArrowRight size={13} />
        </Link>
        <Link href="/profile" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px", fontSize: 12, fontWeight: 600,
          background: "transparent", color: "var(--text)",
          border: "1px solid var(--border)", textDecoration: "none", borderRadius: 0,
        }}>
          <ExternalLink size={13} />
          Update LinkedIn
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify `app/(dashboard)/dashboard/page.tsx` to fetch and render the banner**

After the existing `profile` query (around line 28), add a banner data fetch block. Insert this after the `const profile = await prisma.profile.findUnique(...)` block and before the `const seenSpaces` line:

```typescript
// Banner: show "Why [School]?" if student is school-linked and admin enabled visibility
let bannerData: { schoolName: string; studentsCount: number; collegesCount: number; jobsCount: number } | null = null;
if (profile?.schoolId) {
  const [settings, schoolUser, studentCounts] = await Promise.all([
    prisma.schoolBrochureSettings.findUnique({
      where: { schoolId: profile.schoolId },
      select: { visibility: true },
    }),
    prisma.user.findUnique({
      where: { id: profile.schoolId },
      select: { name: true, profile: { select: { displayName: true } } },
    }),
    prisma.studentBrochureData.findMany({
      where: { profile: { schoolId: profile.schoolId } },
      select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true },
    }),
  ]);

  if (settings?.visibility === "STUDENTS") {
    const colleges = new Set(studentCounts.map((s) => s.college).filter(Boolean)).size;
    const jobs = studentCounts.filter((s) => (s.jobTitle && s.employer) || (s.internshipTitle && s.internshipOrg)).length;
    bannerData = {
      schoolName:    schoolUser?.profile?.displayName ?? schoolUser?.name ?? "Your School",
      studentsCount: studentCounts.length,
      collegesCount: colleges,
      jobsCount:     jobs,
    };
  }
}
```

- [ ] **Step 3: Add the import and render the banner in `dashboard/page.tsx`**

At the top of the file, add:
```typescript
import WhySchoolBanner from "@/components/school/WhySchoolBanner";
```

In the returned JSX, replace:
```tsx
<DashboardClient
```
with:
```tsx
<>
  {bannerData && (
    <WhySchoolBanner
      schoolName={bannerData.schoolName}
      studentsCount={bannerData.studentsCount}
      collegesCount={bannerData.collegesCount}
      jobsCount={bannerData.jobsCount}
    />
  )}
  <DashboardClient
```

And close the fragment after `/>`:
```tsx
  />
</>
```

- [ ] **Step 4: Verify**

Log in as a student account that has `profile.schoolId` set. The banner should be hidden by default (visibility is `ADMIN_ONLY`). Then as a school admin, toggle visibility to "Students" in the curation panel and save. Reload the student dashboard — the banner should now appear with the stats and the two CTA buttons.

- [ ] **Step 5: Commit**

```bash
git add components/school/WhySchoolBanner.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: student Why-School banner on dashboard

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 1 Amendment: Add Testimonials Table + Survey Email Tracking

**Files:**
- Modify: `prisma/schema.prisma` (add to the brochure section created in Task 1)
- Modify: `prisma/migrations/20260706000000_brochure_tables/migration.sql` (append before running)

> Run this BEFORE `npx prisma generate` in Task 1 — or if Task 1 is already done, create a new migration `20260706000001_brochure_testimonials`.

- [ ] **Step 1: Add `lastEmailedAt` to `StudentBrochureData` in schema**

In `prisma/schema.prisma`, in the `StudentBrochureData` model, add after `internshipOrg`:

```prisma
  lastEmailedAt   DateTime?
```

- [ ] **Step 2: Add `BrochureTestimonial` model to schema**

Append after `SchoolBrochureSettings`:

```prisma
model BrochureTestimonial {
  id            String   @id @default(cuid())
  schoolId      String
  body          String
  sourceName    String
  sourceContext String?
  sourceType    String   @default("STUDENT")
  approved      Boolean  @default(false)
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([schoolId])
}
```

- [ ] **Step 3: Add to the migration SQL**

Append to `prisma/migrations/20260706000000_brochure_tables/migration.sql` (or new file if already deployed):

```sql
ALTER TABLE "StudentBrochureData" ADD COLUMN IF NOT EXISTS "lastEmailedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "BrochureTestimonial" (
  "id"            TEXT NOT NULL,
  "schoolId"      TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "sourceName"    TEXT NOT NULL,
  "sourceContext" TEXT,
  "sourceType"    TEXT NOT NULL DEFAULT 'STUDENT',
  "approved"      BOOLEAN NOT NULL DEFAULT false,
  "displayOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrochureTestimonial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BrochureTestimonial_schoolId_idx" ON "BrochureTestimonial"("schoolId");
```

- [ ] **Step 4: Regenerate client**

```bash
npx prisma generate
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add BrochureTestimonial table and survey email tracking field

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 11: Testimonials API + Curation Panel Integration

**Files:**
- Create: `app/api/school/brochure/testimonials/route.ts`
- Create: `app/api/school/brochure/testimonials/[id]/route.ts`
- Modify: `components/school/BrochureCurationPanel.tsx`

**Interfaces:**
- Consumes: `BrochureTestimonial` Prisma model (Task 1 Amendment)
- Produces:
  - `GET /api/school/brochure/testimonials?schoolId=` → `{ testimonials: TestimonialRow[] }`
  - `POST /api/school/brochure/testimonials` body: `{ schoolId, body, sourceName, sourceContext?, sourceType? }` → `{ testimonial }`
  - `PATCH /api/school/brochure/testimonials/[id]` body: partial fields → `{ testimonial }`
  - `DELETE /api/school/brochure/testimonials/[id]` → `{ ok: true }`
  - `TestimonialRow` = `{ id, body, sourceName, sourceContext, sourceType, approved, displayOrder }`

- [ ] **Step 1: Create `app/api/school/brochure/testimonials/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  schoolId:      z.string(),
  body:          z.string().min(1).max(600),
  sourceName:    z.string().min(1).max(100),
  sourceContext: z.string().max(100).optional().nullable(),
  sourceType:    z.enum(["STUDENT", "ALUMNI", "PARENT", "ORG"]).default("STUDENT"),
});

async function guard(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return { error: "Forbidden", status: 403 };
  return { session, role: dbUser.role };
}

export async function GET(req: Request) {
  const check = await guard(req);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  const { searchParams } = new URL(req.url);
  const schoolId = check.role === "SCHOOL" ? check.session.user.id : searchParams.get("schoolId");
  if (!schoolId) return NextResponse.json({ error: "schoolId required" }, { status: 400 });

  const testimonials = await prisma.brochureTestimonial.findMany({
    where: { schoolId },
    orderBy: { displayOrder: "asc" },
    select: { id: true, body: true, sourceName: true, sourceContext: true, sourceType: true, approved: true, displayOrder: true },
  });
  return NextResponse.json({ testimonials });
}

export async function POST(req: Request) {
  const check = await guard(req);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  if (check.role === "SCHOOL" && parsed.data.schoolId !== check.session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const count = await prisma.brochureTestimonial.count({ where: { schoolId: parsed.data.schoolId } });
  const testimonial = await prisma.brochureTestimonial.create({
    data: { ...parsed.data, displayOrder: count },
  });
  return NextResponse.json({ testimonial }, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/school/brochure/testimonials/[id]/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  body:          z.string().min(1).max(600).optional(),
  sourceName:    z.string().min(1).max(100).optional(),
  sourceContext: z.string().max(100).nullable().optional(),
  sourceType:    z.enum(["STUDENT", "ALUMNI", "PARENT", "ORG"]).optional(),
  approved:      z.boolean().optional(),
  displayOrder:  z.number().int().optional(),
});

async function guardItem(id: string, userId: string, role: string) {
  const item = await prisma.brochureTestimonial.findUnique({ where: { id }, select: { schoolId: true } });
  if (!item) return { error: "Not found", status: 404 };
  if (role === "SCHOOL" && item.schoolId !== userId) return { error: "Forbidden", status: 403 };
  return { item };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const check = await guardItem(id, session.user.id, dbUser.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const updated = await prisma.brochureTestimonial.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ testimonial: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const check = await guardItem(id, session.user.id, dbUser.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  await prisma.brochureTestimonial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Add testimonials section to `BrochureCurationPanel.tsx`**

Add to the existing imports at the top:

```typescript
import { Quote, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
```

Add state in the component (after the existing state declarations):

```typescript
interface TestimonialRow {
  id: string; body: string; sourceName: string; sourceContext: string | null;
  sourceType: string; approved: boolean; displayOrder: number;
}
const [testimonials, setTestimonials] = useState<TestimonialRow[]>([]);
const [newQuote, setNewQuote] = useState({ body: "", sourceName: "", sourceContext: "", sourceType: "STUDENT" });
const [addingQuote, setAddingQuote] = useState(false);
```

In the `useEffect`, extend the `Promise.all` to also fetch testimonials:

```typescript
fetch(`/api/school/brochure/testimonials${qs}`).then((r) => r.json()),
```

And in the `.then` handler, destructure and set:

```typescript
.then(([{ students: s }, { settings }, { testimonials: t }]) => {
  // ... existing setters ...
  setTestimonials(t ?? []);
  setLoading(false);
});
```

Add these helper functions in the component body (before the return):

```typescript
const toggleApprove = async (t: TestimonialRow) => {
  const res = await fetch(`/api/school/brochure/testimonials/${t.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved: !t.approved }),
  });
  const { testimonial } = await res.json();
  setTestimonials((prev) => prev.map((x) => x.id === t.id ? testimonial : x));
};

const deleteTestimonial = async (id: string) => {
  await fetch(`/api/school/brochure/testimonials/${id}`, { method: "DELETE" });
  setTestimonials((prev) => prev.filter((x) => x.id !== id));
};

const addTestimonial = async () => {
  if (!newQuote.body.trim() || !newQuote.sourceName.trim()) return;
  setAddingQuote(true);
  const res = await fetch("/api/school/brochure/testimonials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolId, ...newQuote }),
  });
  const { testimonial } = await res.json();
  setTestimonials((prev) => [...prev, testimonial]);
  setNewQuote({ body: "", sourceName: "", sourceContext: "", sourceType: "STUDENT" });
  setAddingQuote(false);
};
```

Append the following JSX block at the end of the returned div (after the student list `</div>`):

```tsx
{/* Testimonials */}
<div style={{ marginTop: 28, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
    <Quote size={13} style={{ color: "var(--amber)" }} />
    <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: 0 }}>
      Testimonials
    </p>
  </div>

  {testimonials.map((t) => (
    <div key={t.id} style={{ display: "flex", gap: 10, marginBottom: 10, padding: "12px 14px", background: t.approved ? "var(--surface)" : "transparent", border: "1px solid var(--border)", opacity: t.approved ? 1 : 0.6 }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text)", fontStyle: "italic" }}>"{t.body}"</p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--n-muted)", fontFamily: "var(--font-mono)" }}>
          — {t.sourceName}{t.sourceContext ? ` · ${t.sourceContext}` : ""} · {t.sourceType}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        <button onClick={() => toggleApprove(t)} title={t.approved ? "Unapprove" : "Approve"} style={{ background: "none", border: "none", cursor: "pointer", color: t.approved ? "var(--amber)" : "var(--n-muted)", padding: 0 }}>
          {t.approved ? <CheckCircle2 size={15} /> : <Circle size={15} />}
        </button>
        <button onClick={() => deleteTestimonial(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--n-muted)", padding: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  ))}

  {/* Add new testimonial form */}
  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
    <textarea
      placeholder="Quote text…"
      value={newQuote.body}
      onChange={(e) => setNewQuote((q) => ({ ...q, body: e.target.value }))}
      rows={3}
      style={{ padding: "8px 12px", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, color: "var(--text)", resize: "vertical", fontFamily: "inherit" }}
    />
    <div style={{ display: "flex", gap: 8 }}>
      <input
        placeholder="Name"
        value={newQuote.sourceName}
        onChange={(e) => setNewQuote((q) => ({ ...q, sourceName: e.target.value }))}
        style={{ flex: 1, padding: "7px 10px", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, color: "var(--text)" }}
      />
      <input
        placeholder="Context (e.g. Grade 11 · Fellow)"
        value={newQuote.sourceContext}
        onChange={(e) => setNewQuote((q) => ({ ...q, sourceContext: e.target.value }))}
        style={{ flex: 2, padding: "7px 10px", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, color: "var(--text)" }}
      />
      <select
        value={newQuote.sourceType}
        onChange={(e) => setNewQuote((q) => ({ ...q, sourceType: e.target.value }))}
        style={{ padding: "7px 10px", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, color: "var(--text)" }}
      >
        <option value="STUDENT">Student</option>
        <option value="ALUMNI">Alumni</option>
        <option value="PARENT">Parent</option>
        <option value="ORG">Org</option>
      </select>
    </div>
    <button
      onClick={addTestimonial}
      disabled={addingQuote}
      style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 12, fontWeight: 600, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 0, cursor: "pointer" }}
    >
      <Plus size={13} />
      {addingQuote ? "Adding…" : "Add Testimonial"}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Update the PDF brochure endpoint (Task 8) to use `BrochureTestimonial` instead of `OrgReview`**

In `app/api/school/brochure/route.ts`, replace the `reviews` query in `Promise.all`:

```typescript
// Replace:
prisma.orgReview.findMany({
  where: { profile: { schoolId } },
  select: { body: true, org: { select: { name: true } } },
  orderBy: { createdAt: "desc" },
  take: 3,
}),

// With:
prisma.brochureTestimonial.findMany({
  where: { schoolId, approved: true },
  select: { body: true, sourceName: true, sourceContext: true },
  orderBy: { displayOrder: "asc" },
}),
```

Update the `testimonials` mapping:

```typescript
// Replace:
const testimonials: Testimonial[] = reviews.map((r) => ({ body: r.body, orgName: r.org.name }));

// With:
const testimonials: Testimonial[] = reviews.map((r) => ({
  body: r.body,
  sourceName: r.sourceName,
  sourceContext: r.sourceContext ?? null,
}));
```

- [ ] **Step 5: Update the `Testimonial` interface in `BrochureDocument.tsx`**

In `components/school/BrochureDocument.tsx`, replace:

```typescript
export interface Testimonial {
  body: string;
  orgName: string;
}
```

With:

```typescript
export interface Testimonial {
  body: string;
  sourceName: string;
  sourceContext: string | null;
}
```

And update the testimonial rendering in the Document component:

```tsx
// Replace:
<Text style={styles.testimonialOrg}>— {t.orgName}</Text>

// With:
<Text style={styles.testimonialOrg}>
  — {t.sourceName}{t.sourceContext ? ` · ${t.sourceContext}` : ""}
</Text>
```

- [ ] **Step 6: Verify**

In the curation panel, add a testimonial with body, name, and context. Toggle it to approved (circle icon → checkmark). Download the brochure PDF — the approved testimonial should appear. Delete it — should disappear from the list.

- [ ] **Step 7: Commit**

```bash
git add app/api/school/brochure/testimonials/ components/school/BrochureCurationPanel.tsx components/school/BrochureDocument.tsx app/api/school/brochure/route.ts
git commit -m "feat: testimonials management system with admin CRUD

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 12: Annual Survey Email System

**Files:**
- Create: `app/api/school/brochure/send-survey-emails/route.ts`
- Create: `lib/surveyEmailTemplate.ts`
- Modify: `components/school/BrochureCurationPanel.tsx`

**Interfaces:**
- Consumes: `StudentBrochureData.lastEmailedAt` (Task 1 Amendment), `Profile.schoolId`, `User.email`, Resend client from `lib/resend.ts`
- Produces: `POST /api/school/brochure/send-survey-emails` → `{ sent: number, skipped: number }`; "Send Annual Survey" button in curation panel

- [ ] **Step 1: Create `lib/surveyEmailTemplate.ts`**

```typescript
export function surveyEmailHtml(schoolName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f5f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5ea;">
          <tr>
            <td style="background:#1a1a1f;padding:28px 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#9090a8;font-family:'Courier New',monospace;">Nivarro × ${schoolName}</p>
              <h1 style="margin:8px 0 0;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">Annual Outcomes Update</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#2a2a33;line-height:1.6;">
                Hey — it's that time of year. ${schoolName} uses Nivarro to show prospective students
                the real outcomes of graduates like you: where they went to college, what roles they landed,
                and what they've built since.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#2a2a33;line-height:1.6;">
                Takes two minutes. No test scores, no rankings — just your story.
              </p>
              <a href="https://app.nivarro.co/profile/survey"
                 style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#1a1a1f;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.01em;">
                Update Your Outcomes →
              </a>
              <p style="margin:24px 0 0;font-size:12px;color:#9090a8;line-height:1.5;">
                You're receiving this because you're connected to ${schoolName} on Nivarro.
                Your information is only shared with your school's administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f0f0f5;background:#f9f9fb;">
              <p style="margin:0;font-size:11px;color:#b0b0c0;">
                Powered by <a href="https://app.nivarro.co" style="color:#4a80f0;text-decoration:none;">Nivarro</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
```

- [ ] **Step 2: Create `app/api/school/brochure/send-survey-emails/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";
import { surveyEmailHtml } from "@/lib/surveyEmailTemplate";
import { z } from "zod";
import { subMonths } from "date-fns";

const schema = z.object({ schoolId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { schoolId } = parsed.data;
  if (dbUser.role === "SCHOOL" && schoolId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const schoolUser = await prisma.user.findUnique({
    where: { id: schoolId },
    select: { name: true, profile: { select: { displayName: true } } },
  });
  const schoolName = schoolUser?.profile?.displayName ?? schoolUser?.name ?? "Your School";

  const cutoff = subMonths(new Date(), 11);

  const profiles = await prisma.profile.findMany({
    where: { schoolId },
    select: {
      user: { select: { email: true } },
      brochureData: { select: { lastEmailedAt: true } },
    },
  });

  const toEmail = profiles.filter((p) => {
    if (!p.user.email) return false;
    const last = p.brochureData?.lastEmailedAt;
    return !last || last < cutoff;
  });

  const resend = getResendClient();
  let sent = 0;
  const html = surveyEmailHtml(schoolName);

  for (const p of toEmail) {
    if (!p.user.email) continue;
    try {
      await resend.emails.send({
        from: "Nivarro <surveys@nivarro.co>",
        to: p.user.email,
        subject: `Update your outcomes — ${schoolName} annual survey`,
        html,
      });
      sent++;
    } catch {
      // Continue on individual failures
    }
  }

  // Bulk update lastEmailedAt for all profiles that have one
  const profileIds = profiles
    .filter((p) => {
      if (!p.user.email) return false;
      const last = p.brochureData?.lastEmailedAt;
      return !last || last < cutoff;
    })
    .map((p) => p);

  // We need profile IDs — re-query with IDs
  const profilesWithIds = await prisma.profile.findMany({
    where: { schoolId },
    select: { id: true, user: { select: { email: true } }, brochureData: { select: { lastEmailedAt: true } } },
  });
  const nowDate = new Date();
  for (const p of profilesWithIds) {
    if (!p.user.email) continue;
    const last = p.brochureData?.lastEmailedAt;
    if (!last || last < cutoff) {
      await prisma.studentBrochureData.upsert({
        where: { profileId: p.id },
        create: { profileId: p.id, lastEmailedAt: nowDate },
        update: { lastEmailedAt: nowDate },
      });
    }
  }

  return NextResponse.json({ sent, skipped: profiles.length - sent });
}
```

- [ ] **Step 3: Add "Send Annual Survey" button to `BrochureCurationPanel.tsx`**

Add state near the other state declarations:

```typescript
const [sendingEmails, setSendingEmails] = useState(false);
const [emailResult, setEmailResult] = useState<{ sent: number; skipped: number } | null>(null);
```

Add the handler function before the return:

```typescript
const sendSurveyEmails = async () => {
  setSendingEmails(true);
  setEmailResult(null);
  const res = await fetch("/api/school/brochure/send-survey-emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolId }),
  });
  const result = await res.json();
  setEmailResult(result);
  setSendingEmails(false);
};
```

Add the button in the controls row, after "Save Settings":

```tsx
<button
  onClick={sendSurveyEmails}
  disabled={sendingEmails}
  style={{
    padding: "8px 14px", fontSize: 12, fontWeight: 600,
    background: "transparent", color: "var(--n-text2)",
    border: "1px solid var(--border)", borderRadius: 0,
    cursor: sendingEmails ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", gap: 6,
  }}
>
  {sendingEmails ? "Sending…" : "Send Annual Survey"}
</button>
{emailResult && (
  <span style={{ fontSize: 11, color: "var(--n-muted)" }}>
    {emailResult.sent} sent · {emailResult.skipped} already emailed this year
  </span>
)}
```

- [ ] **Step 4: Verify**

In the curation panel as a school admin, click "Send Annual Survey". Should show "X sent · Y already emailed this year". Check the `team.nivarro@gmail.com` inbox (if test students use that domain) or check Resend dashboard for sent emails.

- [ ] **Step 5: Commit**

```bash
git add lib/surveyEmailTemplate.ts app/api/school/brochure/send-survey-emails/ components/school/BrochureCurationPanel.tsx
git commit -m "feat: annual survey email system with 11-month cooldown

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 13: Enhanced PDF Design (Pretty Brochure)

**Files:**
- Create: `lib/collegeLogos.ts`
- Modify: `components/school/BrochureDocument.tsx`
- Modify: `app/api/school/brochure/route.ts`

**Interfaces:**
- Consumes: `BrochureData` from Task 7; `collegeDomains` lookup from new `lib/collegeLogos.ts`
- Produces: A visually polished PDF with a dark cover strip, colour-coded college badges, and richer typography

- [ ] **Step 1: Create `lib/collegeLogos.ts`**

This maps common college names to their web domain so Clearbit can serve their logo. Add more as needed.

```typescript
const COLLEGE_DOMAINS: Record<string, string> = {
  "MIT":                        "mit.edu",
  "Massachusetts Institute of Technology": "mit.edu",
  "Harvard University":         "harvard.edu",
  "Harvard":                    "harvard.edu",
  "Stanford University":        "stanford.edu",
  "Stanford":                   "stanford.edu",
  "Yale University":            "yale.edu",
  "Princeton University":       "princeton.edu",
  "Columbia University":        "columbia.edu",
  "University of Pennsylvania": "upenn.edu",
  "Cornell University":         "cornell.edu",
  "Dartmouth College":          "dartmouth.edu",
  "Brown University":           "brown.edu",
  "Duke University":            "duke.edu",
  "Northwestern University":    "northwestern.edu",
  "Johns Hopkins University":   "jhu.edu",
  "Vanderbilt University":      "vanderbilt.edu",
  "Rice University":            "rice.edu",
  "Notre Dame":                 "nd.edu",
  "University of Chicago":      "uchicago.edu",
  "Georgetown University":      "georgetown.edu",
  "Emory University":           "emory.edu",
  "UC Berkeley":                "berkeley.edu",
  "UCLA":                       "ucla.edu",
  "Michigan":                   "umich.edu",
  "University of Michigan":     "umich.edu",
  "Howard University":          "howard.edu",
  "Morehouse College":          "morehouse.edu",
  "Spelman College":            "spelman.edu",
  "NYU":                        "nyu.edu",
  "New York University":        "nyu.edu",
  "Boston University":          "bu.edu",
  "Tufts University":           "tufts.edu",
  "George Washington University": "gwu.edu",
  "American University":        "american.edu",
};

export function getCollegeDomain(name: string): string | null {
  return COLLEGE_DOMAINS[name] ?? null;
}

export async function fetchLogoBase64(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`https://logo.clearbit.com/${domain}?size=48`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Fetch logos in the brochure endpoint before rendering**

In `app/api/school/brochure/route.ts`, add imports at the top:

```typescript
import { getCollegeDomain, fetchLogoBase64 } from "@/lib/collegeLogos";
```

After building the `students` array and before creating `data`, add:

```typescript
// Pre-fetch college logos for unique colleges
const uniqueColleges = [...new Set(students.map((s) => s.college).filter(Boolean))] as string[];
const logoMap: Record<string, string | null> = {};
await Promise.all(
  uniqueColleges.map(async (college) => {
    const domain = getCollegeDomain(college);
    logoMap[college] = domain ? await fetchLogoBase64(domain) : null;
  })
);
```

Pass `logoMap` into `BrochureData`:

```typescript
const data: BrochureData = {
  // ... existing fields ...
  logoMap,
};
```

- [ ] **Step 3: Update `BrochureDocument.tsx` with enhanced design**

Replace the entire file contents with this prettier version:

```typescript
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import React from "react";

const BADGE_COLORS = ["#4a80f0", "#f59e0b", "#10b981", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899"];

const styles = StyleSheet.create({
  page:            { paddingTop: 0, paddingBottom: 52, paddingLeft: 0, paddingRight: 0, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  coverStrip:      { backgroundColor: "#1a1a1f", paddingTop: 36, paddingBottom: 36, paddingLeft: 48, paddingRight: 48, marginBottom: 32 },
  coverEyebrow:    { fontSize: 8, color: "#9090a8", letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica", marginBottom: 8 },
  coverTitle:      { fontSize: 26, color: "#ffffff", fontFamily: "Helvetica-Bold", letterSpacing: -0.5, marginBottom: 6 },
  coverSub:        { fontSize: 12, color: "#c0c0d0" },
  coverDate:       { fontSize: 9,  color: "#666675", marginTop: 10 },
  body:            { paddingLeft: 48, paddingRight: 48 },
  statsRow:        { flexDirection: "row", marginBottom: 32 },
  statBox:         { flex: 1, borderLeftWidth: 3, borderLeftColor: "#4a80f0", borderLeftStyle: "solid", paddingLeft: 12, marginRight: 20 },
  statBoxLast:     { flex: 1, borderLeftWidth: 3, borderLeftColor: "#f59e0b", borderLeftStyle: "solid", paddingLeft: 12 },
  statNum:         { fontSize: 30, color: "#1a1a1f", fontFamily: "Helvetica-Bold", letterSpacing: -1 },
  statLabel:       { fontSize: 8, color: "#9090a8", marginTop: 3, textTransform: "uppercase", letterSpacing: 1 },
  sectionLabel:    { fontSize: 8, color: "#4a80f0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, fontFamily: "Helvetica-Bold" },
  divider:         { borderBottomWidth: 1, borderBottomColor: "#f0f0f5", borderBottomStyle: "solid", marginBottom: 12 },
  tableHead:       { flexDirection: "row", paddingBottom: 8, marginBottom: 2, borderBottomWidth: 1, borderBottomColor: "#e5e5ea", borderBottomStyle: "solid" },
  tableRow:        { flexDirection: "row", paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#f5f5f8", borderBottomStyle: "solid", alignItems: "center" },
  tableRowAlt:     { flexDirection: "row", paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#f5f5f8", borderBottomStyle: "solid", alignItems: "center", backgroundColor: "#fafafa" },
  colName:         { width: "28%", fontSize: 10, color: "#1a1a1f", fontFamily: "Helvetica-Bold" },
  colCollege:      { width: "38%", fontSize: 10, color: "#1a1a1f", flexDirection: "row", alignItems: "center" },
  colRole:         { width: "34%", fontSize: 10, color: "#58586a" },
  colNameH:        { width: "28%", fontSize: 8, color: "#9090a8", textTransform: "uppercase", letterSpacing: 0.5 },
  colCollegeH:     { width: "38%", fontSize: 8, color: "#9090a8", textTransform: "uppercase", letterSpacing: 0.5 },
  colRoleH:        { width: "34%", fontSize: 8, color: "#9090a8", textTransform: "uppercase", letterSpacing: 0.5 },
  badge:           { width: 20, height: 20, borderRadius: 4, marginRight: 7, alignItems: "center", justifyContent: "center" },
  badgeText:       { fontSize: 9, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  logoImg:         { width: 20, height: 20, marginRight: 7, objectFit: "contain" },
  sectionGap:      { marginTop: 28 },
  testimonialWrap: { marginBottom: 16 },
  testimonialInner:{ paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: "#f59e0b", borderLeftStyle: "solid" },
  testimonialText: { fontSize: 11, color: "#2a2a33", fontFamily: "Helvetica-Oblique", lineHeight: 1.6, marginBottom: 4 },
  testimonialSrc:  { fontSize: 8, color: "#9090a8", fontFamily: "Helvetica", textTransform: "uppercase", letterSpacing: 0.5 },
  footer:          { position: "absolute", bottom: 20, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText:      { fontSize: 8, color: "#c0c0c8" },
  footerPage:      { fontSize: 8, color: "#9090a8" },
});

export interface StudentRow {
  name: string; college: string | null;
  jobTitle: string | null; employer: string | null;
  internshipTitle: string | null; internshipOrg: string | null;
}
export interface Testimonial {
  body: string; sourceName: string; sourceContext: string | null;
}
export interface BrochureData {
  schoolName: string; generatedAt: string;
  totalStudents: number; collegesCount: number; jobsCount: number;
  students: StudentRow[]; testimonials: Testimonial[];
  logoMap: Record<string, string | null>;
}

export function BrochureDocument({ data }: { data: BrochureData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cover */}
        <View style={styles.coverStrip}>
          <Text style={styles.coverEyebrow}>Student Outcomes Report</Text>
          <Text style={styles.coverTitle}>Nivarro × {data.schoolName}</Text>
          <Text style={styles.coverSub}>Real outcomes. Real students.</Text>
          <Text style={styles.coverDate}>Generated {data.generatedAt}</Text>
        </View>

        <View style={styles.body}>
          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{data.totalStudents}</Text>
              <Text style={styles.statLabel}>Students Featured</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{data.collegesCount}</Text>
              <Text style={styles.statLabel}>Colleges</Text>
            </View>
            <View style={[styles.statBoxLast, { borderLeftColor: "#10b981" }]}>
              <Text style={styles.statNum}>{data.jobsCount}</Text>
              <Text style={styles.statLabel}>Jobs / Internships</Text>
            </View>
          </View>

          {/* Outcomes table */}
          <Text style={styles.sectionLabel}>Student Outcomes</Text>
          <View style={styles.divider} />
          <View style={styles.tableHead}>
            <Text style={styles.colNameH}>Name</Text>
            <Text style={styles.colCollegeH}>College</Text>
            <Text style={styles.colRoleH}>Role / Employer</Text>
          </View>
          {data.students.map((s, i) => {
            const logo = s.college ? data.logoMap[s.college] : null;
            const initial = s.college ? s.college.charAt(0).toUpperCase() : "?";
            const badgeColor = BADGE_COLORS[i % BADGE_COLORS.length];
            const role = s.jobTitle && s.employer
              ? `${s.jobTitle} @ ${s.employer}`
              : s.internshipTitle && s.internshipOrg
              ? `${s.internshipTitle} @ ${s.internshipOrg}`
              : "—";
            return (
              <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.colName}>{s.name}</Text>
                <View style={styles.colCollege}>
                  {logo
                    ? <Image style={styles.logoImg} src={logo} />
                    : (
                      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.badgeText}>{initial}</Text>
                      </View>
                    )}
                  <Text style={{ fontSize: 10, color: "#1a1a1f" }}>{s.college ?? "—"}</Text>
                </View>
                <Text style={styles.colRole}>{role}</Text>
              </View>
            );
          })}

          {/* Testimonials */}
          {data.testimonials.length > 0 && (
            <View style={styles.sectionGap}>
              <Text style={styles.sectionLabel}>What They Say</Text>
              <View style={styles.divider} />
              {data.testimonials.map((t, i) => (
                <View key={i} style={styles.testimonialWrap}>
                  <View style={styles.testimonialInner}>
                    <Text style={styles.testimonialText}>"{t.body}"</Text>
                    <Text style={styles.testimonialSrc}>
                      — {t.sourceName}{t.sourceContext ? ` · ${t.sourceContext}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Powered by Nivarro · app.nivarro.co</Text>
          <Text style={styles.footerPage} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 4: Verify**

Download the brochure. Confirm:
- Dark cover strip with school name and subtitle
- Three stat boxes with left-border accents in different colours
- Alternating row shading in the outcomes table
- Coloured initial badges next to college names (or actual logo if Clearbit found it)
- Testimonials section with amber left border
- Page number in footer

- [ ] **Step 5: Commit**

```bash
git add lib/collegeLogos.ts components/school/BrochureDocument.tsx app/api/school/brochure/route.ts
git commit -m "feat: enhanced PDF brochure design with logos and visual polish

Generated with Claude Code
via Happy

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ No genius types anywhere
- ✅ No test scores anywhere
- ✅ Dynamic PDF length (React-PDF paginates automatically)
- ✅ Admin curation panel with include/exclude per student
- ✅ Auto-sort presets: Top 5, Top 10, Top 20, Bottom 5, Most Recent, A–Z
- ✅ Visibility toggle (admin-only vs students)
- ✅ Student cap (maxStudents)
- ✅ Student survey page (college, job, internship — no scores)
- ✅ Student dashboard banner gated on visibility setting
- ✅ LinkedIn column placeholder in PDF (renders `—` until field lands)
- ✅ SCHOOL and ADMIN roles both supported; ADMIN passes `?schoolId=`
- ✅ BrochureButton simplified to a fetch call, pdfmake removed
- ✅ Manual SQL migration with `IF NOT EXISTS` safety
- ✅ Testimonials system: admin add/edit/delete/approve, customisable source name + context + type
- ✅ Annual survey email with 11-month cooldown, sent via Resend, updates `lastEmailedAt`
- ✅ College logos via Clearbit (48px, base64-encoded, 3s timeout); falls back to coloured initial badge
- ✅ Prettier PDF: dark cover, coloured stat borders, alternating rows, amber testimonial accents, per-page footer

**LinkedIn integration hook:**
When the other agent's `linkedinUrl` field lands on `Profile`, update `app/api/school/brochure/route.ts` to add a LinkedIn data fetch and pass it into `StudentRow`. The `colRole` column in the PDF already exists and will auto-populate.

**Render cron job hook (future):**
The `POST /api/school/brochure/send-survey-emails` endpoint is self-contained. When ready to automate, add a Render cron job that fires once a year and calls the endpoint with each school's ID.
