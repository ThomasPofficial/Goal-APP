# School Community Chat — Design

**Date:** 2026-07-02
**Status:** Approved (pending spec review)

## What

Paid schools get a private community chat on `/communities`:

1. **Main Room** — one big chat for the whole school. Every student with that school's `schoolId` is auto-joined. Real names, avatars, and contact info (email/phone) are visible because it's a private, trusted space.
2. **Private Rooms** — the school admin account (`role=SCHOOL`) creates sub-rooms and hand-picks which students are in them.

**Scope guard:** this only changes what school-affiliated accounts see. Normal (non-school) student accounts keep the exact current `/communities` page — the hardcoded marketing grid — completely untouched. Org accounts are unaffected (no `/communities` in their nav).

## Architecture: Extend the existing Conversation model (Option A)

Reuse the existing messaging stack (Conversation / ConversationParticipant / Message, `/api/conversations/[id]/messages`, socket.io via `lib/socket.ts`) rather than building a parallel system. The chat UI mirrors `MessagesClient` exactly — same socket wiring (`join_conversation` / `conversation_message`), same message send/load flow, same liveness behavior as `/messages` has today.

## Schema changes

```prisma
enum ConversationType {
  DIRECT
  GROUP
  TEAM
  SCHOOL   // new
}

model Conversation {
  // existing fields...
  schoolId    String?   // User.id of the school account (role=SCHOOL)
  name        String?   // room name, e.g. "Main Room" or admin-chosen
  isMain      Boolean   @default(false)  // true for the school's main room
  createdById String?   // school admin who created a private room
}
```

- One manual SQL migration (project convention: manual migrations, applied by `prisma migrate deploy` at startup via `scripts/start.js`).
- Main room uniqueness: enforced in application logic via find-or-create on `{ type: SCHOOL, schoolId, isMain: true }`.

## Membership rules

- **Main room, auto-join (lazy):** when a user with a `schoolId` (or the school account itself) loads `/communities`, the server finds-or-creates the school's main room and upserts a `ConversationParticipant` for them. No manual join step.
- **Private rooms:** only the school admin creates them, names them, and picks members from the school roster (profiles where `schoolId` matches). Only the creator can add/remove members afterwards. Students cannot leave/join on their own (keeps v1 simple).
- **Membership check for messages:** unchanged — the existing messages API already gates on `ConversationParticipant`.

## API

| Endpoint | Method | Who | Does |
|---|---|---|---|
| `/api/school-rooms` | GET | school student or school admin | Auto-joins main room (find-or-create + upsert participant), returns main room + private rooms the user is in, with participant profiles (name, avatar, handle, email, geniusType) |
| `/api/school-rooms` | POST | school admin only | Create private room: `{ name, memberProfileIds }` → creates `SCHOOL` conversation with participants |
| `/api/school-rooms/[id]/members` | PATCH | room creator only | `{ add: userId[], remove: userId[] }` |
| `/api/conversations/[id]/messages` | GET/POST | participants | **Unchanged** — reused as-is |

Roster search for the member picker reuses the school-scoped profile query pattern from `my-school/page.tsx` (profiles where `schoolId` matches), either inline in the POST page load or via a small `GET /api/school-rooms/roster` endpoint.

## `/communities` page behavior

`page.tsx` branches on the session user:

- **No `schoolId` and not a school account** → render the current hardcoded grid, byte-for-byte unchanged.
- **School-affiliated** (student with `schoolId`, or `role=SCHOOL` account) → render new `SchoolCommunityClient`:
  - **Left:** room list — Main Room pinned first, then private rooms the user belongs to.
  - **Right:** chat thread — same structure as `MessagesClient` (message bubbles, grouped consecutive messages, Enter-to-send textarea, socket join/leave on room switch).
  - **Member panel:** toggleable list of room members showing avatar, display name, handle, genius type badge, and email (contact info is intentionally visible in this private space).
  - **Admin extras** (school account only): "Create private room" button → modal with room name + searchable member checklist from the school roster; member add/remove on rooms they created.

Messages sent by the school admin display with the school's name/avatar.

## Not in v1 (YAGNI)

- Students creating rooms, leaving rooms, or muting
- Read receipts / unread badges in the sidebar
- Message deletion or editing in rooms
- Phone numbers (Profile has no phone field today — email + handle is the contact info shown; add phone later if schools ask)

## Error handling

- Non-participant hitting a room's messages → existing 403 from messages API.
- Non-admin calling POST/PATCH school-rooms → 403.
- Student with a `schoolId` pointing at a deleted school user → treated as non-school (falls back to the static grid).

## Testing

- Seed (or reuse) a school account + 2–3 students sharing its `schoolId` (seed-school-mock endpoint already exists).
- Verify: main-room auto-join on first visit for both students and the school account; messages persist and appear across two logged-in browsers (same liveness as `/messages` — socket if `NEXT_PUBLIC_SOCKET_URL` is set, otherwise on load/refresh); private room creation, member picking, and that non-members can't see or post to it; a normal no-school student still sees the original static grid.
