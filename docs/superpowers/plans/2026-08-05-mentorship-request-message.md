# Mentorship Request Message — Design Spec
_2026-08-05_

## Problem
Students can send a `ConnectionRequest` to a mentor ("Request Mentorship" button on `/my-school` and friends) but can't say *why* — no message field exists. Worse: the mentor side of the flow was never built. `PATCH /api/connections/[id]/respond` exists but nothing in the UI calls it, so every request sits as `PENDING` forever and never reaches the school admin's `/school/connections` approval queue (which only surfaces `ACCEPTED` requests). Adding a message is pointless without also building the missing mentor inbox — this spec does both, since one is dead weight without the other.

Builds directly on `2026-07-16-school-connections-design.md` (request/accept/approve flow, already implemented). Nothing in that spec's data model or approval flow changes — this only adds a `message` field and the missing mentor-side UI.

## Data model
Add one nullable column via manual migration (per this repo's Prisma pattern — schema edits need a hand-written `prisma/migrations/*/migration.sql` or `migrate deploy` crashes on boot):

```prisma
model ConnectionRequest {
  ...
  message String?   // optional note from the requester, shown to the mentor and school admin
}
```

## Request flow changes
**`POST /api/connections/request`** — body becomes `{ toUserId, message?: string }` (max ~500 chars, trimmed; empty string stored as `null`). No other validation changes.

**UI** — the three "Request Mentorship" buttons (`AlumniDirectory.tsx`, `SchoolHubClient.tsx`, `AlumniClient.tsx`) stop firing the POST directly on click. Click opens a small modal (mentor name/photo header, textarea, Send/Cancel) instead; Send does the existing fetch with the message included. Cancel/no-message still sends (message is optional, not required).

## Mentor inbox (new — the missing piece)
`/mentorship` (`app/(dashboard)/mentorship/page.tsx`) currently redirects any non-walled-student straight to `/dashboard`. Change: also let through any user who has at least one `PENDING` incoming `ConnectionRequest` (`toUserId = session.user.id`). Walled students see their existing assigned-mentor thread unchanged; everyone else who reaches this route now sees an "Incoming Requests" list instead:
- One row per pending request: requester name/photo, their message (if any), Accept / Decline buttons.
- Accept/Decline call the existing `PATCH /api/connections/[id]/respond` — unchanged endpoint, first real caller.
- Accepted requests disappear from this list (they move to the school admin's queue next, per the existing 07-16 flow).

No new route — reuses `/mentorship`, gated by a new server-side query alongside the existing `isWalledStudent` check.

## Approval queue
`/school/connections` (`ConnectionsClient.tsx` + its `page.tsx` query) — include `message` in the row select and render it under the requester/target line so the admin has context before creating the room.

## Room creation — seed the first message
`app/api/school/connections/[id]/approve/route.ts` — after `createPrivateRoom(...)` succeeds, if `connectionRequest.message` is non-null, insert one `Message` row in the new conversation: `senderId: fromUserId`, `content: connectionRequest.message`. So the mentor opens the room and the student's original ask is already sitting there — no re-explaining.

## Non-goals
- No edit/delete of a sent message.
- No re-request-with-new-message after a decline (existing 409 "request already exists" behavior for PENDING/ACCEPTED pairs is unchanged; a DECLINED request is not currently re-requestable, out of scope to change here).
- No push/email notification on new incoming request — inbox is pull-only (matches existing notifications-tab scope elsewhere).
