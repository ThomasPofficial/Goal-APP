const Thread = require('../models/Thread');

function appError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function createThread(userIdA, userIdB) {
  const ids = [userIdA.toString(), userIdB.toString()].sort();
  const existing = await Thread.findOne({ participants: { $all: ids, $size: 2 } });
  if (existing) return existing;
  return Thread.create({ participants: ids, unread_counts: { [ids[0]]: 0, [ids[1]]: 0 } });
}

async function getThreadsForUser(userId) {
  return Thread.find({ participants: userId }).populate('participants', 'name photo_url').sort({ 'last_message.timestamp': -1, created_at: -1 });
}

async function getThread(threadId, userId) {
  const thread = await Thread.findById(threadId);
  if (!thread || !thread.participants.map(String).includes(userId.toString())) {
    throw appError('NOT_PARTICIPANT', 'You are not a participant in this thread');
  }
  return thread;
}

module.exports = { createThread, getThreadsForUser, getThread };
