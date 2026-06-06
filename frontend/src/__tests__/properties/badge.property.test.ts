import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { formatBadgeCount } from '../../lib/format'

/**
 * Property 9: Unread badge formatting
 * Validates: Requirements 8.1
 *
 * For any non-negative integer unseen count, the badge formatter SHALL return:
 * - no badge (empty string) when count is 0
 * - the count as a string when count is 1–99
 * - "99+" when count exceeds 99
 */

describe('Property 9: Unread badge formatting', () => {
  it('returns empty string for count 0', () => {
    expect(formatBadgeCount(0)).toBe('')
  })

  it('returns count as string for values 1–99', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        (count) => {
          const result = formatBadgeCount(count)
          expect(result).toBe(String(count))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns "99+" for values > 99', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1_000_000 }),
        (count) => {
          const result = formatBadgeCount(count)
          expect(result).toBe('99+')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('never returns a badge for zero or negative values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 0 }),
        (count) => {
          const result = formatBadgeCount(count)
          expect(result).toBe('')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is always a string for any non-negative integer', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        (count) => {
          const result = formatBadgeCount(count)
          expect(typeof result).toBe('string')
          if (count === 0) {
            expect(result).toBe('')
          } else if (count <= 99) {
            expect(result).toBe(String(count))
          } else {
            expect(result).toBe('99+')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
