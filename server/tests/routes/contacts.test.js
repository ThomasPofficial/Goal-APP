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
    const res = await request(app).post('/api/contacts/request').set('Authorization', `Bearer ${token(alice._id)}`).send({ recipient_id: bob._id, message: 'Hi Bob' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });
  it('returns 409 for duplicate request', async () => {
    await request(app).post('/api/contacts/request').set('Authorization', `Bearer ${token(alice._id)}`).send({ recipient_id: bob._id });
    const res = await request(app).post('/api/contacts/request').set('Authorization', `Bearer ${token(alice._id)}`).send({ recipient_id: bob._id });
    expect(res.status).toBe(409);
  });
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/contacts/request').send({ recipient_id: bob._id });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/contacts/requests', () => {
  it('returns pending requests for the authenticated user', async () => {
    await request(app).post('/api/contacts/request').set('Authorization', `Bearer ${token(alice._id)}`).send({ recipient_id: bob._id, message: 'Hi' });
    const res = await request(app).get('/api/contacts/requests').set('Authorization', `Bearer ${token(bob._id)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('PATCH /api/contacts/requests/:id/accept', () => {
  it('accepts a request and returns a thread', async () => {
    const { body: req } = await request(app).post('/api/contacts/request').set('Authorization', `Bearer ${token(alice._id)}`).send({ recipient_id: bob._id });
    const res = await request(app).patch(`/api/contacts/requests/${req._id}/accept`).set('Authorization', `Bearer ${token(bob._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.participants).toBeDefined();
  });
  it('returns 403 if not the recipient', async () => {
    const { body: req } = await request(app).post('/api/contacts/request').set('Authorization', `Bearer ${token(alice._id)}`).send({ recipient_id: bob._id });
    const res = await request(app).patch(`/api/contacts/requests/${req._id}/accept`).set('Authorization', `Bearer ${token(alice._id)}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/contacts/requests/:id', () => {
  it('cancels a pending request by the sender', async () => {
    const { body: req } = await request(app).post('/api/contacts/request').set('Authorization', `Bearer ${token(alice._id)}`).send({ recipient_id: bob._id });
    const res = await request(app).delete(`/api/contacts/requests/${req._id}`).set('Authorization', `Bearer ${token(alice._id)}`);
    expect(res.status).toBe(200);
  });
  it('returns 403 if not the sender', async () => {
    const { body: req } = await request(app).post('/api/contacts/request').set('Authorization', `Bearer ${token(alice._id)}`).send({ recipient_id: bob._id });
    const res = await request(app).delete(`/api/contacts/requests/${req._id}`).set('Authorization', `Bearer ${token(bob._id)}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/contacts/requests/:id/reject', () => {
  it('rejects a request', async () => {
    const { body: req } = await request(app).post('/api/contacts/request').set('Authorization', `Bearer ${token(alice._id)}`).send({ recipient_id: bob._id });
    const res = await request(app).patch(`/api/contacts/requests/${req._id}/reject`).set('Authorization', `Bearer ${token(bob._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });
});
