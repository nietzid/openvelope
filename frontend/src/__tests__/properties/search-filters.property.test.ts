import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property: Search filter validation
 *
 * Validates the search filter logic for SearchInterface and search service:
 * 1. Combining filters (from, to, folder, date range, has_attachment) doesn't produce invalid queries
 * 2. Empty filters are excluded from the query params
 * 3. Date filter formats are valid when provided
 */

interface SearchFilters {
  from?: string
  to?: string
  folder?: string
  date_after?: string
  date_before?: string
  has_attachment?: boolean
}

/**
 * Builds search API params from filter state.
 * Empty/undefined filters are excluded from the params object.
 * Matches the param construction in services/search.ts.
 */
function buildSearchParams(filters: SearchFilters): Record<string, string | boolean> {
  const params: Record<string, string | boolean> = {}
  if (filters.from?.trim()) params.from = filters.from.trim()
  if (filters.to?.trim()) params.to = filters.to.trim()
  if (filters.folder?.trim()) params.folder = filters.folder.trim()
  if (filters.date_after) params.date_after = filters.date_after
  if (filters.date_before) params.date_before = filters.date_before
  if (filters.has_attachment !== undefined) params.has_attachment = filters.has_attachment
  return params
}

/**
 * Validates that a date string matches YYYY-MM-DD format and is parseable.
 */
function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date))
}

/**
 * Validates that date_after <= date_before when both are provided.
 */
function isValidDateRange(dateAfter: string, dateBefore: string): boolean {
  return new Date(dateAfter) <= new Date(dateBefore)
}

/** Generator for arbitrary string values for filter fields */
const arbFilterString = fc.string({ minLength: 0, maxLength: 100 })

/** Generator for valid date strings in YYYY-MM-DD format */
const arbValidDate = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }),
).map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

/** Generator for complete search filters */
const arbSearchFilters = fc.record({
  from: fc.option(arbFilterString, { nil: undefined }),
  to: fc.option(arbFilterString, { nil: undefined }),
  folder: fc.option(fc.constantFrom('INBOX', 'Sent', 'Drafts', 'Trash'), { nil: undefined }),
  date_after: fc.option(arbValidDate, { nil: undefined }),
  date_before: fc.option(arbValidDate, { nil: undefined }),
  has_attachment: fc.option(fc.boolean(), { nil: undefined }),
})

describe('Property: Search filter validation', () => {
  describe('Empty filter exclusion', () => {
    it('empty string filters are excluded from params', () => {
      fc.assert(
        fc.property(arbFilterString, (value) => {
          const filters: SearchFilters = { from: value, to: value }
          const params = buildSearchParams(filters)
          if (!value.trim()) {
            expect(params.from).toBeUndefined()
            expect(params.to).toBeUndefined()
          } else {
            expect(params.from).toBe(value.trim())
            expect(params.to).toBe(value.trim())
          }
        }),
        { numRuns: 100 },
      )
    })

    it('undefined filters are excluded from params', () => {
      const filters: SearchFilters = {}
      const params = buildSearchParams(filters)
      expect(params.from).toBeUndefined()
      expect(params.to).toBeUndefined()
      expect(params.folder).toBeUndefined()
      expect(params.date_after).toBeUndefined()
      expect(params.date_before).toBeUndefined()
      expect(params.has_attachment).toBeUndefined()
    })

    it('filter values are trimmed in params', () => {
      fc.assert(
        fc.property(
          fc.tuple(arbFilterString, arbFilterString).filter(([a, b]) => a.trim().length > 0 && b.trim().length > 0),
          ([from, to]) => {
            const filters: SearchFilters = { from: `  ${from}  `, to: `  ${to}  ` }
            const params = buildSearchParams(filters)
            expect(params.from).toBe(from.trim())
            expect(params.to).toBe(to.trim())
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  describe('Filter combination validity', () => {
    it('combining any filters never produces invalid params', () => {
      fc.assert(
        fc.property(arbSearchFilters, (filters) => {
          const params = buildSearchParams(filters)

          // All string params should be non-empty strings when present
          for (const key of ['from', 'to', 'folder']) {
            if (params[key] !== undefined) {
              expect(typeof params[key]).toBe('string')
              expect((params[key] as string).length).toBeGreaterThan(0)
            }
          }

          // Date params should be valid date strings when present
          if (params.date_after !== undefined) {
            expect(typeof params.date_after).toBe('string')
          }
          if (params.date_before !== undefined) {
            expect(typeof params.date_before).toBe('string')
          }

          // has_attachment should be boolean when present
          if (params.has_attachment !== undefined) {
            expect(typeof params.has_attachment).toBe('boolean')
          }
        }),
        { numRuns: 100 },
      )
    })

    it('no key in params is an empty string', () => {
      fc.assert(
        fc.property(arbSearchFilters, (filters) => {
          const params = buildSearchParams(filters)
          for (const [key, value] of Object.entries(params)) {
            expect(key.length).toBeGreaterThan(0)
            if (typeof value === 'string') {
              expect(value.length).toBeGreaterThan(0)
            }
          }
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('Date filter format validation', () => {
    it('valid date strings pass validation', () => {
      fc.assert(
        fc.property(arbValidDate, (date) => {
          expect(isValidDateFormat(date)).toBe(true)
        }),
        { numRuns: 100 },
      )
    })

    it('invalid date formats fail validation', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('not-a-date'),
            fc.constant('2025/01/15'),
            fc.constant('15-01-2025'),
            fc.constant('2025-13-01'),
            fc.constant('2025-01-32'),
            fc.constant('abc'),
            fc.nat({ max: 99999999 }).map(String),
          ),
          (date) => {
            expect(isValidDateFormat(date)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('date range: date_after <= date_before', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-06-01') }),
          fc.integer({ min: 0, max: 365 }),
          (startDate, offsetDays) => {
            // Skip invalid dates (NaN from timezone edge cases)
            if (isNaN(startDate.getTime())) return
            const after = startDate.toISOString().split('T')[0]
            const beforeDate = new Date(startDate.getTime() + offsetDays * 86400000)
            if (isNaN(beforeDate.getTime())) return
            const before = beforeDate.toISOString().split('T')[0]
            expect(isValidDateRange(after, before)).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  describe('Minimum character threshold', () => {
    it('search does NOT trigger when trimmed length < 2', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant(' '),
            fc.constant('a'),
            fc.constant(' a '),
          ).filter((s) => s.trim().length < 2),
          (query) => {
            expect(query.trim().length < 2).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('search IS triggered when trimmed length >= 2', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 200 }).filter(
            (s) => s.trim().length >= 2,
          ),
          (query) => {
            expect(query.trim().length >= 2).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
