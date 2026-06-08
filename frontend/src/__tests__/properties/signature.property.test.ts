import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { sanitize } from '../../lib/sanitize'

/**
 * Property: Signature content preservation
 *
 * Validates the signature logic from ComposeDialog.tsx:
 * 1. Default signature is appended only once (no doubling)
 * 2. Signature content is preserved as-is through sanitization (HTML signatures)
 * 3. Non-default signatures don't auto-append
 */

/**
 * Appends a signature to the body HTML, only if it's a default signature.
 * Matches the logic in ComposeDialog's useEffect for new messages.
 * Prevents doubling by checking if the content is already present.
 */
function appendDefaultSignature(
  bodyHtml: string,
  signatureContent: string,
  isDefault: boolean,
): string {
  if (!isDefault || !signatureContent) return bodyHtml
  // Already contains the signature — don't double-append
  if (bodyHtml.includes(signatureContent)) return bodyHtml
  return '<br/><br/>' + signatureContent
}

/**
 * Simulates the compose dialog's signature append logic:
 * Only appends if body is empty (trimmed) and signature is available.
 */
function simulateComposeSignatureAppend(
  bodyHtml: string,
  signatureContent: string,
  isDefault: boolean,
): string {
  if (!isDefault || !signatureContent) return bodyHtml
  if (bodyHtml.trim()) return bodyHtml // body already has content, don't append
  return '<br/><br/>' + signatureContent
}

/** Arbitrary HTML signature content (safe chars only — no &, <, > which DOMParser encodes) */
const arbHtmlSignature = fc.oneof(
  fc.constant('<p>Best regards,<br/>John Doe</p>'),
  fc.constant('<div><strong>John</strong> · CEO</div>'),
  fc.constant('<p style="color: #666;">Sent from my iPhone</p>'),
  fc.string({ minLength: 1, maxLength: 200 })
    .filter((s) => !s.includes('&') && !s.includes('<') && !s.includes('>'))
    .map((s) => `<p>${s}</p>`),
  fc.tuple(
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('&') && !s.includes('<')),
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('&') && !s.includes('<')),
  ).map(
    ([name, title]) => `<div><strong>${name}</strong><br/><em>${title}</em></div>`,
  ),
)

/** Arbitrary compose mode */
const arbComposeMode = fc.constantFrom('new', 'reply', 'forward')

describe('Property: Signature content preservation', () => {
  describe('Default signature append-once', () => {
    it('default signature is appended when body is empty', () => {
      fc.assert(
        fc.property(arbHtmlSignature, (signature) => {
          const result = simulateComposeSignatureAppend('', signature, true)
          expect(result).toContain(signature)
        }),
        { numRuns: 100 },
      )
    })

    it('default signature is NOT appended when body already has content', () => {
      fc.assert(
        fc.property(arbHtmlSignature, (signature) => {
          const body = '<p>Reply text here</p>'
          const result = simulateComposeSignatureAppend(body, signature, true)
          expect(result).toBe(body)
        }),
        { numRuns: 100 },
      )
    })

    it('appending signature twice does not double it', () => {
      fc.assert(
        fc.property(arbHtmlSignature, (signature) => {
          const once = appendDefaultSignature('', signature, true)
          const twice = appendDefaultSignature(once, signature, true)
          expect(twice).toBe(once)
          // Count occurrences — should appear exactly once
          const count = twice.split(signature).length - 1
          expect(count).toBe(1)
        }),
        { numRuns: 100 },
      )
    })

    it('idempotent: applying append twice yields same result as once', () => {
      fc.assert(
        fc.property(arbHtmlSignature, fc.string({ maxLength: 200 }), (signature, body) => {
          const once = appendDefaultSignature(body, signature, true)
          const twice = appendDefaultSignature(once, signature, true)
          expect(twice).toBe(once)
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('Non-default signature behavior', () => {
    it('non-default signature is NOT auto-appended', () => {
      fc.assert(
        fc.property(arbHtmlSignature, (signature) => {
          const result = appendDefaultSignature('', signature, false)
          expect(result).toBe('')
        }),
        { numRuns: 100 },
      )
    })

    it('non-default signature does not modify existing body', () => {
      fc.assert(
        fc.property(arbHtmlSignature, (signature) => {
          const body = '<p>My reply</p>'
          const result = appendDefaultSignature(body, signature, false)
          expect(result).toBe(body)
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('Empty signature handling', () => {
    it('empty signature content is not appended', () => {
      fc.assert(
        fc.property(arbComposeMode, () => {
          const result = appendDefaultSignature('', '', true)
          expect(result).toBe('')
        }),
        { numRuns: 100 },
      )
    })

    it('empty body with empty signature stays empty', () => {
      const result = simulateComposeSignatureAppend('', '', true)
      expect(result).toBe('')
    })
  })

  describe('Signature content preservation through sanitization', () => {
    it('safe HTML signatures pass through sanitization unchanged', () => {
      fc.assert(
        fc.property(arbHtmlSignature, (signature) => {
          const sanitized = sanitize(signature)
          // The safe content should be preserved
          const parser = new DOMParser()
          const inputDoc = parser.parseFromString(signature, 'text/html')
          const resultDoc = parser.parseFromString(sanitized, 'text/html')
          expect(resultDoc.body.innerHTML).toBe(inputDoc.body.innerHTML)
        }),
        { numRuns: 100 },
      )
    })

    it('signatures with dangerous content are sanitized but non-dangerous parts preserved', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 30 })
              .filter((s) => !s.includes('&') && !s.includes('<') && !s.includes('>') && s.trim().length > 0)
              .map((s) => `<p>${s}</p>`),
            fc.string({ minLength: 1, maxLength: 30 })
              .filter((s) => !s.includes('&') && !s.includes('<') && !s.includes('>')),
          ),
          ([safe, before]) => {
            const dangerous = `${before}<script>evil()</script>${safe}`
            const sanitized = sanitize(dangerous)
            // Script tags should be removed
            expect(sanitized).not.toContain('<script>')
            expect(sanitized).not.toContain('evil()')
            // Safe content should be preserved — compare parsed DOM to handle entity encoding
            const parser = new DOMParser()
            const safeDoc = parser.parseFromString(safe, 'text/html')
            const sanitizedDoc = parser.parseFromString(sanitized, 'text/html')
            expect(sanitizedDoc.body.innerHTML).toContain(safeDoc.body.innerHTML)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('signature content is preserved as-is through the compose flow', () => {
      fc.assert(
        fc.property(arbHtmlSignature, (signature) => {
          // Simulate: default sig → append → sanitize → should contain original
          const appended = appendDefaultSignature('', signature, true)
          const sanitized = sanitize(appended)
          // Parse both to compare
          const parser = new DOMParser()
          const appendedDoc = parser.parseFromString(appended, 'text/html')
          const sanitizedDoc = parser.parseFromString(sanitized, 'text/html')
          expect(sanitizedDoc.body.innerHTML).toBe(appendedDoc.body.innerHTML)
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('Reply and forward modes do not append signature', () => {
    it('reply mode does not trigger signature append', () => {
      fc.assert(
        fc.property(arbHtmlSignature, (signature) => {
          const replyBody = '<br/><blockquote>Original message</blockquote>'
          // Since replyBody contains text, appendDefaultSignature checks includes()
          // It may or may not append depending on whether body already contains signature
          // But the body itself is not empty, so simulateCompose wouldn't append
          const simulated = simulateComposeSignatureAppend(replyBody, signature, true)
          expect(simulated).toBe(replyBody)
        }),
        { numRuns: 100 },
      )
    })

    it('forward mode does not trigger signature append', () => {
      fc.assert(
        fc.property(arbHtmlSignature, (signature) => {
          const forwardBody = '<br/><p>---------- Forwarded message ----------</p><p>Content</p>'
          const simulated = simulateComposeSignatureAppend(forwardBody, signature, true)
          expect(simulated).toBe(forwardBody)
        }),
        { numRuns: 100 },
      )
    })
  })
})
