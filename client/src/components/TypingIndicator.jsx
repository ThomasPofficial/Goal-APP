import React, { useState, useEffect } from 'react';
import { getSocket } from '../socket';

export default function TypingIndicator({ threadId, currentUserId }) {
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
