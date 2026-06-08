import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeBackoffDelay,
  INITIAL_DELAY_MS,
  MAX_DELAY_MS,
  MAX_RETRIES,
  BACKOFF_MULTIPLIER,
  WebSocketService,
} from './websocket'
import { useUIStore } from '../stores/uiStore'

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []
  readyState: number = WebSocket.CONNECTING
  url: string
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  close() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) this.onclose()
  }

  simulateOpen() {
    this.readyState = WebSocket.OPEN
    if (this.onopen) this.onopen()
  }

  simulateClose() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) this.onclose()
  }

  simulateMessage(data: string) {
    if (this.onmessage) this.onmessage({ data })
  }
}

describe('computeBackoffDelay', () => {
  it('returns INITIAL_DELAY_MS for attempt 0', () => {
    expect(computeBackoffDelay(0)).toBe(INITIAL_DELAY_MS)
  })

  it('doubles delay for each subsequent attempt', () => {
    expect(computeBackoffDelay(1)).toBe(INITIAL_DELAY_MS * BACKOFF_MULTIPLIER)
    expect(computeBackoffDelay(2)).toBe(INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, 2))
  })

  it('caps delay at MAX_DELAY_MS', () => {
    // 3000 * 2^4 = 48000 -> capped at 30000
    expect(computeBackoffDelay(4)).toBe(MAX_DELAY_MS)
    expect(computeBackoffDelay(5)).toBe(MAX_DELAY_MS)
    expect(computeBackoffDelay(9)).toBe(MAX_DELAY_MS)
  })

  it('returns null for attempt >= MAX_RETRIES', () => {
    expect(computeBackoffDelay(MAX_RETRIES)).toBeNull()
    expect(computeBackoffDelay(11)).toBeNull()
    expect(computeBackoffDelay(100)).toBeNull()
  })

  it('computes correct values for all attempts 0 through 9', () => {
    const expected = [3000, 6000, 12000, 24000, 30000, 30000, 30000, 30000, 30000, 30000]
    for (let i = 0; i < MAX_RETRIES; i++) {
      expect(computeBackoffDelay(i)).toBe(expected[i])
    }
  })
})

describe('WebSocketService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
    // Reset store state
    useUIStore.setState({ wsStatus: 'disconnected', wsRetryCount: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sets status to connected on successful open', () => {
    const service = new WebSocketService('ws://localhost/ws', 'token123')
    service.connect()

    const ws = MockWebSocket.instances[0]
    ws.simulateOpen()

    expect(useUIStore.getState().wsStatus).toBe('connected')
    expect(useUIStore.getState().wsRetryCount).toBe(0)
  })

  it('sets status to reconnecting on connection loss', () => {
    const service = new WebSocketService('ws://localhost/ws', 'token123')
    service.connect()

    const ws = MockWebSocket.instances[0]
    ws.simulateOpen()
    ws.simulateClose()

    expect(useUIStore.getState().wsStatus).toBe('reconnecting')
  })

  it('stops reconnecting after MAX_RETRIES and sets status to disconnected', () => {
    const service = new WebSocketService('ws://localhost/ws', 'token123')
    service.connect()

    // Simulate MAX_RETRIES failed connection attempts
    for (let i = 0; i < MAX_RETRIES; i++) {
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]
      ws.simulateClose()
      vi.runAllTimers()
    }

    // One more close should trigger the max retries stop
    const lastWs = MockWebSocket.instances[MockWebSocket.instances.length - 1]
    lastWs.simulateClose()

    expect(useUIStore.getState().wsStatus).toBe('disconnected')
  })

  it('resets attempt counter on successful reconnection', () => {
    const service = new WebSocketService('ws://localhost/ws', 'token123')
    service.connect()

    // First connection opens then closes
    const ws1 = MockWebSocket.instances[0]
    ws1.simulateOpen()
    ws1.simulateClose()

    // Advance timer for reconnect
    vi.runAllTimers()

    // Second connection opens
    const ws2 = MockWebSocket.instances[1]
    ws2.simulateOpen()

    expect(useUIStore.getState().wsStatus).toBe('connected')
    expect(useUIStore.getState().wsRetryCount).toBe(0)
  })

  it('dispatches reconnected event on successful reconnection', () => {
    const service = new WebSocketService('ws://localhost/ws', 'token123')
    const callback = vi.fn()
    service.on('reconnected', callback)
    service.connect()

    const ws = MockWebSocket.instances[0]
    ws.simulateOpen()

    expect(callback).toHaveBeenCalledWith(null)
  })

  it('manualRetry resets counter and reconnects', () => {
    const service = new WebSocketService('ws://localhost/ws', 'token123')
    service.connect()

    // Exhaust all retries
    for (let i = 0; i < MAX_RETRIES; i++) {
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]
      ws.simulateClose()
      vi.runAllTimers()
    }
    const lastWs = MockWebSocket.instances[MockWebSocket.instances.length - 1]
    lastWs.simulateClose()

    expect(useUIStore.getState().wsStatus).toBe('disconnected')

    // Manual retry
    const instanceCountBefore = MockWebSocket.instances.length
    service.manualRetry()

    expect(MockWebSocket.instances.length).toBe(instanceCountBefore + 1)
    expect(useUIStore.getState().wsStatus).toBe('reconnecting')

    // Simulate successful connection
    const newWs = MockWebSocket.instances[MockWebSocket.instances.length - 1]
    newWs.simulateOpen()

    expect(useUIStore.getState().wsStatus).toBe('connected')
  })

  it('disconnect stops reconnecting and sets status to disconnected', () => {
    const service = new WebSocketService('ws://localhost/ws', 'token123')
    service.connect()

    const ws = MockWebSocket.instances[0]
    ws.simulateOpen()
    service.disconnect()

    expect(useUIStore.getState().wsStatus).toBe('disconnected')
  })

  it('uses exponential backoff delays between reconnection attempts', () => {
    const service = new WebSocketService('ws://localhost/ws', 'token123')
    service.connect()

    const ws1 = MockWebSocket.instances[0]
    ws1.simulateOpen()
    ws1.simulateClose()

    // First reconnect should be after INITIAL_DELAY_MS (3000ms)
    vi.advanceTimersByTime(2999)
    expect(MockWebSocket.instances.length).toBe(1)

    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances.length).toBe(2)

    // Second reconnect attempt fails, next delay should be 6000ms
    const ws2 = MockWebSocket.instances[1]
    ws2.simulateClose()

    vi.advanceTimersByTime(5999)
    expect(MockWebSocket.instances.length).toBe(2)

    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances.length).toBe(3)
  })
})
