# Onboarding Enforcement — Design

**Date:** 2026-08-05
**Status:** Approved by user, pending implementation plan

## Problem

Nothing currently forces a user to finish `/onboarding` before using the rest of the
app. `app/(onboarding)/onboarding/OnboardingClient.tsx` is a 4-step flow (genius quiz
result reveal → focus → interests → grade) that `PATCH`es `/api/profile` with
`onboardingComplete: true` at the end, but a user can navigate away at any point and
nothing stops them.

This surfaced as a real symptom: the "Find General Users" (`/peers`) grade filter
looked completely broken, because the real (non-demo) student accounts that exist in
production (Leah, shlok madhekar, etc.) never finished onboarding and so have
`Profile.grade = null`. Selecting any grade always returned zero matches.

## Scope

Onboarding enforcement applies **only to standard, self-signup student accounts** —
`role === "STUDENT"` with no `profile.schoolId`. Confirmed by reading the account-type
taxonomy in the codebase:

- **Walled students** (`role === "STUDENT"`, `profile.schoolId` set — added via a
  school's roster CSV import) already get `onboardingComplete: true` stamped directly
  at import time (`app/api/school/roster/import/route.ts`,
  `app/api/hq/schools/[schoolId]/import/route.ts`). They never touch `/onboarding` and
  don't need to.
- **ORG accounts** have a completely separate setup flow (`/orgs/new`), not this
  onboarding form. Out of scope for this change.
- **SCHOOL/ADMIN accounts** don't go through `/onboarding` either.

Enforcement is a **hard block**: any request to a non-exempt path redirects to
`/onboarding` until the profile is marked complete. A soft nag/banner was considered
and rejected — it wouldn't reliably close the data gap (users can just ignore a
banner indefinitely).

## Mechanism

`proxy.ts` (Next.js 16's renamed `middleware.ts`) now runs on the **Node.js runtime by
default** (confirmed via Next.js 16 release notes — this is *why* it was renamed:
"proxy" signals it's no longer edge-only). That means it can call Prisma directly,
the same way `app/(dashboard)/layout.tsx` already does for computing `isWalledStudent`.
No JWT/session-callback changes are needed — every request re-checks fresh from the
DB, so there's no staleness to manage.

Add, after the existing session/public-path gate in `proxy.ts`:

```ts
const skipOnboardingCheck =
  pathname.startsWith("/api") ||       // API routes must never receive an HTML redirect
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
```

Walled students and every non-STUDENT role always evaluate `needsOnboarding = false` —
zero behavior change for them.

### Why `proxy.ts` and not `(dashboard)/layout.tsx`

`(dashboard)/layout.tsx` already does an equivalent Prisma lookup for `isWalledStudent`
and would reuse that exact query with zero extra DB cost — but layouts don't get the
current pathname cleanly in the App Router, and `/quiz` lives in the *same* route
group as everything else under `(dashboard)`. `/onboarding` requires `geniusType` to
already be set and redirects to `/quiz` if it isn't
(`app/(onboarding)/onboarding/page.tsx:17`) — so blocking at the layout level with no
clean pathname exemption would create a redirect loop: dashboard-layout → `/onboarding`
→ `/quiz` → (still wrapped by dashboard-layout) → `/onboarding` → ...

`proxy.ts` naturally operates in terms of `pathname`, so exemption is trivial and this
loop can't occur.

## Exemptions & loop safety

- `/onboarding` and `/quiz` are already in `proxy.ts`'s existing `isPublic` list
  (session-gate exempt); the onboarding check exempts them explicitly too, on top of
  a blanket `/api/*` exemption (broader than the current `isPublic` API allowlist,
  which only covers `/api/auth`, `/api/admin`, `/api/webhooks`). Without the full
  `/api` exemption, the onboarding page's own `PATCH /api/profile` call — and every
  other authenticated API call made by an incomplete user — would get an HTML redirect
  back instead of JSON and silently break.
- No new loop risk: `/onboarding`'s own page logic (pre-existing, untouched) already
  redirects to `/dashboard` if already complete and to `/quiz` if `geniusType` is
  missing. `proxy.ts` only ever pushes incomplete students *toward* `/onboarding`,
  never away from it.
- Sign-out: the sign-out server action posts to whatever page invoked it. Since an
  incomplete student is always parked on `/onboarding` (exempt), sign-out from there
  works. Whether `/onboarding` currently exposes a sign-out control wasn't verified —
  worth a quick check during implementation, but not a blocker for this design.

## Data behavior

- No JWT/session changes. Every request re-checks Prisma fresh — existing incomplete
  real accounts (Leah, shlok madhekar, etc.) get swept into `/onboarding` on their very
  next page load after this deploys, automatically. No forced logout, no backfill
  migration needed.
- New registrations with no `Profile` row yet: `profile` reads as `null`, so
  `schoolId`/`onboardingComplete` both evaluate falsy → correctly treated as "needs
  onboarding."
- Cost: one extra indexed `findUnique` per request, only for logged-in requests to
  non-exempt paths. Same query shape already used elsewhere in this codebase
  (`lib/accountGate.ts`'s `isWalledStudent`).

## Out of scope (explicitly deferred)

- Enforcing ORG accounts to finish `/orgs/new` before using the rest of the app — a
  separate, parallel flow, not addressed here.
- Any change to how `onboardingComplete` is computed or stored — only enforcement of
  the existing flag.
- A sign-out affordance on `/onboarding`, if missing — noted above, not a blocker.
