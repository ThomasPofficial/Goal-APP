# Roster Invite & Account Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every roster member a real, working way to activate their account, and give teachers a way to hand them the link — today, by copy/paste, with the actual automatic email send stubbed for a later agent.

**Architecture:** Reuse the existing `PasswordResetToken` table and `resetPassword()` server action (already purpose-agnostic — it just sets a password for whatever email owns the token) as the activation mechanism. Repurpose the existing, currently-unused `User.emailVerified` field as the "has this account been activated" flag — no schema migration needed. A new `lib/account-invite.ts` helper creates invite tokens and calls a stubbed `lib/invite-email.ts::sendInviteEmail()`. Roster API routes call this helper on new-user creation and expose the resulting link back to the UI; `RosterClient.tsx` gets a copy-link flow and a per-member activation-status badge.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, NextAuth v5, `resend` (present but not called by this feature — stub only), `bcryptjs`, Node `crypto`.

This repo has no automated test runner configured (`package.json` has no `test` script, no `jest`/`vitest` config, no `*.test.ts` files anywhere). Verification steps in this plan use `npx tsc --noEmit` for type safety and manual `curl`/browser checks against `npm run dev`, matching how prior features in this codebase were verified.

## Global Constraints

- No new Prisma models or migrations — reuse `PasswordResetToken` and the existing (unused) `User.emailVerified DateTime?` field exactly as described in the spec.
- Stub the actual email send — `sendInviteEmail()` must never throw and must not call Resend; mark it with `// TODO(email-integration): wire real Resend send here, see lib/welcome-email.ts for the pattern`.
- Do not touch `/hq/**`, any permission/role-tier logic, or seed/demo account routes (`/api/admin/seed-*`) — explicitly out of scope, see design spec's "Scope trim" note.
- Invite tokens expire in 7 days (vs. 1 hour for password resets) — this is a "get around to it" invite, not an urgent security action.
- UI copy is plain-language for a non-technical school admin, but keeps precise technical terms like "CSV" where the existing UI already uses them.
- `resetPassword()` must keep working unchanged for its existing password-reset callers — the only behavior addition is stamping `emailVerified`.

---

### Task 1: Repurpose `emailVerified` as the activation flag

**Files:**
- Modify: `app/actions/auth.ts:105-136` (`resetPassword` function)
- Modify: `app/api/auth/register/route.ts:34-42`

**Interfaces:**
- Consumes: nothing new (uses existing `prisma`, `bcrypt`, `crypto` imports already in these files)
- Produces: after this task, `User.emailVerified` is non-null for (a) every self-serve registered account, and (b) any account whose owner has successfully claimed a password via `/reset-password` or `/activate-account` (both routes call the same `resetPassword` action). Later tasks rely on `emailVerified === null` as the "pending activation" signal.

- [ ] **Step 1: Update `resetPassword` to stamp `emailVerified` on successful claim**

In `app/actions/auth.ts`, find the `resetPassword` function's `$transaction` call (around line 127) and add the `emailVerified` field to the user update:

```typescript
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, emailVerified: new Date() },
    }),
    prisma.passwordResetToken.delete({ where: { token: hashedToken } }),
  ]);
```

- [ ] **Step 2: Stamp `emailVerified` on self-serve registration**

In `app/api/auth/register/route.ts`, find the `prisma.user.create` call (around line 35) and add `emailVerified`:

```typescript
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "STUDENT",
        emailVerified: new Date(),
      },
    });
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by these two edits (pre-existing unrelated errors, if any, are not your concern here).

- [ ] **Step 4: Commit**

```bash
git add app/actions/auth.ts app/api/auth/register/route.ts
git commit -m "feat: stamp emailVerified on registration and password claim"
```

---

### Task 2: Stubbed invite email module

**Files:**
- Create: `lib/invite-email.ts`

**Interfaces:**
- Consumes: nothing (no imports from other new files in this plan)
- Produces: `sendInviteEmail(args: { to: string; name?: string; activateUrl: string }): Promise<{ id: string | null }>` — Task 3's `createAccountInvite` calls this.

- [ ] **Step 1: Write the stub module**

Create `lib/invite-email.ts`:

```typescript
export type InviteEmailArgs = {
  to: string;
  name?: string;
  activateUrl: string;
};

/**
 * Stub — logs the invite instead of sending it. A later agent wires this
 * up to Resend (see lib/welcome-email.ts for the exact pattern: build the
 * HTML, call getResendClient().emails.send(...), throw on result.error).
 * Never throws: account creation must not fail because email isn't wired up.
 */
// TODO(email-integration): wire real Resend send here, see lib/welcome-email.ts for the pattern
export async function sendInviteEmail(
  args: InviteEmailArgs
): Promise<{ id: string | null }> {
  console.log(
    `[sendInviteEmail:stub] would invite ${args.name ?? args.to} <${args.to}> → ${args.activateUrl}`
  );
  return { id: null };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/invite-email.ts
git commit -m "feat: add stubbed invite email module"
```

---

### Task 3: `createAccountInvite` helper

**Files:**
- Create: `lib/account-invite.ts`

**Interfaces:**
- Consumes: `sendInviteEmail` from `lib/invite-email.ts` (Task 2); `prisma` from `lib/prisma`; Node `crypto`.
- Produces: `createAccountInvite(args: { email: string; name?: string }): Promise<{ activateUrl: string }>` — Tasks 4, 5, and 6 (roster routes) call this.

- [ ] **Step 1: Write the helper**

Create `lib/account-invite.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendInviteEmail } from "@/lib/invite-email";

export type CreateAccountInviteArgs = {
  email: string;
  name?: string;
};

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates (or replaces) an activation token for the given email and
 * returns the link a teacher can hand to that person. Reuses the same
 * PasswordResetToken table and resetPassword() claim flow used for
 * ordinary password resets — activation is just a first-time claim.
 */
export async function createAccountInvite(
  args: CreateAccountInviteArgs
): Promise<{ activateUrl: string }> {
  const email = args.email.trim();

  await prisma.passwordResetToken.deleteMany({ where: { email } });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  await prisma.passwordResetToken.create({
    data: {
      email,
      token: hashedToken,
      expires: new Date(Date.now() + INVITE_EXPIRY_MS),
    },
  });

  const appUrl = (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "https://goal-app-3.onrender.com"
  ).replace(/\/$/, "");
  const activateUrl = `${appUrl}/activate-account?token=${rawToken}`;

  await sendInviteEmail({ to: email, name: args.name, activateUrl });

  return { activateUrl };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/account-invite.ts
git commit -m "feat: add createAccountInvite helper"
```

---

### Task 4: `/activate-account` page

**Files:**
- Create: `app/(auth)/activate-account/page.tsx`

**Interfaces:**
- Consumes: `resetPassword(token, password)` from `app/actions/auth.ts` (unchanged signature — Task 1 only added an internal side effect).
- Produces: a page at `/activate-account?token=...`. No other task depends on this page's internals, only on the URL shape `/activate-account?token=<token>` (used by Task 3's `activateUrl`).

- [ ] **Step 1: Write the page**

Create `app/(auth)/activate-account/page.tsx`, modeled directly on `app/(auth)/reset-password/page.tsx` with activation-specific copy:

```tsx
"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";

function ActivateAccountForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm" style={{ color: "#f87171" }}>
          This activation link is invalid.
        </p>
        <p className="text-sm" style={{ color: "var(--text2)" }}>
          Ask your school admin to send you a new invite link.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError("");
    setLoading(true);
    const result = await resetPassword(token!, password);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      window.location.href = "/login";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
          Choose a Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          required
          className="w-full text-sm"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: "6px", padding: "10px 14px" }}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
          Confirm Password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          required
          className="w-full text-sm"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: "6px", padding: "10px 14px" }}
        />
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-md" style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 font-bold text-sm rounded-md py-2.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-widest"
        style={{ background: "var(--gold)", color: "#04070F", fontFamily: "var(--font-display, sans-serif)", letterSpacing: "0.1em" }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? "Activating..." : "Activate account"}
      </button>
    </form>
  );
}

export default function ActivateAccountPage() {
  return (
    <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border-md)", boxShadow: "0 32px 64px rgba(0,0,0,0.5)" }}>
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4" style={{ background: "var(--gold)" }}>
          <span className="font-black text-lg" style={{ color: "#04070F", fontFamily: "var(--font-display, sans-serif)" }}>N</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>Welcome to Nivarro</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>Set a password to activate your account</p>
      </div>
      <Suspense fallback={<div className="h-40" />}>
        <ActivateAccountForm />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, then in another terminal generate a token directly for a throwaway test email and confirm the page renders and the form is reachable:

```bash
node -e "
const crypto = require('crypto');
const raw = crypto.randomBytes(32).toString('hex');
console.log('http://localhost:3000/activate-account?token=' + raw);
"
```

Open the printed URL — expect the "Welcome to Nivarro" activation form to render (it will show "Invalid or expired link" on submit since no matching token exists in the DB yet — that's expected at this step; full end-to-end verification happens in Task 5's manual check).

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/activate-account/page.tsx"
git commit -m "feat: add /activate-account page"
```

---

### Task 5: Wire invites into single-member roster add

**Files:**
- Modify: `app/api/school/roster/members/route.ts`

**Interfaces:**
- Consumes: `createAccountInvite` from `lib/account-invite.ts` (Task 3).
- Produces: POST `/api/school/roster/members` now returns `{ id: string, activateUrl?: string }` — `activateUrl` present only when a brand-new user was created. Task 8 (RosterClient) reads this field.

- [ ] **Step 1: Add the invite call on the new-user branch**

In `app/api/school/roster/members/route.ts`, import the helper at the top:

```typescript
import { createAccountInvite } from "@/lib/account-invite";
```

Then modify the function's ending. Currently it's:

```typescript
  } else {
    const newUser = await prisma.user.create({
      data: {
        name: displayName.trim(),
        email: email.trim(),
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        role: "STUDENT",
        isAlumni: role === "ALUMNI",
        profile: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: profileData as any,
        },
      },
    });
    userId = newUser.id;
  }

  return NextResponse.json({ id: userId });
}
```

Change it to capture whether this was a new user and generate the invite:

```typescript
  let activateUrl: string | undefined;

  if (existingUser) {
    // ... (unchanged existing-user branch above)
  } else {
    const newUser = await prisma.user.create({
      data: {
        name: displayName.trim(),
        email: email.trim(),
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        role: "STUDENT",
        isAlumni: role === "ALUMNI",
        profile: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: profileData as any,
        },
      },
    });
    userId = newUser.id;

    const invite = await createAccountInvite({
      email: email.trim(),
      name: displayName.trim(),
    });
    activateUrl = invite.activateUrl;
  }

  return NextResponse.json({ id: userId, activateUrl });
}
```

(The `let activateUrl` declaration goes right before the existing `if (existingUser) { ... } else { ... }` block — do not duplicate that block, just add the new lines inside the existing `else` branch and change the final `return` line.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

With `npm run dev` running and logged in as a SCHOOL-role account (e.g. `school@nivarro.demo` / `demo2026` per the seeded demo accounts), use the browser devtools console on `/school/roster` or `curl` with a valid session cookie to POST a new member and confirm the response includes `activateUrl`:

```bash
curl -s -X POST http://localhost:3000/api/school/roster/members \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste your session cookie here>" \
  -d '{"displayName":"Test Student","email":"test-invite-1@example.com","role":"STUDENT"}'
```

Expected: JSON response containing `"activateUrl":"http://localhost:3000/activate-account?token=..."`. Then open that URL, set a password, confirm it redirects to `/login`, and confirm `npx prisma studio` (or a quick query) shows that user's `emailVerified` is now non-null.

- [ ] **Step 4: Commit**

```bash
git add app/api/school/roster/members/route.ts
git commit -m "feat: generate activation invite on new roster member add"
```

---

### Task 6: Wire invites into CSV roster import

**Files:**
- Modify: `app/api/school/roster/import/route.ts`

**Interfaces:**
- Consumes: `createAccountInvite` from `lib/account-invite.ts` (Task 3).
- Produces: POST `/api/school/roster/import` now returns `{ imported: number, skipped: number, errors: string[], invites: { email: string; name: string; activateUrl: string }[] }`. Task 8 (RosterClient) reads `invites`.

- [ ] **Step 1: Add the invite call and collect results**

In `app/api/school/roster/import/route.ts`, import the helper:

```typescript
import { createAccountInvite } from "@/lib/account-invite";
```

Add an `invites` array declaration alongside the existing `imported`/`skipped`/`errors` (near the top of the function body, around line 40):

```typescript
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const invites: { email: string; name: string; activateUrl: string }[] = [];
```

In the `for (const row of rows)` loop, find the `else` branch that creates a new user (currently ending at `imported++;`):

```typescript
      } else {
        await prisma.user.create({
          data: {
            name: displayName,
            email,
            passwordHash: await bcrypt.hash(randomUUID(), 10),
            role: "STUDENT",
            isAlumni,
            profile: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              create: profileData as any,
            },
          },
        });

        const invite = await createAccountInvite({ email, name: displayName });
        invites.push({ email, name: displayName, activateUrl: invite.activateUrl });
      }

      imported++;
```

Update the final response to include `invites`:

```typescript
  return NextResponse.json({ imported, skipped, errors, invites });
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

```bash
curl -s -X POST http://localhost:3000/api/school/roster/import \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste your session cookie here>" \
  -d '{"rows":[{"displayName":"Test Import Student","email":"test-invite-2@example.com","role":"STUDENT"}]}'
```

Expected: `imported: 1`, `invites` array with one entry containing a working `activateUrl`.

- [ ] **Step 4: Commit**

```bash
git add app/api/school/roster/import/route.ts
git commit -m "feat: generate activation invites on CSV roster import"
```

---

### Task 7: Resend-invite endpoint

**Files:**
- Create: `app/api/school/roster/members/[userId]/resend-invite/route.ts`

**Interfaces:**
- Consumes: `createAccountInvite` from `lib/account-invite.ts` (Task 3); `getSchoolSession` from `lib/school-auth.ts`.
- Produces: POST `/api/school/roster/members/:userId/resend-invite` → `{ activateUrl: string }` on success, or `{ error: string }` with 404 if the member isn't found in this school or is already activated. Task 8 (RosterClient) calls this endpoint.

- [ ] **Step 1: Write the route**

Create `app/api/school/roster/members/[userId]/resend-invite/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";
import { createAccountInvite } from "@/lib/account-invite";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;
  const { userId } = await params;

  // Security: only resend for a member that belongs to this school
  const profile = await prisma.profile.findFirst({
    where: { userId, schoolId },
    include: { user: { select: { email: true, emailVerified: true } } },
  });

  if (!profile || !profile.user.email) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (profile.user.emailVerified) {
    return NextResponse.json(
      { error: "This member has already activated their account." },
      { status: 404 }
    );
  }

  const invite = await createAccountInvite({
    email: profile.user.email,
    name: profile.displayName,
  });

  return NextResponse.json({ activateUrl: invite.activateUrl });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Using the `test-invite-1@example.com` member created in Task 5 (before you activated it, or add a fresh one), call:

```bash
curl -s -X POST http://localhost:3000/api/school/roster/members/<that-user-id>/resend-invite \
  -H "Cookie: <paste your session cookie here>"
```

Expected: `{ "activateUrl": "..." }` with a fresh token. Calling it again after visiting that link and setting a password should now return the 404 "already activated" error.

- [ ] **Step 4: Commit**

```bash
git add "app/api/school/roster/members/[userId]/resend-invite/route.ts"
git commit -m "feat: add roster member resend-invite endpoint"
```

---

### Task 8: Expose `emailVerified` from the roster page query

**Files:**
- Modify: `app/(dashboard)/school/roster/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: the `members` array passed to `RosterClient` gains an `emailVerified: string | null` field (ISO string or null) per member. Task 9 (RosterClient) reads this.

- [ ] **Step 1: Add `emailVerified` to the query and mapped output**

In `app/(dashboard)/school/roster/page.tsx`, add `emailVerified: true` to the `user.select` block:

```typescript
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isAlumni: true,
          createdAt: true,
          emailVerified: true,
        },
      },
```

And add it to the mapped `members` array:

```typescript
  const members = memberProfiles.map((p) => ({
    profileId: p.id,
    userId: p.userId,
    displayName: p.displayName,
    email: p.user.email ?? null,
    phone: p.phone ?? null,
    role: p.user.role,
    isAlumni: p.user.isAlumni,
    staffTitle: p.staffTitle ?? null,
    graduationYear: p.graduationYear ?? null,
    industry: p.industry ?? null,
    intendedCollege: p.intendedCollege ?? null,
    intendedMajor: p.intendedMajor ?? null,
    isAvailableToMentor: p.isAvailableToMentor,
    createdAt: p.user.createdAt.toISOString(),
    emailVerified: p.user.emailVerified ? p.user.emailVerified.toISOString() : null,
  }));
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (the `Member` interface in `RosterClient.tsx` doesn't have `emailVerified` yet — that's fine, it's a superset of props; Task 9 adds the field to the interface).

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/school/roster/page.tsx"
git commit -m "feat: pass emailVerified through to roster client"
```

---

### Task 9: Roster UI — status badge, copy-link, resend, import results

**Files:**
- Modify: `app/(dashboard)/school/roster/RosterClient.tsx`

**Interfaces:**
- Consumes: `emailVerified` field on `Member` (Task 8); `activateUrl` field in the POST `/api/school/roster/members` response (Task 5); `invites` field in the POST `/api/school/roster/import` response (Task 6); POST `/api/school/roster/members/:userId/resend-invite` (Task 7).
- Produces: nothing consumed by later tasks — this is the final task in the plan.

- [ ] **Step 1: Add `emailVerified` to the `Member` interface**

In `app/(dashboard)/school/roster/RosterClient.tsx`, add the field to the `Member` interface (near the top of the file):

```typescript
interface Member {
  profileId: string;
  userId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  role: "STUDENT" | "ORG" | "ADMIN" | "SCHOOL";
  isAlumni: boolean;
  staffTitle: string | null;
  graduationYear: number | null;
  industry: string | null;
  intendedCollege: string | null;
  intendedMajor: string | null;
  isAvailableToMentor: boolean;
  createdAt: string;
  emailVerified: string | null;
}
```

- [ ] **Step 2: Add state for the post-add invite panel and copy feedback**

Near the other `useState` declarations (after the "Add Member modal form state" block), add:

```typescript
  const [addedInviteUrl, setAddedInviteUrl] = useState<string | null>(null);
  const [addedMemberName, setAddedMemberName] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
```

- [ ] **Step 3: Add a shared clipboard-copy helper**

Add this function near the other handlers (e.g. right after `resetAddForm`):

```typescript
  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      // clipboard API unavailable — silently no-op, the link is still visible to select/copy manually
    }
  };
```

- [ ] **Step 4: Show the invite link after a successful Add Member**

Modify `handleAddMember` — currently on success it does `setShowAddModal(false); resetAddForm(); await refreshMembers();`. Change the success branch to:

```typescript
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add member.");
        setAddLoading(false);
        return;
      }
      setAddedMemberName(addName.trim());
      setAddedInviteUrl(data.activateUrl ?? null);
      resetAddForm();
      await refreshMembers();
```

(Note: `resetAddForm()` also resets `addLoading`, so leave the explicit `setShowAddModal(false)` out here — Step 5 replaces the modal body with the confirmation panel instead of closing it.)

- [ ] **Step 5: Render the confirmation panel in place of the Add Member form**

In the Add Member modal JSX (the `{showAddModal && ( ... )}` block), wrap the existing form content so it only renders when there's no pending invite to show, and add the confirmation panel. Right after the modal's `<h2>Add Member</h2>` heading, add:

```tsx
            {addedInviteUrl !== null || (addedInviteUrl === null && addedMemberName) ? (
              <div>
                <p style={{ fontSize: 14, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.5 }}>
                  <strong>{addedMemberName}</strong> has been added. We don&apos;t send this
                  automatically yet — copy the link below and send it to them (text, email,
                  whatever&apos;s easiest) so they can set up their password and log in.
                </p>
                {addedInviteUrl && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    <input
                      readOnly
                      value={addedInviteUrl}
                      style={{ ...inputStyle, flex: 1, fontFamily: "var(--font-mono)", fontSize: 11 }}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={() => copyToClipboard(addedInviteUrl, "add-modal")}
                      style={{
                        padding: "8px 16px",
                        background: "var(--amber)",
                        border: "1px solid var(--amber)",
                        color: "#000",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        borderRadius: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {copiedKey === "add-modal" ? "Copied!" : "Copy Invite Link"}
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setAddedInviteUrl(null);
                    setAddedMemberName("");
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    borderRadius: 0,
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* ...existing Add Member form JSX goes here, unchanged... */}
              </>
            )}
```

Move all the existing form JSX (Role selector through the final Submit button) inside that `<>...</>` fragment in the `else` branch. Also update the modal's close-button and backdrop-click handlers to reset the new state too:

```typescript
              onClick={() => {
                setShowAddModal(false);
                resetAddForm();
                setAddedInviteUrl(null);
                setAddedMemberName("");
              }}
```

Apply that same three-line reset (`setShowAddModal(false)`, `setAddedInviteUrl(null)`, `setAddedMemberName("")`) to both the backdrop `onClick` and the `&times;` close button's `onClick` for the Add Member modal.

- [ ] **Step 6: Add the "Setup Pending" badge to member rows**

In the member row rendering (the `tabMembers.map((m) => { ... })` block), find the `badgeLabel` computation:

```typescript
                const badgeLabel = m.isAlumni
                  ? "ALUMNI"
                  : m.staffTitle
                  ? "STAFF"
                  : m.role;
```

Right after the existing role badge `<span>` element (the one showing `{badgeLabel}`), add a pending badge and a copy-link action, shown only when `m.emailVerified` is null:

```tsx
                    {/* Activation status */}
                    {!m.emailVerified && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--muted)",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          padding: "2px 8px",
                          borderRadius: 0,
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                        title="This person hasn't set up their account yet"
                      >
                        SETUP PENDING
                      </span>
                    )}
```

Place this immediately after the role badge `<span>...{badgeLabel}...</span>` and before the "System ID" `<span>`.

- [ ] **Step 7: Add the "Copy Invite Link" row action for pending members**

In the row Actions `<div>` (containing the Edit ✏ and Remove 🗑 buttons), add a new button before them, shown only when `!m.emailVerified`:

```tsx
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {!m.emailVerified && (
                        <button
                          onClick={() => handleCopyInviteLink(m)}
                          disabled={resendingId === m.userId}
                          title="Copy invite link"
                          style={{
                            padding: "5px 10px",
                            background: "transparent",
                            border: "1px solid var(--amber)",
                            color: "var(--amber)",
                            cursor: resendingId === m.userId ? "not-allowed" : "pointer",
                            borderRadius: 0,
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            whiteSpace: "nowrap",
                            opacity: resendingId === m.userId ? 0.6 : 1,
                          }}
                        >
                          {resendingId === m.userId
                            ? "…"
                            : copiedKey === m.userId
                            ? "Copied!"
                            : "Copy Invite Link"}
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(m)}
```

(The existing Edit and Remove buttons stay unchanged directly below — just insert the new conditional button above them, inside the same wrapping `<div>`.)

Add the handler function `handleCopyInviteLink` near the other member-row handlers (e.g. after `handleRemoveMember`):

```typescript
  const handleCopyInviteLink = async (m: Member) => {
    setResendError(null);
    setResendingId(m.userId);
    try {
      const res = await fetch(
        `/api/school/roster/members/${m.userId}/resend-invite`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setResendError(data.error ?? "Failed to generate invite link.");
        return;
      }
      await copyToClipboard(data.activateUrl, m.userId);
    } catch {
      setResendError("Network error. Please try again.");
    } finally {
      setResendingId(null);
    }
  };
```

Render `resendError` near the existing `removeError` display block (same styling pattern, right after it):

```tsx
          {resendError && (
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
                {resendError}
              </span>
              <button
                onClick={() => setResendError(null)}
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
```

- [ ] **Step 8: Show invite links in the CSV import result screen**

Modify the `importResult` type to include `invites`, right where `importResult` state is declared:

```typescript
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    invites: { email: string; name: string; activateUrl: string }[];
  } | null>(null);
```

Also add `invites: []` to the two places `setImportResult` is called with a synthesized (non-API) result — the network-error and non-ok-response fallbacks in `handleImport`:

```typescript
      if (!res.ok) {
        setImportResult({
          imported: 0,
          skipped: parsedRows.length,
          errors: [data.error ?? "Import failed"],
          invites: [],
        });
      } else {
        setImportResult(data);
      }
      setImportStep("result");
    } catch {
      setImportResult({
        imported: 0,
        skipped: parsedRows.length,
        errors: ["Network error. Please try again."],
        invites: [],
      });
      setImportStep("result");
```

In the Step 3 result screen JSX, right after the existing `{importResult.errors.length > 0 && ( ... )}` block and before the final `<div style={{ display: "flex", justifyContent: "flex-end" }}>` (the "Done" button row), add:

```tsx
                    {importResult.invites.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                              margin: 0,
                              lineHeight: 1.5,
                            }}
                          >
                            Since we don&apos;t send these automatically yet, here are
                            their setup links to share:
                          </p>
                          <button
                            onClick={() => {
                              const block = importResult.invites
                                .map((inv) => `${inv.name} <${inv.email}>: ${inv.activateUrl}`)
                                .join("\n");
                              copyToClipboard(block, "import-all");
                            }}
                            style={{
                              padding: "5px 12px",
                              background: "transparent",
                              border: "1px solid var(--border)",
                              color: "var(--text)",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              cursor: "pointer",
                              borderRadius: 0,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {copiedKey === "import-all" ? "Copied!" : "Copy All Links"}
                          </button>
                        </div>
                        <div
                          style={{
                            maxHeight: 200,
                            overflowY: "auto",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {importResult.invites.map((inv, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "6px 10px",
                                borderBottom:
                                  i < importResult.invites.length - 1
                                    ? "1px solid var(--border)"
                                    : "none",
                              }}
                            >
                              <span style={{ fontSize: 12, color: "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {inv.name} <span style={{ color: "var(--muted)" }}>({inv.email})</span>
                              </span>
                              <button
                                onClick={() => copyToClipboard(inv.activateUrl, `import-${i}`)}
                                style={{
                                  padding: "4px 10px",
                                  background: "transparent",
                                  border: "1px solid var(--amber)",
                                  color: "var(--amber)",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  cursor: "pointer",
                                  borderRadius: 0,
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                {copiedKey === `import-${i}` ? "Copied!" : "Copy Link"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
```

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 10: Manual verification**

With `npm run dev` running, log in as a SCHOOL account and visit `/school/roster`:
1. Click "+ Add Member", fill in a new student's name/email, submit — expect the confirmation panel with a working "Copy Invite Link" button instead of the modal just closing.
2. After clicking Done, find that member's row — expect a "SETUP PENDING" badge and a "Copy Invite Link" row action.
3. Click that row's "Copy Invite Link" — expect it to flip to "Copied!" briefly, and pasting the clipboard contents should be a working `/activate-account?token=...` URL.
4. Open that URL in a new tab, set a password — expect redirect to `/login`, then log in successfully with the new credentials. Back on `/school/roster` (refresh), that member's "SETUP PENDING" badge should be gone.
5. Use "Import CSV" with a small CSV of 2 new members — expect the result screen to list both with individual "Copy Link" buttons and a working "Copy All Links" button.

- [ ] **Step 11: Commit**

```bash
git add "app/(dashboard)/school/roster/RosterClient.tsx"
git commit -m "feat: roster UI for invite links and activation status"
```

---

## Plan Self-Review Notes

- **Spec coverage:** data model (Task 1), stubbed send (Task 2), `createAccountInvite`/token reuse (Task 3), `/activate-account` page (Task 4), single-add wiring (Task 5), CSV import wiring (Task 6), resend endpoint (Task 7), roster query field (Task 8), all UI wording/badge/copy-link/CSV-results requirements from the spec (Task 9). Seed-route stamping and `/hq` parity are covered by the design doc's explicit scope trim / out-of-scope list — no task needed.
- **Type consistency check:** `createAccountInvite({ email, name })` (Task 3) is called identically in Tasks 5, 6, and 7. `activateUrl` is the field name used consistently in the single-add response (Task 5), the resend endpoint response (Task 7), and read by the UI (Task 9, Step 4). `invites: { email, name, activateUrl }[]` is the field name/shape used consistently in Task 6's response and Task 9 Step 8's `importResult` type.
- **No placeholders:** every step above includes literal code, not descriptions of code.
