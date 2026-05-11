import React from 'react';

export default function MessageBubble({ message, isMine }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: isMine ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    }}>
      <div style={{
        maxWidth: '60%',
        padding: '8px 12px',
        borderRadius: 12,
        background: isMine ? '#0084ff' : '#e9ecef',
        color: isMine ? '#fff' : '#000',
        wordBreak: 'break-word',
      }}>
        <p style={{ margin: 0 }}>{message.content}</p>
        <small style={{ opacity: 0.7, fontSize: 11 }}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </small>
      </div>
    </div>
  );
}
