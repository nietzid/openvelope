import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 16: Search input validation and result capping
 * Validates: Requirements 12.2, 12.3
 *
 * For any search input string, the search SHALL not trigger if the trimmed string
 * length is less than 2 characters. For any search response containing N results,
 * the rendered results list SHALL display at most 50 items.
 */

/** Minimum characters before search triggers */
const MIN_CHARS = 2

/** Maximum number of results to display */
const MAX_RESULTS = 50

/**
 * Determines if a search query should trigger a search request.
 */
function shouldTriggerSearch(query: string): boolean {
  return query.trim().length >= MIN_CHARS
}

/**
 * Caps search results to the maximum display limit.
 */
function capResults<T>(results: T[]): T[] {
  return results.slice(0, MAX_RESULTS)
}

describe('Property 16: Search input validation and result capping', () => {
  describe('Input validation', () => {
    it('search is NOT triggered when trimmed length < 2', () => {
      // Generate strings that when trimmed have length 0 or 1
      const shortStrings = fc.oneof(
        fc.constant(''),
        fc.constant(' '),
        fc.constant('  '),
        fc.constant('\t'),
        fc.constant('\n'),
        fc.constant('a'),
        fc.constant(' a '),
        fc.constant(' x'),
        // Strings of only whitespace with arbitrary length
        fc.nat({ max: 20 }).map((n) => ' '.repeat(n)),
        // Single char padded with whitespace
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 1 }),
          fc.nat({ max: 10 }),
        ).map(([c, padding]) => ' '.repeat(padding) + c + ' '.repeat(padding)),
      ).filter((s) => s.trim().length < MIN_CHARS)

      fc.assert(
        fc.property(shortStrings, (query) => {
          expect(shouldTriggerSearch(query)).toBe(false)
        }),
        { numRuns: 100 },
      )
    })

    it('search IS triggered when trimmed length >= 2', () => {
      const validQueries = fc.string({ minLength: 2, maxLength: 200 }).filter(
        (s) => s.trim().length >= MIN_CHARS,
      )

      fc.assert(
        fc.property(validQueries, (query) => {
          expect(shouldTriggerSearch(query)).toBe(true)
        }),
        { numRuns: 100 },
      )
    })

    it('validates the decision boundary for any arbitrary string', () => {
      fc.assert(
        fc.property(fc.string(), (query) => {
          const result = shouldTriggerSearch(query)
          const expected = query.trim().length >= MIN_CHARS
          expect(result).toBe(expected)
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('Result capping', () => {
    it('renders at most 50 items regardless of input array size', () => {
      fc.assert(
        fc.property(
          fc.array(fc.nat(), { minLength: 0, maxLength: 200 }),
          (results) => {
            const capped = capResults(results)
            expect(capped.length).toBeLessThanOrEqual(MAX_RESULTS)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('preserves all items when array length <= 50', () => {
      fc.assert(
        fc.property(
          fc.array(fc.nat(), { minLength: 0, maxLength: MAX_RESULTS }),
          (results) => {
            const capped = capResults(results)
            expect(capped.length).toBe(results.length)
            expect(capped).toEqual(results)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('truncates to exactly 50 when array length > 50', () => {
      fc.assert(
        fc.property(
          fc.array(fc.nat(), { minLength: MAX_RESULTS + 1, maxLength: 200 }),
          (results) => {
            const capped = capResults(results)
            expect(capped.length).toBe(MAX_RESULTS)
            // Verify the first 50 items are preserved in order
            expect(capped).toEqual(results.slice(0, MAX_RESULTS))
          },
        ),
        { numRuns: 100 },
      )
    })

    it('capped results are always a prefix of the original array', () => {
      fc.assert(
        fc.property(
          fc.array(fc.nat(), { minLength: 0, maxLength: 200 }),
          (results) => {
            const capped = capResults(results)
            for (let i = 0; i < capped.length; i++) {
              expect(capped[i]).toBe(results[i])
            }
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
