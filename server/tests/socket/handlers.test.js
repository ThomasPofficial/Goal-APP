const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const registerHandlers = require('../../socket/handlers');
const User = require('../../models/User');
const ThreadService = require('../../services/ThreadService');
const ContactRequest = require('../../models/ContactRequest');

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

  httpServer.listen(0);
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
  await ContactRequest.create({ sender_id: alice._id, recipient_id: bob._id, status: 'accepted' });
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

    aliceSocket.emit('join_thread', { thread_id: thread._id.toString() });
    bobSocket.emit('join_thread', { thread_id: thread._id.toString() });
    await new Promise(r => setTimeout(r, 100));

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
    await new Promise(r => setTimeout(r, 100));

    const typing = waitForEvent(bobSocket, 'user_typing');
    aliceSocket.emit('typing_start', { thread_id: thread._id.toString() });

    const data = await typing;
    expect(data.user_id).toBe(alice._id.toString());
    expect(data.name).toBe('Alice');

    aliceSocket.disconnect();
    bobSocket.disconnect();
  });
});
