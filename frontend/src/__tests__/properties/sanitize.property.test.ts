import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { sanitize } from '../../lib/sanitize'

/**
 * Property 12: HTML sanitization removes all dangerous content
 * Validates: Requirements 10.3
 *
 * For any HTML string input, the sanitize function SHALL produce output that contains
 * no dangerous elements, no inline event handler attributes, and no javascript:/data: URIs.
 * Safe content SHALL be preserved.
 *
 * Note: Comprehensive property tests also exist in lib/sanitize.test.ts.
 * This file provides a dedicated property-test-only suite for the spec requirement.
 */

/** Generator for HTML strings with various malicious payloads */
const arbMaliciousHtml = fc.oneof(
  // Random strings that might accidentally form HTML
  fc.string(),
  // Strings with script tags
  fc.tuple(fc.string(), fc.string()).map(
    ([before, after]) => `${before}<script>alert('xss')</script>${after}`,
  ),
  // Strings with event handlers
  fc.tuple(fc.string({ minLength: 1, maxLength: 20 }), fc.constantFrom('onclick', 'onmouseover', 'onerror', 'onload', 'onfocus')).map(
    ([text, handler]) => `<div ${handler}="evil()">${text}</div>`,
  ),
  // Strings with dangerous URIs
  fc.string({ minLength: 1, maxLength: 30 }).map(
    (text) => `<a href="javascript:alert(1)">${text}</a>`,
  ),
  fc.string({ minLength: 1, maxLength: 30 }).map(
    (text) => `<img src="data:text/html,<script>alert(1)</script>">`,
  ),
  // Strings with iframe/object/embed
  fc.string().map(
    (text) => `<iframe src="https://evil.com"></iframe><p>${text}</p>`,
  ),
  fc.string().map(
    (text) => `<object data="evil.swf"><p>${text}</p></object>`,
  ),
  fc.string().map(
    (text) => `<embed src="evil.swf"><p>${text}</p>`,
  ),
  // Strings with style/link elements
  fc.string().map(
    (text) => `<style>body{display:none}</style><p>${text}</p>`,
  ),
  fc.string().map(
    (text) => `<link rel="stylesheet" href="evil.css"><p>${text}</p>`,
  ),
)

/** Generator for safe-only HTML content */
const arbSafeHtml = fc.oneof(
  fc.constant('<p>Hello world</p>'),
  fc.constant('<div><span>Nested content</span></div>'),
  fc.constant('<ul><li>Item 1</li><li>Item 2</li></ul>'),
  fc.constant('<a href="https://example.com">Safe link</a>'),
  fc.constant('<strong>Bold</strong> and <em>italic</em>'),
  fc.constant('<h1>Title</h1><p>Paragraph</p>'),
  fc.constant('<blockquote>Quoted text</blockquote>'),
  fc.constant('<table><tr><td>Cell</td></tr></table>'),
  fc.constant('<img src="https://example.com/img.png">'),
  fc.constant('<br><hr>'),
)

describe('Property 12: HTML sanitization removes all dangerous content', () => {
  it('output never contains dangerous element tags', () => {
    fc.assert(
      fc.property(arbMaliciousHtml, (input) => {
        const result = sanitize(input)
        // Parse the output and check for actual dangerous elements in the DOM tree
        const parser = new DOMParser()
        const doc = parser.parseFromString(result, 'text/html')
        const dangerousSelectors = ['script', 'iframe', 'object', 'embed', 'style', 'link']
        for (const selector of dangerousSelectors) {
          expect(doc.body.querySelectorAll(selector).length).toBe(0)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('output never contains inline event handler attributes', () => {
    fc.assert(
      fc.property(arbMaliciousHtml, (input) => {
        const result = sanitize(input)
        const eventHandlerPattern = /\s+on\w+\s*=/i
        expect(eventHandlerPattern.test(result)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('output never contains javascript: or data: URI schemes in href/src', () => {
    fc.assert(
      fc.property(arbMaliciousHtml, (input) => {
        const result = sanitize(input)
        const parser = new DOMParser()
        const doc = parser.parseFromString(result, 'text/html')
        const elements = doc.body.querySelectorAll('[href], [src]')
        for (const el of elements) {
          const href = el.getAttribute('href') ?? ''
          const src = el.getAttribute('src') ?? ''
          expect(/^\s*(javascript|data)\s*:/i.test(href)).toBe(false)
          expect(/^\s*(javascript|data)\s*:/i.test(src)).toBe(false)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('preserves safe HTML content unchanged', () => {
    fc.assert(
      fc.property(arbSafeHtml, (input) => {
        const result = sanitize(input)
        // Parse both and compare — safe content should pass through unchanged
        const parser = new DOMParser()
        const inputDoc = parser.parseFromString(input, 'text/html')
        const resultDoc = parser.parseFromString(result, 'text/html')
        expect(resultDoc.body.innerHTML).toBe(inputDoc.body.innerHTML)
      }),
      { numRuns: 100 },
    )
  })

  it('output from arbitrary strings never contains dangerous elements', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitize(input)
        // Parse the output and check for actual dangerous elements in the DOM tree
        const parser = new DOMParser()
        const doc = parser.parseFromString(result, 'text/html')
        const dangerousSelectors = ['script', 'iframe', 'object', 'embed', 'style', 'link']
        for (const selector of dangerousSelectors) {
          expect(doc.body.querySelectorAll(selector).length).toBe(0)
        }
      }),
      { numRuns: 100 },
    )
  })
})
