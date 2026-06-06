import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ResizeDivider, clampPanelWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH_RATIO } from './ResizeDivider'

afterEach(cleanup)

describe('clampPanelWidth', () => {
  it('returns MIN_PANEL_WIDTH when width is below minimum', () => {
    expect(clampPanelWidth(100, 1200)).toBe(MIN_PANEL_WIDTH)
  })

  it('returns max when width exceeds 50% viewport', () => {
    expect(clampPanelWidth(800, 1200)).toBe(600)
  })

  it('returns the width when within valid range', () => {
    expect(clampPanelWidth(400, 1200)).toBe(400)
  })

  it('clamps to minimum exactly at 280', () => {
    expect(clampPanelWidth(280, 1200)).toBe(280)
  })

  it('clamps to max exactly at 50% viewport', () => {
    expect(clampPanelWidth(600, 1200)).toBe(600)
  })

  it('handles very small viewport where max < min', () => {
    // viewport 400 → max = 200, which is less than 280
    // Math.min(Math.max(100, 280), 200) = Math.min(280, 200) = 200
    // This is correct - when the viewport is too small, max wins
    expect(clampPanelWidth(100, 400)).toBe(200)
  })
})

describe('ResizeDivider', () => {
  it('renders a separator element', () => {
    render(<ResizeDivider width={350} onResize={() => {}} />)
    const divider = screen.getByRole('separator')
    expect(divider).toBeDefined()
  })

  it('has correct aria attributes', () => {
    render(<ResizeDivider width={350} onResize={() => {}} />)
    const divider = screen.getByRole('separator')
    expect(divider.getAttribute('aria-orientation')).toBe('vertical')
    expect(divider.getAttribute('aria-valuenow')).toBe('350')
    expect(divider.getAttribute('aria-valuemin')).toBe(String(MIN_PANEL_WIDTH))
    expect(divider.getAttribute('aria-label')).toBe('Resize message list')
  })

  it('has col-resize cursor class', () => {
    render(<ResizeDivider width={350} onResize={() => {}} />)
    const divider = screen.getByRole('separator')
    expect(divider.className).toContain('cursor-col-resize')
  })

  it('has 4px width (w-1 = 0.25rem = 4px)', () => {
    render(<ResizeDivider width={350} onResize={() => {}} />)
    const divider = screen.getByRole('separator')
    expect(divider.className).toContain('w-1')
  })

  it('applies border color by default', () => {
    render(<ResizeDivider width={350} onResize={() => {}} />)
    const divider = screen.getByRole('separator')
    expect(divider.className).toContain('bg-[var(--color-border)]')
  })

  it('calls onResize with clamped width during drag', () => {
    const onResize = vi.fn()
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true })

    render(<ResizeDivider width={350} onResize={onResize} />)
    const divider = screen.getByRole('separator')

    // Simulate pointer down
    fireEvent.pointerDown(divider, { clientX: 350, pointerId: 1 })

    // Simulate pointer move (drag right by 50px → new width = 400)
    fireEvent.pointerMove(divider, { clientX: 400, pointerId: 1 })

    expect(onResize).toHaveBeenCalledWith(400)
  })

  it('does not call onResize on pointer move without pointer down', () => {
    const onResize = vi.fn()
    render(<ResizeDivider width={350} onResize={onResize} />)
    const divider = screen.getByRole('separator')

    fireEvent.pointerMove(divider, { clientX: 400, pointerId: 1 })

    expect(onResize).not.toHaveBeenCalled()
  })

  it('clamps to minimum width on drag left', () => {
    const onResize = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true })

    render(<ResizeDivider width={350} onResize={onResize} />)
    const divider = screen.getByRole('separator')

    fireEvent.pointerDown(divider, { clientX: 350, pointerId: 1 })
    // Drag left by 200px → 350 - 200 = 150, clamped to 280
    fireEvent.pointerMove(divider, { clientX: 150, pointerId: 1 })

    expect(onResize).toHaveBeenCalledWith(MIN_PANEL_WIDTH)
  })

  it('clamps to maximum width (50% viewport) on drag right', () => {
    const onResize = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true })

    render(<ResizeDivider width={350} onResize={onResize} />)
    const divider = screen.getByRole('separator')

    fireEvent.pointerDown(divider, { clientX: 350, pointerId: 1 })
    // Drag right by 500px → 350 + 500 = 850, clamped to 600 (50% of 1200)
    fireEvent.pointerMove(divider, { clientX: 850, pointerId: 1 })

    expect(onResize).toHaveBeenCalledWith(600)
  })

  it('stops resizing after pointer up', () => {
    const onResize = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true })

    render(<ResizeDivider width={350} onResize={onResize} />)
    const divider = screen.getByRole('separator')

    fireEvent.pointerDown(divider, { clientX: 350, pointerId: 1 })
    fireEvent.pointerMove(divider, { clientX: 400, pointerId: 1 })
    expect(onResize).toHaveBeenCalledTimes(1)

    fireEvent.pointerUp(divider, { clientX: 400, pointerId: 1 })

    // Move after pointer up should not trigger resize
    fireEvent.pointerMove(divider, { clientX: 500, pointerId: 1 })
    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it('updates aria-valuenow when width prop changes', () => {
    const { rerender } = render(<ResizeDivider width={350} onResize={() => {}} />)
    expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe('350')

    rerender(<ResizeDivider width={450} onResize={() => {}} />)
    expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe('450')
  })
})

describe('constants', () => {
  it('MIN_PANEL_WIDTH is 280', () => {
    expect(MIN_PANEL_WIDTH).toBe(280)
  })

  it('MAX_PANEL_WIDTH_RATIO is 0.5', () => {
    expect(MAX_PANEL_WIDTH_RATIO).toBe(0.5)
  })
})
