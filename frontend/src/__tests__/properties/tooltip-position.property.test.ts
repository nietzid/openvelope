import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { computePosition, GAP } from '../../components/primitives/Tooltip'

/**
 * Property 5: Tooltip positioning never overflows viewport
 * Validates: Requirements 5.4
 *
 * For any trigger element position (x, y, width, height) and viewport dimensions,
 * the computed tooltip placement SHALL maintain an 8px gap from the trigger and
 * the tooltip SHALL not extend beyond the viewport boundaries (flipping to the
 * opposite side when the preferred placement would overflow).
 */

// Mock window properties for testing
beforeEach(() => {
  // Reset scroll position
  Object.defineProperty(window, 'scrollX', { value: 0, writable: true })
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true })
})

/** Generate tooltip dimensions */
const tooltipSizeArb = fc.record({
  width: fc.integer({ min: 20, max: 200 }),
  height: fc.integer({ min: 16, max: 60 }),
})

/** Generate viewport dimensions */
const viewportArb = fc.record({
  width: fc.integer({ min: 320, max: 2560 }),
  height: fc.integer({ min: 320, max: 1440 }),
})

const placementArb = fc.constantFrom('top' as const, 'bottom' as const, 'left' as const, 'right' as const)

describe('Property 5: Tooltip positioning never overflows viewport', () => {
  it('computed tooltip position stays within viewport bounds', () => {
    fc.assert(
      fc.property(
        viewportArb,
        tooltipSizeArb,
        placementArb,
        (viewport, tooltipSize, placement) => {
          // Set viewport dimensions
          Object.defineProperty(window, 'innerWidth', { value: viewport.width, configurable: true })
          Object.defineProperty(window, 'innerHeight', { value: viewport.height, configurable: true })

          // Generate trigger within viewport
          const triggerX = Math.min(50, viewport.width - 20)
          const triggerY = Math.min(50, viewport.height - 20)
          const triggerRect = {
            x: triggerX,
            y: triggerY,
            width: 40,
            height: 30,
            top: triggerY,
            left: triggerX,
            right: triggerX + 40,
            bottom: triggerY + 30,
            toJSON: () => ({}),
          } as DOMRect

          const pos = computePosition(triggerRect, tooltipSize, placement)

          // The tooltip position (accounting for scroll=0) should stay within viewport
          const tooltipLeft = pos.left
          const tooltipTop = pos.top
          const tooltipRight = tooltipLeft + tooltipSize.width
          const tooltipBottom = tooltipTop + tooltipSize.height

          expect(tooltipLeft).toBeGreaterThanOrEqual(0)
          expect(tooltipTop).toBeGreaterThanOrEqual(0)
          expect(tooltipRight).toBeLessThanOrEqual(viewport.width)
          expect(tooltipBottom).toBeLessThanOrEqual(viewport.height)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('maintains 8px gap from trigger when not clamped', () => {
    fc.assert(
      fc.property(
        placementArb,
        (placement) => {
          // Use a large viewport so no clamping occurs
          Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true })
          Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true })

          // Place trigger in the center of viewport
          const triggerRect = {
            x: 800,
            y: 400,
            width: 100,
            height: 40,
            top: 400,
            left: 800,
            right: 900,
            bottom: 440,
            toJSON: () => ({}),
          } as DOMRect

          const tooltipSize = { width: 120, height: 32 }
          const pos = computePosition(triggerRect, tooltipSize, placement)

          // Verify 8px gap based on placement
          switch (placement) {
            case 'top':
              // Tooltip bottom edge should be 8px above trigger top
              expect(triggerRect.top - (pos.top + tooltipSize.height)).toBe(GAP)
              break
            case 'bottom':
              // Tooltip top edge should be 8px below trigger bottom
              expect(pos.top - triggerRect.bottom).toBe(GAP)
              break
            case 'left':
              // Tooltip right edge should be 8px to the left of trigger left
              expect(triggerRect.left - (pos.left + tooltipSize.width)).toBe(GAP)
              break
            case 'right':
              // Tooltip left edge should be 8px to the right of trigger right
              expect(pos.left - triggerRect.right).toBe(GAP)
              break
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('tooltip never overflows with arbitrary trigger positions and tooltip sizes', () => {
    fc.assert(
      fc.property(
        viewportArb,
        tooltipSizeArb,
        placementArb,
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 0, max: 1400 }),
        fc.integer({ min: 10, max: 150 }),
        fc.integer({ min: 10, max: 80 }),
        (viewport, tooltipSize, placement, triggerX, triggerY, triggerW, triggerH) => {
          Object.defineProperty(window, 'innerWidth', { value: viewport.width, configurable: true })
          Object.defineProperty(window, 'innerHeight', { value: viewport.height, configurable: true })

          const triggerRect = {
            x: triggerX,
            y: triggerY,
            width: triggerW,
            height: triggerH,
            top: triggerY,
            left: triggerX,
            right: triggerX + triggerW,
            bottom: triggerY + triggerH,
            toJSON: () => ({}),
          } as DOMRect

          const pos = computePosition(triggerRect, tooltipSize, placement)

          // After clamping, tooltip must be within viewport
          expect(pos.left).toBeGreaterThanOrEqual(0)
          expect(pos.top).toBeGreaterThanOrEqual(0)
          expect(pos.left + tooltipSize.width).toBeLessThanOrEqual(viewport.width)
          expect(pos.top + tooltipSize.height).toBeLessThanOrEqual(viewport.height)
        }
      ),
      { numRuns: 100 }
    )
  })
})
