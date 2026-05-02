import React, { useRef, useEffect } from 'react';
import { useMessages } from '../hooks/useMessages';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

export default function ChatWindow({ thread, userId }) {
  const { messages, hasMore, sendMessage, loadMore, handleTyping } = useMessages(thread._id, userId);
  const [input, setInput] = React.useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: 12, borderBottom: '1px solid #ddd', fontWeight: 600 }}>
        {thread.participant?.name || 'Chat'}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {hasMore && (
          <button onClick={loadMore} style={{ display: 'block', margin: '0 auto 8px' }}>
            Load older messages
          </button>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg._id}
            message={msg}
            isMine={msg.sender_id?.toString() === userId?.toString()}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <TypingIndicator threadId={thread._id} currentUserId={userId} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', padding: 12, borderTop: '1px solid #ddd' }}>
        <input
          value={input}
          onChange={e => { setInput(e.target.value); handleTyping(); }}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: '1px solid #ddd', outline: 'none' }}
        />
        <button type="submit" style={{ marginLeft: 8, padding: '8px 16px', borderRadius: 20, background: '#0084ff', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Send
        </button>
      </form>
    </div>
  );
}
