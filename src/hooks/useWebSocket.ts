import { useEffect, useRef } from 'react'
import { wsClient } from '../services/wsClient'
import { useLobbyStore } from '../stores/lobbyStore'

// Keep a global flag so the connection survives page navigation
let wsStarted = false

export function useWebSocket() {
  const setConnectionStatus = useLobbyStore((s) => s.setConnectionStatus)
  const didConnect = useRef(false)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    setConnectionStatus('connecting')

    const onConnected = () => setConnectionStatus('connected')
    const onDisconnected = () => setConnectionStatus('disconnected')

    if (!wsStarted) {
      wsStarted = true
      wsClient.connect(wsUrl)
    } else if (wsClient.readyState === WebSocket.OPEN) {
      // Already connected from a previous page, just fire connected
      setConnectionStatus('connected')
    }

    wsClient.on('connected', onConnected)
    wsClient.on('disconnected', onDisconnected)
    didConnect.current = true

    return () => {
      wsClient.off('connected', onConnected)
      wsClient.off('disconnected', onDisconnected)
      // Don't disconnect — keep connection alive across page navigations
    }
  }, [setConnectionStatus])
}
