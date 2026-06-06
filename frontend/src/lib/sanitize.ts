/**
 * HTML sanitizer for email message rendering.
 * Uses browser-native DOMParser to parse and clean HTML.
 *
 * Strips: <script>, <iframe>, <object>, <embed>, <style>, <link> elements,
 * inline event handlers (on*), and dangerous URI schemes (javascript:, data:).
 */

/** Elements that are always removed from sanitized output */
const DANGEROUS_ELEMENTS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'style',
  'link',
])

/** Attributes that can contain URIs which need scheme validation */
const URI_ATTRIBUTES = new Set(['href', 'src'])

/** Regex matching dangerous URI schemes (javascript: and data:) */
const DANGEROUS_URI_PATTERN = /^\s*(javascript|data)\s*:/i

/**
 * Sanitizes an HTML string by removing dangerous elements, event handler
 * attributes, and dangerous URI schemes. Preserves safe HTML structure.
 *
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitize(html: string): string {
  if (!html) return ''

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Walk the DOM and remove dangerous content
  sanitizeNode(doc.body)

  return doc.body.innerHTML
}

/**
 * Recursively sanitizes a DOM node and its children.
 */
function sanitizeNode(node: Node): void {
  // Collect child nodes to iterate (we'll modify the tree as we go)
  const children = Array.from(node.childNodes)

  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element
      const tagName = element.tagName.toLowerCase()

      // Remove dangerous elements entirely
      if (DANGEROUS_ELEMENTS.has(tagName)) {
        node.removeChild(child)
        continue
      }

      // Strip event handler attributes (on*)
      const attributesToRemove: string[] = []
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i]
        const attrName = attr.name.toLowerCase()

        if (attrName.startsWith('on')) {
          attributesToRemove.push(attr.name)
        } else if (URI_ATTRIBUTES.has(attrName) && DANGEROUS_URI_PATTERN.test(attr.value)) {
          attributesToRemove.push(attr.name)
        }
      }

      for (const attrName of attributesToRemove) {
        element.removeAttribute(attrName)
      }

      // Recurse into children
      sanitizeNode(element)
    }
  }
}
