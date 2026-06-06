import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Property 19: Color contrast compliance
 *
 * For any foreground/background color pair used in the token system
 * (text-primary on bg, text-primary on surface, text-secondary on bg,
 * text-secondary on surface) in both light and dark themes, the computed WCAG
 * contrast ratio SHALL be ≥ 4.5:1 for normal text and ≥ 3:1 for large text.
 *
 * **Validates: Requirements 14.4**
 */

// --- WCAG contrast ratio utilities ---

/**
 * Parses a hex color string (#RRGGBB) to [R, G, B] in 0–255 range.
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

/**
 * Linearizes an sRGB channel value (0–255) to a linear value (0–1).
 */
function linearize(channel: number): number {
  const sRGB = channel / 255
  return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
}

/**
 * Computes the relative luminance of an RGB color per WCAG 2.1.
 */
function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(linearize)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Computes the WCAG contrast ratio between two colors.
 * Returns a value ≥ 1, where L1 is the lighter color.
 */
function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg))
  const l2 = relativeLuminance(hexToRgb(bg))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// --- Parse tokens.css ---

function parseTokens(): { light: Record<string, string>; dark: Record<string, string> } {
  const cssPath = resolve(__dirname, '../../styles/tokens.css')
  const css = readFileSync(cssPath, 'utf-8')

  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}

  // Parse :root block
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/)
  if (rootMatch) {
    const rootContent = rootMatch[1]
    const propRegex = /--(color-[\w-]+):\s*(#[0-9a-fA-F]{6})/g
    let match: RegExpExecArray | null
    while ((match = propRegex.exec(rootContent)) !== null) {
      light[match[1]] = match[2]
    }
  }

  // Parse [data-theme="dark"] block
  const darkMatch = css.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)
  if (darkMatch) {
    const darkContent = darkMatch[1]
    const propRegex = /--(color-[\w-]+):\s*(#[0-9a-fA-F]{6})/g
    let match: RegExpExecArray | null
    while ((match = propRegex.exec(darkContent)) !== null) {
      dark[match[1]] = match[2]
    }
  }

  return { light, dark }
}

// --- Token color pairs to test ---

interface ColorPair {
  name: string
  fg: string
  bg: string
  isLargeText: boolean
}

function getColorPairs(tokens: Record<string, string>): ColorPair[] {
  const pairs: ColorPair[] = []

  const fg_primary = tokens['color-text-primary']
  const fg_secondary = tokens['color-text-secondary']
  const bg_main = tokens['color-bg']
  const bg_surface = tokens['color-surface']

  if (fg_primary && bg_main) {
    pairs.push({ name: 'text-primary on bg', fg: fg_primary, bg: bg_main, isLargeText: false })
    pairs.push({ name: 'text-primary on bg (large)', fg: fg_primary, bg: bg_main, isLargeText: true })
  }
  if (fg_primary && bg_surface) {
    pairs.push({ name: 'text-primary on surface', fg: fg_primary, bg: bg_surface, isLargeText: false })
    pairs.push({ name: 'text-primary on surface (large)', fg: fg_primary, bg: bg_surface, isLargeText: true })
  }
  if (fg_secondary && bg_main) {
    pairs.push({ name: 'text-secondary on bg', fg: fg_secondary, bg: bg_main, isLargeText: false })
    pairs.push({ name: 'text-secondary on bg (large)', fg: fg_secondary, bg: bg_main, isLargeText: true })
  }
  if (fg_secondary && bg_surface) {
    pairs.push({ name: 'text-secondary on surface', fg: fg_secondary, bg: bg_surface, isLargeText: false })
    pairs.push({ name: 'text-secondary on surface (large)', fg: fg_secondary, bg: bg_surface, isLargeText: true })
  }

  return pairs
}

describe('Property: Color contrast compliance', () => {
  const { light, dark } = parseTokens()

  it('tokens.css is parsed correctly with required color tokens', () => {
    expect(light['color-text-primary']).toBeDefined()
    expect(light['color-text-secondary']).toBeDefined()
    expect(light['color-bg']).toBeDefined()
    expect(light['color-surface']).toBeDefined()
    expect(dark['color-text-primary']).toBeDefined()
    expect(dark['color-text-secondary']).toBeDefined()
    expect(dark['color-bg']).toBeDefined()
    expect(dark['color-surface']).toBeDefined()
  })

  describe('Light theme', () => {
    const pairs = getColorPairs(light)

    it('all text/background pairs meet WCAG contrast requirements', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...pairs),
          (pair) => {
            const ratio = contrastRatio(pair.fg, pair.bg)
            const minRatio = pair.isLargeText ? 3.0 : 4.5

            expect(ratio).toBeGreaterThanOrEqual(minRatio)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  describe('Dark theme', () => {
    const pairs = getColorPairs(dark)

    it('all text/background pairs meet WCAG contrast requirements', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...pairs),
          (pair) => {
            const ratio = contrastRatio(pair.fg, pair.bg)
            const minRatio = pair.isLargeText ? 3.0 : 4.5

            expect(ratio).toBeGreaterThanOrEqual(minRatio)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  describe('Contrast ratio helper correctness', () => {
    it('contrast ratio of a color against itself is 1:1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (r, g, b) => {
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
            const ratio = contrastRatio(hex, hex)
            expect(ratio).toBeCloseTo(1.0, 5)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('black on white produces max contrast (21:1)', () => {
      const ratio = contrastRatio('#000000', '#ffffff')
      expect(ratio).toBeCloseTo(21.0, 0)
    })

    it('contrast ratio is always ≥ 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (r1, g1, b1, r2, g2, b2) => {
            const hex1 = `#${r1.toString(16).padStart(2, '0')}${g1.toString(16).padStart(2, '0')}${b1.toString(16).padStart(2, '0')}`
            const hex2 = `#${r2.toString(16).padStart(2, '0')}${g2.toString(16).padStart(2, '0')}${b2.toString(16).padStart(2, '0')}`
            const ratio = contrastRatio(hex1, hex2)
            expect(ratio).toBeGreaterThanOrEqual(1.0)
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
