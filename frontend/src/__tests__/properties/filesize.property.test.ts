import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { formatSize } from '../../lib/format'

/**
 * Property 13: File size formatting
 * Validates: Requirements 10.5
 *
 * For any non-negative integer byte count, formatSize SHALL return:
 * - bytes with "B" suffix when < 1024
 * - value in KB (one decimal) with "KB" suffix when < 1,048,576
 * - value in MB (one decimal) with "MB" suffix when ≥ 1,048,576
 */

describe('Property 13: File size formatting', () => {
  it('returns bytes with "B" suffix for values < 1024', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1023 }),
        (bytes) => {
          const result = formatSize(bytes)
          expect(result).toBe(`${bytes} B`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns KB with one decimal for values 1024 to 1,048,575', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1024, max: 1_048_575 }),
        (bytes) => {
          const result = formatSize(bytes)
          const expectedKB = (bytes / 1024).toFixed(1)
          expect(result).toBe(`${expectedKB} KB`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns MB with one decimal for values >= 1,048,576', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_048_576, max: 10_737_418_240 }), // up to 10 GB
        (bytes) => {
          const result = formatSize(bytes)
          const expectedMB = (bytes / 1_048_576).toFixed(1)
          expect(result).toBe(`${expectedMB} MB`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('always selects the correct unit based on byte count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_737_418_240 }),
        (bytes) => {
          const result = formatSize(bytes)
          if (bytes < 1024) {
            expect(result).toMatch(/^\d+ B$/)
          } else if (bytes < 1_048_576) {
            expect(result).toMatch(/^\d+\.\d KB$/)
          } else {
            expect(result).toMatch(/^\d+\.\d MB$/)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is always a non-empty string', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10_737_418_240 }),
        (bytes) => {
          const result = formatSize(bytes)
          expect(result.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
