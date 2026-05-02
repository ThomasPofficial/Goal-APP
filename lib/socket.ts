import { io, type Socket } from 'socket.io-client'
import { useRef } from 'react'

let _socket: Socket | null = null

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      autoConnect: false,
      reconnection: true,
    })
  }
  return _socket
}

export function useSocket(): Socket {
  const ref = useRef(getSocket())
  return ref.current
}
