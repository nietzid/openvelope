type Listener = (data: unknown) => void

interface WebSocketMessage {
  event: string
  data: unknown
}

const RECONNECT_DELAY_MS = 3000

export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private listeners: Map<string, Set<Listener>> = new Map()
  private shouldReconnect = false

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    this.shouldReconnect = true
    this.openSocket()
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
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
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.shouldReconnect) {
        this.openSocket()
      }
    }, RECONNECT_DELAY_MS)
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
