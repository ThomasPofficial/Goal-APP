import { io, type Socket } from 'socket.io-client'
import { useEffect, useState } from 'react'

let _socket: Socket | null = null

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null
  const url = process.env.NEXT_PUBLIC_SOCKET_URL
  if (!url) return null
  if (!_socket) {
    _socket = io(url, { reconnection: true })
  }
  return _socket
}

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null)
  useEffect(() => {
    setSocket(getSocket())
  }, [])
  return socket
}
