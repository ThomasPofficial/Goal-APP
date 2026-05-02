import React from 'react';
import ThreadList from './components/ThreadList';
import ContactRequestBanner from './components/ContactRequestBanner';

const userId = localStorage.getItem('userId');
const token = localStorage.getItem('token');

export default function App() {
  const [activeThread, setActiveThread] = React.useState(null);
  const ChatWindow = React.lazy(() => import('./components/ChatWindow'));

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <ContactRequestBanner token={token} />
      <ThreadList token={token} userId={userId} onSelect={setActiveThread} />
      {activeThread && (
        <React.Suspense fallback={null}>
          <ChatWindow thread={activeThread} userId={userId} token={token} />
        </React.Suspense>
      )}
    </div>
  );
}
