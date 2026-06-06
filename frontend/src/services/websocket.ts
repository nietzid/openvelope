import { useUIStore } from '../stores/uiStore'

type Listener = (data: unknown) => void

interface WebSocketMessage {
  event: string
  data: unknown
}

// Reconnection parameters
export const INITIAL_DELAY_MS = 3000
export const MAX_DELAY_MS = 30000
export const MAX_RETRIES = 10
export const BACKOFF_MULTIPLIER = 2

/**
 * Computes the reconnection delay for a given attempt number.
 * delay = min(INITIAL_DELAY_MS × BACKOFF_MULTIPLIER^attempt, MAX_DELAY_MS)
 *
 * Returns null for attempt >= MAX_RETRIES (reconnection should stop).
 */
export function computeBackoffDelay(attempt: number): number | null {
  if (attempt >= MAX_RETRIES) {
    return null
  }
  return Math.min(INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt), MAX_DELAY_MS)
}

export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private listeners: Map<string, Set<Listener>> = new Map()
  private shouldReconnect = false
  private attemptCount = 0

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    this.shouldReconnect = true
    this.attemptCount = 0
    this.openSocket()
  }

  disconnect(): void {
    this.shouldReconnect = false
    this.attemptCount = 0
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    useUIStore.getState().setWsStatus('disconnected', 0)
  }

  /**
   * Manual retry: resets the attempt counter and starts a new connection attempt.
   * Can be called by the user after max retries have been exhausted.
   */
  manualRetry(): void {
    this.attemptCount = 0
    this.shouldReconnect = true
    useUIStore.getState().setWsStatus('reconnecting', 0)
    this.openSocket()
  }

  on(event: string, callback: Listener): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(callback)
    return () => {
      const current = this.listeners.get(event)
      if (current) {
        current.delete(callback)
        if (current.size === 0) {
          this.listeners.delete(event)
        }
      }
    }
  }

  private openSocket(): void {
    const urlWithToken = `${this.url}${this.url.includes('?') ? '&' : '?'}token=${encodeURIComponent(this.token)}`
    const socket = new WebSocket(urlWithToken)
    this.ws = socket

    socket.onopen = () => {
      if (this.reconnectTimer !== null) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
      // Successful connection — reset attempt counter and update status
      this.attemptCount = 0
      useUIStore.getState().setWsStatus('connected', 0)
      // Re-dispatch a synthetic 'reconnected' event so consumers can re-subscribe
      this.dispatch('reconnected', null)
    }

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WebSocketMessage
        if (parsed && typeof parsed === 'object' && typeof parsed.event === 'string') {
          this.dispatch(parsed.event, parsed.data)
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message', err)
      }
    }

    socket.onerror = (event) => {
      console.error('[WebSocket] error', event)
    }

    socket.onclose = () => {
      this.ws = null
      if (this.shouldReconnect) {
        this.scheduleReconnect()
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return

    const delay = computeBackoffDelay(this.attemptCount)

    if (delay === null) {
      // Max retries exhausted — stop reconnecting
      this.shouldReconnect = false
      useUIStore.getState().setWsStatus('disconnected', this.attemptCount)
      return
    }

    // Update status to reconnecting with current attempt count
    useUIStore.getState().setWsStatus('reconnecting', this.attemptCount)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.attemptCount++
      if (this.shouldReconnect) {
        this.openSocket()
      }
    }, delay)
  }

  private dispatch(event: string, data: unknown): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const listener of set) {
      try {
        listener(data)
      } catch (err) {
        console.error(`[WebSocket] listener for "${event}" threw`, err)
      }
    }
  }
}
