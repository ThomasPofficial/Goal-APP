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
  contactRequest = await ContactRequest.create({ sender_id: alice._id, recipient_id: bob._id, status: 'accepted' });
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
    await expect(MessageService.sendMessage(thread._id, carol._id, 'Hi')).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' });
  });
  it('throws NOT_PARTICIPANT if the underlying ContactRequest is not accepted', async () => {
    await ContactRequest.findByIdAndUpdate(contactRequest._id, { status: 'pending' });
    await expect(MessageService.sendMessage(thread._id, alice._id, 'Hello')).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' });
  });
  it('throws CONTENT_EMPTY for blank content', async () => {
    await expect(MessageService.sendMessage(thread._id, alice._id, '   ')).rejects.toMatchObject({ code: 'CONTENT_EMPTY' });
  });
  it('throws CONTENT_TOO_LONG for content over 2000 chars', async () => {
    await expect(MessageService.sendMessage(thread._id, alice._id, 'a'.repeat(2001))).rejects.toMatchObject({ code: 'CONTENT_TOO_LONG' });
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
    const { messages } = await MessageService.getHistory(thread._id, alice._id, mid.timestamp, 10);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Old');
  });
  it('throws NOT_PARTICIPANT for non-participants', async () => {
    const carol = await User.create({ name: 'Carol', email: 'carol@test.com' });
    await expect(MessageService.getHistory(thread._id, carol._id)).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' });
  });
  it('defaults limit to 30 and has_more true when more exist', async () => {
    for (let i = 0; i < 35; i++) {
      await Message.create({ thread_id: thread._id, sender_id: alice._id, content: `msg ${i}`, timestamp: new Date(Date.now() + i) });
    }
    const { messages, has_more } = await MessageService.getHistory(thread._id, alice._id);
    expect(messages).toHaveLength(30);
    expect(has_more).toBe(true);
  });
  it('caps limit at 100 even if a higher value is passed', async () => {
    for (let i = 0; i < 110; i++) {
      await Message.create({ thread_id: thread._id, sender_id: alice._id, content: `msg ${i}`, timestamp: new Date(Date.now() + i) });
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
    await MessageService.markRead(thread._id, bob._id);
    const updated = await Thread.findById(thread._id);
    expect(updated.unread_counts.get(bob._id.toString())).toBe(0);
    const messages = await Message.find({ thread_id: thread._id });
    for (const msg of messages) {
      expect(msg.read_by.map(String)).toContain(bob._id.toString());
    }
  });
});
