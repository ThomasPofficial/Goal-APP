# Nivarro Messaging System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack real-time messaging system with contact requests, Socket.io delivery, thread management, unread tracking, and paginated message history.

**Architecture:** Service-layered Node.js/Express/Socket.io backend with MongoDB (Mongoose) and JWT auth; React frontend. REST handles contact requests; Socket.io handles real-time messaging. Business logic lives in service classes — route/socket handlers stay thin.

**Tech Stack:** Node.js, Express, Socket.io 4, Mongoose 8, jsonwebtoken, React 18, Vite, socket.io-client, axios, Jest 29, supertest, mongodb-memory-server

**Spec:** `docs/superpowers/specs/2026-03-17-messaging-design.md`

---

## File Map

### Server
| File | Responsibility |
|------|----------------|
| `server/index.js` | Express + Socket.io startup; wires middleware, routes, socket handlers |
| `server/config/db.js` | Mongoose connection |
| `server/.env` | Env vars (not committed) |
| `server/.env.example` | Env var template |
| `server/middleware/auth.js` | JWT verification for REST and Socket.io |
| `server/models/User.js` | Mongoose User schema |
| `server/models/ContactRequest.js` | Mongoose ContactRequest schema |
| `server/models/Thread.js` | Mongoose Thread schema |
| `server/models/Message.js` | Mongoose Message schema |
| `server/services/ContactService.js` | Contact request business logic |
| `server/services/ThreadService.js` | Thread find/create/list |
| `server/services/MessageService.js` | Send, history, mark-read |
| `server/routes/contacts.js` | REST: contact request endpoints |
| `server/routes/threads.js` | REST: thread list + message history |
| `server/socket/handlers.js` | Socket.io event handlers |
| `server/tests/helpers.js` | Shared test utilities (mongo setup, JWT factory) |
| `server/tests/services/ContactService.test.js` | Service unit tests |
| `server/tests/services/ThreadService.test.js` | Service unit tests |
| `server/tests/services/MessageService.test.js` | Service unit tests |
| `server/tests/routes/contacts.test.js` | Route integration tests |
| `server/tests/routes/threads.test.js` | Route integration tests |
| `server/tests/socket/handlers.test.js` | Socket handler integration tests |

### Client
| File | Responsibility |
|------|----------------|
| `client/src/socket.js` | Socket.io client singleton |
| `client/src/api.js` | Axios instance with JWT header |
| `client/src/hooks/useSocket.js` | Subscribe/unsubscribe socket events |
| `client/src/hooks/useThread.js` | Thread list state + real-time updates |
| `client/src/hooks/useMessages.js` | Message history + real-time append |
| `client/src/components/ThreadList.jsx` | Thread sidebar |
| `client/src/components/ChatWindow.jsx` | Active conversation view |
| `client/src/components/MessageBubble.jsx` | Single message display |
| `client/src/components/TypingIndicator.jsx` | Animated typing dots |
| `client/src/components/ContactRequestBanner.jsx` | Accept/reject UI |

---

## Chunk 1: Server Foundation

### Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `server/package.json`
- Create: `client/package.json`
- Create: `server/.env.example`
- Create: `server/jest.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "nivarro",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client"
  }
}
```

Save to: `package.json`

- [ ] **Step 2: Create server/package.json**

```json
{
  "name": "nivarro-server",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest --runInBand --forceExit"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.4.0",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "mongodb-memory-server": "^9.3.0",
    "nodemon": "^3.1.3",
    "supertest": "^7.0.0"
  }
}
```

Save to: `server/package.json`

- [ ] **Step 3: Create client/package.json**

```json
{
  "name": "nivarro-client",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1"
  }
}
```

Save to: `client/package.json`

- [ ] **Step 4: Create server jest.config.js**

```js
module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['**/tests/**/*.test.js'],
};
```

Save to: `server/jest.config.js`

- [ ] **Step 5: Create .env.example**

```
MONGO_URI=mongodb://localhost:27017/nivarro
JWT_SECRET=change_me_in_production
PORT=5000
CLIENT_URL=http://localhost:3000
```

Save to: `server/.env.example`

- [ ] **Step 6: Create .gitignore**

```
node_modules/
server/.env
server/coverage/
client/dist/
*.log
```

Save to: `.gitignore`

- [ ] **Step 7: Install dependencies**

Run from `server/` directory:
```bash
cd server && npm install
```

Run from `client/` directory:
```bash
cd client && npm install
```

- [ ] **Step 8: Commit scaffold**

```bash
git add package.json server/package.json client/package.json server/jest.config.js server/.env.example .gitignore
git commit -m "feat: monorepo scaffold with server and client packages"
```

---

### Task 2: DB Config + Test Helpers

**Files:**
- Create: `server/config/db.js`
- Create: `server/tests/helpers.js`

- [ ] **Step 1: Create server/config/db.js**

```js
const mongoose = require('mongoose');

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
}

module.exports = connectDB;
```

- [ ] **Step 2: Create server/tests/helpers.js**

```js
// Set test secret BEFORE any module that reads process.env.JWT_SECRET
process.env.JWT_SECRET = 'test_secret';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongod;

async function startDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function stopDB() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

function makeToken(userId) {
  return jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET);
}

module.exports = { startDB, stopDB, clearDB, makeToken };
```

- [ ] **Step 3: Commit**

```bash
git add server/config/db.js server/tests/helpers.js
git commit -m "feat: DB connection config and test helpers"
```

---

### Task 3: Mongoose Models

**Files:**
- Create: `server/models/User.js`
- Create: `server/models/ContactRequest.js`
- Create: `server/models/Thread.js`
- Create: `server/models/Message.js`

- [ ] **Step 1: Create User model**

```js
// server/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  photo_url: { type: String, default: null },
  skills: [String],
  bio: { type: String, default: '' },
  interests: [String],
  location: { type: String, default: '' },
  last_seen: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
```

- [ ] **Step 2: Create ContactRequest model**

```js
// server/models/ContactRequest.js
const mongoose = require('mongoose');

const contactRequestSchema = new mongoose.Schema(
  {
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, maxlength: 500, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

contactRequestSchema.index({ sender_id: 1, recipient_id: 1 }, { unique: true });

module.exports = mongoose.model('ContactRequest', contactRequestSchema);
```

- [ ] **Step 3: Create Thread model**

```js
// server/models/Thread.js
const mongoose = require('mongoose');

const threadSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    last_message: {
      sender_id: mongoose.Schema.Types.ObjectId,
      content: String,
      timestamp: Date,
    },
    unread_counts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

threadSchema.index({ participants: 1 });

module.exports = mongoose.model('Thread', threadSchema);
// Note: updatedAt is suppressed via `updatedAt: false` to keep the schema clean
```

- [ ] **Step 4: Create Message model**

```js
// server/models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  thread_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread', required: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 2000 },
  timestamp: { type: Date, default: Date.now },
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

messageSchema.index({ thread_id: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
```

- [ ] **Step 5: Commit**

```bash
git add server/models/
git commit -m "feat: add Mongoose models for User, ContactRequest, Thread, Message"
```

---

### Task 4: JWT Auth Middleware

**Files:**
- Create: `server/middleware/auth.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/middleware/auth.test.js`:

```js
process.env.JWT_SECRET = 'test_secret';
const jwt = require('jsonwebtoken');
const { verifyToken, requireAuth, socketAuth } = require('../../middleware/auth');

const SECRET = 'test_secret';
const userId = '507f1f77bcf86cd799439011';

describe('verifyToken', () => {
  it('returns decoded payload for a valid token', () => {
    const token = jwt.sign({ id: userId }, SECRET);
    const result = verifyToken(token, SECRET);
    expect(result.id).toBe(userId);
  });

  it('throws for an invalid token', () => {
    expect(() => verifyToken('bad.token.here', SECRET)).toThrow();
  });

  it('throws for an expired token', () => {
    const token = jwt.sign({ id: userId }, SECRET, { expiresIn: -1 });
    expect(() => verifyToken(token, SECRET)).toThrow();
  });
});

describe('requireAuth', () => {
  function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  it('calls next() and sets req.user for a valid Bearer token', () => {
    const token = jwt.sign({ id: userId }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(userId);
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = makeRes();
    requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for an invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad.token' } };
    const res = makeRes();
    requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('socketAuth', () => {
  it('sets socket.user and calls next() for a valid token', () => {
    const token = jwt.sign({ id: userId }, SECRET);
    const socket = { handshake: { auth: { token } } };
    const next = jest.fn();
    socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.user.id).toBe(userId);
  });

  it('calls next(Error) when token is missing', () => {
    const socket = { handshake: { auth: {} } };
    const next = jest.fn();
    socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('calls next(Error) for an invalid token', () => {
    const socket = { handshake: { auth: { token: 'bad.token' } } };
    const next = jest.fn();
    socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest tests/middleware/auth.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../middleware/auth'`

- [ ] **Step 3: Implement auth middleware**

```js
// server/middleware/auth.js
const jwt = require('jsonwebtoken');

function verifyToken(token, secret) {
  return jwt.verify(token, secret || process.env.JWT_SECRET);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'AUTH_FAILED', message: 'No token provided' });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ code: 'AUTH_FAILED', message: 'Invalid token' });
  }
}

function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('AUTH_FAILED'));
  try {
    socket.user = verifyToken(token);
    next();
  } catch {
    next(new Error('AUTH_FAILED'));
  }
}

module.exports = { verifyToken, requireAuth, socketAuth };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx jest tests/middleware/auth.test.js --no-coverage
```

Expected: PASS (9 tests)

- [ ] **Step 5: Create server/index.js stub** (needed by route tests in Chunk 3)

```js
// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const { requireAuth, socketAuth } = require('./middleware/auth');
const contactRoutes = require('./routes/contacts');
const threadRoutes = require('./routes/threads');
const registerHandlers = require('./socket/handlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.use('/api/contacts', requireAuth, contactRoutes);
app.use('/api/threads', requireAuth, threadRoutes);

io.use(socketAuth);
io.on('connection', (socket) => {
  socket.join(socket.user.id);
  registerHandlers(io, socket);
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB().then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = { app, server, io };
```

Note: The `if (require.main === module)` guard prevents the server from starting when imported by tests. Routes and handlers required here (`contacts.js`, `threads.js`, `handlers.js`) will be created in Chunk 3 — do not run `node index.js` until Chunk 3 is complete.

- [ ] **Step 6: Commit**

```bash
git add server/middleware/auth.js server/tests/middleware/auth.test.js server/index.js
git commit -m "feat: JWT auth middleware with REST and Socket.io variants, server entry stub"
```

---

## Chunk 2: Service Layer

### Task 5: ContactService

**Files:**
- Create: `server/services/ContactService.js`
- Create: `server/tests/services/ContactService.test.js`

- [ ] **Step 1: Write failing tests**

```js
// server/tests/services/ContactService.test.js
const { startDB, stopDB, clearDB } = require('../helpers');
const ContactService = require('../../services/ContactService');
const User = require('../../models/User');
const ContactRequest = require('../../models/ContactRequest');

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

let alice, bob;

beforeEach(async () => {
  alice = await User.create({ name: 'Alice', email: 'alice@test.com' });
  bob = await User.create({ name: 'Bob', email: 'bob@test.com' });
});

describe('sendRequest', () => {
  it('creates a contact request', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id, 'Hey!');
    expect(req.sender_id.toString()).toBe(alice._id.toString());
    expect(req.recipient_id.toString()).toBe(bob._id.toString());
    expect(req.message).toBe('Hey!');
    expect(req.status).toBe('pending');
  });

  it('throws DUPLICATE_REQUEST if request already exists', async () => {
    await ContactService.sendRequest(alice._id, bob._id);
    await expect(ContactService.sendRequest(alice._id, bob._id)).rejects.toMatchObject({
      code: 'DUPLICATE_REQUEST',
    });
  });
});

describe('acceptRequest', () => {
  it('sets status to accepted and returns a thread', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    const thread = await ContactService.acceptRequest(req._id, bob._id);
    expect(thread.participants.map(String)).toEqual(
      expect.arrayContaining([alice._id.toString(), bob._id.toString()])
    );
    const updated = await ContactRequest.findById(req._id);
    expect(updated.status).toBe('accepted');
  });

  it('throws if userId is not the recipient', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await expect(ContactService.acceptRequest(req._id, alice._id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('rejectRequest', () => {
  it('sets status to rejected', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await ContactService.rejectRequest(req._id, bob._id);
    const updated = await ContactRequest.findById(req._id);
    expect(updated.status).toBe('rejected');
  });
});

describe('cancelRequest', () => {
  it('deletes the request if sender and pending', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await ContactService.cancelRequest(req._id, alice._id);
    const found = await ContactRequest.findById(req._id);
    expect(found).toBeNull();
  });

  it('throws FORBIDDEN if not sender', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await expect(ContactService.cancelRequest(req._id, bob._id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws FORBIDDEN if already accepted', async () => {
    const req = await ContactService.sendRequest(alice._id, bob._id);
    await ContactService.acceptRequest(req._id, bob._id);
    await expect(ContactService.cancelRequest(req._id, alice._id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('getPendingRequests', () => {
  it('returns only pending requests for the recipient', async () => {
    await ContactService.sendRequest(alice._id, bob._id, 'Hi');
    const requests = await ContactService.getPendingRequests(bob._id);
    expect(requests).toHaveLength(1);
    expect(requests[0].sender_id.name).toBe('Alice');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest tests/services/ContactService.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../services/ContactService'`

- [ ] **Step 3: Implement ContactService**

```js
// server/services/ContactService.js
const ContactRequest = require('../models/ContactRequest');
const ThreadService = require('./ThreadService');

function appError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function sendRequest(senderId, recipientId, message = '') {
  const existing = await ContactRequest.findOne({ sender_id: senderId, recipient_id: recipientId });
  if (existing) throw appError('DUPLICATE_REQUEST', 'Contact request already exists');
  return ContactRequest.create({ sender_id: senderId, recipient_id: recipientId, message });
}

async function acceptRequest(requestId, userId) {
  const req = await ContactRequest.findById(requestId);
  if (!req || req.recipient_id.toString() !== userId.toString()) {
    throw appError('FORBIDDEN', 'Not authorized to accept this request');
  }
  req.status = 'accepted';
  await req.save();
  return ThreadService.createThread(req.sender_id, req.recipient_id);
}

async function rejectRequest(requestId, userId) {
  const req = await ContactRequest.findById(requestId);
  if (!req || req.recipient_id.toString() !== userId.toString()) {
    throw appError('FORBIDDEN', 'Not authorized to reject this request');
  }
  req.status = 'rejected';
  return req.save();
}

async function cancelRequest(requestId, userId) {
  const req = await ContactRequest.findById(requestId);
  if (!req || req.sender_id.toString() !== userId.toString() || req.status !== 'pending') {
    throw appError('FORBIDDEN', 'Cannot cancel this request');
  }
  await req.deleteOne();
}

async function getPendingRequests(userId) {
  return ContactRequest.find({ recipient_id: userId, status: 'pending' }).populate('sender_id', 'name photo_url');
}

module.exports = { sendRequest, acceptRequest, rejectRequest, cancelRequest, getPendingRequests };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx jest tests/services/ContactService.test.js --no-coverage
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add server/services/ContactService.js server/tests/services/ContactService.test.js
git commit -m "feat: ContactService with send, accept, reject, cancel, list"
```

---

### Task 6: ThreadService

**Files:**
- Create: `server/services/ThreadService.js`
- Create: `server/tests/services/ThreadService.test.js`

- [ ] **Step 1: Write failing tests**

```js
// server/tests/services/ThreadService.test.js
const { startDB, stopDB, clearDB } = require('../helpers');
const ThreadService = require('../../services/ThreadService');
const User = require('../../models/User');
const Thread = require('../../models/Thread');
const Message = require('../../models/Message');

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

let alice, bob;
beforeEach(async () => {
  alice = await User.create({ name: 'Alice', email: 'alice@test.com' });
  bob = await User.create({ name: 'Bob', email: 'bob@test.com' });
});

describe('createThread', () => {
  it('creates a new thread between two users', async () => {
    const thread = await ThreadService.createThread(alice._id, bob._id);
    expect(thread.participants.map(String)).toEqual(
      expect.arrayContaining([alice._id.toString(), bob._id.toString()])
    );
  });

  it('returns existing thread if one already exists', async () => {
    const first = await ThreadService.createThread(alice._id, bob._id);
    const second = await ThreadService.createThread(alice._id, bob._id);
    expect(first._id.toString()).toBe(second._id.toString());
    const count = await Thread.countDocuments();
    expect(count).toBe(1);
  });

  it('is idempotent regardless of participant order', async () => {
    const first = await ThreadService.createThread(alice._id, bob._id);
    const second = await ThreadService.createThread(bob._id, alice._id);
    expect(first._id.toString()).toBe(second._id.toString());
  });
});

describe('getThreadsForUser', () => {
  it('returns threads for the user sorted by most recent activity', async () => {
    const thread = await ThreadService.createThread(alice._id, bob._id);
    await Thread.findByIdAndUpdate(thread._id, {
      last_message: { sender_id: alice._id, content: 'Hi', timestamp: new Date() },
    });
    const threads = await ThreadService.getThreadsForUser(alice._id);
    expect(threads).toHaveLength(1);
    expect(threads[0].last_message.content).toBe('Hi');
  });

  it('returns empty array if user has no threads', async () => {
    const threads = await ThreadService.getThreadsForUser(alice._id);
    expect(threads).toEqual([]);
  });
});

describe('getThread', () => {
  it('returns the thread if user is a participant', async () => {
    const thread = await ThreadService.createThread(alice._id, bob._id);
    const found = await ThreadService.getThread(thread._id, alice._id);
    expect(found._id.toString()).toBe(thread._id.toString());
  });

  it('throws NOT_PARTICIPANT if user is not in the thread', async () => {
    const carol = await User.create({ name: 'Carol', email: 'carol@test.com' });
    const thread = await ThreadService.createThread(alice._id, bob._id);
    await expect(ThreadService.getThread(thread._id, carol._id)).rejects.toMatchObject({
      code: 'NOT_PARTICIPANT',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest tests/services/ThreadService.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../services/ThreadService'`

- [ ] **Step 3: Implement ThreadService**

```js
// server/services/ThreadService.js
const Thread = require('../models/Thread');

function appError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function createThread(userIdA, userIdB) {
  const ids = [userIdA.toString(), userIdB.toString()].sort();
  const existing = await Thread.findOne({
    participants: { $all: ids, $size: 2 },
  });
  if (existing) return existing;
  return Thread.create({
    participants: ids,
    unread_counts: { [ids[0]]: 0, [ids[1]]: 0 },
  });
}

async function getThreadsForUser(userId) {
  return Thread.find({ participants: userId })
    .populate('participants', 'name photo_url')
    .sort({ 'last_message.timestamp': -1, created_at: -1 });
}

async function getThread(threadId, userId) {
  const thread = await Thread.findById(threadId);
  if (!thread || !thread.participants.map(String).includes(userId.toString())) {
    throw appError('NOT_PARTICIPANT', 'You are not a participant in this thread');
  }
  return thread;
}

module.exports = { createThread, getThreadsForUser, getThread };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx jest tests/services/ThreadService.test.js --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add server/services/ThreadService.js server/tests/services/ThreadService.test.js
git commit -m "feat: ThreadService with create (idempotent), list, and get"
```

---

### Task 7: MessageService

**Files:**
- Create: `server/services/MessageService.js`
- Create: `server/tests/services/MessageService.test.js`

- [ ] **Step 1: Write failing tests**

```js
// server/tests/services/MessageService.test.js
const { startDB, stopDB, clearDB } = require('../helpers');
const MessageService = require('../../services/MessageService');
const ThreadService = require('../../services/ThreadService');
const User = require('../../models/User');
const Thread = require('../../models/Thread');
const Message = require('../../models/Message');
const ContactRequest = require('../../models/ContactRequest');

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

let alice, bob, thread, contactRequest;
beforeEach(async () => {
  alice = await User.create({ name: 'Alice', email: 'alice@test.com' });
  bob = await User.create({ name: 'Bob', email: 'bob@test.com' });
  // ContactRequest must exist and be accepted before messaging is allowed
  contactRequest = await ContactRequest.create({
    sender_id: alice._id,
    recipient_id: bob._id,
    status: 'accepted',
  });
  thread = await ThreadService.createThread(alice._id, bob._id);
});

describe('sendMessage', () => {
  it('stores a message and updates thread last_message', async () => {
    const msg = await MessageService.sendMessage(thread._id, alice._id, 'Hello Bob');
    expect(msg.content).toBe('Hello Bob');
    expect(msg.sender_id.toString()).toBe(alice._id.toString());

    const updated = await Thread.findById(thread._id);
    expect(updated.last_message.content).toBe('Hello Bob');
  });

  it('increments unread count for the non-sender', async () => {
    await MessageService.sendMessage(thread._id, alice._id, 'Hello');
    const updated = await Thread.findById(thread._id);
    expect(updated.unread_counts.get(bob._id.toString())).toBe(1);
    expect(updated.unread_counts.get(alice._id.toString())).toBe(0);
  });

  it('throws NOT_PARTICIPANT if sender is not in thread', async () => {
    const carol = await User.create({ name: 'Carol', email: 'carol@test.com' });
    await expect(
      MessageService.sendMessage(thread._id, carol._id, 'Hi')
    ).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' });
  });

  it('throws NOT_PARTICIPANT if the underlying ContactRequest is not accepted', async () => {
    // Revert the accepted ContactRequest to pending to test the guard
    await ContactRequest.findByIdAndUpdate(contactRequest._id, { status: 'pending' });
    await expect(
      MessageService.sendMessage(thread._id, alice._id, 'Hello')
    ).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' });
  });

  it('throws CONTENT_EMPTY for blank content', async () => {
    await expect(
      MessageService.sendMessage(thread._id, alice._id, '   ')
    ).rejects.toMatchObject({ code: 'CONTENT_EMPTY' });
  });

  it('throws CONTENT_TOO_LONG for content over 2000 chars', async () => {
    await expect(
      MessageService.sendMessage(thread._id, alice._id, 'a'.repeat(2001))
    ).rejects.toMatchObject({ code: 'CONTENT_TOO_LONG' });
  });
});

describe('getHistory', () => {
  it('returns messages newest-first for a participant', async () => {
    await MessageService.sendMessage(thread._id, alice._id, 'First');
    await MessageService.sendMessage(thread._id, bob._id, 'Second');
    const { messages, has_more } = await MessageService.getHistory(thread._id, alice._id);
    expect(messages[0].content).toBe('Second');
    expect(messages[1].content).toBe('First');
    expect(has_more).toBe(false);
  });

  it('paginates using before_timestamp', async () => {
    await MessageService.sendMessage(thread._id, alice._id, 'Old');
    const mid = await MessageService.sendMessage(thread._id, alice._id, 'Middle');
    await MessageService.sendMessage(thread._id, alice._id, 'New');
    const { messages } = await MessageService.getHistory(
      thread._id, alice._id, mid.timestamp, 10
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Old');
  });

  it('throws NOT_PARTICIPANT for non-participants', async () => {
    const carol = await User.create({ name: 'Carol', email: 'carol@test.com' });
    await expect(
      MessageService.getHistory(thread._id, carol._id)
    ).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' });
  });

  it('defaults limit to 30 and caps at 100', async () => {
    // Create 35 messages
    for (let i = 0; i < 35; i++) {
      await Message.create({
        thread_id: thread._id,
        sender_id: alice._id,
        content: `msg ${i}`,
        timestamp: new Date(Date.now() + i),
      });
    }
    const { messages, has_more } = await MessageService.getHistory(thread._id, alice._id);
    expect(messages).toHaveLength(30);
    expect(has_more).toBe(true);
  });

  it('caps limit at 100 even if a higher value is passed', async () => {
    for (let i = 0; i < 110; i++) {
      await Message.create({
        thread_id: thread._id,
        sender_id: alice._id,
        content: `msg ${i}`,
        timestamp: new Date(Date.now() + i),
      });
    }
    const { messages, has_more } = await MessageService.getHistory(thread._id, alice._id, null, 150);
    expect(messages).toHaveLength(100);
    expect(has_more).toBe(true);
  });
});

describe('markRead', () => {
  it('resets unread count and adds user to read_by on all messages', async () => {
    await MessageService.sendMessage(thread._id, alice._id, 'Msg 1');
    await MessageService.sendMessage(thread._id, alice._id, 'Msg 2');
    // bob has 2 unread
    await MessageService.markRead(thread._id, bob._id);

    const updated = await Thread.findById(thread._id);
    expect(updated.unread_counts.get(bob._id.toString())).toBe(0);

    const messages = await Message.find({ thread_id: thread._id });
    for (const msg of messages) {
      expect(msg.read_by.map(String)).toContain(bob._id.toString());
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest tests/services/MessageService.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../services/MessageService'`

- [ ] **Step 3: Implement MessageService**

```js
// server/services/MessageService.js
const Message = require('../models/Message');
const Thread = require('../models/Thread');
const ContactRequest = require('../models/ContactRequest');

function appError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function sendMessage(threadId, senderId, content) {
  const thread = await Thread.findById(threadId);
  if (!thread || !thread.participants.map(String).includes(senderId.toString())) {
    throw appError('NOT_PARTICIPANT', 'You are not a participant in this thread');
  }

  // Verify the underlying ContactRequest is accepted (spec Section 8)
  const [p1, p2] = thread.participants.map(String);
  const accepted = await ContactRequest.findOne({
    $or: [
      { sender_id: p1, recipient_id: p2, status: 'accepted' },
      { sender_id: p2, recipient_id: p1, status: 'accepted' },
    ],
  });
  if (!accepted) throw appError('NOT_PARTICIPANT', 'Contact request not accepted');

  if (!content || !content.trim()) throw appError('CONTENT_EMPTY', 'Message content is empty');
  if (content.length > 2000) throw appError('CONTENT_TOO_LONG', 'Message exceeds 2000 characters');

  const msg = await Message.create({
    thread_id: threadId,
    sender_id: senderId,
    content: content.trim(),
    timestamp: new Date(),
    read_by: [senderId],
  });

  // Update last_message and increment unread for other participants
  const update = { last_message: { sender_id: senderId, content: content.trim(), timestamp: msg.timestamp } };
  for (const participantId of thread.participants) {
    if (participantId.toString() !== senderId.toString()) {
      const key = `unread_counts.${participantId.toString()}`;
      await Thread.findByIdAndUpdate(threadId, { $set: update, $inc: { [key]: 1 } });
      return msg; // return after first (DM has exactly 2 participants)
    }
  }
  await Thread.findByIdAndUpdate(threadId, { $set: update });
  return msg;
}

async function getHistory(threadId, userId, beforeTimestamp = null, limit = 30) {
  const thread = await Thread.findById(threadId);
  if (!thread || !thread.participants.map(String).includes(userId.toString())) {
    throw appError('NOT_PARTICIPANT', 'You are not a participant in this thread');
  }

  const cappedLimit = Math.min(limit, 100);
  const query = { thread_id: threadId };
  if (beforeTimestamp) query.timestamp = { $lt: new Date(beforeTimestamp) };

  const messages = await Message.find(query)
    .sort({ timestamp: -1 })
    .limit(cappedLimit + 1);

  const has_more = messages.length > cappedLimit;
  const result = has_more ? messages.slice(0, cappedLimit) : messages;
  const next_cursor = has_more ? result[result.length - 1].timestamp.toISOString() : null;

  return { messages: result, has_more, next_cursor };
}

async function markRead(threadId, userId) {
  const thread = await Thread.findById(threadId);
  if (!thread) return;

  // Two separate operations. Not a true atomic transaction (would require a replica set
  // for MongoDB sessions). In practice, the window for partial failure is negligible in a
  // single-node dev setup. Migrate to session transactions when a replica set is available.
  const key = `unread_counts.${userId.toString()}`;
  await Thread.findByIdAndUpdate(threadId, { $set: { [key]: 0 } });
  await Message.updateMany(
    { thread_id: threadId, read_by: { $ne: userId } },
    { $addToSet: { read_by: userId } }
  );
}

module.exports = { sendMessage, getHistory, markRead };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx jest tests/services/MessageService.test.js --no-coverage
```

Expected: PASS (9 tests)

- [ ] **Step 5: Run all service tests to confirm no regressions**

```bash
cd server && npx jest tests/services/ --no-coverage
```

Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add server/services/MessageService.js server/tests/services/MessageService.test.js
git commit -m "feat: MessageService with send, paginated history, and mark-read"
```

---

## Chunk 3: Transport Layer

### Task 8: Contact REST Routes

**Files:**
- Create: `server/routes/contacts.js`
- Create: `server/tests/routes/contacts.test.js`

- [ ] **Step 1: Write failing tests**

```js
// server/tests/routes/contacts.test.js
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { startDB, stopDB, clearDB } = require('../helpers');
const contactRoutes = require('../../routes/contacts');
const { requireAuth } = require('../../middleware/auth');
const User = require('../../models/User');

const JWT_SECRET = 'test_secret';
process.env.JWT_SECRET = JWT_SECRET;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/contacts', requireAuth, contactRoutes);
  return app;
}

function token(userId) {
  return jwt.sign({ id: userId.toString() }, JWT_SECRET);
}

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

let alice, bob, app;
beforeEach(async () => {
  alice = await User.create({ name: 'Alice', email: 'alice@test.com' });
  bob = await User.create({ name: 'Bob', email: 'bob@test.com' });
  app = makeApp();
});

describe('POST /api/contacts/request', () => {
  it('creates a contact request', async () => {
    const res = await request(app)
      .post('/api/contacts/request')
      .set('Authorization', `Bearer ${token(alice._id)}`)
      .send({ recipient_id: bob._id, message: 'Hi Bob' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('returns 409 for duplicate request', async () => {
    await request(app)
      .post('/api/contacts/request')
      .set('Authorization', `Bearer ${token(alice._id)}`)
      .send({ recipient_id: bob._id });
    const res = await request(app)
      .post('/api/contacts/request')
      .set('Authorization', `Bearer ${token(alice._id)}`)
      .send({ recipient_id: bob._id });
    expect(res.status).toBe(409);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/contacts/request').send({ recipient_id: bob._id });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/contacts/requests', () => {
  it('returns pending requests for the authenticated user', async () => {
    await request(app)
      .post('/api/contacts/request')
      .set('Authorization', `Bearer ${token(alice._id)}`)
      .send({ recipient_id: bob._id, message: 'Hi' });
    const res = await request(app)
      .get('/api/contacts/requests')
      .set('Authorization', `Bearer ${token(bob._id)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('PATCH /api/contacts/requests/:id/accept', () => {
  it('accepts a request and returns a thread', async () => {
    const { body: req } = await request(app)
      .post('/api/contacts/request')
      .set('Authorization', `Bearer ${token(alice._id)}`)
      .send({ recipient_id: bob._id });
    const res = await request(app)
      .patch(`/api/contacts/requests/${req._id}/accept`)
      .set('Authorization', `Bearer ${token(bob._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.participants).toBeDefined();
  });

  it('returns 403 if not the recipient', async () => {
    const { body: req } = await request(app)
      .post('/api/contacts/request')
      .set('Authorization', `Bearer ${token(alice._id)}`)
      .send({ recipient_id: bob._id });
    const res = await request(app)
      .patch(`/api/contacts/requests/${req._id}/accept`)
      .set('Authorization', `Bearer ${token(alice._id)}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/contacts/requests/:id', () => {
  it('cancels a pending request by the sender', async () => {
    const { body: req } = await request(app)
      .post('/api/contacts/request')
      .set('Authorization', `Bearer ${token(alice._id)}`)
      .send({ recipient_id: bob._id });
    const res = await request(app)
      .delete(`/api/contacts/requests/${req._id}`)
      .set('Authorization', `Bearer ${token(alice._id)}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 if not the sender', async () => {
    const { body: req } = await request(app)
      .post('/api/contacts/request')
      .set('Authorization', `Bearer ${token(alice._id)}`)
      .send({ recipient_id: bob._id });
    const res = await request(app)
      .delete(`/api/contacts/requests/${req._id}`)
      .set('Authorization', `Bearer ${token(bob._id)}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/contacts/requests/:id/reject', () => {
  it('rejects a request', async () => {
    const { body: req } = await request(app)
      .post('/api/contacts/request')
      .set('Authorization', `Bearer ${token(alice._id)}`)
      .send({ recipient_id: bob._id });
    const res = await request(app)
      .patch(`/api/contacts/requests/${req._id}/reject`)
      .set('Authorization', `Bearer ${token(bob._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest tests/routes/contacts.test.js --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement contacts routes**

```js
// server/routes/contacts.js
const express = require('express');
const router = express.Router();
const ContactService = require('../services/ContactService');

router.post('/request', async (req, res) => {
  try {
    const result = await ContactService.sendRequest(
      req.user.id,
      req.body.recipient_id,
      req.body.message
    );
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 'DUPLICATE_REQUEST') return res.status(409).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const requests = await ContactService.getPendingRequests(req.user.id);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/requests/:id/accept', async (req, res) => {
  try {
    const thread = await ContactService.acceptRequest(req.params.id, req.user.id);
    res.json(thread);
  } catch (err) {
    if (err.code === 'FORBIDDEN') return res.status(403).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.patch('/requests/:id/reject', async (req, res) => {
  try {
    const result = await ContactService.rejectRequest(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    if (err.code === 'FORBIDDEN') return res.status(403).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/requests/:id', async (req, res) => {
  try {
    await ContactService.cancelRequest(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'FORBIDDEN') return res.status(403).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx jest tests/routes/contacts.test.js --no-coverage
```

Expected: PASS (9 tests)

Note: `requireAuth` is applied globally on the router in `server/index.js`, so 401 is covered for all routes by the POST 401 test and the auth middleware unit tests (Task 4). Adding per-route 401 tests for every endpoint would be redundant.

- [ ] **Step 5: Commit**

```bash
git add server/routes/contacts.js server/tests/routes/contacts.test.js
git commit -m "feat: contact request REST routes with accept, reject, cancel"
```

---

### Task 9: Thread REST Routes

**Files:**
- Create: `server/routes/threads.js`
- Create: `server/tests/routes/threads.test.js`

- [ ] **Step 1: Write failing tests**

```js
// server/tests/routes/threads.test.js
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { startDB, stopDB, clearDB } = require('../helpers');
const threadRoutes = require('../../routes/threads');
const { requireAuth } = require('../../middleware/auth');
const User = require('../../models/User');
const ThreadService = require('../../services/ThreadService');
const MessageService = require('../../services/MessageService');

const JWT_SECRET = 'test_secret';
process.env.JWT_SECRET = JWT_SECRET;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/threads', requireAuth, threadRoutes);
  return app;
}

function token(userId) {
  return jwt.sign({ id: userId.toString() }, JWT_SECRET);
}

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

let alice, bob, thread, app;
beforeEach(async () => {
  alice = await User.create({ name: 'Alice', email: 'alice@test.com' });
  bob = await User.create({ name: 'Bob', email: 'bob@test.com' });
  thread = await ThreadService.createThread(alice._id, bob._id);
  app = makeApp();
});

describe('GET /api/threads', () => {
  it('returns threads for authenticated user', async () => {
    await MessageService.sendMessage(thread._id, alice._id, 'Hello');
    const res = await request(app)
      .get('/api/threads')
      .set('Authorization', `Bearer ${token(alice._id)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/threads');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/threads/:id/messages', () => {
  it('returns paginated message history for a participant', async () => {
    await MessageService.sendMessage(thread._id, alice._id, 'Msg 1');
    await MessageService.sendMessage(thread._id, bob._id, 'Msg 2');
    const res = await request(app)
      .get(`/api/threads/${thread._id}/messages`)
      .set('Authorization', `Bearer ${token(alice._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.has_more).toBe(false);
  });

  it('returns 403 for non-participants', async () => {
    const carol = await User.create({ name: 'Carol', email: 'carol@test.com' });
    const res = await request(app)
      .get(`/api/threads/${thread._id}/messages`)
      .set('Authorization', `Bearer ${token(carol._id)}`);
    expect(res.status).toBe(403);
  });

  it('accepts before query param for pagination', async () => {
    const msg1 = await MessageService.sendMessage(thread._id, alice._id, 'Old');
    const msg2 = await MessageService.sendMessage(thread._id, alice._id, 'New');
    const res = await request(app)
      .get(`/api/threads/${thread._id}/messages?before=${msg2.timestamp.toISOString()}`)
      .set('Authorization', `Bearer ${token(alice._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe('Old');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest tests/routes/threads.test.js --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement thread routes**

```js
// server/routes/threads.js
const express = require('express');
const router = express.Router();
const ThreadService = require('../services/ThreadService');
const MessageService = require('../services/MessageService');

router.get('/', async (req, res) => {
  try {
    const threads = await ThreadService.getThreadsForUser(req.user.id);
    res.json(threads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const result = await MessageService.getHistory(
      req.params.id,
      req.user.id,
      req.query.before || null,
      limit
    );
    res.json(result);
  } catch (err) {
    if (err.code === 'NOT_PARTICIPANT') return res.status(403).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx jest tests/routes/threads.test.js --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/routes/threads.js server/tests/routes/threads.test.js
git commit -m "feat: thread list and message history REST routes"
```

---

### Task 10: Socket.io Handlers

**Files:**
- Create: `server/socket/handlers.js`
- Create: `server/tests/socket/handlers.test.js`
- No changes to: `server/index.js` — the complete stub created in Task 4 already wires everything; no modifications needed here

- [ ] **Step 1: Write failing socket handler tests**

```js
// server/tests/socket/handlers.test.js
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const registerHandlers = require('../../socket/handlers');
const User = require('../../models/User');
const ThreadService = require('../../services/ThreadService');
const MessageService = require('../../services/MessageService');

const JWT_SECRET = 'test_secret';
process.env.JWT_SECRET = JWT_SECRET;

let mongod, io, httpServer, alice, bob, thread;

function makeClient(userId, port) {
  return Client(`http://localhost:${port}`, {
    auth: { token: jwt.sign({ id: userId.toString() }, JWT_SECRET) },
    autoConnect: false,
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  httpServer = createServer();
  io = new Server(httpServer);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('AUTH_FAILED'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('AUTH_FAILED'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.user.id);
    registerHandlers(io, socket);
  });

  httpServer.listen(0); // random port
});

afterAll(async () => {
  io.close();
  httpServer.close();
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany({});
  alice = await User.create({ name: 'Alice', email: 'alice@test.com' });
  bob = await User.create({ name: 'Bob', email: 'bob@test.com' });
  thread = await ThreadService.createThread(alice._id, bob._id);
});

function connectClient(userId) {
  return new Promise((resolve, reject) => {
    const port = httpServer.address().port;
    const client = makeClient(userId, port);
    client.on('connect', () => resolve(client));
    client.on('connect_error', reject);
    client.connect();
  });
}

function waitForEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('send_message', () => {
  it('delivers message_received to thread room', async () => {
    const aliceSocket = await connectClient(alice._id);
    const bobSocket = await connectClient(bob._id);

    // Both join the thread
    aliceSocket.emit('join_thread', { thread_id: thread._id.toString() });
    bobSocket.emit('join_thread', { thread_id: thread._id.toString() });
    await new Promise(r => setTimeout(r, 50));

    const received = waitForEvent(bobSocket, 'message_received');
    aliceSocket.emit('send_message', { thread_id: thread._id.toString(), content: 'Hello Bob' });

    const data = await received;
    expect(data.message.content).toBe('Hello Bob');

    aliceSocket.disconnect();
    bobSocket.disconnect();
  });

  it('emits error for non-participant sender', async () => {
    const carol = await User.create({ name: 'Carol', email: 'carol@test.com' });
    const carolSocket = await connectClient(carol._id);

    const errorReceived = waitForEvent(carolSocket, 'error');
    carolSocket.emit('send_message', { thread_id: thread._id.toString(), content: 'Hi' });

    const err = await errorReceived;
    expect(err.code).toBe('NOT_PARTICIPANT');

    carolSocket.disconnect();
  });
});

describe('typing indicators', () => {
  it('broadcasts user_typing to other participants', async () => {
    const aliceSocket = await connectClient(alice._id);
    const bobSocket = await connectClient(bob._id);

    aliceSocket.emit('join_thread', { thread_id: thread._id.toString() });
    bobSocket.emit('join_thread', { thread_id: thread._id.toString() });
    await new Promise(r => setTimeout(r, 50));

    const typing = waitForEvent(bobSocket, 'user_typing');
    aliceSocket.emit('typing_start', { thread_id: thread._id.toString() });

    const data = await typing;
    expect(data.user_id).toBe(alice._id.toString());
    expect(data.name).toBe('Alice');

    aliceSocket.disconnect();
    bobSocket.disconnect();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest tests/socket/handlers.test.js --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement Socket.io handlers**

```js
// server/socket/handlers.js
const MessageService = require('../services/MessageService');
const ThreadService = require('../services/ThreadService');
const User = require('../models/User');

const typingTimers = new Map();

function registerHandlers(io, socket) {
  const userId = socket.user.id;

  socket.on('join_thread', async ({ thread_id }) => {
    try {
      await ThreadService.getThread(thread_id, userId);
      socket.join(thread_id);
      socket.emit('thread_joined', { thread_id });
    } catch (err) {
      socket.emit('error', { code: err.code || 'THREAD_NOT_FOUND', message: err.message });
    }
  });

  socket.on('leave_thread', ({ thread_id }) => {
    socket.leave(thread_id);
  });

  socket.on('send_message', async ({ thread_id, content }) => {
    try {
      const msg = await MessageService.sendMessage(thread_id, userId, content);

      // Deliver to thread room
      io.to(thread_id).emit('message_received', { message: msg });

      // Fetch fresh thread state (post-send) and sender profile for notifications
      const [freshThread, user] = await Promise.all([
        ThreadService.getThread(thread_id, userId),
        User.findById(userId).select('name photo_url'),
      ]);

      const senderProfile = {
        user_id: userId,
        name: user.name,
        initials: user.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        photo_url: user.photo_url || null,
      };

      // Notify each participant's personal room using fresh post-send thread state
      for (const participantId of freshThread.participants) {
        const pidStr = participantId.toString();

        io.to(pidStr).emit('thread_updated', {
          thread_id,
          last_message: msg,
          participant: senderProfile,
        });

        if (pidStr !== userId) {
          const unreadCount = freshThread.unread_counts.get(pidStr) || 0;
          io.to(pidStr).emit('unread_update', { thread_id, unread_count: unreadCount });
        }
      }
    } catch (err) {
      socket.emit('error', { code: err.code || 'ERROR', message: err.message });
    }
  });

  socket.on('mark_read', async ({ thread_id }) => {
    try {
      await MessageService.markRead(thread_id, userId);
      socket.emit('unread_update', { thread_id, unread_count: 0 });
    } catch (err) {
      socket.emit('error', { code: err.code || 'ERROR', message: err.message });
    }
  });

  socket.on('typing_start', async ({ thread_id }) => {
    const key = `${thread_id}:${userId}`;
    const user = await User.findById(userId).select('name');

    socket.to(thread_id).emit('user_typing', {
      thread_id,
      user_id: userId,
      name: user ? user.name : '',
    });

    if (typingTimers.has(key)) clearTimeout(typingTimers.get(key));
    typingTimers.set(key, setTimeout(() => {
      io.to(thread_id).emit('user_stopped_typing', { thread_id, user_id: userId });
      typingTimers.delete(key);
    }, 5000));
  });

  socket.on('typing_stop', ({ thread_id }) => {
    const key = `${thread_id}:${userId}`;
    if (typingTimers.has(key)) {
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
    }
    socket.to(thread_id).emit('user_stopped_typing', { thread_id, user_id: userId });
  });

  socket.on('disconnect', () => {
    // Clean up typing timers for this socket
    for (const [key] of typingTimers) {
      if (key.endsWith(`:${userId}`)) {
        clearTimeout(typingTimers.get(key));
        typingTimers.delete(key);
      }
    }
  });
}

module.exports = registerHandlers;
```

- [ ] **Step 4: Run socket handler tests to verify they pass**

```bash
cd server && npx jest tests/socket/handlers.test.js --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Run full test suite**

```bash
cd server && npx jest --no-coverage
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/socket/handlers.js server/tests/socket/handlers.test.js
git commit -m "feat: Socket.io handlers for messaging, typing indicators, and mark-read"
```

---

## Chunk 4: React Client

### Task 11: Client Scaffold + Socket Singleton

**Files:**
- Create: `client/vite.config.js`
- Create: `client/index.html`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`
- Create: `client/src/socket.js`
- Create: `client/src/api.js`

- [ ] **Step 1: Create vite.config.js**

```js
// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
```

- [ ] **Step 2: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nivarro</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create socket singleton**

```js
// client/src/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(token) {
  // Reconnect if no socket, disconnected, or actively disconnected
  if (socket?.connected) return socket;
  if (socket && !socket.connected) {
    socket.connect(); // reconnect existing instance
    return socket;
  }
  socket = io('http://localhost:5000', {
    auth: { token },
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

- [ ] **Step 4: Create axios api instance**

```js
// client/src/api.js
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export function setAuthToken(token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default api;
```

- [ ] **Step 5: Create main.jsx and App.jsx stubs**

```jsx
// client/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```jsx
// client/src/App.jsx
import React from 'react';
import ThreadList from './components/ThreadList';
import ContactRequestBanner from './components/ContactRequestBanner';

// For now, read userId and token from localStorage
// Replace with real auth when auth system is built
const userId = localStorage.getItem('userId');
const token = localStorage.getItem('token');

export default function App() {
  const [activeThread, setActiveThread] = React.useState(null);

  // Lazy import ChatWindow to avoid circular deps in stubs
  const ChatWindow = React.lazy(() => import('./components/ChatWindow'));

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <ContactRequestBanner token={token} />
      <ThreadList token={token} userId={userId} onSelect={setActiveThread} />
      {activeThread && (
        <React.Suspense fallback={null}>
          <ChatWindow thread={activeThread} userId={userId} token={token} />
        </React.Suspense>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add client/
git commit -m "feat: React client scaffold with socket singleton and axios instance"
```

---

### Task 12: React Hooks

**Files:**
- Create: `client/src/hooks/useSocket.js`
- Create: `client/src/hooks/useThread.js`
- Create: `client/src/hooks/useMessages.js`

- [ ] **Step 1: Create useSocket hook**

```js
// client/src/hooks/useSocket.js
import { useEffect } from 'react';
import { connectSocket, getSocket } from '../socket';

export function useSocket(token) {
  useEffect(() => {
    if (token) connectSocket(token);
  }, [token]);

  return getSocket(); // return the socket instance, not the function reference
}

export function useSocketEvent(event, handler, deps = []) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
```

- [ ] **Step 2: Create useThread hook**

```js
// client/src/hooks/useThread.js
import { useState, useEffect, useCallback } from 'react';
import api, { setAuthToken } from '../api';
import { connectSocket, getSocket } from '../socket';

export function useThread(token, userId) {
  const [threads, setThreads] = useState([]);

  useEffect(() => {
    if (!token) return;
    setAuthToken(token);
    connectSocket(token);

    api.get('/threads').then(res => setThreads(res.data)).catch(console.error);

    const socket = getSocket();
    if (!socket) return;

    function onThreadUpdated(data) {
      setThreads(prev => {
        const exists = prev.find(t => t._id === data.thread_id);
        if (exists) {
          return prev
            .map(t => t._id === data.thread_id ? { ...t, last_message: data.last_message } : t)
            .sort((a, b) => new Date(b.last_message?.timestamp) - new Date(a.last_message?.timestamp));
        }
        return [{ _id: data.thread_id, last_message: data.last_message, participant: data.participant, unread_count: 0 }, ...prev];
      });
    }

    function onUnreadUpdate({ thread_id, unread_count }) {
      setThreads(prev =>
        prev.map(t => t._id === thread_id ? { ...t, unread_count } : t)
      );
    }

    socket.on('thread_updated', onThreadUpdated);
    socket.on('unread_update', onUnreadUpdate);
    return () => {
      socket.off('thread_updated', onThreadUpdated);
      socket.off('unread_update', onUnreadUpdate);
    };
  }, [token, userId]);

  return threads;
}
```

- [ ] **Step 3: Create useMessages hook**

```js
// client/src/hooks/useMessages.js
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { getSocket } from '../socket';

export function useMessages(threadId, userId) {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const typingStopTimer = useRef(null);

  useEffect(() => {
    if (!threadId) return;
    setMessages([]);

    const socket = getSocket();
    if (socket) socket.emit('join_thread', { thread_id: threadId });

    api.get(`/threads/${threadId}/messages`).then(res => {
      setMessages(res.data.messages.reverse());
      setHasMore(res.data.has_more);
      setNextCursor(res.data.next_cursor);
    });

    if (socket) {
      socket.emit('mark_read', { thread_id: threadId });

      function onMessage({ message }) {
        setMessages(prev => [...prev, message]);
        socket.emit('mark_read', { thread_id: threadId });
      }

      socket.on('message_received', onMessage);
      return () => {
        socket.off('message_received', onMessage);
        socket.emit('leave_thread', { thread_id: threadId });
        clearTimeout(typingStopTimer.current); // prevent stale typing_stop on old thread
      };
    }
  }, [threadId]);

  const sendMessage = useCallback((content) => {
    const socket = getSocket();
    if (socket) socket.emit('send_message', { thread_id: threadId, content });
  }, [threadId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) return;
    const res = await api.get(`/threads/${threadId}/messages?before=${nextCursor}`);
    setMessages(prev => [...res.data.messages.reverse(), ...prev]);
    setHasMore(res.data.has_more);
    setNextCursor(res.data.next_cursor);
  }, [threadId, hasMore, nextCursor]);

  const handleTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing_start', { thread_id: threadId });
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { thread_id: threadId });
    }, 2000);
  }, [threadId]);

  return { messages, hasMore, sendMessage, loadMore, handleTyping };
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/
git commit -m "feat: useSocket, useThread, useMessages React hooks"
```

---

### Task 13: React Components

**Files:**
- Create: `client/src/components/ThreadList.jsx`
- Create: `client/src/components/ChatWindow.jsx`
- Create: `client/src/components/MessageBubble.jsx`
- Create: `client/src/components/TypingIndicator.jsx`
- Create: `client/src/components/ContactRequestBanner.jsx`

- [ ] **Step 1: Create MessageBubble**

```jsx
// client/src/components/MessageBubble.jsx
import React from 'react';

export default function MessageBubble({ message, isMine }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: isMine ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    }}>
      <div style={{
        maxWidth: '60%',
        padding: '8px 12px',
        borderRadius: 12,
        background: isMine ? '#0084ff' : '#e9ecef',
        color: isMine ? '#fff' : '#000',
        wordBreak: 'break-word',
      }}>
        <p style={{ margin: 0 }}>{message.content}</p>
        <small style={{ opacity: 0.7, fontSize: 11 }}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </small>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TypingIndicator**

```jsx
// client/src/components/TypingIndicator.jsx
import React, { useState, useEffect } from 'react';
import { getSocket } from '../socket';

export default function TypingIndicator({ threadId, currentUserId }) {
  // Map<user_id, name> — tracks who is typing by ID so we can remove the correct entry
  const [typingMap, setTypingMap] = useState(new Map());

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onTyping({ thread_id, user_id, name }) {
      if (thread_id !== threadId || user_id === currentUserId) return;
      setTypingMap(prev => new Map(prev).set(user_id, name));
    }

    function onStopped({ thread_id, user_id }) {
      if (thread_id !== threadId) return;
      setTypingMap(prev => {
        const next = new Map(prev);
        next.delete(user_id);
        return next;
      });
    }

    socket.on('user_typing', onTyping);
    socket.on('user_stopped_typing', onStopped);
    return () => {
      socket.off('user_typing', onTyping);
      socket.off('user_stopped_typing', onStopped);
    };
  }, [threadId, currentUserId]);

  if (typingMap.size === 0) return null;
  const names = [...typingMap.values()];
  return (
    <div style={{ padding: '4px 12px', fontStyle: 'italic', color: '#888', fontSize: 13 }}>
      {names[0]} is typing...
    </div>
  );
}
```

- [ ] **Step 3: Create ChatWindow**

```jsx
// client/src/components/ChatWindow.jsx
import React, { useRef, useEffect } from 'react';
import { useMessages } from '../hooks/useMessages';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

export default function ChatWindow({ thread, userId }) {
  const { messages, hasMore, sendMessage, loadMore, handleTyping } = useMessages(thread._id, userId);
  const [input, setInput] = React.useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: 12, borderBottom: '1px solid #ddd', fontWeight: 600 }}>
        {thread.participant?.name || 'Chat'}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {hasMore && (
          <button onClick={loadMore} style={{ display: 'block', margin: '0 auto 8px' }}>
            Load older messages
          </button>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg._id}
            message={msg}
            isMine={msg.sender_id?.toString() === userId?.toString()}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <TypingIndicator threadId={thread._id} currentUserId={userId} />

      <form onSubmit={handleSubmit} style={{ display: 'flex', padding: 12, borderTop: '1px solid #ddd' }}>
        <input
          value={input}
          onChange={e => { setInput(e.target.value); handleTyping(); }}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: '1px solid #ddd', outline: 'none' }}
        />
        <button type="submit" style={{ marginLeft: 8, padding: '8px 16px', borderRadius: 20, background: '#0084ff', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Create ThreadList**

```jsx
// client/src/components/ThreadList.jsx
import React from 'react';
import { useThread } from '../hooks/useThread';

function initials(name) {
  return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
}

function preview(content) {
  if (!content) return '';
  return content.length > 60 ? content.slice(0, 57) + '...' : content;
}

export default function ThreadList({ token, userId, onSelect }) {
  const threads = useThread(token, userId);

  return (
    <div style={{ width: 300, borderRight: '1px solid #ddd', overflowY: 'auto', height: '100vh' }}>
      <div style={{ padding: '16px 12px', fontWeight: 700, fontSize: 18, borderBottom: '1px solid #ddd' }}>
        Messages
      </div>
      {threads.map(thread => {
        const participant = thread.participants?.find(p => p._id?.toString() !== userId) || thread.participant;
        return (
          <div
            key={thread._id}
            onClick={() => onSelect(thread)}
            style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#0084ff',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, flexShrink: 0,
            }}>
              {participant?.photo_url
                ? <img src={participant.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                : initials(participant?.name || '')}
            </div>
            <div style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{participant?.name || 'Unknown'}</div>
              <div style={{ color: '#888', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {preview(thread.last_message?.content)}
              </div>
            </div>
            {thread.unread_count > 0 && (
              <div style={{
                background: '#0084ff', color: '#fff', borderRadius: '50%',
                width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {thread.unread_count}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create ContactRequestBanner**

```jsx
// client/src/components/ContactRequestBanner.jsx
import React, { useState, useEffect } from 'react';
import api, { setAuthToken } from '../api';

export default function ContactRequestBanner({ token }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!token) return;
    setAuthToken(token);
    api.get('/contacts/requests').then(res => setRequests(res.data)).catch(console.error);
  }, [token]);

  if (requests.length === 0) return null;

  async function accept(id) {
    await api.patch(`/contacts/requests/${id}/accept`);
    setRequests(prev => prev.filter(r => r._id !== id));
  }

  async function reject(id) {
    await api.patch(`/contacts/requests/${id}/reject`);
    setRequests(prev => prev.filter(r => r._id !== id));
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: '#fff8e1', borderBottom: '1px solid #ffe082', padding: '8px 16px',
    }}>
      {requests.map(req => (
        <div key={req._id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span>
            <strong>{req.sender_id?.name}</strong> wants to connect
            {req.message ? `: "${req.message}"` : ''}
          </span>
          <button onClick={() => accept(req._id)} style={{ background: '#0084ff', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
            Accept
          </button>
          <button onClick={() => reject(req._id)} style={{ background: '#eee', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
            Decline
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit all client components**

```bash
git add client/src/components/ client/src/hooks/
git commit -m "feat: React components - ThreadList, ChatWindow, MessageBubble, TypingIndicator, ContactRequestBanner"
```

---

### Task 14: Final Wiring + Smoke Test

- [ ] **Step 1: Run full server test suite one final time**

```bash
cd server && npx jest --no-coverage
```

Expected: All tests PASS

- [ ] **Step 2: Create server/.env from example**

```bash
cp server/.env.example server/.env
# Edit server/.env and set JWT_SECRET to a real secret value
```

- [ ] **Step 3: Start MongoDB locally (if not running)**

Ensure MongoDB is running locally on port 27017. If using Homebrew on Mac:
```bash
brew services start mongodb-community
```
On Windows, start the MongoDB service via Services or:
```bash
net start MongoDB
```

- [ ] **Step 4: Start the dev server**

```bash
cd server && npm run dev
```

Expected: `Server running on port 5000`

- [ ] **Step 5: Start the client**

```bash
cd client && npm run dev
```

Expected: Vite dev server at `http://localhost:3000`

- [ ] **Step 6: Manual smoke test**

To test end-to-end, open two browser tabs (or use two different browsers) at `http://localhost:3000`. Set `localStorage.userId` and `localStorage.token` in each tab to two different test users and valid JWTs. Verify:

1. Contact request banner appears for the recipient
2. Accepting creates a thread visible in ThreadList
3. Opening the thread and sending a message delivers it in real-time to the other tab
4. Typing indicator appears while the other user types
5. Unread badge increments on the non-active tab

- [ ] **Step 7: Final commit**

```bash
git add server/.env.example
git commit -m "feat: complete Nivarro messaging system - server + client"
```

---

## Summary

| Chunk | What it delivers |
|-------|-----------------|
| 1: Server Foundation | Monorepo, models, auth middleware |
| 2: Service Layer | All business logic, fully tested |
| 3: Transport Layer | REST routes, Socket.io handlers, server entry |
| 4: React Client | Socket singleton, hooks, all 5 UI components |
