import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { sanitize } from './sanitize'

describe('sanitize', () => {
  describe('unit tests', () => {
    it('returns empty string for empty input', () => {
      expect(sanitize('')).toBe('')
    })

    it('returns empty string for null-like input', () => {
      expect(sanitize(undefined as unknown as string)).toBe('')
    })

    it('preserves plain text', () => {
      expect(sanitize('Hello, world!')).toBe('Hello, world!')
    })

    it('preserves safe HTML elements', () => {
      const input = '<p>Hello <strong>world</strong></p>'
      expect(sanitize(input)).toBe('<p>Hello <strong>world</strong></p>')
    })

    it('preserves links with safe hrefs', () => {
      const input = '<a href="https://example.com">Link</a>'
      expect(sanitize(input)).toBe('<a href="https://example.com">Link</a>')
    })

    it('preserves images with safe src', () => {
      const input = '<img src="https://example.com/img.png">'
      expect(sanitize(input)).toContain('src="https://example.com/img.png"')
    })

    it('strips <script> elements', () => {
      const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
      expect(sanitize(input)).toBe('<p>Hello</p><p>World</p>')
    })

    it('strips <iframe> elements', () => {
      const input = '<div><iframe src="https://evil.com"></iframe></div>'
      expect(sanitize(input)).toBe('<div></div>')
    })

    it('strips <object> elements', () => {
      const input = '<object data="evil.swf"></object><p>safe</p>'
      expect(sanitize(input)).toBe('<p>safe</p>')
    })

    it('strips <embed> elements', () => {
      const input = '<embed src="evil.swf"><p>safe</p>'
      expect(sanitize(input)).toBe('<p>safe</p>')
    })

    it('strips <style> elements', () => {
      const input = '<style>body { display: none; }</style><p>visible</p>'
      expect(sanitize(input)).toBe('<p>visible</p>')
    })

    it('strips <link> elements', () => {
      const input = '<link rel="stylesheet" href="evil.css"><p>safe</p>'
      expect(sanitize(input)).toBe('<p>safe</p>')
    })

    it('strips inline event handlers (onclick)', () => {
      const input = '<button onclick="alert(1)">Click</button>'
      expect(sanitize(input)).toBe('<button>Click</button>')
    })

    it('strips inline event handlers (onmouseover)', () => {
      const input = '<div onmouseover="steal()">Hover</div>'
      expect(sanitize(input)).toBe('<div>Hover</div>')
    })

    it('strips inline event handlers (onerror)', () => {
      const input = '<img src="x" onerror="alert(1)">'
      const result = sanitize(input)
      expect(result).not.toContain('onerror')
      expect(result).toContain('src="x"')
    })

    it('strips javascript: URI in href', () => {
      const input = '<a href="javascript:alert(1)">Click</a>'
      const result = sanitize(input)
      expect(result).not.toContain('javascript:')
      expect(result).toBe('<a>Click</a>')
    })

    it('strips javascript: URI with whitespace', () => {
      const input = '<a href="  javascript:alert(1)">Click</a>'
      const result = sanitize(input)
      expect(result).not.toContain('javascript:')
    })

    it('strips javascript: URI case-insensitive', () => {
      const input = '<a href="JavaScript:alert(1)">Click</a>'
      const result = sanitize(input)
      expect(result).not.toContain('JavaScript:')
    })

    it('strips data: URI in href', () => {
      const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>'
      const result = sanitize(input)
      expect(result).not.toContain('data:')
    })

    it('strips data: URI in src', () => {
      const input = '<img src="data:image/svg+xml,<svg onload=alert(1)>">'
      const result = sanitize(input)
      expect(result).not.toContain('data:')
    })

    it('strips javascript: URI in src', () => {
      const input = '<img src="javascript:alert(1)">'
      const result = sanitize(input)
      expect(result).not.toContain('javascript:')
    })

    it('handles nested dangerous elements', () => {
      const input = '<div><p><script>evil()</script></p></div>'
      expect(sanitize(input)).toBe('<div><p></p></div>')
    })

    it('handles multiple event handlers on one element', () => {
      const input = '<div onclick="a()" onmouseover="b()" class="safe">Text</div>'
      const result = sanitize(input)
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('onmouseover')
      expect(result).toContain('class="safe"')
      expect(result).toContain('Text')
    })

    it('preserves safe attributes', () => {
      const input = '<div id="main" class="container" data-value="42">Content</div>'
      expect(sanitize(input)).toBe('<div id="main" class="container" data-value="42">Content</div>')
    })

    it('handles deeply nested safe HTML', () => {
      const input = '<div><ul><li><a href="https://safe.com">Link</a></li></ul></div>'
      expect(sanitize(input)).toBe('<div><ul><li><a href="https://safe.com">Link</a></li></ul></div>')
    })
  })

  describe('property-based tests', () => {
    /**
     * **Validates: Requirements 10.3**
     * Property 12: HTML sanitization removes all dangerous content
     */
    it('output never contains dangerous elements', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = sanitize(input)
          const dangerousTags = ['<script', '<iframe', '<object', '<embed', '<style', '<link']
          for (const tag of dangerousTags) {
            if (result.toLowerCase().includes(tag)) {
              return false
            }
          }
          return true
        }),
        { numRuns: 100 },
      )
    })

    it('output never contains inline event handlers', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const result = sanitize(input)
            // Check for on* attributes in the sanitized output
            const eventHandlerPattern = /\s+on\w+\s*=/i
            return !eventHandlerPattern.test(result)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('output never contains javascript: or data: URI schemes in href/src', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = sanitize(input)
          // Parse the result and check href/src attributes
          const parser = new DOMParser()
          const doc = parser.parseFromString(result, 'text/html')
          const elements = doc.body.querySelectorAll('[href], [src]')
          for (const el of elements) {
            const href = el.getAttribute('href') ?? ''
            const src = el.getAttribute('src') ?? ''
            if (/^\s*(javascript|data)\s*:/i.test(href) || /^\s*(javascript|data)\s*:/i.test(src)) {
              return false
            }
          }
          return true
        }),
        { numRuns: 100 },
      )
    })

    it('preserves safe content structure', () => {
      // Generate HTML with only safe elements and verify it passes through unchanged
      const safeHtml = fc.oneof(
        fc.constant('<p>Hello world</p>'),
        fc.constant('<div><span>text</span></div>'),
        fc.constant('<ul><li>item 1</li><li>item 2</li></ul>'),
        fc.constant('<a href="https://example.com">link</a>'),
        fc.constant('<strong>bold</strong> and <em>italic</em>'),
        fc.constant('<h1>Title</h1><p>Paragraph</p>'),
        fc.constant('<blockquote>Quote</blockquote>'),
        fc.constant('<table><tr><td>Cell</td></tr></table>'),
      )

      fc.assert(
        fc.property(safeHtml, (input) => {
          const result = sanitize(input)
          // Parse both and compare structure
          const parser = new DOMParser()
          const inputDoc = parser.parseFromString(input, 'text/html')
          const resultDoc = parser.parseFromString(result, 'text/html')
          return inputDoc.body.innerHTML === resultDoc.body.innerHTML
        }),
        { numRuns: 100 },
      )
    })

    it('stripping dangerous elements from generated HTML with injected scripts', () => {
      const htmlWithScript = fc.tuple(
        fc.constantFrom('<p>', '<div>', '<span>'),
        fc.string(),
        fc.constantFrom('</p>', '</div>', '</span>'),
      ).map(([open, text, close]) => `${open}${text}${close}<script>alert("xss")</script>`)

      fc.assert(
        fc.property(htmlWithScript, (input) => {
          const result = sanitize(input)
          return !result.toLowerCase().includes('<script')
        }),
        { numRuns: 100 },
      )
    })
  })
})
