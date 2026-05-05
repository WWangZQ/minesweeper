import { useEffect } from 'react'
import { wsClient } from '../services/wsClient'
import { useLobbyStore } from '../stores/lobbyStore'

export function useWebSocket() {
  const setConnectionStatus = useLobbyStore((s) => s.setConnectionStatus)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    setConnectionStatus('connecting')

    const onConnected = () => setConnectionStatus('connected')
    const onDisconnected = () => setConnectionStatus('disconnected')

    wsClient.connect(wsUrl)
    wsClient.on('connected', onConnected)
    wsClient.on('disconnected', onDisconnected)

    return () => {
      wsClient.off('connected', onConnected)
      wsClient.off('disconnected', onDisconnected)
      wsClient.disconnect()
    }
  }, [setConnectionStatus])
}
