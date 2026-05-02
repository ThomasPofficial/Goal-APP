import { useState, useEffect } from 'react';
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
