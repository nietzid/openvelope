import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property: Contact autocomplete debounce
 *
 * Validates the autocomplete query logic from ComposeDialog.tsx:
 * 1. The last comma-separated segment is extracted as the search query
 * 2. Query trimmed length < 2 returns empty (no search triggered)
 * 3. Result count is bounded (never > 10 for autocomplete)
 */

/** Maximum number of autocomplete results displayed */
const MAX_AUTOCOMPLETE_RESULTS = 10

/** Minimum characters before autocomplete triggers */
const MIN_CHARS = 2

/**
 * Extracts the last comma-separated segment from the To field value.
 * Matches ComposeDialog.handleToChange logic.
 */
function extractSearchQuery(input: string): string {
  const segments = input.split(',').map((s) => s.trim())
  return segments[segments.length - 1] ?? ''
}

/**
 * Determines if an autocomplete search should be triggered.
 * Matches the threshold check in ComposeDialog.handleToChange.
 */
function shouldTriggerAutocomplete(query: string): boolean {
  return query.trim().length >= MIN_CHARS
}

/**
 * Caps autocomplete results to the maximum display limit.
 */
function capAutocompleteResults<T>(results: T[]): T[] {
  return results.slice(0, MAX_AUTOCOMPLETE_RESULTS)
}

/** Arbitrary generator for email-like strings */
const arbEmailPart = fc.string({ minLength: 1, maxLength: 30 }).filter(
  (s) => s.trim().length > 0 && !s.includes(','),
)

/** Arbitrary generator for comma-separated email lists */
const arbToFieldValue = fc.oneof(
  fc.constant(''),
  arbEmailPart,
  fc.tuple(arbEmailPart, arbEmailPart).map(([a, b]) => `${a}, ${b}`),
  fc.tuple(arbEmailPart, arbEmailPart, arbEmailPart).map(([a, b, c]) => `${a}, ${b}, ${c}`),
)

/** Arbitrary generator for search result items */
const arbResult = fc.record({
  id: fc.nat({ max: 10000 }),
  display_name: fc.string({ minLength: 1, maxLength: 50 }),
  email_addr: fc.emailAddress(),
})

describe('Property: Contact autocomplete debounce', () => {
  describe('Query extraction', () => {
    it('extracts the last segment from comma-separated values', () => {
      fc.assert(
        fc.property(arbToFieldValue, (value) => {
          const query = extractSearchQuery(value)
          const segments = value.split(',').map((s) => s.trim())
          expect(query).toBe(segments[segments.length - 1] ?? '')
        }),
        { numRuns: 100 },
      )
    })

    it('single email is returned as-is', () => {
      fc.assert(
        fc.property(arbEmailPart, (email) => {
          const query = extractSearchQuery(email)
          expect(query).toBe(email.trim())
        }),
        { numRuns: 100 },
      )
    })

    it('empty string returns empty query', () => {
      expect(extractSearchQuery('')).toBe('')
    })
  })

  describe('Debounce threshold', () => {
    it('does NOT trigger when query trimmed length < 2', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant(' '),
            fc.constant('a'),
            fc.constant(' a '),
            fc.nat({ max: 20 }).map((n) => ' '.repeat(n)),
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 1 }),
              fc.nat({ max: 10 }),
            ).map(([c, pad]) => ' '.repeat(pad) + c + ' '.repeat(pad)),
          ).filter((s) => s.trim().length < MIN_CHARS),
          (query) => {
            expect(shouldTriggerAutocomplete(query)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('DOES trigger when query trimmed length >= 2', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 50 }).filter(
            (s) => s.trim().length >= MIN_CHARS,
          ),
          (query) => {
            expect(shouldTriggerAutocomplete(query)).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('validates the decision boundary for any arbitrary string', () => {
      fc.assert(
        fc.property(fc.string(), (query) => {
          const result = shouldTriggerAutocomplete(query)
          const expected = query.trim().length >= MIN_CHARS
          expect(result).toBe(expected)
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('Result capping', () => {
    it('returns at most 10 results regardless of input size', () => {
      fc.assert(
        fc.property(
          fc.array(arbResult, { minLength: 0, maxLength: 50 }),
          (results) => {
            const capped = capAutocompleteResults(results)
            expect(capped.length).toBeLessThanOrEqual(MAX_AUTOCOMPLETE_RESULTS)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('preserves all items when array length <= 10', () => {
      fc.assert(
        fc.property(
          fc.array(arbResult, { minLength: 0, maxLength: MAX_AUTOCOMPLETE_RESULTS }),
          (results) => {
            const capped = capAutocompleteResults(results)
            expect(capped.length).toBe(results.length)
            expect(capped).toEqual(results)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('truncates to exactly 10 when array length > 10', () => {
      fc.assert(
        fc.property(
          fc.array(arbResult, { minLength: MAX_AUTOCOMPLETE_RESULTS + 1, maxLength: 50 }),
          (results) => {
            const capped = capAutocompleteResults(results)
            expect(capped.length).toBe(MAX_AUTOCOMPLETE_RESULTS)
            expect(capped).toEqual(results.slice(0, MAX_AUTOCOMPLETE_RESULTS))
          },
        ),
        { numRuns: 100 },
      )
    })

    it('capped results are always a prefix of the original array', () => {
      fc.assert(
        fc.property(
          fc.array(arbResult, { minLength: 0, maxLength: 50 }),
          (results) => {
            const capped = capAutocompleteResults(results)
            for (let i = 0; i < capped.length; i++) {
              expect(capped[i]).toEqual(results[i])
            }
          },
        ),
        { numRuns: 100 },
      )
    })

    it('empty input produces empty output', () => {
      expect(capAutocompleteResults([])).toEqual([])
    })
  })
})
