import { useEffect, useMemo, useRef } from 'react'
import { WebSocketService } from '../services/websocket'
import { useAuthStore } from '../stores/authStore'

function buildWsUrl(token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`
}

export function useWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const tokenRef = useRef<string | null>(accessToken)

  // Keep token ref up to date so connect() can read the latest value
  // (avoids stale closure issues without forcing a reconnect on token change)
  useEffect(() => {
    tokenRef.current = accessToken
  }, [accessToken])

  const service = useMemo(() => {
    if (!accessToken) return null
    return new WebSocketService(buildWsUrl(accessToken), accessToken)
  }, [accessToken])

  useEffect(() => {
    if (!service) return
    service.connect()
    return () => {
      service.disconnect()
    }
  }, [service])

  const on = useMemo(() => {
    return (event: string, callback: (data: any) => void): (() => void) => {
      if (!service) return () => {}
      return service.on(event, callback)
    }
  }, [service])

  return { on }
}
