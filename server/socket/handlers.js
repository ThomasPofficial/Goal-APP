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

      io.to(thread_id).emit('message_received', { message: msg });

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

      for (const participantId of freshThread.participants) {
        const pidStr = participantId.toString();
        io.to(pidStr).emit('thread_updated', { thread_id, last_message: msg, participant: senderProfile });
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
    socket.to(thread_id).emit('user_typing', { thread_id, user_id: userId, name: user ? user.name : '' });
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
    for (const [key] of typingTimers) {
      if (key.endsWith(`:${userId}`)) {
        clearTimeout(typingTimers.get(key));
        typingTimers.delete(key);
      }
    }
  });
}

module.exports = registerHandlers;
