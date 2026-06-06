import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 15: Attachment validation
 * Validates: Requirements 11.6
 *
 * For any file size in bytes and current attachment count, the attachment validator
 * SHALL reject the file if size > 25MB (26,214,400 bytes) or if current count ≥ 10,
 * and SHALL accept otherwise.
 */

/** Maximum file size: 25MB */
const MAX_FILE_SIZE = 26_214_400
/** Maximum number of attachments */
const MAX_ATTACHMENTS = 10

/**
 * Validates whether a file attachment should be accepted.
 * Returns true if the file is acceptable, false if it should be rejected.
 */
function validateAttachment(fileSize: number, currentCount: number): boolean {
  if (fileSize > MAX_FILE_SIZE) return false
  if (currentCount >= MAX_ATTACHMENTS) return false
  return true
}

describe('Property 15: Attachment validation', () => {
  it('rejects files larger than 25MB (26,214,400 bytes)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FILE_SIZE + 1, max: 100_000_000 }),
        fc.nat({ max: MAX_ATTACHMENTS - 1 }),
        (fileSize, currentCount) => {
          expect(validateAttachment(fileSize, currentCount)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rejects when attachment count is already at or above 10', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MAX_FILE_SIZE }),
        fc.integer({ min: MAX_ATTACHMENTS, max: 100 }),
        (fileSize, currentCount) => {
          expect(validateAttachment(fileSize, currentCount)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('accepts files within size limit and below attachment count', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MAX_FILE_SIZE }),
        fc.nat({ max: MAX_ATTACHMENTS - 1 }),
        (fileSize, currentCount) => {
          expect(validateAttachment(fileSize, currentCount)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('boundary: exactly 25MB is accepted', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MAX_ATTACHMENTS - 1 }),
        (currentCount) => {
          expect(validateAttachment(MAX_FILE_SIZE, currentCount)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('boundary: exactly 25MB + 1 byte is rejected', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MAX_ATTACHMENTS - 1 }),
        (currentCount) => {
          expect(validateAttachment(MAX_FILE_SIZE + 1, currentCount)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('boundary: count of exactly 10 is rejected', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MAX_FILE_SIZE }),
        (fileSize) => {
          expect(validateAttachment(fileSize, MAX_ATTACHMENTS)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('boundary: count of 9 with valid size is accepted', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MAX_FILE_SIZE }),
        (fileSize) => {
          expect(validateAttachment(fileSize, 9)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('combined: validates the complete decision logic for arbitrary inputs', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100_000_000 }),
        fc.nat({ max: 50 }),
        (fileSize, currentCount) => {
          const result = validateAttachment(fileSize, currentCount)
          const expected = fileSize <= MAX_FILE_SIZE && currentCount < MAX_ATTACHMENTS
          expect(result).toBe(expected)
        },
      ),
      { numRuns: 100 },
    )
  })
})
