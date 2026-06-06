import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { Dialog } from './Dialog'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderDialog(props: Partial<React.ComponentProps<typeof Dialog>> = {}) {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    title: 'Test Dialog',
    children: <button>Inside Dialog</button>,
    ...props,
  }
  return { ...render(<Dialog {...defaultProps} />), onClose: defaultProps.onClose }
}

function advanceFrames() {
  // Advance through the double-rAF used for enter animation
  act(() => {
    vi.advanceTimersByTime(32)
  })
}

describe('Dialog', () => {
  describe('rendering', () => {
    it('does not render when open is false', () => {
      renderDialog({ open: false })
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('renders when open is true', () => {
      renderDialog({ open: true })
      advanceFrames()
      expect(screen.getByRole('dialog')).toBeDefined()
    })

    it('renders title text', () => {
      renderDialog({ title: 'My Dialog Title' })
      advanceFrames()
      expect(screen.getByText('My Dialog Title')).toBeDefined()
    })

    it('renders children content', () => {
      renderDialog({ children: <p>Dialog body content</p> })
      advanceFrames()
      expect(screen.getByText('Dialog body content')).toBeDefined()
    })

    it('renders into a portal at document.body level', () => {
      const { container } = renderDialog()
      advanceFrames()
      // The dialog should NOT be a descendant of the render container
      expect(container.querySelector('[role="dialog"]')).toBeNull()
      // But it should exist in the body
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    })
  })

  describe('accessibility', () => {
    it('has role="dialog"', () => {
      renderDialog()
      advanceFrames()
      const dialog = screen.getByRole('dialog')
      expect(dialog.getAttribute('role')).toBe('dialog')
    })

    it('has aria-modal="true"', () => {
      renderDialog()
      advanceFrames()
      const dialog = screen.getByRole('dialog')
      expect(dialog.getAttribute('aria-modal')).toBe('true')
    })

    it('has aria-labelledby pointing to the title', () => {
      renderDialog({ title: 'Accessible Title' })
      advanceFrames()
      const dialog = screen.getByRole('dialog')
      const labelledBy = dialog.getAttribute('aria-labelledby')
      expect(labelledBy).toBe('dialog-title')
      const titleEl = document.getElementById('dialog-title')
      expect(titleEl).not.toBeNull()
      expect(titleEl!.textContent).toBe('Accessible Title')
    })

    it('uses custom labelId when provided', () => {
      renderDialog({ labelId: 'custom-label-id', title: 'Custom' })
      advanceFrames()
      const dialog = screen.getByRole('dialog')
      expect(dialog.getAttribute('aria-labelledby')).toBe('custom-label-id')
      expect(document.getElementById('custom-label-id')).not.toBeNull()
    })
  })

  describe('close triggers', () => {
    it('calls onClose when Escape key is pressed', () => {
      const { onClose } = renderDialog()
      advanceFrames()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when backdrop is clicked', () => {
      const { onClose } = renderDialog()
      advanceFrames()
      // The backdrop is the aria-hidden div
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose when dialog panel is clicked', () => {
      const { onClose } = renderDialog()
      advanceFrames()
      const dialog = screen.getByRole('dialog')
      fireEvent.click(dialog)
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('focus management', () => {
    it('focuses the first focusable element inside the dialog', () => {
      renderDialog({
        children: (
          <>
            <input data-testid="first-input" />
            <button>Second</button>
          </>
        ),
      })
      advanceFrames()
      expect(document.activeElement).toBe(screen.getByTestId('first-input'))
    })

    it('traps focus: Tab on last element moves to first', () => {
      renderDialog({
        children: (
          <>
            <button data-testid="btn-first">First</button>
            <button data-testid="btn-last">Last</button>
          </>
        ),
      })
      advanceFrames()

      const lastBtn = screen.getByTestId('btn-last')
      lastBtn.focus()
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
      expect(document.activeElement).toBe(screen.getByTestId('btn-first'))
    })

    it('traps focus: Shift+Tab on first element moves to last', () => {
      renderDialog({
        children: (
          <>
            <button data-testid="btn-first">First</button>
            <button data-testid="btn-last">Last</button>
          </>
        ),
      })
      advanceFrames()

      const firstBtn = screen.getByTestId('btn-first')
      firstBtn.focus()
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(screen.getByTestId('btn-last'))
    })
  })

  describe('animations', () => {
    it('applies enter animation classes (scale and opacity) when opening', () => {
      renderDialog()
      advanceFrames()
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('scale-100')
      expect(dialog.className).toContain('opacity-100')
      expect(dialog.className).toContain('duration-[300ms]')
    })

    it('applies initial closed state classes before animation starts', () => {
      renderDialog()
      // Before rAF fires, dialog should be in initial state
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('scale-[0.96]')
      expect(dialog.className).toContain('opacity-0')
    })

    it('applies ease-out-expo timing for open animation', () => {
      renderDialog()
      advanceFrames()
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]')
    })

    it('backdrop has opacity 0.3 when dialog is visible', () => {
      renderDialog()
      advanceFrames()
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
      expect(backdrop.style.opacity).toBe('0.3')
    })

    it('backdrop has opacity 0 initially', () => {
      renderDialog()
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
      expect(backdrop.style.opacity).toBe('0')
    })
  })

  describe('body scroll lock', () => {
    it('sets body overflow to hidden when dialog is mounted', () => {
      renderDialog()
      advanceFrames()
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('restores body overflow when dialog unmounts', () => {
      document.body.style.overflow = 'auto'
      const { rerender } = render(
        <Dialog open={true} onClose={() => {}} title="Test">
          <p>Content</p>
        </Dialog>,
      )
      advanceFrames()
      expect(document.body.style.overflow).toBe('hidden')

      rerender(
        <Dialog open={false} onClose={() => {}} title="Test">
          <p>Content</p>
        </Dialog>,
      )
      // Simulate transitionend to trigger unmount
      const wrapper = document.querySelector('.fixed.inset-0') as HTMLElement
      if (wrapper) {
        fireEvent.transitionEnd(wrapper)
      }
      act(() => {
        vi.advanceTimersByTime(16)
      })
      expect(document.body.style.overflow).toBe('auto')
    })
  })
})
