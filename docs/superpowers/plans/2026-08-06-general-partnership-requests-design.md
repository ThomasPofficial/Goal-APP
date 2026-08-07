# General Partnership Requests — Design

**Status:** Approved, ready for implementation planning.

## Problem

Today, `/my-school` lets a walled student (or alumni) send a **1:1 request** to exactly one alumni or staff/teacher member (`POST /api/connections/request`, backed by `ConnectionRequest`). Pure student↔student requests are blocked. The target accepts/declines on `/mentorship`, then a school admin must separately approve the accepted request (`/api/school/connections/[id]/approve`) before a private room is created.

This is too narrow. Students need a general way to request being grouped with **any group of any type of people** within their school — students, alumni, and teachers — not just a single mentor.

## Decisions

1. **Group requests, not 1:1.** A single request can target any number of invitees, mixing students/alumni/staff freely.
2. **Replaces the existing 1:1 flow entirely** — no separate "quick mentor request" path survives alongside it.
3. **Safety guardrail kept:** every request must include at least one alumni or staff/teacher member among the invitees (no pure student-only group), matching today's rule. Re-checked at finalize time against the *accepted* set only — if every alumni/staff invitee declines and only students accepted, the request expires empty rather than silently becoming a student-only group.
4. **Admin approval stays required** before any room is created — consistent with the existing oversight layer for a platform serving minors.
5. **Group forms from whoever accepts**, not from unanimous accept. A 48-hour auto-finalize window closes out the request: after 48h from creation, it finalizes based on responses received so far (no manual "lock it in" step for the requester).
6. **Invite pool = the whole school.** Any student, alumni, or staff member in the requester's school is invitable — the `isAvailableToMentor`-only restriction on students/alumni is dropped for this flow. (Note: `isAvailableToMentor` itself is untouched as a field/toggle; it's just no longer used to *filter* who's invitable here.)
7. **No cap on group size.**
8. **Renamed to "Partnerships"** in all student-facing nav/copy, since this is no longer "mentorship"-specific.

## Data model

Replace `ConnectionRequest` (single `toUserId`) with two models:

```prisma
model PartnershipRequest {
  id          String                  @id @default(cuid())
  schoolId    String
  fromUserId  String
  message     String?
  status      PartnershipRequestStatus @default(PENDING)
  roomId      String?
  expiresAt   DateTime
  createdAt   DateTime                @default(now())
  finalizedAt DateTime?
  invites     PartnershipInvite[]

  @@index([schoolId, status])
}

model PartnershipInvite {
  id          String                @id @default(cuid())
  requestId   String
  request     PartnershipRequest    @relation(fields: [requestId], references: [id])
  userId      String
  status      PartnershipInviteStatus @default(PENDING)
  respondedAt DateTime?

  @@index([requestId])
  @@index([userId, status])
}

enum PartnershipRequestStatus {
  PENDING           // within the 48h window, still collecting responses
  AWAITING_APPROVAL // window closed, >=1 eligible accepter, waiting on school admin
  APPROVED          // admin approved, roomId set
  EXPIRED_EMPTY     // window closed, no eligible accepted group (0 accepters, or no alumni/staff among accepters)
  REJECTED          // admin rejected
}

enum PartnershipInviteStatus {
  PENDING
  ACCEPTED
  DECLINED
}
```

`expiresAt` is set to `createdAt + 48h` at creation. This replaces `ConnectionRequest`/`ConnectionRequestStatus` outright — all four current consumers (`/my-school`, `/mentorship`, `/school/mentorship`, `/api/school/connections`) are being rewritten as part of this change, so there's no parallel-model migration concern.

**Rejected alternative:** keeping `ConnectionRequest` as-is and wrapping multiple rows in a "PartnershipGroup" join model. Rejected because it duplicates the accept/decline state machine across two levels for no benefit — a single request-with-child-invites model is simpler to query and reason about.

**Dropped:** today's dedupe check ("block a new request if one's already pending/accepted between the same two people") does not generalize cleanly to overlapping groups and is dropped. The admin approval queue is the spam control instead.

## Request lifecycle

1. **Create** — Student picks any number of people (any type) on `/my-school`, writes an optional message, submits.
   - `POST /api/partnerships/request` — body `{ toUserIds: string[], message?: string }`.
   - Server validates: requester role ≠ `SCHOOL`; requester not in `toUserIds`; all `toUserIds` share requester's `schoolId`; at least one invitee is alumni or staff (`isAlumni` or `profile.staffTitle` set).
   - Creates `PartnershipRequest` (`status: PENDING`, `expiresAt: now + 48h`) + one `PartnershipInvite` per invitee (`status: PENDING`).

2. **Respond** — Each invitee sees the incoming request on `/partnerships`, including who else was invited and their current status (transparency — no guessing who else is in the group).
   - `PATCH /api/partnerships/invites/[inviteId]/respond` — body `{ action: "accept" | "decline" }`. Only the invite's own `userId` may respond; only while the parent request is still `PENDING`.

3. **Finalize (lazy, at 48h)** — No cron/job infra exists in this app; finalization is computed lazily. A shared helper (`lib/partnerships.ts::finalizeExpiredPartnershipRequests(schoolId)`) is called at the top of every `GET` that reads partnership data for a school (`/my-school`, `/api/partnerships/my-requests` used by `/partnerships`, `/api/school/partnerships`). It finds `PENDING` requests in that school past `expiresAt` and:
   - Computes the accepted-invitee set.
   - If that set contains at least one alumni/staff member → `status: AWAITING_APPROVAL`, `finalizedAt: now`.
   - Otherwise (zero accepters, or accepters are all students) → `status: EXPIRED_EMPTY`, `finalizedAt: now`.
   - Any invites still `PENDING` at finalize time are left as-is (their non-response is just not counted) — no need to force them to `DECLINED`.

4. **Admin approval** — `/school/partnerships` (renamed from `/school/mentorship`) shows a queue of `AWAITING_APPROVAL` requests: requester, accepted members, and (for context) everyone else invited with their status.
   - `POST /api/school/partnerships/[id]/approve` — creates the room via the existing `createPrivateRoom(schoolId, [fromUserId, ...acceptedInviteeIds, schoolId], groupName)`, posts the original message into it if present, sets `status: APPROVED`, `roomId`.
   - `POST /api/school/partnerships/[id]/reject` — sets `status: REJECTED`, no room.
   - `groupName` is auto-generated from participant display names (e.g. "Alice, Bob & Carol"), same pattern as today's `${fromName} & ${toName}`.

5. **Requester/invitee visibility into outcome** — `EXPIRED_EMPTY` and `REJECTED` requests are visible to the requester as a plain "didn't go anywhere" state (no admin action needed, no error thrown); `APPROVED` requests surface as a new thread in `/partnerships`' existing thread list (unchanged from today's thread-list mechanism, `GET /api/mentorship/my-threads` → renamed `GET /api/partnerships/my-threads`, still keyed on `ConversationType.MENTORSHIP`).

## UI changes

- **`/my-school`** (`SchoolHubClient.tsx`): directory expands to three sections — Staff, Alumni, Students (currently only shows staff + `isAvailableToMentor` alumni). A "Request a Partnership" toggle switches into multi-select mode across all three sections; selected count + optional message field + submit.
- **`/partnerships`** (renamed from `/mentorship`; `app/(dashboard)/mentorship` → `app/(dashboard)/partnerships`): "Incoming Requests" panel extended to show the full invited group and per-person status, not just a single `fromUser`. Existing chat/idea-board thread UI (already shipped: rename affordance, Idea Board tab) is unchanged.
- **`/school/partnerships`** (renamed from `/school/mentorship`; `app/(dashboard)/school/mentorship` → `app/(dashboard)/school/partnerships`): existing admin-initiated pairing UI stays as a separate "create a pairing directly" tool; a new tab/section is added for the `AWAITING_APPROVAL` queue (approve/reject).
- **Nav:** `Sidebar.tsx`, `SidebarShell.tsx` (`WALLED_BOTTOM_TABS`), `WalledDashboardClient.tsx` — label "Mentorship" → "Partnerships", href `/mentorship` → `/partnerships`. `MessagesClient.tsx` grouping label "Mentorship" → "Partnerships" (cosmetic only).
- **Old routes** (`/mentorship`, `/school/mentorship`) become redirects to the new paths, so existing deep links (e.g. from `/notifications`) keep working.
- **`ConversationType.MENTORSHIP` enum value is left unchanged** — renaming it would force an enum + data migration for zero user-facing benefit. Only display copy and route paths change; the underlying conversation type stays `MENTORSHIP`.

## Edge cases

- Requester can't invite themselves; `SCHOOL`-role accounts can't be requesters (ported from today's checks).
- All invitees must share the requester's `schoolId`.
- Request created with zero eligible (alumni/staff) invitees is rejected at creation time with a 400, before any DB write.
- `EXPIRED_EMPTY` includes both "nobody responded" and "only students accepted" — both surface the same plain "didn't go anywhere" state to the requester; no need to distinguish the reason in the UI.
- An invite can only be responded to once; the API returns 409 on a second response attempt (matches today's `respond` route behavior).

## Out of scope

- Changing the `isAvailableToMentor` field itself, or the existing admin-initiated pairing tool on `/school/partnerships` (kept as-is, just relocated under the renamed route).
- Any change to `ConversationType` enum values or the Idea Board / rename-chat features already shipped on the mentorship thread UI.
