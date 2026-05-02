import React from 'react';
import { useThread } from '../hooks/useThread';

function initials(name) {
  return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
}

function preview(content) {
  if (!content) return '';
  return content.length > 60 ? content.slice(0, 57) + '...' : content;
}

export default function ThreadList({ token, userId, onSelect }) {
  const threads = useThread(token, userId);

  return (
    <div style={{ width: 300, borderRight: '1px solid #ddd', overflowY: 'auto', height: '100vh' }}>
      <div style={{ padding: '16px 12px', fontWeight: 700, fontSize: 18, borderBottom: '1px solid #ddd' }}>
        Messages
      </div>
      {threads.map(thread => {
        const participant = thread.participants?.find(p => p._id?.toString() !== userId) || thread.participant;
        return (
          <div
            key={thread._id}
            onClick={() => onSelect(thread)}
            style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#0084ff',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, flexShrink: 0,
            }}>
              {participant?.photo_url
                ? <img src={participant.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                : initials(participant?.name || '')}
            </div>
            <div style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{participant?.name || 'Unknown'}</div>
              <div style={{ color: '#888', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {preview(thread.last_message?.content)}
              </div>
            </div>
            {thread.unread_count > 0 && (
              <div style={{
                background: '#0084ff', color: '#fff', borderRadius: '50%',
                width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {thread.unread_count}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
