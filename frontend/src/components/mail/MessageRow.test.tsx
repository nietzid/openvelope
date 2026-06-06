import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MessageRow } from './MessageRow'
import type { MessageSummary } from '../../types'

afterEach(cleanup)

function createMessage(overrides: Partial<MessageSummary> = {}): MessageSummary {
  return {
    uid: 1,
    from: 'Alice Smith',
    to: 'bob@example.com',
    subject: 'Meeting Tomorrow',
    date: '2025-01-15T10:30:00Z',
    size: 2048,
    flags: { seen: true, flagged: false, answered: false, draft: false, deleted: false },
    has_attach: false,
    preview: 'Hey Bob, just a reminder about our meeting tomorrow at 3pm.',
    ...overrides,
  }
}

const defaultProps = {
  isSelected: false,
  isBatchSelected: false,
  onSelect: vi.fn(),
  onBatchToggle: vi.fn(),
}

describe('MessageRow', () => {
  it('renders sender, subject, preview, and timestamp', () => {
    render(<MessageRow message={createMessage()} {...defaultProps} />)

    expect(screen.getByText('Alice Smith')).toBeDefined()
    expect(screen.getByText('Meeting Tomorrow')).toBeDefined()
    expect(screen.getByText('Hey Bob, just a reminder about our meeting tomorrow at 3pm.')).toBeDefined()
    expect(screen.getByRole('row').querySelector('time')).not.toBeNull()
  })

  it('truncates preview to 120 characters', () => {
    const longPreview = 'A'.repeat(150)
    render(<MessageRow message={createMessage({ preview: longPreview })} {...defaultProps} />)

    const previewEl = screen.getByText(/^A+…$/)
    expect(previewEl.textContent!.length).toBeLessThanOrEqual(121) // 120 chars + ellipsis character
  })

  it('does not render preview when empty', () => {
    render(<MessageRow message={createMessage({ preview: '' })} {...defaultProps} />)

    const row = screen.getByRole('row')
    // Sender, subject visible; no preview span
    expect(screen.getByText('Alice Smith')).toBeDefined()
    expect(screen.getByText('Meeting Tomorrow')).toBeDefined()
    // Only 2 text spans (sender + subject) in the content area
    const textSpans = row.querySelectorAll('span')
    expect(textSpans.length).toBe(2) // sender + subject, no preview
  })

  describe('unread indicator', () => {
    it('shows 6px accent dot when message is unread', () => {
      const flags = { seen: false, flagged: false, answered: false, draft: false, deleted: false }
      render(<MessageRow message={createMessage({ flags })} {...defaultProps} />)

      const dot = screen.getByLabelText('Unread')
      expect(dot.className).toContain('w-[6px]')
      expect(dot.className).toContain('h-[6px]')
      expect(dot.className).toContain('bg-[var(--color-accent)]')
    })

    it('does not show unread dot when message is read', () => {
      render(<MessageRow message={createMessage()} {...defaultProps} />)

      expect(screen.queryByLabelText('Unread')).toBeNull()
    })

    it('applies semibold to sender and subject when unread', () => {
      const flags = { seen: false, flagged: false, answered: false, draft: false, deleted: false }
      render(<MessageRow message={createMessage({ flags })} {...defaultProps} />)

      const sender = screen.getByText('Alice Smith')
      const subject = screen.getByText('Meeting Tomorrow')
      expect(sender.className).toContain('font-semibold')
      expect(subject.className).toContain('font-semibold')
    })

    it('uses normal weight for sender and subject when read', () => {
      render(<MessageRow message={createMessage()} {...defaultProps} />)

      const sender = screen.getByText('Alice Smith')
      const subject = screen.getByText('Meeting Tomorrow')
      expect(sender.className).toContain('font-normal')
      expect(subject.className).toContain('font-normal')
    })
  })

  describe('selection', () => {
    it('highlights row when isSelected is true', () => {
      render(<MessageRow message={createMessage()} {...defaultProps} isSelected={true} />)

      const row = screen.getByRole('row')
      expect(row.className).toContain('bg-[var(--color-accent)]/10')
    })

    it('sets aria-selected when isSelected', () => {
      render(<MessageRow message={createMessage()} {...defaultProps} isSelected={true} />)

      const row = screen.getByRole('row')
      expect(row.getAttribute('aria-selected')).toBe('true')
    })

    it('calls onSelect with uid when row is clicked', () => {
      const onSelect = vi.fn()
      render(<MessageRow message={createMessage({ uid: 42 })} {...defaultProps} onSelect={onSelect} />)

      fireEvent.click(screen.getByRole('row'))
      expect(onSelect).toHaveBeenCalledWith(42)
    })
  })

  describe('batch checkbox', () => {
    it('renders a checkbox', () => {
      render(<MessageRow message={createMessage()} {...defaultProps} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeDefined()
    })

    it('shows checked state when isBatchSelected', () => {
      render(<MessageRow message={createMessage()} {...defaultProps} isBatchSelected={true} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox.getAttribute('aria-checked')).toBe('true')
      expect(checkbox.className).toContain('bg-[var(--color-accent)]')
    })

    it('calls onBatchToggle without triggering onSelect', () => {
      const onSelect = vi.fn()
      const onBatchToggle = vi.fn()
      render(
        <MessageRow
          message={createMessage({ uid: 7 })}
          {...defaultProps}
          onSelect={onSelect}
          onBatchToggle={onBatchToggle}
        />,
      )

      fireEvent.click(screen.getByRole('checkbox'))
      expect(onBatchToggle).toHaveBeenCalledWith(7)
      expect(onSelect).not.toHaveBeenCalled()
    })
  })

  describe('style props', () => {
    it('applies style prop for virtual list positioning', () => {
      const style = { position: 'absolute' as const, top: 144, left: 0 }
      render(<MessageRow message={createMessage()} {...defaultProps} style={style} />)

      const row = screen.getByRole('row')
      expect(row.style.position).toBe('absolute')
      expect(row.style.top).toBe('144px')
    })

    it('applies animationStyle prop', () => {
      const animationStyle = { opacity: 0, transform: 'translateY(4px)', transitionDelay: '60ms' }
      render(<MessageRow message={createMessage()} {...defaultProps} animationStyle={animationStyle} />)

      const row = screen.getByRole('row')
      expect(row.style.opacity).toBe('0')
      expect(row.style.transform).toBe('translateY(4px)')
    })
  })

  describe('keyboard interaction', () => {
    it('selects message on Enter keydown', () => {
      const onSelect = vi.fn()
      render(<MessageRow message={createMessage({ uid: 5 })} {...defaultProps} onSelect={onSelect} />)

      fireEvent.keyDown(screen.getByRole('row'), { key: 'Enter' })
      expect(onSelect).toHaveBeenCalledWith(5)
    })

    it('selects message on Space keydown', () => {
      const onSelect = vi.fn()
      render(<MessageRow message={createMessage({ uid: 5 })} {...defaultProps} onSelect={onSelect} />)

      fireEvent.keyDown(screen.getByRole('row'), { key: ' ' })
      expect(onSelect).toHaveBeenCalledWith(5)
    })
  })

  describe('focus management', () => {
    it('has tabIndex=0 for keyboard reachability', () => {
      render(<MessageRow message={createMessage()} {...defaultProps} />)
      const row = screen.getByRole('row')
      expect(row.tabIndex).toBe(0)
    })

    it('includes focus-visible ring classes', () => {
      render(<MessageRow message={createMessage()} {...defaultProps} />)
      const row = screen.getByRole('row')
      expect(row.className).toContain('focus-visible:ring-2')
      expect(row.className).toContain('focus-visible:ring-[var(--color-accent)]')
      expect(row.className).toContain('focus-visible:ring-offset-2')
    })
  })
})
