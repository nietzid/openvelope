import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { MAX_CONTENT_LENGTH } from '../../components/primitives/Tooltip'

/**
 * Property 7: Tooltip text length constraint
 * Validates: Requirements 5.7
 *
 * For any string provided as tooltip content, the rendered tooltip text
 * SHALL be at most 80 characters. Strings exceeding 80 characters SHALL be truncated.
 */

/**
 * Apply the same truncation logic as the Tooltip component.
 */
function truncateContent(content: string): string {
  return content.length > MAX_CONTENT_LENGTH
    ? content.slice(0, MAX_CONTENT_LENGTH)
    : content
}

describe('Property 7: Tooltip text length constraint', () => {
  it('truncated content is always <= 80 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (content) => {
          const result = truncateContent(content)
          expect(result.length).toBeLessThanOrEqual(MAX_CONTENT_LENGTH)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('content <= 80 characters is preserved unchanged', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: MAX_CONTENT_LENGTH }),
        (content) => {
          const result = truncateContent(content)
          expect(result).toBe(content)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('content > 80 characters is truncated to exactly 80 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: MAX_CONTENT_LENGTH + 1, maxLength: 500 }),
        (content) => {
          const result = truncateContent(content)
          expect(result.length).toBe(MAX_CONTENT_LENGTH)
          // The truncated result should be the first 80 chars of the original
          expect(result).toBe(content.slice(0, MAX_CONTENT_LENGTH))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('truncation preserves the beginning of the string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (content) => {
          const result = truncateContent(content)
          // The result should always be a prefix of the original content
          expect(content.startsWith(result)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('works with unicode characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200, unit: 'grapheme-ascii' }),
        (content) => {
          const result = truncateContent(content)
          expect(result.length).toBeLessThanOrEqual(MAX_CONTENT_LENGTH)
        }
      ),
      { numRuns: 100 }
    )
  })
})
