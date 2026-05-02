# Nivarro Messaging System — Design Spec
**Date:** 2026-03-17
**Status:** Approved
**Subagent:** Messaging Subagent

---

## 1. Overview

Full-stack real-time messaging system for the Nivarro platform. Covers contact requests (REST), message delivery (Socket.io), thread management, unread tracking, and message history. Built as a monorepo with a Node.js/Express/Socket.io/MongoDB backend and a React frontend.

---

## 2. Repository Structure

```
Nivarro APP/
├── server/
│   ├── index.js                  # Entry point — Express + Socket.io server
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   ├── middleware/
│   │   └── auth.js               # JWT verification middleware
│   ├── models/
│   │   ├── User.js
│   │   ├── ContactRequest.js
│   │   ├── Thread.js
│   │   └── Message.js
│   ├── services/
│   │   ├── ContactService.js
│   │   ├── ThreadService.js
│   │   └── MessageService.js
│   ├── routes/
│   │   └── contacts.js           # REST routes for contact requests
│   └── socket/
│       └── handlers.js           # Socket.io event handlers
├── client/
│   ├── src/
│   │   ├── socket.js             # Socket.io client instance
│   │   ├── components/
│   │   │   ├── ThreadList.jsx
│   │   │   ├── ChatWindow.jsx
│   │   │   ├── MessageBubble.jsx
│   │   │   ├── TypingIndicator.jsx
│   │   │   └── ContactRequestBanner.jsx
│   │   └── hooks/
│   │       ├── useSocket.js
│   │       ├── useThread.js
│   │       └── useMessages.js
│   └── package.json
├── package.json                  # Root — npm workspaces
└── docs/
```

---

## 3. Data Models

### User
```js
{
  _id: ObjectId,
  name: String,           // required
  email: String,          // required, unique
  photo_url: String,      // optional
  skills: [String],
  bio: String,
  interests: [String],
  location: String,       // optional
  last_seen: Date
}
```

### ContactRequest
```js
{
  _id: ObjectId,
  sender_id: ObjectId,    // ref User
  recipient_id: ObjectId, // ref User
  message: String,        // optional intro message (max 500 chars)
  status: String,         // enum: 'pending' | 'accepted' | 'rejected'
  created_at: Date,
  updated_at: Date
}
```
**Index:** `{ sender_id, recipient_id }` unique — prevents duplicate requests.

### Thread
```js
{
  _id: ObjectId,
  participants: [ObjectId],  // ref User, exactly 2 for DMs
  created_at: Date,
  last_message: {
    sender_id: ObjectId,
    content: String,
    timestamp: Date
  },
  unread_counts: {           // Map: user_id (string) -> count (number)
    "<user_id>": Number
  }
}
```
**Index:** `{ participants: 1 }` — fast lookup of shared thread between two users.

### Message
```js
{
  _id: ObjectId,
  thread_id: ObjectId,   // ref Thread
  sender_id: ObjectId,   // ref User
  content: String,       // max 2000 chars, required
  timestamp: Date,
  read_by: [ObjectId]    // user_ids who have read this message
}
```
**Index:** `{ thread_id: 1, timestamp: -1 }` — fast paginated history queries.

---

## 4. Authentication

- **REST:** `Authorization: Bearer <jwt>` header on all protected routes. Verified by `middleware/auth.js`, which decodes the token and attaches `req.user`.
- **Socket.io:** JWT passed as `{ auth: { token } }` on `io.connect()`. Verified in the `connection` middleware before any event handlers run. Connection rejected if token is invalid.

---

## 5. REST API

All routes prefixed `/api`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/contacts/request` | JWT | Send a contact request (with optional message) |
| GET | `/api/contacts/requests` | JWT | List pending incoming requests for the authenticated user |
| DELETE | `/api/contacts/requests/:id` | JWT | Cancel a sent contact request (sender only) |
| PATCH | `/api/contacts/requests/:id/accept` | JWT | Accept a contact request; creates a thread |
| PATCH | `/api/contacts/requests/:id/reject` | JWT | Reject a contact request |
| GET | `/api/threads` | JWT | List all threads for the authenticated user |
| GET | `/api/threads/:thread_id/messages` | JWT | Paginated message history (`?before=<ISO timestamp>&limit=30`; default limit 30, max 100; omitting `before` returns most recent messages) |

### Accept Contact Request Flow
When a request is accepted:
1. Set `status = 'accepted'` on the ContactRequest
2. Call `ThreadService.createThread(sender_id, recipient_id)` — idempotent (returns existing thread if one exists)
3. Emit `thread_updated` to both users' personal Socket.io rooms so the UI reflects the new thread immediately

---

## 6. Socket.io Architecture

### Connection
```
io.use(authMiddleware)          // Verify JWT, attach socket.user
socket.join(socket.user._id)    // Personal room for unread updates
```

### Client → Server Events

| Event | Payload | Handler |
|-------|---------|---------|
| `join_thread` | `{ thread_id }` | Verify participant, join room |
| `leave_thread` | `{ thread_id }` | Leave room |
| `send_message` | `{ thread_id, content }` | Validate, store, emit to room |
| `mark_read` | `{ thread_id }` | Reset unread count to 0 |
| `typing_start` | `{ thread_id }` | Broadcast to room |
| `typing_stop` | `{ thread_id }` | Broadcast to room |

### Server → Client Events

| Event | Payload | Target Room | Trigger |
|-------|---------|-------------|---------|
| `message_received` | `{ message }` | Thread room | New message in thread |
| `thread_updated` | `{ thread_id, last_message, participant }` | User personal room | Thread created or metadata changed; includes full participant profile (`user_id`, `name`, `initials`, `photo_url`) so the frontend can render without a follow-up fetch |
| `unread_update` | `{ thread_id, unread_count }` | User personal room | Unread count changed for a specific user; sent only to non-sender personal room |
| `user_typing` | `{ thread_id, user_id, name }` | Thread room | Someone is typing |
| `user_stopped_typing` | `{ thread_id, user_id }` | Thread room | Typing stopped |
| `error` | `{ code, message }` | Emitting socket | Validation or delivery failure |

**Event routing rules:**
- `thread_updated` fires on the **user's personal room** only — used by `ThreadList` to update thread previews. Never broadcast to the thread room.
- `unread_update` fires on the **non-sender's personal room** only — used for unread badges. Never broadcast to the thread room.
- `message_received`, `user_typing`, `user_stopped_typing` fire on the **thread room** only — visible only to participants currently in the room.

### Typing Indicator Auto-Clear
Server tracks a `typingTimers` map keyed by `thread_id:user_id`. Each `typing_start` resets the timer to 5 seconds. If no `typing_stop` arrives in 5 seconds, server emits `user_stopped_typing` automatically.

---

## 7. Service Layer

### ContactService
- `sendRequest(senderId, recipientId, message)` — create ContactRequest, reject if duplicate exists
- `acceptRequest(requestId, userId)` — accept, create thread via ThreadService, return thread
- `rejectRequest(requestId, userId)` — reject, return updated request
- `cancelRequest(requestId, userId)` — delete request if status is still `pending` and userId matches sender_id; return 403 otherwise
- `getPendingRequests(userId)` — return all pending requests where recipient = userId

### ThreadService
- `createThread(userIdA, userIdB)` — idempotent: find or create thread between the two users
- `getThreadsForUser(userId)` — return all threads, populate participant profile data, sorted by last activity
- `getThread(threadId, userId)` — return single thread, verify userId is a participant

### MessageService
- `sendMessage(threadId, senderId, content)` — independently verify senderId is a participant in the thread (do not rely on room membership alone), validate content, store Message, update Thread.last_message, increment unread counts for all other participants atomically
- `getHistory(threadId, userId, beforeTimestamp, limit)` — paginated fetch (default limit 30, max 100, most recent if `beforeTimestamp` omitted), verify participant
- `markRead(threadId, userId)` — atomically: set `unread_counts[userId] = 0` on Thread AND bulk-add userId to `read_by` on all messages in the thread where userId is not already in `read_by`

---

## 8. Validation Rules

| Rule | Behavior |
|------|----------|
| Sender must be thread participant (checked on every `send_message`) | Emit `error` `NOT_PARTICIPANT`, do not store |
| Content must be non-empty | Emit `error` `CONTENT_EMPTY` |
| Content max 2000 chars | Emit `error` `CONTENT_TOO_LONG` |
| Thread must exist on `join_thread` | Emit `error` `THREAD_NOT_FOUND` |
| No duplicate contact requests | Return 409 from REST endpoint |
| History only for participants | Return 403 from REST endpoint |
| No messaging without accepted contact | `MessageService.sendMessage` verifies the underlying ContactRequest has `status = 'accepted'` before storing; returns `NOT_PARTICIPANT` error if not |
| Cancel only by sender, only while pending | Return 403 if userId ≠ sender_id or status ≠ 'pending' |

---

## 9. Frontend Components

### ThreadList
- Fetches `/api/threads` on mount
- Listens for `thread_updated` and `unread_update` on personal Socket.io room to keep list live
- Shows participant name, avatar, last message preview (60 chars), unread badge

### ChatWindow
- Joins thread room on open (`join_thread`), leaves on close/unmount (`leave_thread`)
- Fetches initial history via `/api/threads/:id/messages`
- Listens for `message_received` to append new messages
- Emits `typing_start` on keystroke activity (debounced 300ms); emits `typing_stop` when input is cleared or user stops typing (no keystroke for 2 seconds)
- Emits `mark_read` when window is focused and thread is active

### ContactRequestBanner
- Displayed when a user has pending incoming contact requests
- Accept triggers `PATCH /api/contacts/requests/:id/accept`
- Reject triggers `PATCH /api/contacts/requests/:id/reject`

---

## 10. Error Codes

| Code | Meaning |
|------|---------|
| `NOT_PARTICIPANT` | Sender is not in this thread |
| `CONTENT_EMPTY` | Message content is blank |
| `CONTENT_TOO_LONG` | Content exceeds 2000 characters |
| `THREAD_NOT_FOUND` | thread_id does not exist |
| `AUTH_FAILED` | JWT missing or invalid |
| `DUPLICATE_REQUEST` | Contact request already exists |

---

## 11. Packages

### Server
- `express` — HTTP server
- `socket.io` — real-time transport
- `mongoose` — MongoDB ODM
- `jsonwebtoken` — JWT verification
- `dotenv` — environment config
- `cors` — cross-origin for dev

### Client
- `react`, `react-dom`
- `socket.io-client`
- `axios` — HTTP requests

---

## 12. Environment Variables

```
MONGO_URI=mongodb://localhost:27017/nivarro
JWT_SECRET=<secret>
PORT=5000
CLIENT_URL=http://localhost:3000
```
