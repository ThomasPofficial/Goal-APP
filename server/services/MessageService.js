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

  const update = { last_message: { sender_id: senderId, content: content.trim(), timestamp: msg.timestamp } };
  for (const participantId of thread.participants) {
    if (participantId.toString() !== senderId.toString()) {
      const key = `unread_counts.${participantId.toString()}`;
      await Thread.findByIdAndUpdate(threadId, { $set: update, $inc: { [key]: 1 } });
      return msg;
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
  const messages = await Message.find(query).sort({ timestamp: -1 }).limit(cappedLimit + 1);
  const has_more = messages.length > cappedLimit;
  const result = has_more ? messages.slice(0, cappedLimit) : messages;
  const next_cursor = has_more ? result[result.length - 1].timestamp.toISOString() : null;
  return { messages: result, has_more, next_cursor };
}

async function markRead(threadId, userId) {
  const thread = await Thread.findById(threadId);
  if (!thread) return;
  const key = `unread_counts.${userId.toString()}`;
  await Thread.findByIdAndUpdate(threadId, { $set: { [key]: 0 } });
  await Message.updateMany({ thread_id: threadId, read_by: { $ne: userId } }, { $addToSet: { read_by: userId } });
}

module.exports = { sendMessage, getHistory, markRead };
