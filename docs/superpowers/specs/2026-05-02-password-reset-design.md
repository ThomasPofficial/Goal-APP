# Password Reset Feature — Design Spec

## Overview
Simple email-based password reset for Nivarro. User enters email, receives a link, clicks it, sets a new password. Tokens stored in the database, expire after 1 hour.

## Database

Add one model to `prisma/schema.prisma`:

```prisma
model PasswordResetToken {
  id      String   @id @default(cuid())
  email   String
  token   String   @unique
  expires DateTime
}
```

Run `prisma migrate dev` locally or deploy migration via `prisma migrate deploy` on Render (already handled by `scripts/start.js`).

## Email

Provider: **Resend** (`resend` npm package).
Env vars required:
- `RESEND_API_KEY` — from Resend dashboard (already added in Render, needs value)
- `FROM_EMAIL` — verified sender address (e.g. `noreply@nivarro.co`)

## Pages

Both under `app/(auth)/` to reuse the existing centered auth layout.

### `/forgot-password`
- Single email input field
- On submit: calls `requestPasswordReset(email)` server action
- Always shows "If an account exists, you'll receive an email" (no user enumeration)
- Link back to login

### `/reset-password`
- Reads `?token=` from URL on load (server component wrapping client form)
- If token missing/expired: shows error with link to /forgot-password
- New password + confirm password fields (min 8 chars)
- On submit: calls `resetPassword(token, password)` server action
- On success: redirects to `/login`

## Server Actions (in `app/actions/auth.ts`)

### `requestPasswordReset(email: string): Promise<void>`
1. Find user by email — if not found, return silently (no enumeration)
2. Guard: if `user.email` is null, return silently
3. Delete any existing token for this email
4. Generate raw token: `crypto.randomBytes(32).toString('hex')`
5. Hash it: `crypto.createHash('sha256').update(rawToken).digest('hex')`
6. Store `{ email, token: hashedToken, expires: now + 1 hour }` in `PasswordResetToken`
7. Send email via Resend with link `https://nivarro.co/reset-password?token=<rawToken>`

### `resetPassword(token: string, password: string): Promise<{ error: string } | { success: true }>`
1. Hash the incoming token: `crypto.createHash('sha256').update(token).digest('hex')`
2. Find hashed token in DB — if not found: return `{ error: "Invalid or expired link." }`
3. Check `expires > now` — if expired: delete token, return `{ error: "Link has expired. Request a new one." }`
4. Find user by `token.email` — if not found: return `{ error: "Account not found." }`
5. Hash new password with bcrypt
6. Atomically in a `prisma.$transaction`: update user's `passwordHash` + delete the token
7. Return `{ success: true }`

## UI Style
Match existing auth pages: dark background `#0d0d0e`, gold accent `#c9a84c`, same card/input/button styling.

## Login Page Change
Add a small "Forgot password?" link below the password field, styled like the "Create one" link (`text-[#c9a84c]`).

## What's Not Included
- Email change
- Rate limiting (can add later)
- Token rotation on reuse
