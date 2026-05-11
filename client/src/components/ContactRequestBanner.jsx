import React, { useState, useEffect } from 'react';
import api, { setAuthToken } from '../api';

export default function ContactRequestBanner({ token }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!token) return;
    setAuthToken(token);
    api.get('/contacts/requests').then(res => setRequests(res.data)).catch(console.error);
  }, [token]);

  if (requests.length === 0) return null;

  async function accept(id) {
    await api.patch(`/contacts/requests/${id}/accept`);
    setRequests(prev => prev.filter(r => r._id !== id));
  }

  async function reject(id) {
    await api.patch(`/contacts/requests/${id}/reject`);
    setRequests(prev => prev.filter(r => r._id !== id));
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: '#fff8e1', borderBottom: '1px solid #ffe082', padding: '8px 16px',
    }}>
      {requests.map(req => (
        <div key={req._id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span>
            <strong>{req.sender_id?.name}</strong> wants to connect
            {req.message ? `: "${req.message}"` : ''}
          </span>
          <button onClick={() => accept(req._id)} style={{ background: '#0084ff', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
            Accept
          </button>
          <button onClick={() => reject(req._id)} style={{ background: '#eee', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
            Decline
          </button>
        </div>
      ))}
    </div>
  );
}
