# School Community Rooms — Design Spec
_2026-07-02_

## Problem
The `/communities` page is a static placeholder. School accounts (paying customers) need a real, private communication layer: one big general room auto-populated with all school-linked users, plus admin-created private rooms for targeted groups.

## Users in scope
Three account types can participate in school community rooms — all must have `profile.schoolId` set to the same school:
1. **Alumni** — `User.isAlumni = true`
2. **School Admin** — `User.role = SCHOOL`
3. **School-affiliated students** — regular students with `profile.schoolId` set (joined via school code)

General students with no `schoolId` see a gate ("Your school hasn't activated Nivarro yet").

## Rooms
- **General Room** — one per school, auto-created when the school is set up. Every user who links to the school is auto-added as a participant.
- **Private Rooms** — admin-only creation. Admin selects any subset of school users (any type) and names the room. Members can be added/removed later.

## Profile info visible in rooms
Because these are private, trusted school communities, messages show full profile context: display name, avatar, email, and phone number. Phone is a new optional field on `Profile`.

## Schema changes
```
// ConversationType enum → add COMMUNITY
// Conversation model → add:
//   schoolId        String?  (school User.id)
//   isPrivateRoom   Boolean  @default(false)
//   communityName   String?
// Profile model → add:
//   phone           String?
```

## API surface
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/communities/rooms` | List all community rooms the current user is in (for their school) |
| POST | `/api/communities/rooms` | Admin only — create a private room with selected participant IDs |
| GET | `/api/communities/rooms/[id]/members` | List members of a room with full profile info |
| POST | `/api/communities/rooms/[id]/members` | Admin only — add members to a private room |
| DELETE | `/api/communities/rooms/[id]/members/[userId]` | Admin only — remove member |

Messages use the existing `/api/conversations/[id]/messages` GET + POST routes unchanged.

## Page: `/communities` (rewrite)
- **Non-school user:** static gate, no rooms shown
- **School user:** split view — room list on left, chat on right (same layout as `/messages`)
  - General Room always appears first, pinned
  - Private rooms listed below
  - Admin sees "+ New Room" button that opens a member picker modal
  - Messages show full name + avatar + email + phone badge

## Auto-join trigger
Whenever `profile.schoolId` is set (school code entry, admin setup, alumni verify), a server-side helper `ensureSchoolGeneralRoom(schoolId, userId)` is called. It finds or creates the school's general COMMUNITY conversation and upserts the user as a participant.

## What is NOT changing
- Existing `Conversation`, `Message`, `ConversationParticipant` models (only extended)
- `/api/conversations/[id]/messages` routes
- WebSocket socket.io events (`join_conversation`, `conversation_message`)
- `MessagesClient` component (reused, not replaced)
- General student experience (orgs, teams, DMs, etc.)
