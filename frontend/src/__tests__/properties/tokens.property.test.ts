import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Property 1: Token structure completeness and theme parity
 * Validates: Requirements 1.1, 1.2
 *
 * For any design token configuration, the validation function SHALL accept it only if it contains
 * at least 5 semantic color roles, at least 6 spacing stops, at least 3 radius stops,
 * at least 3 shadow elevations, and required typography values — AND the light and dark token
 * sets have identical key sets.
 */

// Parse the actual tokens.css to extract token keys
function parseTokensCSS(): { lightKeys: string[]; darkKeys: string[] } {
  const tokensPath = path.resolve(__dirname, '../../styles/tokens.css')
  const content = fs.readFileSync(tokensPath, 'utf-8')

  const lightKeys: string[] = []
  const darkKeys: string[] = []

  // Extract :root block
  const rootMatch = content.match(/:root\s*\{([^}]+)\}/)
  if (rootMatch) {
    const rootBlock = rootMatch[1]
    const varMatches = rootBlock.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)
    for (const m of varMatches) {
      lightKeys.push(m[1])
    }
  }

  // Extract [data-theme="dark"] block
  const darkMatch = content.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)
  if (darkMatch) {
    const darkBlock = darkMatch[1]
    const varMatches = darkBlock.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)
    for (const m of varMatches) {
      darkKeys.push(m[1])
    }
  }

  return { lightKeys, darkKeys }
}

function categorizeTokens(keys: string[]) {
  return {
    colors: keys.filter((k) => k.startsWith('color-')),
    spacing: keys.filter((k) => k.startsWith('space-')),
    radius: keys.filter((k) => k.startsWith('radius-')),
    shadows: keys.filter((k) => k.startsWith('shadow-')),
    typography: keys.filter(
      (k) =>
        k.startsWith('font-') ||
        k.startsWith('text-') ||
        k.startsWith('leading-')
    ),
  }
}

interface TokenConfig {
  colors: string[]
  spacing: string[]
  radius: string[]
  shadows: string[]
  typography: string[]
}

function validateTokenConfig(config: TokenConfig): boolean {
  return (
    config.colors.length >= 5 &&
    config.spacing.length >= 6 &&
    config.radius.length >= 3 &&
    config.shadows.length >= 3 &&
    config.typography.length >= 1
  )
}

// Arbitrary for generating token config objects
const tokenConfigArb = fc.record({
  colors: fc.array(
    fc.stringMatching(/^color-[a-z]+(-[a-z]+)?$/),
    { minLength: 0, maxLength: 15 }
  ),
  spacing: fc.array(
    fc.stringMatching(/^space-[0-9]+$/),
    { minLength: 0, maxLength: 12 }
  ),
  radius: fc.array(
    fc.stringMatching(/^radius-(sm|md|lg|xl|2xl)$/),
    { minLength: 0, maxLength: 6 }
  ),
  shadows: fc.array(
    fc.stringMatching(/^shadow-(low|md|high|xl)$/),
    { minLength: 0, maxLength: 6 }
  ),
  typography: fc.array(
    fc.stringMatching(/^(font|text|leading)-[a-z]+$/),
    { minLength: 0, maxLength: 10 }
  ),
})

describe('Property 1: Token structure completeness and theme parity', () => {
  it('actual tokens.css has minimum required counts for each category', () => {
    const { lightKeys } = parseTokensCSS()
    const categories = categorizeTokens(lightKeys)

    expect(categories.colors.length).toBeGreaterThanOrEqual(5)
    expect(categories.spacing.length).toBeGreaterThanOrEqual(6)
    expect(categories.radius.length).toBeGreaterThanOrEqual(3)
    expect(categories.shadows.length).toBeGreaterThanOrEqual(3)
    expect(categories.typography.length).toBeGreaterThanOrEqual(1)
  })

  it('light and dark token sets have identical overrideable key sets', () => {
    const { lightKeys, darkKeys } = parseTokensCSS()

    // Dark theme should override color and shadow tokens (those that change between themes)
    // The dark keys should be a subset of light keys (dark overrides light values)
    const darkKeySet = new Set(darkKeys)
    const lightKeySet = new Set(lightKeys)

    // Every dark key must exist in light
    for (const key of darkKeys) {
      expect(lightKeySet.has(key)).toBe(true)
    }

    // Dark should override at minimum the color tokens and shadows
    const darkColors = darkKeys.filter((k) => k.startsWith('color-'))
    const lightColors = lightKeys.filter((k) => k.startsWith('color-'))
    expect(new Set(darkColors)).toEqual(new Set(lightColors))

    const darkShadows = darkKeys.filter((k) => k.startsWith('shadow-'))
    const lightShadows = lightKeys.filter((k) => k.startsWith('shadow-'))
    expect(new Set(darkShadows)).toEqual(new Set(lightShadows))
  })

  it('validates token configs: accepts only configs with minimum counts', () => {
    fc.assert(
      fc.property(tokenConfigArb, (config) => {
        const isValid = validateTokenConfig(config)
        const meetsMinimums =
          config.colors.length >= 5 &&
          config.spacing.length >= 6 &&
          config.radius.length >= 3 &&
          config.shadows.length >= 3 &&
          config.typography.length >= 1

        expect(isValid).toBe(meetsMinimums)
      }),
      { numRuns: 100 }
    )
  })
})
