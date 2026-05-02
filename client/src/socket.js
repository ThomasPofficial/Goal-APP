import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(token) {
  if (socket?.connected) return socket;
  if (socket && !socket.connected) {
    socket.connect();
    return socket;
  }
  const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  socket = io(serverUrl, {
    auth: { token },
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
