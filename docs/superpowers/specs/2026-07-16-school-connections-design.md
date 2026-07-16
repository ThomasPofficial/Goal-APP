# School Connections — Design Spec
_2026-07-16_

## Problem
Students, alumni, and teachers within a school have no way to request a 1:1/small-group connection that turns into a private chatroom. The one existing UI gesture toward this — a "Request Mentorship" button on `/my-school`'s alumni/mentor cards — is a dead stub: `onRequest` only sets local React state (`setRequestedIds`), no backend call is ever made.

This spec covers the request → accept → teacher-approved room flow. It reuses existing infrastructure rather than building new: the `Conversation`/`ConversationParticipant` models, the `COMMUNITY` conversation type, and the admin-only room-creation code in `/api/communities/rooms` (see `2026-07-02-school-community-rooms-design.md`) are all unchanged and reused as-is.

## Scope boundary vs. existing systems
- **Admin-curated mentorship pairing** (`/mentorship`, `/school/mentorship`, `ConversationType.MENTORSHIP`) is untouched — this is a separate, teacher-initiated bulk-pairing flow and stays as-is.
- **The school general room** (`ensureSchoolGeneralRoom` in `lib/communities.ts`) already exists and is fully implemented — auto-creates/find a `COMMUNITY` conversation with `isPrivateRoom: false` per school and upserts the calling user as a participant. It's already called from `/communities`, `alumni/verify`, `enter-school-code`, and `setup-profile`. It is **not** called from the two HQ admin roster-add routes — that's the only gap here (see "General room wiring" below).

## Account types in scope

Per `docs/account-types-design.md`'s 4-type taxonomy, this feature touches exactly two of them:
- **Student** (`role=STUDENT`, `schoolId` set, `isAlumni=false`) and **Alum** (`role=STUDENT`, `schoolId` set, `isAlumni=true`) — both use `/my-school` today and get the Connect button/request UI. No change to which account types can reach `/my-school`.
- **Admin/Teacher** (`role=SCHOOL`) — gets the new `/school/connections` approval queue.

**Explicitly untouched:** Standard (`schoolId=null`) never reaches `/my-school` (existing gate unchanged) so never sees Connect UI. ORG role and the site-wide super-admin (`role=ADMIN`, `team.nivarro@gmail.com`) have no surface in this feature at all — no new endpoint should accept either role.

**Auth checks, spelled out explicitly** (to avoid repeating known bug #4 from the account-types audit, where `isOrg = role==="ORG" || role==="ADMIN"` let ADMIN silently inherit ORG nav — every check below uses a direct, single-purpose comparison, not a shared/aliased flag):
- `/api/connections/request`, `/api/connections/[id]/respond`, `/api/connections/my-requests` — any authenticated user with a resolvable `schoolId` (via the same `getSchoolId` helper pattern as `/api/communities/rooms/[id]/members`); SCHOOL-role users resolve to their own id as `schoolId` per that same helper, but a SCHOOL-role user calling `/request` should be rejected — this feature's requester is always a Student/Alum, not the teacher (teacher only approves, per confirmed non-goal). Add an explicit `if (user.role === 'SCHOOL') return 403` at the top of `/request`, not an inferred check.
- `/api/school/connections`, `/api/school/connections/[id]/approve` — `role === 'SCHOOL'` only, checked directly (mirrors the existing check in `/api/communities/rooms` POST). No ADMIN carve-in.
- `/school/connections` page — server-side redirect to `/dashboard` for any non-SCHOOL role, same pattern as `app/(hq)/hq/page.tsx`'s `role !== "ADMIN"` redirect.

## Data model

New model, added via manual migration per this repo's Prisma pattern:

```prisma
model ConnectionRequest {
  id           String    @id @default(cuid())
  schoolId     String
  fromUserId   String
  toUserId     String
  status       ConnectionRequestStatus @default(PENDING)
  roomId       String?   // set once a teacher approves and the room is created
  createdAt    DateTime  @default(now())
  respondedAt  DateTime?

  @@index([schoolId, status])
  @@index([toUserId])
}

enum ConnectionRequestStatus {
  PENDING
  ACCEPTED
  DECLINED
}
```

`roomId` references an existing `Conversation.id` (the private room created on approval) — no FK constraint needed beyond app-level lookup, consistent with other loosely-coupled references in this schema.

## Request / accept flow

**POST `/api/connections/request`** — body: `{ toUserId }`
- Resolves `fromUserId` from session, looks up both users' `schoolId` (same `getSchoolId` pattern used in `/api/communities/rooms/[id]/members/route.ts` — SCHOOL-role user's own id IS their schoolId, everyone else via `profile.schoolId`).
- Rejects (400) if `fromUserId`/`toUserId` aren't in the same school.
- Rejects (400) if **both** users are plain students (`role !== 'SCHOOL'` and `isAlumni === false` for both sides) — enforces the "no pure student↔student" rule server-side. At least one side must be alumni or SCHOOL-role.
- Rejects (409) if a PENDING or ACCEPTED request already exists between the same pair (either direction).
- Creates `ConnectionRequest` with `status: PENDING`.

**PATCH `/api/connections/[id]/respond`** — body: `{ action: 'accept' | 'decline' }`
- Only `toUserId` may respond.
- Sets `status` to `ACCEPTED` or `DECLINED`, sets `respondedAt`.
- No room is created here — ACCEPTED just makes the request visible in the teacher's queue.

**GET `/api/connections/my-requests`** — lists the current user's incoming/outgoing requests (for showing pending/sent state on `/my-school` cards, replacing the current fake `requestedIds` local state with real data).

## Teacher approval flow

**GET `/api/school/connections`** (SCHOOL-role only) — lists ACCEPTED requests for the admin's school where `roomId IS NULL`, plus a history list of already-fulfilled ones.

**POST `/api/school/connections/[id]/approve`** (SCHOOL-role only)
- Loads the `ConnectionRequest`, verifies `status === 'ACCEPTED'` and `roomId IS NULL`.
- Creates the private room using the same logic as `/api/communities/rooms` POST (`type: COMMUNITY, schoolId, isPrivateRoom: true, communityName` derived from the two display names, participants: `[fromUserId, toUserId]`) — factored into a shared helper in `lib/communities.ts` so both call sites use identical logic rather than duplicating it.
- Sets `roomId` on the `ConnectionRequest`.
- Adding further participants to this room later goes through the existing `/api/communities/rooms/[id]/members` POST, unchanged (SCHOOL-role only, per existing behavior — no permission changes).

## UI surfaces

**`/my-school` (`SchoolHubClient.tsx`)** — student/alumni side:
- `MentorCard` and `AlumnusCard`'s `onRequest` stub is replaced with a real `POST /api/connections/request` call; `requestedIds` local state is replaced by data from `GET /api/connections/my-requests` (so "Sent"/pending state survives a page reload, unlike today).
- A Connect button is added to the Staff section (currently has none).
- Direction shipped in v1: student/alumni (viewer) → alumni/teacher (target) — the only direction with an existing browse UI. Backend allows any non-student↔student pair, but alumni-initiates-to-student and teacher-initiates have no browse surface yet and are out of scope here (fast-follow).

**`/school/connections`** (new page, SCHOOL-role only, parallel to existing `/school/mentorship` and `/school/roster`):
- Queue of ACCEPTED requests awaiting approval, one-click "Create Room" per row (calls the approve endpoint).
- History section below showing already-approved requests and a link into each resulting room.

## General room wiring (the one existing-system gap)

`app/api/hq/schools/[schoolId]/members/route.ts` (POST, single member add) and `app/api/hq/schools/[schoolId]/import/route.ts` (CSV bulk import) each create a new `User` (+ `Profile` with `schoolId` set) but never call `ensureSchoolGeneralRoom`. Add a call to `ensureSchoolGeneralRoom(schoolId, newUserId)` right after each user is created in both routes, so anyone added through the internal admin dashboard is automatically in their school's general room — matching the behavior users already get via self-serve paths (school code entry, alumni verify).

## Non-goals for v1
- No "my connections" list/directory view beyond the resulting chatroom itself.
- No un-connect / leave-room flow.
- No teacher-initiated connect requests — teacher's role is approval only, per confirmed scope.
- No alumni-initiates-to-student or teacher-initiates browse UI (backend supports the pair, UI doesn't ship it yet).
- No changes to `ConversationType.MENTORSHIP` admin-curated pairing — fully separate system, untouched.

## What is NOT changing
- `Conversation`, `Message`, `ConversationParticipant` models (only referenced, not altered)
- `/api/communities/rooms` and `/api/communities/rooms/[id]/members` (reused as-is / factored into a shared helper, not behaviorally changed)
- `ensureSchoolGeneralRoom` (reused as-is)
- Admin-curated mentorship pairing (`/mentorship`, `/school/mentorship`)
