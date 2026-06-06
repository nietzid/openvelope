import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BatchToolbar } from './BatchToolbar'
import { useMailboxStore } from '../../stores/mailboxStore'

vi.mock('../../services/messages', () => ({
  batchOperation: vi.fn(() => Promise.resolve()),
}))

afterEach(cleanup)

beforeEach(() => {
  useMailboxStore.setState({
    selectedUIDs: new Set(),
    currentFolder: 'INBOX',
  })
})

describe('BatchToolbar', () => {
  it('is hidden when no messages are selected', () => {
    render(<BatchToolbar />)

    const toolbar = screen.getByRole('toolbar', { hidden: true })
    expect(toolbar.getAttribute('aria-hidden')).toBe('true')
    expect(toolbar.className).toContain('-translate-y-full')
  })

  it('slides in when messages are selected', () => {
    useMailboxStore.setState({ selectedUIDs: new Set([1, 2, 3]) })
    render(<BatchToolbar />)

    const toolbar = screen.getByRole('toolbar')
    expect(toolbar.getAttribute('aria-hidden')).not.toBe('true')
    expect(toolbar.className).toContain('translate-y-0')
    expect(toolbar.className).not.toContain('-translate-y-full')
  })

  it('displays the selected count', () => {
    useMailboxStore.setState({ selectedUIDs: new Set([10, 20, 30]) })
    render(<BatchToolbar />)

    expect(screen.getByText('3 selected')).toBeDefined()
  })

  it('renders all batch action buttons', () => {
    useMailboxStore.setState({ selectedUIDs: new Set([1]) })
    render(<BatchToolbar />)

    expect(screen.getByText('Mark Read')).toBeDefined()
    expect(screen.getByText('Mark Unread')).toBeDefined()
    expect(screen.getByText('Delete')).toBeDefined()
    expect(screen.getByText('Move')).toBeDefined()
  })

  it('calls batchOperation with mark_read and clears selection', async () => {
    const { batchOperation } = await import('../../services/messages')
    useMailboxStore.setState({ selectedUIDs: new Set([5, 10]), currentFolder: 'INBOX' })
    render(<BatchToolbar />)

    fireEvent.click(screen.getByText('Mark Read'))

    // Wait for async handler
    await vi.waitFor(() => {
      expect(batchOperation).toHaveBeenCalledWith('INBOX', [5, 10], 'mark_read')
    })
    expect(useMailboxStore.getState().selectedUIDs.size).toBe(0)
  })

  it('calls batchOperation with mark_unread and clears selection', async () => {
    const { batchOperation } = await import('../../services/messages')
    useMailboxStore.setState({ selectedUIDs: new Set([7]), currentFolder: 'Sent' })
    render(<BatchToolbar />)

    fireEvent.click(screen.getByText('Mark Unread'))

    await vi.waitFor(() => {
      expect(batchOperation).toHaveBeenCalledWith('Sent', [7], 'mark_unread')
    })
    expect(useMailboxStore.getState().selectedUIDs.size).toBe(0)
  })

  it('calls batchOperation with delete and clears selection', async () => {
    const { batchOperation } = await import('../../services/messages')
    useMailboxStore.setState({ selectedUIDs: new Set([1, 2]), currentFolder: 'INBOX' })
    render(<BatchToolbar />)

    fireEvent.click(screen.getByText('Delete'))

    await vi.waitFor(() => {
      expect(batchOperation).toHaveBeenCalledWith('INBOX', [1, 2], 'delete')
    })
    expect(useMailboxStore.getState().selectedUIDs.size).toBe(0)
  })

  it('has role=toolbar for accessibility', () => {
    useMailboxStore.setState({ selectedUIDs: new Set([1]) })
    render(<BatchToolbar />)

    expect(screen.getByRole('toolbar')).toBeDefined()
  })

  it('uses 250ms ease-out-expo transition', () => {
    useMailboxStore.setState({ selectedUIDs: new Set([1]) })
    render(<BatchToolbar />)

    const toolbar = screen.getByRole('toolbar')
    expect(toolbar.className).toContain('duration-[250ms]')
    expect(toolbar.className).toContain('[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]')
  })
})
