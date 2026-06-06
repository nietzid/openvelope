import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { clampPanelWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH_RATIO } from '../../components/layout/ResizeDivider'

/**
 * Property 8: Panel resize clamping
 * Validates: Requirements 7.4
 *
 * For any viewport width and drag delta applied to the Message_List panel divider,
 * the resulting panel width SHALL be clamped to the range [280px, viewport_width × 0.5].
 */

describe('Property 8: Panel resize clamping', () => {
  it('result is always >= min(MIN_PANEL_WIDTH, viewport × 0.5)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10000, max: 10000, noNaN: true }),
        fc.double({ min: 320, max: 3840, noNaN: true }),
        (width, viewportWidth) => {
          const result = clampPanelWidth(width, viewportWidth)
          const max = viewportWidth * MAX_PANEL_WIDTH_RATIO
          // When viewport is small enough that max < MIN, the clamp resolves to max
          const effectiveMin = Math.min(MIN_PANEL_WIDTH, max)
          expect(result).toBeGreaterThanOrEqual(effectiveMin)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is always >= MIN_PANEL_WIDTH when viewport is large enough', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10000, max: 10000, noNaN: true }),
        fc.double({ min: 560, max: 3840, noNaN: true }), // viewport >= 560 ensures max >= 280
        (width, viewportWidth) => {
          const result = clampPanelWidth(width, viewportWidth)
          expect(result).toBeGreaterThanOrEqual(MIN_PANEL_WIDTH)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is always <= viewport × 0.5', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10000, max: 10000, noNaN: true }),
        fc.double({ min: 320, max: 3840, noNaN: true }),
        (width, viewportWidth) => {
          const result = clampPanelWidth(width, viewportWidth)
          expect(result).toBeLessThanOrEqual(viewportWidth * MAX_PANEL_WIDTH_RATIO)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('values within range are returned unchanged', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 560, max: 3840, noNaN: true }),
        (viewportWidth) => {
          const maxWidth = viewportWidth * MAX_PANEL_WIDTH_RATIO
          // Only test when valid range exists (min < max)
          if (MIN_PANEL_WIDTH > maxWidth) return

          return fc.assert(
            fc.property(
              fc.double({ min: MIN_PANEL_WIDTH, max: maxWidth, noNaN: true }),
              (width) => {
                const result = clampPanelWidth(width, viewportWidth)
                expect(result).toBeCloseTo(width, 10)
              }
            ),
            { numRuns: 10 }
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('drag delta applied to base width is properly clamped', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 560, max: 3840 }), // viewport >= 560 ensures max >= MIN_PANEL_WIDTH
        fc.integer({ min: 280, max: 1000 }),
        fc.integer({ min: -2000, max: 2000 }),
        (viewportWidth, baseWidth, dragDelta) => {
          const newWidth = baseWidth + dragDelta
          const result = clampPanelWidth(newWidth, viewportWidth)

          const min = MIN_PANEL_WIDTH
          const max = viewportWidth * MAX_PANEL_WIDTH_RATIO

          expect(result).toBeGreaterThanOrEqual(min)
          expect(result).toBeLessThanOrEqual(max)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('clamping is idempotent', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10000, max: 10000, noNaN: true }),
        fc.double({ min: 320, max: 3840, noNaN: true }),
        (width, viewportWidth) => {
          const once = clampPanelWidth(width, viewportWidth)
          const twice = clampPanelWidth(once, viewportWidth)
          expect(twice).toBe(once)
        }
      ),
      { numRuns: 100 }
    )
  })
})
