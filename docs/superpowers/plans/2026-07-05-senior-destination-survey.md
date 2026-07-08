# Senior Destination Survey — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full alumni lifecycle survey system that sends annual May emails with Proxycurl-prefilled LinkedIn data, collects college/career outcomes into new `confirmedCollege`/`confirmedMajor` fields, and monitors LinkedIn monthly for job changes.

**Architecture:** Proxycurl API fetches structured LinkedIn JSON; Claude (Haiku) extracts normalized fields; Resend sends magic-link emails with a one-click Confirm form. Survey responses write to separate `confirmedCollege`/`confirmedMajor` profile fields (never overwriting `intendedCollege`/`intendedMajor`). Monthly LinkedIn scan writes `LinkedinScanEvent` records and emails the school admin on any detected changes without auto-updating the profile.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, Resend, Proxycurl API (`nubela.co/proxycurl`), Anthropic Claude API (`claude-haiku-4-5-20251001`)

## Global Constraints

- All new pages use inline styles only — no Tailwind, no new CSS files
- Design tokens: `var(--text)`, `var(--surface)`, `var(--border)`, `var(--amber)`, `var(--font-mono)`, `var(--font-display)`, `var(--n-text2)`, `var(--n-muted)`
- Border radius: 0px throughout
- Section labels: `fontFamily: "var(--font-mono)"`, uppercase, `letterSpacing: "0.2em"`, amber color
- Schema migrations: write SQL manually in `prisma/migrations/` — do NOT run `prisma migrate dev`. Run `prisma generate` after editing `schema.prisma`.
- New env vars required: `PROXYCURL_API_KEY`, `CRON_SECRET` — add to Render dashboard
- Auth guard pattern: `const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- Admin/School guard: check `session?.user?.role === "ADMIN" || session?.user?.role === "SCHOOL"`
- Cron endpoints also accept `Authorization: Bearer ${CRON_SECRET}` as an alternative to session auth
- Proxycurl: always pass `use_cache=if-present` query param to avoid charging for repeated calls
- **Timezone-aware survey send:** Cron fires at **16:00 UTC on May 1** = 12pm ET / 9am PT / 8am AKT / 6am HST — covers all US timezones at a reasonable hour. Never send before 6am local time anywhere in the USA.

---

## File Map

**New files:**
- `prisma/migrations/20260705000000_senior_destination_survey/migration.sql`
- `lib/proxycurl.ts`
- `lib/survey-prefill.ts`
- `lib/survey-email.ts`
- `app/api/survey/[token]/route.ts`
- `app/api/survey/[token]/optout/route.ts`
- `app/api/admin/survey/enqueue/route.ts`
- `app/api/admin/survey/linkedin-scan/route.ts`
- `app/api/admin/survey/status/route.ts`
- `app/survey/[token]/page.tsx`
- `app/survey/optout-confirmed/page.tsx`
- `app/(dashboard)/school/survey/page.tsx`

**Modified files:**
- `prisma/schema.prisma`
- `app/(dashboard)/school/destinations/page.tsx`
- `components/layout/Sidebar.tsx`

---

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260705000000_senior_destination_survey/migration.sql`

**Interfaces:**
- Produces: `SurveyToken` model, `LinkedinScanEvent` model; Profile fields `linkedinUrl`, `employer`, `jobTitle`, `confirmedCollege`, `confirmedMajor`, `lastLinkedinScan`, `linkedinScanOptOut`, `surveyOptOut`; User relations `surveyTokens`, `linkedinScanEvents`

- [ ] **Step 1: Add SurveyToken and LinkedinScanEvent models to schema.prisma**

Add after the existing `OrgReview` model block:

```prisma
// ─────────────────────────────────────────────
// SENIOR DESTINATION SURVEY
// ─────────────────────────────────────────────

model SurveyToken {
  id          String    @id @default(cuid())
  userId      String
  token       String    @unique @default(cuid())
  year        Int
  sentAt      DateTime  @default(now())
  expiresAt   DateTime
  respondedAt DateTime?
  prefillData String?   // JSON: {college,major,industry,employer,jobTitle}

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, year])
  @@index([userId])
}

model LinkedinScanEvent {
  id        String   @id @default(cuid())
  userId    String
  scannedAt DateTime @default(now())
  field     String   // "employer" | "jobTitle" | "confirmedCollege" | "confirmedMajor"
  prevValue String?
  newValue  String?
  notified  Boolean  @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([scannedAt])
}
```

- [ ] **Step 2: Add fields to Profile model**

In the `Profile` model, add before the `createdAt` line:

```prisma
  linkedinUrl        String?
  employer           String?
  jobTitle           String?
  confirmedCollege   String?
  confirmedMajor     String?
  lastLinkedinScan   DateTime?
  linkedinScanOptOut Boolean   @default(false)
  surveyOptOut       Boolean   @default(false)
```

- [ ] **Step 3: Add relations to User model**

In the `User` model, add after the last existing relation line:

```prisma
  surveyTokens       SurveyToken[]
  linkedinScanEvents LinkedinScanEvent[]
```

- [ ] **Step 4: Write migration SQL**

Create `prisma/migrations/20260705000000_senior_destination_survey/migration.sql`:

```sql
-- Add columns to Profile
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "linkedinUrl"        TEXT,
  ADD COLUMN IF NOT EXISTS "employer"           TEXT,
  ADD COLUMN IF NOT EXISTS "jobTitle"           TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedCollege"   TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedMajor"     TEXT,
  ADD COLUMN IF NOT EXISTS "lastLinkedinScan"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "linkedinScanOptOut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "surveyOptOut"       BOOLEAN NOT NULL DEFAULT false;

-- SurveyToken table
CREATE TABLE IF NOT EXISTS "SurveyToken" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "token"       TEXT NOT NULL,
  "year"        INTEGER NOT NULL,
  "sentAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  "prefillData" TEXT,
  CONSTRAINT "SurveyToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SurveyToken_token_key"       ON "SurveyToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "SurveyToken_userId_year_key" ON "SurveyToken"("userId", "year");
CREATE INDEX        IF NOT EXISTS "SurveyToken_userId_idx"      ON "SurveyToken"("userId");

ALTER TABLE "SurveyToken"
  ADD CONSTRAINT "SurveyToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LinkedinScanEvent table
CREATE TABLE IF NOT EXISTS "LinkedinScanEvent" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "field"     TEXT NOT NULL,
  "prevValue" TEXT,
  "newValue"  TEXT,
  "notified"  BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "LinkedinScanEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LinkedinScanEvent_userId_idx"    ON "LinkedinScanEvent"("userId");
CREATE INDEX IF NOT EXISTS "LinkedinScanEvent_scannedAt_idx" ON "LinkedinScanEvent"("scannedAt");

ALTER TABLE "LinkedinScanEvent"
  ADD CONSTRAINT "LinkedinScanEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Regenerate Prisma client**

```bash
cd C:/Users/thoma/goal-app && npx prisma generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260705000000_senior_destination_survey/
git commit -m "feat: schema — SurveyToken, LinkedinScanEvent, alumni destination fields"
```

---

### Task 2: Proxycurl + Claude prefill helpers

**Files:**
- Create: `lib/proxycurl.ts`
- Create: `lib/survey-prefill.ts`

**Interfaces:**
- Produces:
  - `fetchLinkedinProfile(url: string): Promise<ProxycurlProfile | null>`
  - `extractPrefill(profile: ProxycurlProfile): Promise<SurveyPrefill>`
  - `type SurveyPrefill = { college: string|null, major: string|null, industry: string|null, employer: string|null, jobTitle: string|null }`

- [ ] **Step 1: Create lib/proxycurl.ts**

```typescript
// lib/proxycurl.ts
export type ProxycurlProfile = {
  first_name?: string;
  last_name?: string;
  headline?: string;
  industry?: string;
  experiences?: Array<{
    company?: string;
    title?: string;
    ends_at?: null | object;
  }>;
  education?: Array<{
    school?: string;
    degree_name?: string;
    field_of_study?: string;
  }>;
};

export async function fetchLinkedinProfile(
  linkedinUrl: string
): Promise<ProxycurlProfile | null> {
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://nubela.co/proxycurl/api/v2/linkedin?linkedin_profile_url=${encodeURIComponent(linkedinUrl)}&use_cache=if-present`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) return null;
    return (await res.json()) as ProxycurlProfile;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Create lib/survey-prefill.ts**

```typescript
// lib/survey-prefill.ts
import Anthropic from "@anthropic-ai/sdk";
import type { ProxycurlProfile } from "./proxycurl";

export type SurveyPrefill = {
  college: string | null;
  major: string | null;
  industry: string | null;
  employer: string | null;
  jobTitle: string | null;
};

export async function extractPrefill(
  profile: ProxycurlProfile
): Promise<SurveyPrefill> {
  const client = new Anthropic();
  const empty: SurveyPrefill = { college: null, major: null, industry: null, employer: null, jobTitle: null };
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: `Extract career and education from this LinkedIn profile JSON.
Return ONLY a JSON object with keys: college, major, industry, employer, jobTitle.
Use null for any missing field. No markdown, no explanation.

${JSON.stringify(profile, null, 2)}`,
      }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const parsed = JSON.parse(text);
    return {
      college:  parsed.college  ?? null,
      major:    parsed.major    ?? null,
      industry: parsed.industry ?? null,
      employer: parsed.employer ?? null,
      jobTitle: parsed.jobTitle ?? null,
    };
  } catch {
    return empty;
  }
}
```

- [ ] **Step 3: Compile check**

```bash
cd C:/Users/thoma/goal-app && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from the new files.

- [ ] **Step 4: Commit**

```bash
git add lib/proxycurl.ts lib/survey-prefill.ts
git commit -m "feat: Proxycurl wrapper + Claude prefill extractor"
```

---

### Task 3: Survey email helper

**Files:**
- Create: `lib/survey-email.ts`

**Interfaces:**
- Consumes: `getResendClient()` from `lib/resend.ts`; `SurveyPrefill` from `lib/survey-prefill.ts`
- Produces: `sendSurveyEmail(args: SurveyEmailArgs): Promise<void>`

- [ ] **Step 1: Create lib/survey-email.ts**

```typescript
// lib/survey-email.ts
import { getResendClient } from "./resend";
import type { SurveyPrefill } from "./survey-prefill";

export type SurveyEmailArgs = {
  to: string;
  name: string;
  token: string;
  prefill: SurveyPrefill | null;
};

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function hasPrefill(p: SurveyPrefill | null): p is SurveyPrefill {
  return !!(p && (p.college || p.employer || p.jobTitle));
}

export async function sendSurveyEmail(args: SurveyEmailArgs): Promise<void> {
  const from   = process.env.FROM_EMAIL ?? "noreply@nivarro.co";
  const appUrl = process.env.AUTH_URL    ?? "https://app.nivarro.co";
  const surveyUrl  = `${appUrl}/survey/${args.token}`;
  const optoutUrl  = `${appUrl}/api/survey/${args.token}/optout`;
  const greet = esc(args.name.trim() || "there");

  const subject = hasPrefill(args.prefill)
    ? "Your annual Nivarro update — confirm in one click"
    : "Your annual Nivarro update — 2 minutes";

  const html = hasPrefill(args.prefill)
    ? prefillHtml({ greet, appUrl, token: args.token, surveyUrl, optoutUrl, prefill: args.prefill })
    : blankHtml({ greet, surveyUrl, optoutUrl });

  const result = await getResendClient().emails.send({ from, to: args.to, subject, html });
  if (result.error) throw new Error(`Survey email failed: ${result.error.message}`);
}

function prefillHtml(a: {
  greet: string; appUrl: string; token: string;
  surveyUrl: string; optoutUrl: string; prefill: SurveyPrefill;
}): string {
  const rows = [
    a.prefill.college  && `<tr><td style="color:#909098;font-size:13px;padding:4px 0">College</td><td style="font-size:13px;padding:4px 0 4px 16px;color:#1a1a1f">${esc(a.prefill.college)}</td></tr>`,
    a.prefill.major    && `<tr><td style="color:#909098;font-size:13px;padding:4px 0">Major</td><td style="font-size:13px;padding:4px 0 4px 16px;color:#1a1a1f">${esc(a.prefill.major!)}</td></tr>`,
    a.prefill.employer && `<tr><td style="color:#909098;font-size:13px;padding:4px 0">Employer</td><td style="font-size:13px;padding:4px 0 4px 16px;color:#1a1a1f">${esc(a.prefill.employer!)}</td></tr>`,
    a.prefill.jobTitle && `<tr><td style="color:#909098;font-size:13px;padding:4px 0">Job Title</td><td style="font-size:13px;padding:4px 0 4px 16px;color:#1a1a1f">${esc(a.prefill.jobTitle!)}</td></tr>`,
  ].filter(Boolean).join("");

  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1f">
  <h2 style="margin:0 0 8px;font-size:20px">Hi ${a.greet},</h2>
  <p style="color:#58586a;line-height:1.55;margin:0 0 20px;font-size:14px">Time for your annual Nivarro check-in. Here's what your LinkedIn shows:</p>
  <table style="border-collapse:collapse;margin-bottom:24px">${rows}</table>
  <p style="color:#58586a;font-size:13px;margin:0 0 20px">Is this still accurate?</p>
  <form method="POST" action="${a.appUrl}/api/survey/${esc(a.token)}" style="display:inline;margin-right:12px">
    ${a.prefill.college  ? `<input type="hidden" name="confirmedCollege" value="${esc(a.prefill.college)}" />` : ""}
    ${a.prefill.major    ? `<input type="hidden" name="confirmedMajor"   value="${esc(a.prefill.major!)}" />` : ""}
    ${a.prefill.industry ? `<input type="hidden" name="industry"         value="${esc(a.prefill.industry!)}" />` : ""}
    ${a.prefill.employer ? `<input type="hidden" name="employer"         value="${esc(a.prefill.employer!)}" />` : ""}
    ${a.prefill.jobTitle ? `<input type="hidden" name="jobTitle"         value="${esc(a.prefill.jobTitle!)}" />` : ""}
    <button type="submit" style="background:#c9a84c;color:#fff;font-weight:600;border:none;padding:12px 20px;cursor:pointer;font-size:14px">Confirm — looks right</button>
  </form>
  <a href="${a.surveyUrl}" style="display:inline-block;background:#1a1a1f;color:#fff;font-weight:600;text-decoration:none;padding:12px 20px;font-size:14px">Update my info →</a>
  <p style="color:#909098;font-size:12px;margin:32px 0 0"><a href="${a.optoutUrl}" style="color:#909098">Unsubscribe from annual surveys</a></p>
</div>`;
}

function blankHtml(a: { greet: string; surveyUrl: string; optoutUrl: string }): string {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1f">
  <h2 style="margin:0 0 8px;font-size:20px">Hi ${a.greet},</h2>
  <p style="color:#58586a;line-height:1.55;margin:0 0 24px;font-size:14px">Time for your annual Nivarro check-in. Where are you now?</p>
  <a href="${a.surveyUrl}" style="display:inline-block;background:#c9a84c;color:#fff;font-weight:600;text-decoration:none;padding:12px 24px;font-size:14px">Complete your update →</a>
  <p style="color:#909098;font-size:12px;margin:32px 0 0"><a href="${a.optoutUrl}" style="color:#909098">Unsubscribe from annual surveys</a></p>
</div>`;
}
```

- [ ] **Step 2: Compile check**

```bash
cd C:/Users/thoma/goal-app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/survey-email.ts
git commit -m "feat: survey email helper — prefilled and blank Resend templates"
```

---

### Task 4: Public survey form page + optout confirmation

**Files:**
- Create: `app/survey/[token]/page.tsx`
- Create: `app/survey/optout-confirmed/page.tsx`

**Interfaces:**
- Consumes: `prisma.surveyToken` with nested `user.profile`; `SurveyPrefill` from `lib/survey-prefill.ts`; query params `?success`, `?already`, `?error`
- Produces: Public survey form at `/survey/[token]`; opt-out confirmation at `/survey/optout-confirmed`

- [ ] **Step 1: Create app/survey/[token]/page.tsx**

```typescript
// app/survey/[token]/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { SurveyPrefill } from "@/lib/survey-prefill";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ success?: string; already?: string; error?: string }>;
};

export default async function SurveyPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { success, already, error } = await searchParams;
  const appUrl = process.env.AUTH_URL ?? "https://app.nivarro.co";

  const st = await prisma.surveyToken.findUnique({
    where: { token },
    include: { user: { select: { name: true, profile: { select: { displayName: true } } } } },
  });
  if (!st) return notFound();

  const name = st.user.profile?.displayName ?? st.user.name ?? "there";
  const prefill: SurveyPrefill | null = st.prefillData ? JSON.parse(st.prefillData) : null;
  const expired  = st.expiresAt < new Date();
  const responded = !!st.respondedAt;

  if (success)   return <SuccessPage name={name} />;
  if (already)   return <AlreadyPage />;
  if (expired)   return <ExpiredPage />;
  if (responded) return <AlreadyPage />;

  return <SurveyForm token={token} prefill={prefill} name={name} appUrl={appUrl} errorMsg={error ? "Something went wrong — please try again." : null} />;
}

function SurveyForm({ token, prefill, name, appUrl, errorMsg }: {
  token: string; prefill: SurveyPrefill | null; name: string; appUrl: string; errorMsg: string | null;
}) {
  return (
    <div style={{ maxWidth: 560, margin: "48px auto", padding: "0 24px", fontFamily: "sans-serif", color: "#1a1a1f" }}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", margin: "0 0 8px" }}>Annual Check-in</p>
      <h1 style={{ fontSize: 32, letterSpacing: "-0.02em", margin: "0 0 8px", fontWeight: 800 }}>Hi {name}</h1>
      <p style={{ fontSize: 14, color: "#58586a", margin: "0 0 32px" }}>Update your info below — takes about 2 minutes.</p>
      {errorMsg && <p style={{ background: "#fff0f0", border: "1px solid #fca5a5", padding: "10px 14px", fontSize: 13, marginBottom: 20 }}>{errorMsg}</p>}
      <form method="POST" action={`${appUrl}/api/survey/${token}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="College / University" name="confirmedCollege" defaultValue={prefill?.college ?? ""} placeholder="MIT, State University…" />
        <Field label="Major / Field of Study" name="confirmedMajor"   defaultValue={prefill?.major ?? ""}   placeholder="Computer Science…" />
        <Field label="Industry"               name="industry"         defaultValue={prefill?.industry ?? ""} placeholder="Software, Healthcare, Finance…" />
        <Field label="Current Employer"       name="employer"         defaultValue={prefill?.employer ?? ""} placeholder="Company name" />
        <Field label="Job Title"              name="jobTitle"         defaultValue={prefill?.jobTitle ?? ""} placeholder="Software Engineer…" />
        <Field label="LinkedIn URL"           name="linkedinUrl"      defaultValue=""                        placeholder="https://linkedin.com/in/yourname" />
        <button type="submit" style={{ marginTop: 8, background: "#c9a84c", color: "#fff", fontWeight: 600, border: "none", padding: "14px 24px", cursor: "pointer", fontSize: 14, alignSelf: "flex-start" }}>
          Submit update
        </button>
      </form>
      <p style={{ marginTop: 40, fontSize: 12, color: "#909098" }}>
        <a href={`${appUrl}/api/survey/${token}/optout`} style={{ color: "inherit" }}>Unsubscribe from annual surveys</a>
      </p>
    </div>
  );
}

function Field({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue: string; placeholder: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</label>
      <input type="text" name={name} defaultValue={defaultValue} placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e5e5e5", padding: "10px 12px", fontSize: 14, outline: "none", background: "#fafafa" }} />
    </div>
  );
}

function SuccessPage({ name }: { name: string }) {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", margin: "0 0 12px" }}>Updated</p>
      <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Thanks, {name}.</h1>
      <p style={{ color: "#58586a", fontSize: 14 }}>Your update is saved. See you next May.</p>
    </div>
  );
}

function AlreadyPage() {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", margin: "0 0 12px" }}>Already done</p>
      <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Your response is on file.</h1>
      <p style={{ color: "#58586a", fontSize: 14 }}>You already submitted for this year. See you next May.</p>
    </div>
  );
}

function ExpiredPage() {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171", margin: "0 0 12px" }}>Expired</p>
      <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>This link has expired.</h1>
      <p style={{ color: "#58586a", fontSize: 14 }}>Survey links are valid for 60 days. Contact your school counselor for a new link.</p>
    </div>
  );
}
```

- [ ] **Step 2: Create app/survey/optout-confirmed/page.tsx**

```typescript
// app/survey/optout-confirmed/page.tsx
export default function OptoutConfirmedPage() {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", margin: "0 0 12px" }}>Unsubscribed</p>
      <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>You&apos;re unsubscribed.</h1>
      <p style={{ color: "#58586a", fontSize: 14 }}>No more annual surveys. Your profile data is unchanged.</p>
    </div>
  );
}
```

- [ ] **Step 3: Compile check**

```bash
cd C:/Users/thoma/goal-app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/survey/
git commit -m "feat: public survey form, optout-confirmed pages"
```

---

### Task 5: Survey response + optout API routes

**Files:**
- Create: `app/api/survey/[token]/route.ts`
- Create: `app/api/survey/[token]/optout/route.ts`

**Interfaces:**
- Consumes: `prisma.surveyToken`, `prisma.profile`; form POST body with fields `confirmedCollege`, `confirmedMajor`, `industry`, `employer`, `jobTitle`, `linkedinUrl`
- Produces: Redirects to `/survey/[token]?success=true`, `?already=true`, or `?error=true`; optout redirects to `/survey/optout-confirmed`

- [ ] **Step 1: Create app/api/survey/[token]/route.ts**

```typescript
// app/api/survey/[token]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appUrl = process.env.AUTH_URL ?? "https://app.nivarro.co";
  const base = `${appUrl}/survey/${token}`;

  const st = await prisma.surveyToken.findUnique({
    where: { token },
    include: { user: { select: { profile: { select: { id: true } } } } },
  });

  if (!st)                      return NextResponse.redirect(`${base}?error=true`);
  if (st.expiresAt < new Date()) return NextResponse.redirect(`${base}?error=true`);
  if (st.respondedAt)           return NextResponse.redirect(`${base}?already=true`);

  const profileId = st.user.profile?.id;
  if (!profileId) return NextResponse.redirect(`${base}?error=true`);

  const ct = req.headers.get("content-type") ?? "";
  let body: Record<string, string> = {};
  if (ct.includes("application/json")) {
    body = await req.json();
  } else {
    const form = await req.formData();
    for (const [k, v] of form.entries()) body[k] = v.toString();
  }

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      ...(body.confirmedCollege && { confirmedCollege: body.confirmedCollege }),
      ...(body.confirmedMajor   && { confirmedMajor:   body.confirmedMajor }),
      ...(body.industry         && { industry:         body.industry }),
      ...(body.employer         && { employer:         body.employer }),
      ...(body.jobTitle         && { jobTitle:         body.jobTitle }),
      ...(body.linkedinUrl      && { linkedinUrl:      body.linkedinUrl }),
    },
  });

  await prisma.surveyToken.update({ where: { token }, data: { respondedAt: new Date() } });
  return NextResponse.redirect(`${base}?success=true`);
}
```

- [ ] **Step 2: Create app/api/survey/[token]/optout/route.ts**

```typescript
// app/api/survey/[token]/optout/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appUrl = process.env.AUTH_URL ?? "https://app.nivarro.co";

  const st = await prisma.surveyToken.findUnique({ where: { token }, select: { userId: true } });
  if (st) {
    const profile = await prisma.profile.findUnique({ where: { userId: st.userId }, select: { id: true } });
    if (profile) {
      await prisma.profile.update({ where: { id: profile.id }, data: { surveyOptOut: true } });
    }
  }

  return NextResponse.redirect(`${appUrl}/survey/optout-confirmed`);
}
```

- [ ] **Step 3: Manual smoke test**

```bash
cd C:/Users/thoma/goal-app && npm run dev
```

Then in Prisma Studio (`npx prisma studio`), create a test `SurveyToken` with:
- `userId`: any valid user id
- `token`: `test-abc-123`
- `year`: 2026
- `expiresAt`: 2026-09-01
- `respondedAt`: null

Visit `http://localhost:3000/survey/test-abc-123` — survey form should render.
Submit the form — should redirect to `?success=true` and show the success page.

- [ ] **Step 4: Commit**

```bash
git add app/api/survey/
git commit -m "feat: survey response and optout API routes"
```

---

### Task 6: Survey enqueue API

**Files:**
- Create: `app/api/admin/survey/enqueue/route.ts`

**Interfaces:**
- Consumes: `fetchLinkedinProfile` from `lib/proxycurl.ts`; `extractPrefill` from `lib/survey-prefill.ts`; `sendSurveyEmail` from `lib/survey-email.ts`; `CRON_SECRET` env var; optional query params `offset` (default 0)
- Produces: `{ queued: number, sent: number, skipped: number }`

- [ ] **Step 1: Create app/api/admin/survey/enqueue/route.ts**

```typescript
// app/api/admin/survey/enqueue/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchLinkedinProfile } from "@/lib/proxycurl";
import { extractPrefill, type SurveyPrefill } from "@/lib/survey-prefill";
import { sendSurveyEmail } from "@/lib/survey-email";

const LIMIT = 50;

function authorized(req: Request, role?: string | null): boolean {
  if (req.headers.get("Authorization") === `Bearer ${process.env.CRON_SECRET}`) return true;
  return role === "ADMIN" || role === "SCHOOL";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const session = await auth();
  if (!authorized(req, session?.user?.role as string | null))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offset = parseInt(new URL(req.url).searchParams.get("offset") ?? "0");
  const year = new Date().getFullYear();

  const pool = await prisma.user.findMany({
    where: {
      OR: [{ isAlumni: true }, { profile: { graduationYear: { lt: year } } }],
      profile: { surveyOptOut: false },
    },
    select: {
      id: true, email: true, name: true,
      profile: { select: { displayName: true, linkedinUrl: true, linkedinScanOptOut: true } },
      surveyTokens: { where: { year }, select: { id: true } },
    },
    skip: offset,
    take: LIMIT,
  });

  let sent = 0, skipped = 0;

  for (const user of pool) {
    if (user.surveyTokens.length > 0 || !user.email) { skipped++; continue; }

    let prefill: SurveyPrefill | null = null;
    if (user.profile?.linkedinUrl && !user.profile.linkedinScanOptOut) {
      const raw = await fetchLinkedinProfile(user.profile.linkedinUrl);
      if (raw) prefill = await extractPrefill(raw);
      await sleep(1000);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    const st = await prisma.surveyToken.create({
      data: { userId: user.id, year, expiresAt, prefillData: prefill ? JSON.stringify(prefill) : null },
    });

    await sendSurveyEmail({
      to: user.email,
      name: user.profile?.displayName ?? user.name ?? "there",
      token: st.token,
      prefill,
    });

    sent++;
  }

  return NextResponse.json({ queued: pool.length, sent, skipped });
}
```

- [ ] **Step 2: Compile check**

```bash
cd C:/Users/thoma/goal-app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/survey/enqueue/
git commit -m "feat: survey enqueue API — Proxycurl prefill + Resend batch"
```

---

### Task 7: LinkedIn scan API

**Files:**
- Create: `app/api/admin/survey/linkedin-scan/route.ts`

**Interfaces:**
- Consumes: `fetchLinkedinProfile` from `lib/proxycurl.ts`; `extractPrefill` from `lib/survey-prefill.ts`; `getResendClient` from `lib/resend.ts`; optional query param `offset` (default 0)
- Produces: `{ scanned: number, changes: number, errors: number }`

- [ ] **Step 1: Create app/api/admin/survey/linkedin-scan/route.ts**

```typescript
// app/api/admin/survey/linkedin-scan/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchLinkedinProfile } from "@/lib/proxycurl";
import { extractPrefill } from "@/lib/survey-prefill";
import { getResendClient } from "@/lib/resend";

const LIMIT = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function authorized(req: Request, role?: string | null): boolean {
  if (req.headers.get("Authorization") === `Bearer ${process.env.CRON_SECRET}`) return true;
  return role === "ADMIN" || role === "SCHOOL";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!authorized(req, session?.user?.role as string | null))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offset = parseInt(new URL(req.url).searchParams.get("offset") ?? "0");

  const profiles = await prisma.profile.findMany({
    where: { linkedinUrl: { not: null }, linkedinScanOptOut: false },
    select: {
      id: true, userId: true, employer: true, jobTitle: true,
      confirmedCollege: true, confirmedMajor: true, linkedinUrl: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { lastLinkedinScan: "asc" },
    skip: offset,
    take: LIMIT,
  });

  const from    = process.env.FROM_EMAIL ?? "noreply@nivarro.co";
  const appUrl  = process.env.AUTH_URL   ?? "https://app.nivarro.co";
  const admin   = await prisma.user.findFirst({ where: { role: "SCHOOL" }, select: { email: true } });
  const adminTo = admin?.email ?? from;

  let changes = 0, errors = 0;

  for (const p of profiles) {
    if (!p.linkedinUrl) continue;
    const raw = await fetchLinkedinProfile(p.linkedinUrl);
    await sleep(1000);
    if (!raw) { errors++; continue; }

    const fresh = await extractPrefill(raw);

    const checks: Array<{ field: string; prev: string | null; next: string | null }> = [
      { field: "employer",        prev: p.employer,        next: fresh.employer },
      { field: "jobTitle",        prev: p.jobTitle,        next: fresh.jobTitle },
      { field: "confirmedCollege",prev: p.confirmedCollege,next: fresh.college },
      { field: "confirmedMajor",  prev: p.confirmedMajor,  next: fresh.major },
    ];

    const detected = checks.filter((c) => c.next && c.next !== c.prev);
    if (detected.length > 0) {
      changes += detected.length;
      await prisma.linkedinScanEvent.createMany({
        data: detected.map((c) => ({ userId: p.userId, field: c.field, prevValue: c.prev, newValue: c.next, notified: true })),
      });

      const lines = detected.map((c) => `${c.field}: ${c.prev ?? "(none)"} → ${c.next}`).join("<br>");
      await getResendClient().emails.send({
        from, to: adminTo,
        subject: `[Nivarro] Alumni update detected — ${p.user.name ?? "Unknown"}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="font-size:18px;margin:0 0 12px">${p.user.name ?? "An alumni"}'s LinkedIn shows changes</h2>
  <p style="background:#f5f5f5;padding:12px;font-size:13px;line-height:1.8">${lines}</p>
  <p style="font-size:13px;color:#58586a">Profile <strong>not</strong> auto-updated. <a href="${appUrl}/school/survey">View in survey dashboard</a>.</p>
</div>`,
      });
    }

    await prisma.profile.update({ where: { id: p.id }, data: { lastLinkedinScan: new Date() } });
  }

  return NextResponse.json({ scanned: profiles.length, changes, errors });
}
```

- [ ] **Step 2: Compile check + commit**

```bash
cd C:/Users/thoma/goal-app && npx tsc --noEmit 2>&1 | head -20
git add app/api/admin/survey/linkedin-scan/
git commit -m "feat: LinkedIn scan API — Proxycurl change detection, admin email notification"
```

---

### Task 8: Survey status API

**Files:**
- Create: `app/api/admin/survey/status/route.ts`

**Interfaces:**
- Produces: `{ year, totalPool, sent, responded, responseRate, recentScanEvents }`

- [ ] **Step 1: Create app/api/admin/survey/status/route.ts**

```typescript
// app/api/admin/survey/status/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as string | null;
  if (role !== "ADMIN" && role !== "SCHOOL")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = new Date().getFullYear();

  const [totalPool, sent, responded, recentScanEvents] = await Promise.all([
    prisma.user.count({
      where: {
        OR: [{ isAlumni: true }, { profile: { graduationYear: { lt: year } } }],
        profile: { surveyOptOut: false },
      },
    }),
    prisma.surveyToken.count({ where: { year } }),
    prisma.surveyToken.count({ where: { year, respondedAt: { not: null } } }),
    prisma.linkedinScanEvent.findMany({
      orderBy: { scannedAt: "desc" },
      take: 50,
      select: {
        id: true, scannedAt: true, field: true, prevValue: true, newValue: true,
        user: { select: { name: true, profile: { select: { displayName: true } } } },
      },
    }),
  ]);

  return NextResponse.json({
    year, totalPool, sent, responded,
    responseRate: sent > 0 ? Math.round((responded / sent) * 100) : 0,
    recentScanEvents,
  });
}
```

- [ ] **Step 2: Compile check + commit**

```bash
cd C:/Users/thoma/goal-app && npx tsc --noEmit 2>&1 | head -20
git add app/api/admin/survey/status/
git commit -m "feat: survey status API — pool, sent, responded, scan events"
```

---

### Task 9: School survey dashboard + sidebar link

**Files:**
- Create: `app/(dashboard)/school/survey/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `/api/admin/survey/status` GET; `/api/admin/survey/enqueue` POST; `/api/admin/survey/linkedin-scan` POST

- [ ] **Step 1: Create app/(dashboard)/school/survey/page.tsx**

```typescript
// app/(dashboard)/school/survey/page.tsx
"use client";
import { useEffect, useState } from "react";

type ScanEvent = {
  id: string; scannedAt: string; field: string;
  prevValue: string | null; newValue: string | null;
  user: { name: string | null; profile: { displayName: string } | null };
};
type Status = {
  year: number; totalPool: number; sent: number;
  responded: number; responseRate: number; recentScanEvents: ScanEvent[];
};

const mono: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11,
  letterSpacing: "0.2em", textTransform: "uppercase" as const,
};

export default function SurveyDashboardPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () =>
    fetch("/api/admin/survey/status").then((r) => r.json()).then(setStatus);

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);

  async function handleSend() {
    setSending(true); setMsg(null);
    try {
      const d = await fetch("/api/admin/survey/enqueue", { method: "POST" }).then((r) => r.json());
      setMsg(`Sent ${d.sent} surveys. Skipped ${d.skipped}.`);
      await refresh();
    } catch { setMsg("Something went wrong. Try again."); }
    finally { setSending(false); }
  }

  async function handleScan() {
    setScanning(true); setMsg(null);
    try {
      const d = await fetch("/api/admin/survey/linkedin-scan", { method: "POST" }).then((r) => r.json());
      setMsg(`Scanned ${d.scanned} profiles. ${d.changes} change(s) detected.`);
      await refresh();
    } catch { setMsg("Something went wrong. Try again."); }
    finally { setScanning(false); }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,3vw,36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 4px" }}>
        Destination Survey
      </h1>
      <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 32px" }}>
        Annual alumni check-in — sends every May at noon ET, LinkedIn scanned monthly.
      </p>

      {loading ? (
        <p style={{ fontSize: 14, color: "var(--n-text2)" }}>Loading…</p>
      ) : status && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {([
            { label: "Alumni pool", value: status.totalPool },
            { label: `Sent ${status.year}`, value: status.sent },
            { label: "Responded", value: status.responded },
            { label: "Response rate", value: `${status.responseRate}%` },
          ] as const).map(({ label, value }) => (
            <div key={label} style={{ flex: "1 1 120px", background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 18px" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 32, color: "var(--amber)", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
              <p style={{ margin: "4px 0 0", ...mono, color: "var(--n-muted)" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button onClick={handleSend} disabled={sending}
          style={{ background: "var(--amber)", color: "#fff", fontWeight: 600, border: "none", padding: "12px 20px", cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, fontSize: 14 }}>
          {sending ? "Sending…" : "Send Survey Now"}
        </button>
        <button onClick={handleScan} disabled={scanning}
          style={{ background: "var(--surface)", color: "var(--text)", fontWeight: 600, border: "1px solid var(--border)", padding: "12px 20px", cursor: scanning ? "not-allowed" : "pointer", opacity: scanning ? 0.6 : 1, fontSize: 14 }}>
          {scanning ? "Scanning…" : "Scan LinkedIn Now"}
        </button>
      </div>

      {msg && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px 16px", fontSize: 14, color: "var(--text)", marginBottom: 24 }}>
          {msg}
        </div>
      )}

      {status && status.recentScanEvents.length > 0 && (
        <>
          <p style={{ ...mono, color: "var(--amber)", margin: "0 0 12px" }}>Detected LinkedIn Changes</p>
          <div style={{ border: "1px solid var(--border)" }}>
            {status.recentScanEvents.map((e) => (
              <div key={e.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--n-muted)", minWidth: 90 }}>{new Date(e.scannedAt).toLocaleDateString()}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 120 }}>{e.user.profile?.displayName ?? e.user.name ?? "Unknown"}</span>
                <span style={{ fontSize: 13, color: "var(--n-text2)" }}>
                  <strong>{e.field}</strong>: {e.prevValue ?? "(none)"} → {e.newValue ?? "(none)"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {status && status.recentScanEvents.length === 0 && !loading && (
        <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
          <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No LinkedIn changes detected yet. Click "Scan LinkedIn Now" to check.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Survey link to SCHOOL_NAV in Sidebar.tsx**

Open `components/layout/Sidebar.tsx`. Find:

```typescript
const SCHOOL_NAV = [
  { href: "/school/destinations", label: "Destinations",  Icon: MapPin },
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/campaigns/new",       label: "Fundraise",     Icon: HeartHandshake },
];
```

Replace with:

```typescript
const SCHOOL_NAV = [
  { href: "/school/destinations", label: "Destinations",  Icon: MapPin },
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/school/survey",       label: "Survey",        Icon: Mail },
  { href: "/campaigns/new",       label: "Fundraise",     Icon: HeartHandshake },
];
```

Then add `Mail` to the lucide-react import at the top of the file (it's already imported from `lucide-react` — just add `Mail` to the list).

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

Log in as `school@nivarro.demo` / `demo2026`. Navigate to `/school/survey`. Verify:
- Stats strip loads (zeros are fine)
- "Send Survey Now" and "Scan LinkedIn Now" buttons are visible
- Survey link appears in the sidebar

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/school/survey/ components/layout/Sidebar.tsx
git commit -m "feat: school survey dashboard + sidebar link"
```

---

### Task 10: Update destinations map to prefer confirmedCollege

**Files:**
- Modify: `app/(dashboard)/school/destinations/page.tsx`

**Interfaces:**
- Consumes: `Profile.confirmedCollege` (new field from Task 1); existing `Profile.intendedCollege`

- [ ] **Step 1: Add confirmedCollege to the Prisma select**

In `app/(dashboard)/school/destinations/page.tsx`, find the `prisma.profile.findMany` call. Add `confirmedCollege: true` to the `select` block alongside `intendedCollege: true`.

- [ ] **Step 2: Update the destinationMap loop**

Find:

```typescript
for (const p of profiles) {
  if (!p.intendedCollege) continue;
  if (!destinationMap[p.intendedCollege]) destinationMap[p.intendedCollege] = { students: [] };
  destinationMap[p.intendedCollege].students.push(p.displayName ?? "Anonymous");
}
```

Replace with:

```typescript
for (const p of profiles) {
  const destination = p.confirmedCollege ?? p.intendedCollege;
  if (!destination) continue;
  if (!destinationMap[destination]) destinationMap[destination] = { students: [] };
  destinationMap[destination].students.push(p.displayName ?? "Anonymous");
}
```

- [ ] **Step 3: Verify page compiles and loads**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Navigate to `/school/destinations` — map should render as before.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/school/destinations/page.tsx
git commit -m "feat: destinations map — prefer confirmedCollege for survey respondents"
```

---

### Task 11: Environment variables + Render cron setup

Configuration-only — no code changes.

- [ ] **Step 1: Add env vars to Render**

In Render dashboard → Goal-APP-3 → **Environment**:

| Key | Value |
|---|---|
| `PROXYCURL_API_KEY` | From [nubela.co/proxycurl](https://nubela.co/proxycurl) dashboard |
| `CRON_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste result |

- [ ] **Step 2: Configure Render cron jobs**

In Render dashboard → **Cron Jobs** → New Cron Job (×2):

**May survey send — 4pm UTC = noon ET / 9am PT / 8am AKT / 6am HST:**
```
Name:     survey-may-send
Schedule: 0 16 1 5 *
Command:  node -e "fetch('https://app.nivarro.co/api/admin/survey/enqueue',{method:'POST',headers:{'Authorization':'Bearer '+process.env.CRON_SECRET}}).then(r=>r.json()).then(console.log).catch(console.error)"
```

**Monthly LinkedIn scan — same timezone-safe window:**
```
Name:     survey-linkedin-scan
Schedule: 0 16 1 * *
Command:  node -e "fetch('https://app.nivarro.co/api/admin/survey/linkedin-scan',{method:'POST',headers:{'Authorization':'Bearer '+process.env.CRON_SECRET}}).then(r=>r.json()).then(console.log).catch(console.error)"
```

- [ ] **Step 3: Push and deploy**

```bash
cd C:/Users/thoma/goal-app && git push
```

- [ ] **Step 4: Smoke test on production**

1. Log in at `app.nivarro.co` as `school@nivarro.demo`
2. Click **Survey** in the sidebar → `/school/survey` loads with stats
3. Click **Send Survey Now** → response shows `{ sent: N, skipped: N }`
4. Check email inbox of a demo alumni account — survey email should arrive within 1 minute

---

## Self-Review

**Spec coverage:**
- ✅ Auto-enroll graduating seniors: `graduationYear < currentYear` in enqueue pool query
- ✅ Annual May survey: Render cron `0 16 1 5 *` + enqueue endpoint
- ✅ Timezone-aware send: 4pm UTC = noon ET / 9am PT / 8am AKT / 6am HST
- ✅ LinkedIn prefill via Proxycurl: `fetchLinkedinProfile` + `extractPrefill` in enqueue
- ✅ One-click Confirm HTML form POST in email
- ✅ Update my info → `/survey/[token]` form page
- ✅ SurveyToken with expiresAt (60 days): Task 1 schema, Task 6 create
- ✅ Duplicate submission guard: Task 5 checks `respondedAt`
- ✅ Token expiry guard: Task 5 checks `expiresAt < new Date()`
- ✅ Opt-out flow: Task 5 optout route + Task 4 optout-confirmed page
- ✅ surveyOptOut respected in enqueue pool: Task 6
- ✅ Monthly LinkedIn scan: Render cron `0 16 1 * *` + scan endpoint
- ✅ LinkedinScanEvent structured records: Task 7
- ✅ Admin notification email on change: Task 7
- ✅ No auto-update Profile from scan: Task 7 creates events only, no profile.update for field values
- ✅ confirmedCollege/confirmedMajor separate from intendedCollege: Tasks 1, 5, 10
- ✅ Destinations map prefers confirmedCollege: Task 10
- ✅ School survey dashboard: Task 9
- ✅ Survey sidebar link: Task 9
- ✅ Node.js cron (not curl): Task 11
- ✅ use_cache=if-present on all Proxycurl calls: lib/proxycurl.ts
- ✅ PROXYCURL_API_KEY + CRON_SECRET: Task 11

**Placeholder scan:** None — all steps contain complete code.

**Type consistency:**
- `SurveyPrefill` defined in `lib/survey-prefill.ts`, imported identically in Tasks 3, 6, 7, 4 ✅
- `fetchLinkedinProfile` returns `ProxycurlProfile | null` — null-checked before `extractPrefill` call in both Tasks 6 and 7 ✅
- `sendSurveyEmail({ to, name, token, prefill })` — call in Task 6 matches signature in Task 3 ✅
- `prisma.surveyToken.create` uses `token` (auto-generated by `@default(cuid())` in schema) — Task 6 reads `st.token` after create ✅
