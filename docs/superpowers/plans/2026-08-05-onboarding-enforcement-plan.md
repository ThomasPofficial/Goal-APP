# Onboarding Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standard (self-signup, non-walled) students who haven't finished `/onboarding` get redirected there on every request, until their profile is marked complete.

**Architecture:** `proxy.ts` (Next.js 16's Node-runtime middleware) gains one extra check after its existing session/public-path gate: for any authenticated, non-exempt request, look up the user's `role` and `profile.{schoolId, onboardingComplete}` via Prisma, and redirect to `/onboarding` if the user is a standard student who hasn't finished it. `/onboarding`, `/quiz`, and all of `/api/*` stay exempt so the flow itself and every API call keep working.

**Tech Stack:** Next.js 16 (Node-runtime `proxy.ts`), NextAuth v5 (`lib/auth.ts`'s `auth()`), Prisma (`lib/prisma.ts`).

## Global Constraints

- Scope is `role === "STUDENT"` with no `profile.schoolId` only. Walled students (`profile.schoolId` set), ORG, SCHOOL, and ADMIN accounts must see **zero** behavior change. (Design doc, "Scope" section.)
- `/api/*` must be exempt from the new redirect even though it isn't in the existing `isPublic` list — an API call redirected to HTML instead of JSON breaks silently. (Design doc, "Exemptions & loop safety.")
- No changes to `lib/auth.ts`, session/JWT callbacks, or any file other than `proxy.ts`. (Design doc, "Mechanism" — explicitly rejected the JWT approach.)
- This repo has no test framework configured (`package.json` has no `test` script, no `vitest`/`jest` config, no `*.test.ts` files) and local dev has no `DATABASE_URL`/auth secrets configured, so `proxy.ts`'s Prisma calls cannot be exercised locally. Verification in this plan is therefore a real-environment (deployed) manual pass, not an automated test suite — do not fabricate a test command that doesn't exist in this repo.

---

### Task 1: Add the onboarding-enforcement check to `proxy.ts`

**Files:**
- Modify: `proxy.ts` (repo root, currently 49 lines — see full current content below)

**Interfaces:**
- Consumes: `auth` from `@/lib/auth` (returns `Promise<Session | null>`, `session.user.id: string`), `prisma` from `@/lib/prisma` (`prisma.user.findUnique`).
- Produces: nothing new consumed elsewhere — `proxy` and `config` are Next.js's own entrypoints, invoked by the framework via the existing `matcher`.

Current full content of `proxy.ts` (for reference — this is what Step 1 replaces):

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // NextAuth v5 sets this cookie in prod (HTTPS) or without __Secure- in dev
  const hasSession =
    req.cookies.has("__Secure-authjs.session-token") ||
    req.cookies.has("authjs.session-token");

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/quiz") ||
    pathname.startsWith("/onboarding");

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|woff2?|ttf|map)$).*)"],
};
```

- [ ] **Step 1: Replace `proxy.ts` with the new version**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // NextAuth v5 sets this cookie in prod (HTTPS) or without __Secure- in dev
  const hasSession =
    req.cookies.has("__Secure-authjs.session-token") ||
    req.cookies.has("authjs.session-token");

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/quiz") ||
    pathname.startsWith("/onboarding");

  // Redirect relative to the incoming request's own origin (req.url), never an
  // env-configured external URL. NEXT_PUBLIC_AUTH_URL can drift out of sync with
  // the domain actually serving the request (e.g. still pointing at the raw
  // *.onrender.com host after a custom domain was added) — that mismatch bounces
  // the browser across origins mid-redirect, which splits the session cookie
  // across two domains and makes a freshly-logged-in user see a stale session
  // from whichever domain still has an old cookie.
  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Force standard (self-signup, non-walled) students to finish /onboarding before
  // using the rest of the app. Walled students (added via school roster CSV import)
  // already get onboardingComplete:true stamped at import time, and every non-STUDENT
  // role (ORG/SCHOOL/ADMIN) is untouched by this check. /api/* is exempted even though
  // it's not in isPublic — an API route redirected to an HTML page instead of JSON
  // would silently break the onboarding page's own PATCH /api/profile call.
  const skipOnboardingCheck =
    pathname.startsWith("/api") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/quiz") ||
    isPublic;

  if (hasSession && !skipOnboardingCheck) {
    const session = await auth();
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, profile: { select: { schoolId: true, onboardingComplete: true } } },
      });
      const needsOnboarding =
        user?.role === "STUDENT" && !user.profile?.schoolId && !user.profile?.onboardingComplete;
      if (needsOnboarding) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  // Files under /public are served from the site root (e.g. /ops-room.png), not
  // under a "/public/" prefix, so excluding "public/" here never matched anything —
  // static assets were getting bounced through the auth redirect above. Exclude by
  // extension instead so images/fonts/etc. actually skip the proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|woff2?|ttf|map)$).*)"],
};
```

- [ ] **Step 2: Type-check (the only local verification available — no DB, so this only catches syntax/type errors, not behavior)**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by `proxy.ts` (pre-existing unrelated errors, if any, are not this task's concern — `next.config.ts` already has `typescript: { ignoreBuildErrors: true }`, so this is a sanity check, not a hard gate).

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat: force standard students to finish onboarding before using the app"
```

---

### Task 2: Deploy and verify against the live environment

**Files:** none (deploy + manual verification only)

**Interfaces:**
- Consumes: the deploy hook documented in memory (`https://api.render.com/deploy/srv-d7o25h68bjmc7395irug?key=XETPeUTTsjo`, must be triggered via Node's `https` module — `curl`/PowerShell `Invoke-WebRequest` fail SSL verification in this dev environment).
- Produces: nothing further downstream — this is the last task.

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Trigger the Render deploy hook**

```bash
node -e "const https = require('https'); https.get('https://api.render.com/deploy/srv-d7o25h68bjmc7395irug?key=XETPeUTTsjo', r => { console.log(r.statusCode); r.on('data', d => process.stdout.write(d.toString())); r.on('end', () => console.log()); });"
```

Expected: `200` and a JSON body like `{"deploy":{"id":"dep-..."}}`.

- [ ] **Step 3: Wait for the deploy to finish building (~2–3 minutes), then verify all four scenarios against `https://app.nivarro.co`**

Use the gstack `browse` tool (`$B`) for all of these — real cookies, real redirects, matches how every other fix this session was verified.

**3a. Incomplete standard student gets redirected.** Register a brand-new throwaway account through the live `/register` form (guarantees `role=STUDENT`, no `schoolId`, `onboardingComplete=false`). Immediately try to navigate to `/dashboard` or `/peers`. Expected: browser lands on `/onboarding`, not the requested page.

**3b. Walled student is unaffected.** Log in as `priya@nivarro.io` / `demo2026` (confirmed walled — her dashboard shows the walled nav: My School / Community Chat / Mentorship / Notifications, no Peers). Navigate to `/dashboard`. Expected: normal walled dashboard loads, no redirect to `/onboarding`.

**3c. Org account is unaffected.** Log in as `ridgepoint@nivarro.demo` / `ridgepoint2026`. Navigate to `/peers` (linked from the sidebar as "Find General Users"). Expected: page loads normally, exactly as before this change.

**3d. Completing onboarding lifts the block.** Using the throwaway account from 3a, complete the quiz (`/quiz`) and all 4 onboarding steps (including picking a grade) through to submission. Immediately try `/dashboard` again. Expected: loads normally, no more redirect — confirms the block isn't permanent/stuck.

If any of 3a–3d fails, do not consider this task done — go back to Task 1 and fix `proxy.ts` before re-deploying.

- [ ] **Step 4: Report results**

Summarize pass/fail for 3a–3d back to the user. No further commit needed (Task 1's commit already covers the change; this task is verification-only).

---

## Self-Review Notes

- **Spec coverage:** Design doc's "Mechanism" section → Task 1 Step 1 (exact code match). "Exemptions & loop safety" → covered by the `skipOnboardingCheck` logic and verified in 3a/3d. "Data behavior" (no JWT changes, fresh-per-request) → Global Constraints + Task 1 (no `lib/auth.ts` touched). "Out of scope" items (ORG onboarding, sign-out affordance on `/onboarding`) → intentionally not tasked here, matching the design doc.
- **Placeholder scan:** no TBD/TODO; every step has literal runnable commands or full file content, not descriptions.
- **Type consistency:** `proxy.ts`'s new code is the only code in this plan — no cross-task signature drift possible.
