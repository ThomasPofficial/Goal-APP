import { useEffect } from 'react';
import { connectSocket, getSocket } from '../socket';

export function useSocket(token) {
  useEffect(() => {
    if (token) connectSocket(token);
  }, [token]);

  return getSocket(); // return the socket instance, not the function reference
}

export function useSocketEvent(event, handler, deps = []) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on(event, handler);
    return () => socket.off(event, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
