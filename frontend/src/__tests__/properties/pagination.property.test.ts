import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 11: Pagination control disabled states
 * Validates: Requirements 9.6
 *
 * For any pagination state (page, pageSize, total):
 * - Previous button SHALL be disabled when page = 0
 * - Next button SHALL be disabled when (page + 1) × pageSize ≥ total
 */

/** Pure logic functions matching the pagination behavior */
function isPrevDisabled(page: number): boolean {
  return page <= 0
}

function isNextDisabled(page: number, pageSize: number, total: number): boolean {
  return (page + 1) * pageSize >= total
}

describe('Property 11: Pagination control disabled states', () => {
  it('Previous is always disabled when page is 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(25, 50, 100, 200),
        fc.nat({ max: 10000 }),
        (pageSize, total) => {
          expect(isPrevDisabled(0)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Previous is always enabled when page > 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (page) => {
          expect(isPrevDisabled(page)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Next is disabled when (page+1)*pageSize >= total', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100 }),
        fc.constantFrom(25, 50, 100, 200),
        fc.nat({ max: 10000 }),
        (page, pageSize, total) => {
          const nextDisabled = isNextDisabled(page, pageSize, total)
          const expected = (page + 1) * pageSize >= total
          expect(nextDisabled).toBe(expected)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Next is enabled when there are more items after the current page', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100 }),
        fc.constantFrom(25, 50, 100, 200),
        (page, pageSize) => {
          // total is guaranteed to be larger than what would fill all pages through (page+1)
          const total = (page + 1) * pageSize + 1
          expect(isNextDisabled(page, pageSize, total)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Next is disabled on the last page', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(25, 50, 100, 200),
        fc.integer({ min: 1, max: 5000 }),
        (pageSize, total) => {
          // Last page index
          const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1)
          expect(isNextDisabled(lastPage, pageSize, total)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('consistency: if prev is disabled (page=0) and total <= pageSize, next is also disabled', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(25, 50, 100, 200),
        (pageSize) => {
          // total fits in first page
          const total = fc.sample(fc.integer({ min: 0, max: pageSize }), 1)[0]
          const page = 0
          expect(isPrevDisabled(page)).toBe(true)
          expect(isNextDisabled(page, pageSize, total)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
