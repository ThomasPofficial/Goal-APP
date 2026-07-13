# School Staff Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a school's existing (canonical) `SCHOOL`-role account create additional real, independently-credentialed admin/teacher logins for the same school, each with full dashboard access, onboarded via an automatic welcome email — no payment flag, no permission tiers, no new `School` table.

**Architecture:** Add a nullable `primarySchoolId` self-relation on `User`. `null` = canonical school account (unchanged, today's model — this is still the id every student/alum's `schoolId` points to). Non-null = a secondary staff account attached to that canonical account. One change to `getSchoolSession()` (resolve `dbUser.primarySchoolId ?? dbUser.id` as the effective `schoolId`) makes every existing school-scoped route (roster, import, mentorship) work identically for staff and canonical accounts with zero changes to those route bodies. A shared email helper (extracted from the existing forgot-password flow) sends a "set your password" link automatically the moment a staff account is created.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, NextAuth v5, bcryptjs, Resend.

## Global Constraints

- Migrations are hand-authored SQL files under `prisma/migrations/`, not generated via `prisma migrate dev` (project convention — see `20260710000000_school_admin_features/migration.sql`).
- No test framework is configured in this repo (no `jest`/`vitest`, no `test` script in `package.json`). Verification for every task is `npx tsc --noEmit` (must show zero new errors) plus a manual `curl`/browser check — do not introduce a new test runner as part of this plan.
- Follow existing file conventions exactly: `bcryptjs` imported as `bcrypt`, `crypto.randomUUID()` for placeholder passwords, `getSchoolSession()` from `@/lib/school-auth` for all school-scoped route guards, inline `style={{...}}` objects (no CSS modules/Tailwind) matching `RosterClient.tsx`'s look.
- Staff accounts never get tiered permissions — flat access model, only asymmetry is who can add/remove staff (canonical only).

---

### Task 1: Add `primarySchoolId` to the `User` model

**Files:**
- Modify: `prisma/schema.prisma:71-96` (the `User` model)
- Create: `prisma/migrations/20260713010000_school_staff_accounts/migration.sql`

**Interfaces:**
- Produces: `User.primarySchoolId: string | null` — every later task reads/writes this field via Prisma Client (`prisma.user.findMany({ where: { primarySchoolId: schoolId } })`, etc).

- [ ] **Step 1: Edit the `User` model in `prisma/schema.prisma`**

Current (lines 71-96):

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  passwordHash  String?
  role          UserRole  @default(STUDENT)
  isAlumni      Boolean   @default(false)
  createdAt     DateTime  @default(now())
  schoolCode String? @unique
  updatedAt     DateTime  @updatedAt

  accounts              Account[]
  sessions              Session[]
  profile               Profile?
  projectMemberships    ProjectMember[]
  notes                 Note[]
  sentMessages          Message[]                 @relation("SentMessages")
  participations        ConversationParticipant[]
  endorsementsGiven     PeerEndorsement[]         @relation("EndorsementsGiven")
  endorsementsReceived  PeerEndorsement[]         @relation("EndorsementsReceived")
  campaigns             Campaign[]                @relation("SchoolCampaigns")
  surveyTokens          SurveyToken[]
  linkedinScanEvents    LinkedinScanEvent[]
}
```

Change to:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  passwordHash  String?
  role          UserRole  @default(STUDENT)
  isAlumni      Boolean   @default(false)
  createdAt     DateTime  @default(now())
  schoolCode String? @unique
  updatedAt     DateTime  @updatedAt
  // Set only on secondary staff logins (role=SCHOOL); null means this IS the
  // canonical school account that Student.schoolId/roster/mentorship point to.
  primarySchoolId String?

  accounts              Account[]
  sessions              Session[]
  profile               Profile?
  projectMemberships    ProjectMember[]
  notes                 Note[]
  sentMessages          Message[]                 @relation("SentMessages")
  participations        ConversationParticipant[]
  endorsementsGiven     PeerEndorsement[]         @relation("EndorsementsGiven")
  endorsementsReceived  PeerEndorsement[]         @relation("EndorsementsReceived")
  campaigns             Campaign[]                @relation("SchoolCampaigns")
  surveyTokens          SurveyToken[]
  linkedinScanEvents    LinkedinScanEvent[]
  primarySchool         User?                     @relation("SchoolStaff", fields: [primarySchoolId], references: [id])
  staffAccounts         User[]                    @relation("SchoolStaff")
}
```

- [ ] **Step 2: Create the migration directory and SQL file**

```bash
mkdir -p prisma/migrations/20260713010000_school_staff_accounts
```

Write `prisma/migrations/20260713010000_school_staff_accounts/migration.sql`:

```sql
-- Multi-staff school accounts: a SCHOOL-role user can have secondary staff
-- logins pointing back to it via primarySchoolId. NULL = canonical account.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primarySchoolId" TEXT;

CREATE INDEX IF NOT EXISTS "User_primarySchoolId_idx" ON "User"("primarySchoolId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_primarySchoolId_fkey"
  FOREIGN KEY ("primarySchoolId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerate the Prisma client and verify no type errors**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client` with no errors.

Run: `npx tsc --noEmit`
Expected: no new errors (there will likely be pre-existing unrelated warnings if any — compare against a baseline run before this task if unsure).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260713010000_school_staff_accounts/migration.sql
git commit -m "$(cat <<'EOF'
Add primarySchoolId self-relation for school staff accounts

Nullable field on User: null means canonical school account (unchanged
behavior), non-null means a secondary staff login attached to that
school. No route logic depends on it yet.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 2: Resolve the effective school in `getSchoolSession()`

**Files:**
- Modify: `lib/school-auth.ts` (entire file, currently 13 lines)

**Interfaces:**
- Consumes: `User.primarySchoolId` from Task 1.
- Produces: `getSchoolSession()` now returns `{ schoolId: string, callerId: string }` on success (previously just `{ schoolId: string }`). `callerId` is the literal signed-in user id; `schoolId` is the effective school (canonical id whether the caller is canonical or staff). Every later task that needs to distinguish "is this the canonical account" compares `callerId === schoolId`. All 6 existing call sites (`app/api/school/roster/route.ts`, `.../roster/members/route.ts`, `.../roster/members/[userId]/route.ts`, `.../roster/import/route.ts`, `.../mentorship/route.ts`, `.../mentorship/[conversationId]/route.ts`) only destructure `{ schoolId }` today, so this is additive and none of them need edits.

- [ ] **Step 1: Replace the contents of `lib/school-auth.ts`**

Current:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSchoolSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" as const, status: 401 as const };
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") return { error: "Forbidden" as const, status: 403 as const };
  return { schoolId: session.user.id };
}
```

Change to:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSchoolSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" as const, status: 401 as const };
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, primarySchoolId: true },
  });
  if (dbUser?.role !== "SCHOOL") return { error: "Forbidden" as const, status: 403 as const };
  return {
    schoolId: dbUser.primarySchoolId ?? session.user.id,
    callerId: session.user.id,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. This confirms all 6 existing call sites still compile against the new (superset) return type.

- [ ] **Step 3: Manual verification against an existing canonical account**

Run the dev server (`npm run dev`), log in as any existing `SCHOOL`-role demo account (see `app/api/admin/seed-demo-accounts/route.ts` for current credentials), and load `/school/roster`. Expected: roster loads exactly as before (this account's `primarySchoolId` is `null`, so `schoolId` resolves to its own id, unchanged behavior).

- [ ] **Step 4: Commit**

```bash
git add lib/school-auth.ts
git commit -m "$(cat <<'EOF'
Resolve effective school id in getSchoolSession for staff accounts

Staff accounts (primarySchoolId set) now resolve to their canonical
school's id everywhere getSchoolSession is used, so roster/import/
mentorship routes work identically for staff and canonical callers
with no changes to those route bodies. Canonical accounts (null
primarySchoolId) are unaffected.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 3: Extract a shared password-setup email helper

**Files:**
- Create: `lib/password-reset.ts`
- Modify: `app/actions/auth.ts:30-90` (the `requestPasswordReset` function)

**Interfaces:**
- Produces: `sendPasswordSetupEmail(email: string, options?: { welcome?: boolean; schoolName?: string }): Promise<{ error: string } | { success: true }>` — Task 4 imports and calls this directly (bypassing the "does a user exist" check, since it's called right after creating one).
- Consumes: `getResendClient()` from `@/lib/resend`, `prisma.passwordResetToken` model (existing, no schema change).

- [ ] **Step 1: Create `lib/password-reset.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/resend";
import crypto from "crypto";

interface SendPasswordSetupEmailOptions {
  welcome?: boolean;
  schoolName?: string;
}

export async function sendPasswordSetupEmail(
  email: string,
  options: SendPasswordSetupEmailOptions = {}
): Promise<{ error: string } | { success: true }> {
  await prisma.passwordResetToken.deleteMany({ where: { email } });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  await prisma.passwordResetToken.create({
    data: {
      email,
      token: hashedToken,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const appUrl = (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "https://goal-app-3.onrender.com").replace(/\/$/, "");
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  const heading = options.welcome ? "Set your password" : "Reset your password";
  const body = options.welcome
    ? `You&apos;ve been added as staff${options.schoolName ? ` at ${options.schoolName}` : ""}. Click the button below to set your password and get started. This link expires in 1 hour.`
    : "Click the button below to set a new password. This link expires in 1 hour.";
  const buttonLabel = options.welcome ? "Set Password" : "Reset Password";
  const subject = options.welcome ? "Set up your Nivarro account" : "Reset your Nivarro password";

  const result = await getResendClient().emails.send({
    from: process.env.FROM_EMAIL ?? "noreply@nivarro.co",
    to: email,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#080809;border-radius:8px">
        <div style="margin-bottom:20px">
          <span style="font-family:sans-serif;font-size:13px;letter-spacing:0.12em;color:#fff;font-weight:700">NI<span style="color:#E8893A">VARRO</span></span>
        </div>
        <h2 style="color:#fff;margin-bottom:8px;font-size:20px;font-weight:600">${heading}</h2>
        <p style="color:#909098;margin-bottom:24px;font-size:14px;line-height:1.6">
          ${body}
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#E8893A;color:#000;font-weight:700;
                  text-decoration:none;padding:12px 28px;border-radius:0;font-size:13px;
                  letter-spacing:0.08em;text-transform:uppercase">
          ${buttonLabel}
        </a>
        <p style="color:#58586a;font-size:12px;margin-top:28px">
          If you didn&apos;t request this, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (result.error) {
    console.error("[sendPasswordSetupEmail] Resend error:", result.error);
    return { error: `Email failed: ${result.error.message}` };
  }

  return { success: true };
}
```

- [ ] **Step 2: Replace `requestPasswordReset` in `app/actions/auth.ts` to call the shared helper**

Current (lines 30-90):

```ts
export async function requestPasswordReset(
  email: string
): Promise<{ error: string } | { success: true }> {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.email) return { success: true };

    await prisma.passwordResetToken.deleteMany({ where: { email: user.email } });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    await prisma.passwordResetToken.create({
      data: {
        email: user.email,
        token: hashedToken,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const appUrl = (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "https://goal-app-3.onrender.com").replace(/\/$/, "");
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    const result = await getResendClient().emails.send({
      from: process.env.FROM_EMAIL ?? "noreply@nivarro.co",
      to: user.email,
      subject: "Reset your Nivarro password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#080809;border-radius:8px">
          <div style="margin-bottom:20px">
            <span style="font-family:sans-serif;font-size:13px;letter-spacing:0.12em;color:#fff;font-weight:700">NI<span style="color:#E8893A">VARRO</span></span>
          </div>
          <h2 style="color:#fff;margin-bottom:8px;font-size:20px;font-weight:600">Reset your password</h2>
          <p style="color:#909098;margin-bottom:24px;font-size:14px;line-height:1.6">
            Click the button below to set a new password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#E8893A;color:#000;font-weight:700;
                    text-decoration:none;padding:12px 28px;border-radius:0;font-size:13px;
                    letter-spacing:0.08em;text-transform:uppercase">
            Reset Password
          </a>
          <p style="color:#58586a;font-size:12px;margin-top:28px">
            If you didn't request this, you can ignore this email.
          </p>
        </div>
      `,
    });

    if (result.error) {
      console.error("[requestPasswordReset] Resend error:", result.error);
      return { error: `Email failed: ${result.error.message}` };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[requestPasswordReset] Unexpected error:", msg);
    return { error: msg };
  }
}
```

Change to:

```ts
export async function requestPasswordReset(
  email: string
): Promise<{ error: string } | { success: true }> {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.email) return { success: true };
    return await sendPasswordSetupEmail(user.email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[requestPasswordReset] Unexpected error:", msg);
    return { error: msg };
  }
}
```

Replace the import block at the top of `app/actions/auth.ts`. Current:

```ts
"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/resend";
import bcrypt from "bcryptjs";
import crypto from "crypto";
```

Change to (drops `getResendClient` — no longer used directly in this file now that `sendPasswordSetupEmail` owns the Resend call; keeps `crypto` because `resetPassword`, the other function in this file, still calls `crypto.createHash` directly):

```ts
"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { sendPasswordSetupEmail } from "@/lib/password-reset";
import bcrypt from "bcryptjs";
import crypto from "crypto";
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors, and no "unused import" errors for `getResendClient` (confirm it was removed from `app/actions/auth.ts`'s import list).

- [ ] **Step 4: Manual verification — forgot-password still works**

With the dev server running, go to `/forgot-password`, submit an email for an existing account, confirm the email still arrives with working copy ("Reset your password" / "Reset Password" button, not the welcome copy).

- [ ] **Step 5: Commit**

```bash
git add lib/password-reset.ts app/actions/auth.ts
git commit -m "$(cat <<'EOF'
Extract password-setup email into a shared helper

sendPasswordSetupEmail() in lib/password-reset.ts now backs both the
existing forgot-password flow and (next task) automatic staff-account
welcome emails, with a welcome/reset copy toggle. Behavior of
requestPasswordReset is unchanged.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 4: `POST` / `GET /api/school/staff`

**Files:**
- Create: `app/api/school/staff/route.ts`

**Interfaces:**
- Consumes: `getSchoolSession()` (Task 2) → `{ schoolId, callerId }`; `sendPasswordSetupEmail()` (Task 3).
- Produces: `POST` creates a `User` with `role: "SCHOOL"`, `primarySchoolId: schoolId` and a matching `Profile`; returns `{ id: string }` (201) or `{ error: string }` (400/403/409). `GET` returns `{ staff: { id: string; name: string | null; email: string | null; createdAt: string }[] }`. Task 6 (UI) calls both.

- [ ] **Step 1: Write `app/api/school/staff/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getSchoolSession } from "@/lib/school-auth";
import { sendPasswordSetupEmail } from "@/lib/password-reset";

export async function GET() {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  const staff = await prisma.user.findMany({
    where: { primarySchoolId: schoolId },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ staff });
}

export async function POST(req: Request) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId, callerId } = check;

  if (callerId !== schoolId) {
    return NextResponse.json(
      { error: "Only the primary school account can add staff." },
      { status: 403 }
    );
  }

  let body: { name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  if (!name || !email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const school = await prisma.user.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });

  const passwordHash = await bcrypt.hash(randomUUID(), 10);
  const staffUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "SCHOOL",
      primarySchoolId: schoolId,
    },
  });

  await prisma.profile.create({
    data: {
      userId: staffUser.id,
      displayName: name,
      onboardingComplete: true,
    },
  });

  await sendPasswordSetupEmail(email, {
    welcome: true,
    schoolName: school?.name ?? undefined,
  });

  return NextResponse.json({ id: staffUser.id }, { status: 201 });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification with curl**

Start the dev server, log into a browser session as an existing canonical `SCHOOL` demo account, copy the `next-auth.session-token` (or `__Secure-next-auth.session-token`) cookie value from devtools, then:

```bash
curl -s -X POST http://localhost:3000/api/school/staff \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<paste-token>" \
  -d '{"name":"Test Teacher","email":"test-teacher@example.com"}'
```

Expected: `{"id":"<some-cuid>"}` with HTTP 201. Then:

```bash
curl -s http://localhost:3000/api/school/staff \
  -H "Cookie: next-auth.session-token=<paste-token>"
```

Expected: `{"staff":[{"id":"<same-cuid>","name":"Test Teacher","email":"test-teacher@example.com","createdAt":"..."}]}`.

Re-running the first `curl` command a second time (same email) should now return `{"error":"An account with this email already exists."}` with HTTP 409.

- [ ] **Step 4: Commit**

```bash
git add app/api/school/staff/route.ts
git commit -m "$(cat <<'EOF'
Add POST/GET /api/school/staff for canonical school accounts

Lets a canonical SCHOOL account create additional staff logins
(role=SCHOOL, primarySchoolId set) and list existing ones. New staff
get an automatic welcome/set-password email. Only the canonical
account (callerId === schoolId) may create staff.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 5: `DELETE /api/school/staff/[userId]`

**Files:**
- Create: `app/api/school/staff/[userId]/route.ts`

**Interfaces:**
- Consumes: `getSchoolSession()` (Task 2).
- Produces: `DELETE` returns `{ ok: true }` (200), `{ error: string }` (403/404). Task 6 (UI) calls this for the remove button.

- [ ] **Step 1: Write `app/api/school/staff/[userId]/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId, callerId } = check;

  if (callerId !== schoolId) {
    return NextResponse.json(
      { error: "Only the primary school account can remove staff." },
      { status: 403 }
    );
  }

  const { userId } = await params;

  const staffUser = await prisma.user.findFirst({
    where: { id: userId, primarySchoolId: schoolId },
    select: { id: true },
  });
  if (!staffUser) {
    return NextResponse.json({ error: "Staff account not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification with curl**

Using the `<some-cuid>` from Task 4's Step 3:

```bash
curl -s -X DELETE http://localhost:3000/api/school/staff/<some-cuid> \
  -H "Cookie: next-auth.session-token=<paste-token>"
```

Expected: `{"ok":true}`. A follow-up `GET /api/school/staff` should now return an empty `staff` array (assuming this was the only staff account created in testing).

Then verify the 403 path: log in as a *staff* account (create one first via Task 4's flow if none exists) and attempt the same DELETE using that account's session cookie. Expected: `{"error":"Only the primary school account can remove staff."}` with HTTP 403.

- [ ] **Step 4: Commit**

```bash
git add "app/api/school/staff/[userId]/route.ts"
git commit -m "$(cat <<'EOF'
Add DELETE /api/school/staff/[userId] for removing staff logins

Canonical-account-only (403 for staff callers or accounts outside the
caller's school). Deletes the staff User row outright.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 6: Staff management page + UI

**Files:**
- Create: `app/(dashboard)/school/staff/page.tsx`
- Create: `app/(dashboard)/school/staff/StaffClient.tsx`

**Interfaces:**
- Consumes: `POST/GET /api/school/staff`, `DELETE /api/school/staff/[userId]` (Tasks 4-5).
- Produces: a new dashboard route at `/school/staff`. No other file depends on this one — it's a leaf page.

- [ ] **Step 1: Write `app/(dashboard)/school/staff/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import StaffClient from "./StaffClient";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, primarySchoolId: true },
  });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");

  const schoolId = dbUser.primarySchoolId ?? session.user.id;
  const isCanonical = schoolId === session.user.id;

  const staff = await prisma.user.findMany({
    where: { primarySchoolId: schoolId },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <StaffClient
      initialStaff={staff.map((s) => ({
        id: s.id,
        name: s.name ?? "Unnamed",
        email: s.email ?? "",
        createdAt: s.createdAt.toISOString(),
      }))}
      isCanonical={isCanonical}
    />
  );
}
```

- [ ] **Step 2: Write `app/(dashboard)/school/staff/StaffClient.tsx`**

```tsx
"use client";

import { useState } from "react";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface Props {
  initialStaff: StaffMember[];
  isCanonical: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  borderRadius: 0,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  marginBottom: 6,
  textTransform: "uppercase",
};

export default function StaffClient({ initialStaff, isCanonical }: Props) {
  const [staff, setStaff] = useState(initialStaff);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const refreshStaff = async () => {
    try {
      const res = await fetch("/api/school/staff");
      if (res.ok) {
        const data = await res.json();
        setStaff(
          data.staff.map(
            (s: {
              id: string;
              name: string | null;
              email: string | null;
              createdAt: string;
            }) => ({
              id: s.id,
              name: s.name ?? "Unnamed",
              email: s.email ?? "",
              createdAt: s.createdAt,
            })
          )
        );
      }
    } catch {
      // ignore refresh errors silently
    }
  };

  const resetAddForm = () => {
    setAddName("");
    setAddEmail("");
    setAddError(null);
    setAddLoading(false);
  };

  const handleAddStaff = async () => {
    if (!addName.trim() || !addEmail.trim()) {
      setAddError("Name and email are required.");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/school/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), email: addEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add staff account.");
        setAddLoading(false);
        return;
      }
      setShowAddModal(false);
      resetAddForm();
      await refreshStaff();
    } catch {
      setAddError("Network error. Please try again.");
      setAddLoading(false);
    }
  };

  const handleRemoveStaff = async (s: StaffMember) => {
    const confirmed = window.confirm(
      `Remove ${s.name}'s login? They will immediately lose access to the school dashboard.`
    );
    if (!confirmed) return;
    setRemovingId(s.id);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/school/staff/${s.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setRemoveError(data.error ?? "Failed to remove staff account.");
      } else {
        await refreshStaff();
      }
    } catch {
      setRemoveError("Network error. Please try again.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 28, display: "flex", flexDirection: "column", gap: 6 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            fontWeight: 700,
            color: "var(--text)",
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: "0.01em",
          }}
        >
          Admin Logins
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          {isCanonical
            ? "Give other staff at your school their own login to the dashboard."
            : "Other people with dashboard access at your school."}
        </p>
      </div>

      {isCanonical && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button
            onClick={() => {
              resetAddForm();
              setShowAddModal(true);
            }}
            style={{
              padding: "8px 16px",
              background: "var(--amber)",
              border: "1px solid var(--amber)",
              color: "#000",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 0,
              whiteSpace: "nowrap",
            }}
          >
            + Add Teacher
          </button>
        </div>
      )}

      {removeError && (
        <div
          style={{
            border: "1px solid rgba(239,68,68,0.4)",
            background: "rgba(239,68,68,0.08)",
            padding: "10px 14px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 13, color: "#ef4444", fontFamily: "var(--font-mono)" }}>
            {removeError}
          </span>
          <button
            onClick={() => setRemoveError(null)}
            style={{
              background: "none",
              border: "none",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {staff.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "48px 32px",
            textAlign: "center",
            borderRadius: 0,
          }}
        >
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            No additional admin logins yet.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {staff.map((s) => (
            <div
              key={s.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                borderRadius: 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  {s.email}
                </div>
              </div>
              {isCanonical && (
                <button
                  onClick={() => handleRemoveStaff(s)}
                  disabled={removingId === s.id}
                  title="Remove staff login"
                  style={{
                    padding: "5px 10px",
                    background: "transparent",
                    border: `1px solid ${
                      removingId === s.id ? "var(--border)" : "rgba(239,68,68,0.4)"
                    }`,
                    color: removingId === s.id ? "var(--muted)" : "#ef4444",
                    cursor: removingId === s.id ? "not-allowed" : "pointer",
                    borderRadius: 0,
                    fontSize: 12,
                    opacity: removingId === s.id ? 0.6 : 1,
                  }}
                >
                  {removingId === s.id ? "Removing…" : "🗑"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              resetAddForm();
            }
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              padding: 28,
              width: "100%",
              maxWidth: 480,
              position: "relative",
            }}
          >
            <button
              onClick={() => {
                setShowAddModal(false);
                resetAddForm();
              }}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: 22,
                lineHeight: 1,
                padding: 0,
              }}
            >
              &times;
            </button>

            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 700,
                margin: "0 0 20px",
                color: "var(--text)",
              }}
            >
              Add Teacher
            </h2>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Full Name *</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="jane@school.edu"
                style={inputStyle}
              />
            </div>

            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              They&apos;ll get an email with a link to set their own password and log in.
            </p>

            {addError && (
              <p style={{ color: "#e05", fontSize: 13, margin: "0 0 12px", fontFamily: "var(--font-mono)" }}>
                {addError}
              </p>
            )}

            <button
              onClick={handleAddStaff}
              disabled={addLoading}
              style={{
                width: "100%",
                padding: "10px 0",
                background: "var(--amber)",
                border: "1px solid var(--amber)",
                color: "#000",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: addLoading ? "not-allowed" : "pointer",
                borderRadius: 0,
                opacity: addLoading ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {addLoading ? "Adding…" : "Add Teacher"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/school/staff/page.tsx" "app/(dashboard)/school/staff/StaffClient.tsx"
git commit -m "$(cat <<'EOF'
Add /school/staff page for managing admin logins

Canonical accounts can add/remove staff logins; staff accounts see
the same list read-only. No nav link yet (next task).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 7: Add nav link

**Files:**
- Modify: `components/layout/Sidebar.tsx:5` (icon import), `:22-30` (`SCHOOL_NAV` array)

**Interfaces:**
- Consumes: nothing new — `SCHOOL_NAV` is already rendered for any `role === "SCHOOL"` user (`app/(dashboard)/layout.tsx:29`), so both canonical and staff accounts see this link automatically once added; no other gating needed.

- [ ] **Step 1: Add the `UserCog` icon to the lucide-react import**

Current line 5:

```ts
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Bell, Briefcase, Megaphone, Globe, MapPin, GraduationCap, HeartHandshake, School, ClipboardList, User } from "lucide-react";
```

Change to:

```ts
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Bell, Briefcase, Megaphone, Globe, MapPin, GraduationCap, HeartHandshake, School, ClipboardList, User, UserCog } from "lucide-react";
```

- [ ] **Step 2: Add the nav entry to `SCHOOL_NAV`**

Current (lines 22-30):

```ts
const SCHOOL_NAV = [
  { href: "/school/destinations", label: "Destinations",  Icon: MapPin },
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/communities",         label: "Community",     Icon: Globe },
  { href: "/school/survey",       label: "Survey",        Icon: ClipboardList },
  { href: "/campaigns",           label: "Fundraise",     Icon: HeartHandshake },
  { href: "/school/mentorship",   label: "Mentorship",    Icon: UsersRound },
  { href: "/school/roster",       label: "Roster",        Icon: Users },
];
```

Change to:

```ts
const SCHOOL_NAV = [
  { href: "/school/destinations", label: "Destinations",  Icon: MapPin },
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/communities",         label: "Community",     Icon: Globe },
  { href: "/school/survey",       label: "Survey",        Icon: ClipboardList },
  { href: "/campaigns",           label: "Fundraise",     Icon: HeartHandshake },
  { href: "/school/mentorship",   label: "Mentorship",    Icon: UsersRound },
  { href: "/school/roster",       label: "Roster",        Icon: Users },
  { href: "/school/staff",        label: "Admin Logins",  Icon: UserCog },
];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "$(cat <<'EOF'
Add Admin Logins nav link to school sidebar

Visible to any SCHOOL-role account (canonical or staff), same as
every other SCHOOL_NAV entry.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 8: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Walk the full flow in the browser**

1. Log in as an existing canonical `SCHOOL` demo account. Confirm "Admin Logins" appears in the sidebar.
2. Go to `/school/staff`. Confirm it shows "No additional admin logins yet." and an "+ Add Teacher" button (canonical view).
3. Click "+ Add Teacher", enter a real name/email you can check, submit. Confirm it appears in the list within a second (via `refreshStaff`).
4. Confirm a "Set up your Nivarro account" email arrives at that address with a working "Set Password" link (check Resend dashboard/logs if using a test inbox).
5. Open the reset link in a private/incognito window, set a password, and log in as the new staff account.
6. As the staff account: confirm the sidebar shows the same `SCHOOL_NAV` (Destinations/Alumni Net/Community/Survey/Fundraise/Mentorship/Roster/Admin Logins). Confirm `/school/roster` shows identical data to the canonical account's view. Confirm `/school/staff` shows the list but with **no** "+ Add Teacher" button and **no** remove buttons (staff view).
7. Back in the canonical account's browser tab/session, confirm it's still logged in and `/school/roster` still works (concurrent-session check) while the staff account is simultaneously logged in elsewhere.
8. As the canonical account, remove the staff login from `/school/staff`. Confirm the row disappears immediately.
9. Confirm the removed staff account can no longer log in (existing session may persist per the spec's noted limitation — new sign-in attempts should fail).

- [ ] **Step 3: Confirm no regression in the pre-existing roster `STAFF` (mentor-tag) feature**

Log in as the canonical account, go to `/school/roster`, add a member via "+ Add Member" with role "Staff" and a job title. Confirm this still creates a walled `STUDENT`-role profile with `staffTitle` set (check via `/api/school/roster` response or the Prisma Studio/DB directly) — confirming Task 1-7 did not touch this unrelated code path.

- [ ] **Step 4: Final commit (if any fixes were needed during verification)**

If Steps 1-3 surfaced issues, fix them in the relevant task's files and commit with a message describing the fix. If everything passed as written, no commit is needed for this task.
