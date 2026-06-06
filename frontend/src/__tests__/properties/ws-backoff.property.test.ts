import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { computeBackoffDelay, INITIAL_DELAY_MS, MAX_DELAY_MS, MAX_RETRIES, BACKOFF_MULTIPLIER } from '../../services/websocket'

/**
 * Property 17: WebSocket exponential backoff
 *
 * For any reconnection attempt number n (0 ≤ n < 10), the computed delay SHALL equal
 * min(3000 × 2^n, 30000) milliseconds. For attempt n ≥ 10, reconnection SHALL stop
 * (returns null) and the status SHALL transition to 'disconnected'.
 *
 * **Validates: Requirements 13.4**
 */
describe('Property: WebSocket exponential backoff', () => {
  it('computes delay = min(INITIAL_DELAY × 2^n, MAX_DELAY) for attempts 0–9', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_RETRIES - 1 }),
        (attempt) => {
          const delay = computeBackoffDelay(attempt)
          const expected = Math.min(INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt), MAX_DELAY_MS)

          expect(delay).toBe(expected)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('returns null (stop reconnecting) for attempts ≥ 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_RETRIES, max: 20 }),
        (attempt) => {
          const delay = computeBackoffDelay(attempt)
          expect(delay).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('delay never exceeds MAX_DELAY_MS (30000) for any valid attempt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_RETRIES - 1 }),
        (attempt) => {
          const delay = computeBackoffDelay(attempt)
          expect(delay).not.toBeNull()
          expect(delay!).toBeLessThanOrEqual(MAX_DELAY_MS)
          expect(delay!).toBeGreaterThanOrEqual(INITIAL_DELAY_MS)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('delay is monotonically non-decreasing for attempts 0–9', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_RETRIES - 2 }),
        (attempt) => {
          const delay1 = computeBackoffDelay(attempt)!
          const delay2 = computeBackoffDelay(attempt + 1)!
          expect(delay2).toBeGreaterThanOrEqual(delay1)
        },
      ),
      { numRuns: 100 },
    )
  })
})
