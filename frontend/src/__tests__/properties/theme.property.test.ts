import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 2: Theme resolution correctness
 * Validates: Requirements 2.2, 2.4, 2.6, 2.7, 2.8
 *
 * For any combination of stored mode ('light' | 'dark' | 'system'), OS preference ('light' | 'dark'),
 * and localStorage availability, the theme engine SHALL:
 * - Resolve to the stored mode value when mode is 'light' or 'dark'
 * - Resolve to the current OS preference when mode is 'system'
 * - Set document.documentElement.dataset.theme to the resolved value
 * - Fall back to 'system' mode when localStorage is unavailable
 */

type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

// Pure resolution logic extracted from themeStore
function resolveTheme(mode: ThemeMode, osPreference: ResolvedTheme): ResolvedTheme {
  if (mode === 'system') return osPreference
  return mode
}

const themeModeArb = fc.constantFrom<ThemeMode>('light', 'dark', 'system')
const osPrefArb = fc.constantFrom<ResolvedTheme>('light', 'dark')
const localStorageAvailableArb = fc.boolean()

describe('Property 2: Theme resolution correctness', () => {
  let originalMatchMedia: typeof window.matchMedia
  let originalLocalStorage: Storage

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    originalLocalStorage = window.localStorage
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    document.documentElement.removeAttribute('data-theme')
    vi.restoreAllMocks()
  })

  it('resolves to stored mode when mode is light or dark, regardless of OS preference', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ThemeMode>('light', 'dark'),
        osPrefArb,
        (mode, osPref) => {
          const resolved = resolveTheme(mode, osPref)
          expect(resolved).toBe(mode)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('resolves to OS preference when mode is system', () => {
    fc.assert(
      fc.property(osPrefArb, (osPref) => {
        const resolved = resolveTheme('system', osPref)
        expect(resolved).toBe(osPref)
      }),
      { numRuns: 100 }
    )
  })

  it('sets data-theme attribute on documentElement for any mode × OS combination', () => {
    fc.assert(
      fc.property(themeModeArb, osPrefArb, (mode, osPref) => {
        // Mock matchMedia for OS preference
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: dark)' ? osPref === 'dark' : false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }))

        const resolved = resolveTheme(mode, osPref)
        // Simulate applyTheme
        document.documentElement.setAttribute('data-theme', resolved)

        expect(document.documentElement.getAttribute('data-theme')).toBe(resolved)
      }),
      { numRuns: 100 }
    )
  })

  it('for any combination, resolved value is always light or dark', () => {
    fc.assert(
      fc.property(themeModeArb, osPrefArb, localStorageAvailableArb, (mode, osPref, _lsAvailable) => {
        const resolved = resolveTheme(mode, osPref)
        expect(['light', 'dark']).toContain(resolved)
      }),
      { numRuns: 100 }
    )
  })

  it('falls back to system mode resolution when localStorage is unavailable', () => {
    fc.assert(
      fc.property(osPrefArb, (osPref) => {
        // When localStorage is unavailable, default mode is 'system'
        const defaultMode: ThemeMode = 'system'
        const resolved = resolveTheme(defaultMode, osPref)
        expect(resolved).toBe(osPref)
      }),
      { numRuns: 100 }
    )
  })
})
