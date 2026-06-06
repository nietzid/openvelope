import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

// Mock matchMedia before importing the store
const listeners: Array<() => void> = []
let darkModeMatches = false

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? darkModeMatches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_event: string, cb: () => void) => {
      listeners.push(cb)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Import store after matchMedia is mocked
const { useThemeStore } = await import('./themeStore')

describe('themeStore', () => {
  beforeEach(() => {
    darkModeMatches = false
    // Reset store state before each test
    useThemeStore.setState({ mode: 'system', resolved: 'light' })
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
  })

  describe('initial state', () => {
    it('defaults mode to system', () => {
      const state = useThemeStore.getState()
      expect(state.mode).toBe('system')
    })

    it('resolved theme matches system preference', () => {
      const state = useThemeStore.getState()
      expect(['light', 'dark']).toContain(state.resolved)
    })
  })

  describe('setMode', () => {
    it('sets mode to light and resolves to light', () => {
      useThemeStore.getState().setMode('light')
      const state = useThemeStore.getState()
      expect(state.mode).toBe('light')
      expect(state.resolved).toBe('light')
    })

    it('sets mode to dark and resolves to dark', () => {
      useThemeStore.getState().setMode('dark')
      const state = useThemeStore.getState()
      expect(state.mode).toBe('dark')
      expect(state.resolved).toBe('dark')
    })

    it('sets mode to system and resolves based on OS preference', () => {
      useThemeStore.getState().setMode('system')
      const state = useThemeStore.getState()
      expect(state.mode).toBe('system')
      expect(['light', 'dark']).toContain(state.resolved)
    })

    it('applies data-theme attribute to document element', () => {
      useThemeStore.getState().setMode('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

      useThemeStore.getState().setMode('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })

  describe('matchMedia listener', () => {
    it('updates resolved theme when system preference changes and mode is system', () => {
      useThemeStore.getState().setMode('system')

      // Simulate OS switching to dark mode
      darkModeMatches = true

      // Trigger the registered listener
      listeners.forEach((cb) => cb())

      const state = useThemeStore.getState()
      expect(state.mode).toBe('system')
      expect(state.resolved).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('does not update resolved theme when mode is not system', () => {
      useThemeStore.getState().setMode('light')

      // Simulate OS switching to dark mode
      darkModeMatches = true

      // Trigger the registered listener
      listeners.forEach((cb) => cb())

      const state = useThemeStore.getState()
      expect(state.resolved).toBe('light')
    })
  })

  describe('persistence', () => {
    it('persists mode to localStorage under webmail-theme key', () => {
      useThemeStore.getState().setMode('dark')

      const stored = JSON.parse(localStorage.getItem('webmail-theme') || '{}')
      expect(stored.state.mode).toBe('dark')
    })
  })
})
