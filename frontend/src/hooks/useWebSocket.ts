import { useEffect, useRef } from 'react'
import { WebSocketService } from '../services/websocket'
import { useAuthStore } from '../stores/authStore'

function getWsBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

/**
 * Manages the WebSocket lifecycle based on auth state.
 * - Connects when an access token is available
 * - Disconnects on logout (token cleared)
 * - Listens for `ws:manual-retry` custom events from the ConnectionStatus component
 * - Exposes the service instance ref for use by useMailboxUpdates
 */
export function useWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const serviceRef = useRef<WebSocketService | null>(null)

  // Connect/disconnect based on auth token
  useEffect(() => {
    if (accessToken) {
      const ws = new WebSocketService(getWsBaseUrl(), accessToken)
      serviceRef.current = ws
      ws.connect()

      return () => {
        ws.disconnect()
        serviceRef.current = null
      }
    } else {
      // Token cleared (logout) — disconnect if still connected
      if (serviceRef.current) {
        serviceRef.current.disconnect()
        serviceRef.current = null
      }
    }
  }, [accessToken])

  // Listen for manual retry events dispatched by the ConnectionStatus component
  useEffect(() => {
    function handleManualRetry() {
      serviceRef.current?.manualRetry()
    }

    window.addEventListener('ws:manual-retry', handleManualRetry)
    return () => {
      window.removeEventListener('ws:manual-retry', handleManualRetry)
    }
  }, [])

  return serviceRef
}
