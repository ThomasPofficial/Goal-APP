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
        clearTimeout(typingStopTimer.current);
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
