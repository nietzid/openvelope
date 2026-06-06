import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { Tooltip, _resetLastCloseTime, _setLastCloseTime } from './Tooltip'

afterEach(cleanup)

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetLastCloseTime()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders children without tooltip initially', () => {
    render(
      <Tooltip content="Hello tooltip">
        <button>Hover me</button>
      </Tooltip>,
    )

    expect(screen.getByText('Hover me')).toBeDefined()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows tooltip after default 500ms delay on mouse enter', () => {
    render(
      <Tooltip content="Hello tooltip">
        <button>Hover me</button>
      </Tooltip>,
    )

    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!)

    // Not visible before delay
    expect(screen.queryByRole('tooltip')).toBeNull()

    // Advance past delay
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByRole('tooltip')).toBeDefined()
    expect(screen.getByRole('tooltip').textContent).toBe('Hello tooltip')
  })

  it('shows tooltip with custom delay', () => {
    render(
      <Tooltip content="Custom delay" delayMs={200}>
        <button>Hover me</button>
      </Tooltip>,
    )

    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!)

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole('tooltip')).toBeDefined()
  })

  it('hides tooltip on mouse leave after exit animation (150ms)', () => {
    render(
      <Tooltip content="Hello tooltip">
        <button>Hover me</button>
      </Tooltip>,
    )

    const trigger = screen.getByText('Hover me').parentElement!

    // Show tooltip
    fireEvent.mouseEnter(trigger)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.getByRole('tooltip')).toBeDefined()

    // Hide tooltip
    fireEvent.mouseLeave(trigger)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('dismisses tooltip on Escape key', () => {
    render(
      <Tooltip content="Hello tooltip">
        <button>Hover me</button>
      </Tooltip>,
    )

    const trigger = screen.getByText('Hover me').parentElement!

    // Show tooltip
    fireEvent.mouseEnter(trigger)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.getByRole('tooltip')).toBeDefined()

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' })
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('has role="tooltip" and aria-describedby when visible', () => {
    render(
      <Tooltip content="Accessible tooltip">
        <button>Hover me</button>
      </Tooltip>,
    )

    const trigger = screen.getByText('Hover me').parentElement!

    // Before showing - no aria-describedby
    expect(trigger.hasAttribute('aria-describedby')).toBe(false)

    // Show tooltip
    fireEvent.mouseEnter(trigger)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeDefined()
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id)
  })

  it('truncates content at 80 characters', () => {
    const longContent = 'A'.repeat(100)

    render(
      <Tooltip content={longContent}>
        <button>Hover me</button>
      </Tooltip>,
    )

    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.textContent!.length).toBe(80)
  })

  it('does not truncate content at or below 80 characters', () => {
    const content = 'A'.repeat(80)

    render(
      <Tooltip content={content}>
        <button>Hover me</button>
      </Tooltip>,
    )

    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.textContent).toBe(content)
  })

  it('shows immediately during warm-up (within 300ms of last close)', () => {
    // Simulate that a tooltip was closed just now
    _setLastCloseTime(Date.now())

    render(
      <Tooltip content="Warm tooltip">
        <button>Hover me</button>
      </Tooltip>,
    )

    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!)

    // Should appear with 0ms delay
    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(screen.getByRole('tooltip')).toBeDefined()
  })

  it('uses full delay when warm-up window has expired', () => {
    // Simulate that a tooltip was closed 500ms ago (beyond 300ms window)
    _setLastCloseTime(Date.now() - 500)

    render(
      <Tooltip content="Cold tooltip">
        <button>Hover me</button>
      </Tooltip>,
    )

    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!)

    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.getByRole('tooltip')).toBeDefined()
  })

  it('cancels show on mouse leave before delay completes', () => {
    render(
      <Tooltip content="Hello tooltip">
        <button>Hover me</button>
      </Tooltip>,
    )

    const trigger = screen.getByText('Hover me').parentElement!

    fireEvent.mouseEnter(trigger)
    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Leave before 500ms delay
    fireEvent.mouseLeave(trigger)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows tooltip on focus and hides on blur', () => {
    render(
      <Tooltip content="Focus tooltip">
        <button>Hover me</button>
      </Tooltip>,
    )

    const trigger = screen.getByText('Hover me').parentElement!

    fireEvent.focus(trigger)
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByRole('tooltip')).toBeDefined()

    fireEvent.blur(trigger)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('applies enter animation styles (scale 0.96, opacity 0 initially)', () => {
    render(
      <Tooltip content="Animated">
        <button>Hover me</button>
      </Tooltip>,
    )

    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!)

    // Advance past delay but before rAF fires for animation
    act(() => {
      vi.advanceTimersByTime(500)
    })

    const tooltip = screen.getByRole('tooltip')
    // The tooltip uses inline styles for animation
    expect(tooltip.style.transform).toBeDefined()
    expect(tooltip.style.opacity).toBeDefined()
  })
})
