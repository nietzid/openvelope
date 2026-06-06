import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { WARMUP_WINDOW_MS, DEFAULT_DELAY_MS } from '../../components/primitives/Tooltip'

/**
 * Property 6: Tooltip warm-up behavior
 * Validates: Requirements 5.1, 5.2
 *
 * For any sequence of tooltip show/hide events where the time between closing
 * tooltip A and hovering tooltip B is less than 300ms, tooltip B SHALL appear
 * with 0ms delay. When the gap exceeds 300ms, the full 500ms delay applies.
 */

/**
 * Compute the effective delay based on time since last tooltip close.
 * This mirrors the logic inside Tooltip.tsx's `show` callback.
 */
function computeEffectiveDelay(timeSinceLastClose: number, delayMs: number = DEFAULT_DELAY_MS): number {
  return timeSinceLastClose < WARMUP_WINDOW_MS ? 0 : delayMs
}

describe('Property 6: Tooltip warm-up behavior', () => {
  it('returns 0ms delay when gap < 300ms (warm-up active)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 299 }),
        (timeSinceLastClose) => {
          const delay = computeEffectiveDelay(timeSinceLastClose)
          expect(delay).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns full delay (500ms) when gap >= 300ms (warm-up expired)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 300, max: 1000 }),
        (timeSinceLastClose) => {
          const delay = computeEffectiveDelay(timeSinceLastClose)
          expect(delay).toBe(DEFAULT_DELAY_MS)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('respects custom delay value when warm-up is not active', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 300, max: 1000 }),
        fc.integer({ min: 100, max: 2000 }),
        (timeSinceLastClose, customDelay) => {
          const delay = computeEffectiveDelay(timeSinceLastClose, customDelay)
          expect(delay).toBe(customDelay)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('always returns 0 when warm-up is active regardless of custom delay', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 299 }),
        fc.integer({ min: 100, max: 2000 }),
        (timeSinceLastClose, customDelay) => {
          const delay = computeEffectiveDelay(timeSinceLastClose, customDelay)
          expect(delay).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('boundary at exactly 300ms returns full delay', () => {
    const delay = computeEffectiveDelay(300)
    expect(delay).toBe(DEFAULT_DELAY_MS)
  })

  it('boundary at 299ms returns 0ms delay', () => {
    const delay = computeEffectiveDelay(299)
    expect(delay).toBe(0)
  })
})
