const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { startDB, stopDB, clearDB } = require('../helpers');
const threadRoutes = require('../../routes/threads');
const { requireAuth } = require('../../middleware/auth');
const User = require('../../models/User');
const ThreadService = require('../../services/ThreadService');
const MessageService = require('../../services/MessageService');
const ContactRequest = require('../../models/ContactRequest');

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
  await ContactRequest.create({ sender_id: alice._id, recipient_id: bob._id, status: 'accepted' });
  thread = await ThreadService.createThread(alice._id, bob._id);
  app = makeApp();
});

describe('GET /api/threads', () => {
  it('returns threads for authenticated user', async () => {
    await MessageService.sendMessage(thread._id, alice._id, 'Hello');
    const res = await request(app).get('/api/threads').set('Authorization', `Bearer ${token(alice._id)}`);
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
    const res = await request(app).get(`/api/threads/${thread._id}/messages`).set('Authorization', `Bearer ${token(alice._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.has_more).toBe(false);
  });
  it('returns 403 for non-participants', async () => {
    const carol = await User.create({ name: 'Carol', email: 'carol@test.com' });
    const res = await request(app).get(`/api/threads/${thread._id}/messages`).set('Authorization', `Bearer ${token(carol._id)}`);
    expect(res.status).toBe(403);
  });
  it('accepts before query param for pagination', async () => {
    await MessageService.sendMessage(thread._id, alice._id, 'Old');
    const msg2 = await MessageService.sendMessage(thread._id, alice._id, 'New');
    const res = await request(app).get(`/api/threads/${thread._id}/messages?before=${msg2.timestamp.toISOString()}`).set('Authorization', `Bearer ${token(alice._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe('Old');
  });
});
