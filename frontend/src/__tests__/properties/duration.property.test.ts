import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { duration } from '../../lib/motion'

/**
 * Property 4: Interactive duration bounds
 * Validates: Requirements 3.6
 *
 * For any duration token categorized as "interactive" in the motion system,
 * its value SHALL be ≤ 350ms. For any token categorized as "decorative",
 * its value SHALL be ≤ 500ms.
 */

// All duration tokens are interactive (used for UI responses)
const interactiveDurations = Object.entries(duration) as [string, number][]

describe('Property 4: Interactive duration bounds', () => {
  it('all duration tokens are ≤ 350ms (interactive bound)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...interactiveDurations),
        ([, value]) => {
          expect(value).toBeLessThanOrEqual(350)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('each individual duration token respects the interactive bound', () => {
    // Enumerate all tokens explicitly
    expect(duration.fast).toBeLessThanOrEqual(350)
    expect(duration.normal).toBeLessThanOrEqual(350)
    expect(duration.slow).toBeLessThanOrEqual(350)
    expect(duration.slower).toBeLessThanOrEqual(350)
  })

  it('no duration token exceeds the decorative bound of 500ms', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...interactiveDurations),
        ([_name, value]) => {
          expect(value).toBeLessThanOrEqual(500)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('all duration values are positive integers', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...interactiveDurations),
        ([_name, value]) => {
          expect(value).toBeGreaterThan(0)
          expect(Number.isInteger(value)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
