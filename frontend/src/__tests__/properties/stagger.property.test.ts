import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { staggerDelay } from '../../lib/motion'

/**
 * Property 3: Stagger delay calculation
 * Validates: Requirements 3.7
 *
 * For any non-negative integer index and positive interval,
 * staggerDelay(index, interval) SHALL return index × interval when index < 10,
 * and 0 when index ≥ 10.
 */

describe('Property 3: Stagger delay calculation', () => {
  it('returns index × interval for index < 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 1, max: 1000 }),
        (index, interval) => {
          const result = staggerDelay(index, interval)
          expect(result).toBe(index * interval)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns 0 for index >= 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 10000 }),
        fc.integer({ min: 1, max: 1000 }),
        (index, interval) => {
          const result = staggerDelay(index, interval)
          expect(result).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is always non-negative for any non-negative index and positive interval', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 1, max: 10000 }),
        (index, interval) => {
          const result = staggerDelay(index, interval)
          expect(result).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
