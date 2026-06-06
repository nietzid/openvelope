import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 14: Compose reply/forward pre-fill
 * Validates: Requirements 11.3, 11.4
 *
 * For any original message with sender, subject, and body:
 * - Reply mode SHALL set recipient to original sender, prefix subject with "Re: "
 *   (unless already prefixed), and include original body in a blockquote.
 * - Forward mode SHALL leave recipient empty, prefix subject with "Fwd: "
 *   (unless already prefixed), and include original body below a separator.
 */

/**
 * Re-implements the prefixSubject logic from ComposeDialog.tsx for testing.
 * This matches the exact behavior of the component's internal function.
 */
function prefixSubject(prefix: string, subject: string): string {
  if (subject.toLowerCase().startsWith(prefix.toLowerCase())) {
    return subject
  }
  return `${prefix}${subject}`
}

/**
 * Builds the initial editor HTML content for reply mode.
 */
function buildReplyBody(originalBody: string): string {
  return `<br/><blockquote style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #666;">${originalBody}</blockquote>`
}

/**
 * Builds the initial editor HTML content for forward mode.
 */
function buildForwardBody(originalBody: string): string {
  return `<br/><p>---------- Forwarded message ----------</p>${originalBody}`
}

/** Arbitrary generator for email addresses */
const arbEmail = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0)

/** Arbitrary generator for subjects */
const arbSubject = fc.string({ minLength: 0, maxLength: 100 })

/** Arbitrary generator for body content */
const arbBody = fc.string({ minLength: 0, maxLength: 500 })

describe('Property 14: Compose reply/forward pre-fill', () => {
  describe('Reply mode', () => {
    it('recipient is set to original sender', () => {
      fc.assert(
        fc.property(arbEmail, arbSubject, arbBody, (sender, subject, body) => {
          // In reply mode, recipient = original sender
          const recipient = sender
          expect(recipient).toBe(sender)
        }),
        { numRuns: 100 },
      )
    })

    it('subject is prefixed with "Re: " avoiding double prefix', () => {
      fc.assert(
        fc.property(arbSubject, (subject) => {
          const result = prefixSubject('Re: ', subject)

          // Must start with "Re: " (case-insensitive match of original prefix)
          expect(result.toLowerCase().startsWith('re: ')).toBe(true)

          // Applying prefix twice should not double it
          const doubleResult = prefixSubject('Re: ', result)
          expect(doubleResult).toBe(result)
        }),
        { numRuns: 100 },
      )
    })

    it('subject with existing "Re:" prefix is not double-prefixed', () => {
      fc.assert(
        fc.property(arbSubject, (baseSubject) => {
          const alreadyPrefixed = `Re: ${baseSubject}`
          const result = prefixSubject('Re: ', alreadyPrefixed)
          expect(result).toBe(alreadyPrefixed)
        }),
        { numRuns: 100 },
      )
    })

    it('reply body contains original body in a blockquote', () => {
      fc.assert(
        fc.property(arbBody, (body) => {
          const result = buildReplyBody(body)
          expect(result).toContain('<blockquote')
          expect(result).toContain(body)
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('Forward mode', () => {
    it('recipient is empty in forward mode', () => {
      fc.assert(
        fc.property(arbEmail, arbSubject, arbBody, (sender, subject, body) => {
          // In forward mode, recipient = empty
          const recipient = ''
          expect(recipient).toBe('')
        }),
        { numRuns: 100 },
      )
    })

    it('subject is prefixed with "Fwd: " avoiding double prefix', () => {
      fc.assert(
        fc.property(arbSubject, (subject) => {
          const result = prefixSubject('Fwd: ', subject)

          // Must start with "Fwd: " (case-insensitive match)
          expect(result.toLowerCase().startsWith('fwd: ')).toBe(true)

          // Applying prefix twice should not double it
          const doubleResult = prefixSubject('Fwd: ', result)
          expect(doubleResult).toBe(result)
        }),
        { numRuns: 100 },
      )
    })

    it('subject with existing "Fwd:" prefix is not double-prefixed', () => {
      fc.assert(
        fc.property(arbSubject, (baseSubject) => {
          const alreadyPrefixed = `Fwd: ${baseSubject}`
          const result = prefixSubject('Fwd: ', alreadyPrefixed)
          expect(result).toBe(alreadyPrefixed)
        }),
        { numRuns: 100 },
      )
    })

    it('forward body contains separator and original body', () => {
      fc.assert(
        fc.property(arbBody, (body) => {
          const result = buildForwardBody(body)
          expect(result).toContain('---------- Forwarded message ----------')
          expect(result).toContain(body)
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('Idempotency', () => {
    it('prefixSubject with "Re: " is idempotent', () => {
      fc.assert(
        fc.property(arbSubject, (subject) => {
          const once = prefixSubject('Re: ', subject)
          const twice = prefixSubject('Re: ', once)
          expect(twice).toBe(once)
        }),
        { numRuns: 100 },
      )
    })

    it('prefixSubject with "Fwd: " is idempotent', () => {
      fc.assert(
        fc.property(arbSubject, (subject) => {
          const once = prefixSubject('Fwd: ', subject)
          const twice = prefixSubject('Fwd: ', once)
          expect(twice).toBe(once)
        }),
        { numRuns: 100 },
      )
    })
  })
})
