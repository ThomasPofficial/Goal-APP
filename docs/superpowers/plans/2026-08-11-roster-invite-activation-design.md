# Roster Invite & Account Activation — Design Spec

**Date:** 2026-08-11
**Status:** Approved, ready for implementation plan

## Overview

Today, when a school admin/teacher adds a student, alum, or staff member on `/school/roster` (single add or CSV import), the new account is created with a random, unusable password hash. The person has no way to ever log in — there's no invite or activation step at all.

This spec fixes that: every newly-added roster member gets a real, working activation link a teacher can hand to them (copy/paste, since automatic email sending isn't wired up yet), and the roster UI clearly shows who's activated their account and who's still pending. The actual "send this automatically via email" step is stubbed behind one clearly-marked function so a later agent can wire in real delivery without touching anything else.

**Coordination note:** a separate, concurrent agent is implementing `docs/superpowers/specs/2026-07-08-account-role-system-design.md` (permission tiers for school admins). That spec explicitly calls "staff invite email polish" out of scope for itself, so intent doesn't overlap. The one shared file both efforts may touch is `app/api/school/roster/members/route.ts` — changes here are additive (new helper call + response field) to keep merges easy.

## Scope

**In scope:**
- `/school/roster` single "Add Member" flow (Students / Alumni / Staff)
- `/school/roster` CSV import flow
- Roster UI: activation status per member, invite-link retrieval

**Out of scope (explicitly not built here):**
- Real automatic email sending — stubbed, see "Stubbed Send" below
- `/hq` (Nivarro internal super-admin tool) — teachers don't use this surface; can get the same treatment later using the same helpers
- Any permission/role-tier gating of who is allowed to invite whom — owned by the concurrent permissions-tier work
- Rate limiting on invite generation

## Data Model

No new tables. One existing, currently-unused field gets a job: `User.emailVerified: DateTime?` (a standard NextAuth field already in `prisma/schema.prisma`, never read or written anywhere in the codebase today — confirmed via repo-wide search).

- `null` = account has never been activated (roster-created stub, or a legacy account from before this feature)
- non-null = the person has set their own password and the account is real

Set at creation time:
- Self-serve `/api/auth/register` → `emailVerified: new Date()` (they picked their own password)
- Roster single-add / CSV import (new user branch) → left `null`

**Scope trim (2026-08-11, during planning):** seed/demo account routes (`/api/admin/seed-*`, ~10 create sites across 4 dev-only files) are intentionally left untouched — they're internal tooling real users never go through, and sweeping all of them is unrelated churn for a purely cosmetic effect (a demo account might show a "Setup Pending" badge in a demo roster view, which is harmless).

Set at claim time:
- Successful password claim via the reused reset flow (see below) → `emailVerified: new Date()`

No migration file needed for a new column since the field already exists in the schema and database.

## Activation Mechanism (reuses existing password-reset infra)

`PasswordResetToken` + the `resetPassword(token, password)` server action (`app/actions/auth.ts`) already do exactly what account activation needs: hand someone a link, they set a password. `resetPassword` is purpose-agnostic — it just sets whatever email owns the token to a new password. It gets one addition: also stamp `emailVerified: new Date()` on successful claim (harmless no-op for someone doing a normal password reset who's already activated).

New helper, `lib/account-invite.ts`:

```
createAccountInvite({ email, name }): Promise<{ activateUrl: string }>
```
1. Delete any existing `PasswordResetToken` for this email (same dedup behavior as `requestPasswordReset`)
2. Generate raw + hashed token, store with a **7-day** expiry (longer than the 1-hour password-reset window — this is a "get around to it" invite, not an urgent security action)
3. Build `activateUrl = ${appUrl}/activate-account?token=<rawToken>`
4. Call the stubbed `sendInviteEmail({ to: email, name, activateUrl })`
5. Return `{ activateUrl }` so the caller (API route) can hand it back to the UI for the "copy link" action

### Stubbed send

`lib/invite-email.ts`, shaped like the existing `lib/welcome-email.ts` so a later agent's diff is just "fill in the Resend call":

```
sendInviteEmail({ to, name, activateUrl }): Promise<{ id: string | null }>
```
Body for now: `console.log` the invite details and a `// TODO(email-integration): wire real Resend send here, see lib/welcome-email.ts for the pattern` comment. Returns `{ id: null }`. Never throws — a failed/stubbed send must not block account creation.

### New page: `/activate-account`

Under `app/(auth)/`, reusing the existing auth page layout/styling. Reads `?token=` the same way `/reset-password` does, and calls the same `resetPassword(token, password)` action underneath — just different copy: "Welcome to Nivarro — set your password to activate your account" instead of "Reset your password." Same error states (invalid/expired token → link back to contacting their school admin, since there's no self-serve resend on this page).

## API Changes

- `app/api/school/roster/members/route.ts` (POST, single add): after creating a **new** user (existing-user-update branch is unaffected), call `createAccountInvite` and include `activateUrl` in the response JSON.
- `app/api/school/roster/import/route.ts` (POST, CSV import): same, for each newly-created row. Response gains an `invites: { email, name, activateUrl }[]` array alongside the existing `imported`/`skipped`/`errors` counts.
- New: `app/api/school/roster/members/[userId]/resend-invite/route.ts` (POST) — for a member whose `emailVerified` is still `null`, calls `createAccountInvite` again (fresh token, since the old one may have expired) and returns the new `activateUrl`. 404s if the member's account is already activated.

## UI Changes (`RosterClient.tsx`)

Wording is plain-language for a non-technical school admin, while keeping precise technical terms (like "CSV") where teachers already expect them from the button that's already there.

**Add Member modal**, on success: instead of just closing, show an inline confirmation panel in place of the form:
> "**Jane Smith has been added.** We don't send this automatically yet — copy the link below and send it to her (text, email, whatever's easiest) so she can set up her password and log in."
> `[ Copy Invite Link ]` button, then a "Done" button to close.

**Member row list**, add a small status badge next to the existing role badge:
- Not yet activated → **"Setup Pending"** (muted/amber outline, not alarming-red — this is expected/normal for a freshly-added member, not an error state)
- Activated → no extra badge (keeps the row clean; absence of the pending badge *is* the "active" signal)

For rows showing "Setup Pending," add one more row action next to Edit/Remove:
- **"Copy Invite Link"** button — calls the resend-invite endpoint under the hood (always fresh, so it works even if the original link expired) and copies straight to clipboard, with a small "Copied!" toast/confirmation.

**CSV Import modal, Step 3 (result screen)**: below the existing "✓ N members imported" line, if `invites.length > 0`:
> "Since we don't send these automatically yet, here are their setup links to share:"
- A scrollable list: `name — email — [ Copy Link ]` per row
- A **"Copy All Links"** button at the top of the list that copies a plain-text block (`Name <email>: <link>` per line) for pasting into an email/spreadsheet in one go

## What's Explicitly Not Included

- Real automatic email delivery (stub only, see above)
- `/hq` super-admin surface parity
- Any change to who is *allowed* to invite (permission tiers — separate concurrent work)
- Rate limiting / abuse prevention on invite/resend generation
- Bulk "resend all pending" action (each pending member can be resent individually; a bulk version can be a fast follow once real email lands and the volume matters)
