import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { SearchInterface } from './SearchInterface'
import { useUIStore } from '../../stores/uiStore'
import { useMailboxStore } from '../../stores/mailboxStore'

// Mock the search service
vi.mock('../../services/search', () => ({
  search: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  if (useUIStore.getState().searchOpen) {
    act(() => { useUIStore.getState().toggleSearch() })
  }
  useMailboxStore.getState().setCurrentFolder('INBOX')
  useMailboxStore.getState().setSelectedUID(null)
})

// jsdom doesn't implement scrollIntoView — mock it globally
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

/**
 * Open search and wait for animation using fake timers for rAF,
 * then switch back to real timers so waitFor can poll properly.
 */
async function openSearch() {
  vi.useFakeTimers()
  act(() => { useUIStore.getState().toggleSearch() })
  // Advance past double-rAF animation
  await act(async () => { vi.advanceTimersByTime(50) })
  vi.useRealTimers()
}

/**
 * Trigger a debounced search: type a query, advance fake timers past debounce,
 * then switch to real timers so waitFor can poll.
 */
async function triggerSearch(input: HTMLInputElement, query: string, debounceMs = 350) {
  vi.useFakeTimers()
  fireEvent.change(input, { target: { value: query } })
  await act(async () => { vi.advanceTimersByTime(debounceMs) })
  vi.useRealTimers()
}

describe('SearchInterface', () => {
  describe('visibility', () => {
    it('does not render when searchOpen is false', () => {
      render(<SearchInterface />)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('renders when searchOpen is true', async () => {
      render(<SearchInterface />)
      await openSearch()
      expect(screen.getByRole('dialog')).toBeDefined()
    })

    it('dialog has correct aria-label', async () => {
      render(<SearchInterface />)
      await openSearch()
      expect(screen.getByRole('dialog', { name: 'Search messages' })).toBeDefined()
    })
  })

  describe('search input', () => {
    it('renders search input with placeholder', async () => {
      render(<SearchInterface />)
      await openSearch()
      expect(screen.getByPlaceholderText('Search messages…')).toBeDefined()
    })

    it('shows "Type at least 2 characters" hint initially', async () => {
      render(<SearchInterface />)
      await openSearch()
      expect(screen.getByText('Type at least 2 characters to search')).toBeDefined()
    })

    it('updates query on input change', async () => {
      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      vi.useFakeTimers()
      fireEvent.change(input, { target: { value: 'hello' } })
      expect((input as HTMLInputElement).value).toBe('hello')
      vi.useRealTimers()
    })

    it('shows Esc keyboard hint', async () => {
      render(<SearchInterface />)
      await openSearch()
      expect(screen.getByText('Esc')).toBeDefined()
    })
  })

  describe('debounce behavior', () => {
    it('does not search when query is less than 2 characters', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')

      await triggerSearch(input, 'a', 400)
      expect(mockedSearch).not.toHaveBeenCalled()
    })

    it('triggers search after debounce for valid queries', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockResolvedValue({ results: [], count: 0 })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')

      await triggerSearch(input, 'hel')

      await waitFor(() => {
        expect(mockedSearch).toHaveBeenCalled()
      })
    })

    it('resets debounce timer on rapid input', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockClear()
      mockedSearch.mockResolvedValue({ results: [], count: 0 })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')

      vi.useFakeTimers()
      fireEvent.change(input, { target: { value: 'he' } })
      await act(async () => { vi.advanceTimersByTime(100) })
      // After 100ms < 300ms debounce, no call yet
      expect(mockedSearch).not.toHaveBeenCalled()

      fireEvent.change(input, { target: { value: 'hel' } })
      await act(async () => { vi.advanceTimersByTime(100) })
      // 100ms after second change, still no call
      expect(mockedSearch).not.toHaveBeenCalled()

      // Complete the debounce from second change (100ms more = 200ms total)
      await act(async () => { vi.advanceTimersByTime(200) })
      vi.useRealTimers()

      await waitFor(() => {
        expect(mockedSearch).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('search results', () => {
    it('shows empty state when search returns no results', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockResolvedValue({ results: [], count: 0 })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'no match')

      await waitFor(() => {
        expect(screen.getByText('No messages matched your search.')).toBeDefined()
      })
    })

    it('shows loading state while searching', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockImplementation(() => new Promise(() => {}))

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'loading test')

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeNull()
      })
    })

    it('shows error state with retry button on search failure', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockRejectedValue(new Error('Network error'))

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'error test')

      await waitFor(() => {
        expect(screen.getByText('Search could not be completed. Please try again.')).toBeDefined()
        expect(screen.getByRole('button', { name: /retry/i })).toBeDefined()
      })
    })

    it('displays search results with sender and subject', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockResolvedValue({
        results: [
          {
            uid: 1, from: 'Alice', to: 'me@example.com', subject: 'Test Subject',
            date: '2025-01-15T10:00:00Z', size: 1000,
            flags: { seen: true, flagged: false, answered: false, draft: false, deleted: false },
            has_attach: false, preview: 'Test preview',
          },
        ],
        count: 1,
      })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'test query')

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeDefined()
        expect(screen.getByText('Test Subject')).toBeDefined()
      })
    })

    it('displays preview text in results', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockResolvedValue({
        results: [
          {
            uid: 2, from: 'Bob', to: 'me@example.com', subject: 'Hello',
            date: '2025-01-15T10:00:00Z', size: 500,
            flags: { seen: true, flagged: false, answered: false, draft: false, deleted: false },
            has_attach: false, preview: 'Preview text here.',
          },
        ],
        count: 1,
      })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'hello')

      await waitFor(() => {
        expect(screen.getByText('Preview text here.')).toBeDefined()
      })
    })

    it('shows unread indicator for unread messages', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockResolvedValue({
        results: [
          {
            uid: 3, from: 'Carol', to: 'me@example.com', subject: 'Unread',
            date: '2025-01-15T10:00:00Z', size: 500,
            flags: { seen: false, flagged: false, answered: false, draft: false, deleted: false },
            has_attach: false, preview: '',
          },
        ],
        count: 1,
      })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'unread')

      await waitFor(() => {
        expect(screen.getByLabelText('Unread')).toBeDefined()
      })
    })
  })

  describe('keyboard navigation', () => {
    it('ArrowDown moves active index down through results', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockResolvedValue({
        results: [
          {
            uid: 1, from: 'A', to: 'me', subject: 'S1', date: '2025-01-15T10:00:00Z',
            size: 100, flags: { seen: true, flagged: false, answered: false, draft: false, deleted: false },
            has_attach: false, preview: '',
          },
          {
            uid: 2, from: 'B', to: 'me', subject: 'S2', date: '2025-01-15T10:00:00Z',
            size: 100, flags: { seen: true, flagged: false, answered: false, draft: false, deleted: false },
            has_attach: false, preview: '',
          },
        ],
        count: 2,
      })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'nav test')

      await waitFor(() => {
        expect(screen.getByText('A')).toBeDefined()
      })

      act(() => { fireEvent.keyDown(input, { key: 'ArrowDown' }) })
      expect(document.querySelector('[data-result-index="0"]')?.getAttribute('aria-selected')).toBe('true')

      act(() => { fireEvent.keyDown(input, { key: 'ArrowDown' }) })
      expect(document.querySelector('[data-result-index="1"]')?.getAttribute('aria-selected')).toBe('true')
    })

    it('ArrowUp wraps to last result from first position', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockResolvedValue({
        results: [
          {
            uid: 1, from: 'A', to: 'me', subject: 'S1', date: '2025-01-15T10:00:00Z',
            size: 100, flags: { seen: true, flagged: false, answered: false, draft: false, deleted: false },
            has_attach: false, preview: '',
          },
          {
            uid: 2, from: 'B', to: 'me', subject: 'S2', date: '2025-01-15T10:00:00Z',
            size: 100, flags: { seen: true, flagged: false, answered: false, draft: false, deleted: false },
            has_attach: false, preview: '',
          },
        ],
        count: 2,
      })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'wrap test')

      await waitFor(() => {
        expect(screen.getByText('A')).toBeDefined()
      })

      act(() => { fireEvent.keyDown(input, { key: 'ArrowUp' }) })
      expect(document.querySelector('[data-result-index="1"]')?.getAttribute('aria-selected')).toBe('true')
    })

    it('Escape closes the search overlay', async () => {
      render(<SearchInterface />)
      await openSearch()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(useUIStore.getState().searchOpen).toBe(false)
    })
  })

  describe('result selection', () => {
    it('clicking a result closes search and navigates', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockResolvedValue({
        results: [
          {
            uid: 42, from: 'Click Test', to: 'me@example.com', subject: 'Click Me',
            date: '2025-01-15T10:00:00Z', size: 100,
            flags: { seen: true, flagged: false, answered: false, draft: false, deleted: false },
            has_attach: false, preview: '',
          },
        ],
        count: 1,
      })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'click test')

      await waitFor(() => {
        expect(screen.getByText('Click Test')).toBeDefined()
      })

      const resultRow = document.querySelector('[data-result-index="0"]') as HTMLElement
      fireEvent.click(resultRow)

      expect(useUIStore.getState().searchOpen).toBe(false)
      expect(useMailboxStore.getState().selectedUID).toBe(42)
    })
  })

  describe('backdrop', () => {
    it('clicking backdrop closes search', async () => {
      render(<SearchInterface />)
      await openSearch()

      const backdrop = document.querySelector('.bg-black[aria-hidden="true"]') as HTMLElement
      expect(backdrop).not.toBeNull()
      fireEvent.click(backdrop)

      expect(useUIStore.getState().searchOpen).toBe(false)
    })
  })

  describe('retry', () => {
    it('retry button re-executes the search', async () => {
      const { search } = await import('../../services/search')
      const mockedSearch = vi.mocked(search)
      mockedSearch.mockClear()
      mockedSearch.mockRejectedValueOnce(new Error('fail'))
      mockedSearch.mockResolvedValue({ results: [], count: 0 })

      render(<SearchInterface />)
      await openSearch()
      const input = screen.getByPlaceholderText('Search messages…')
      await triggerSearch(input, 'retry query')

      await waitFor(() => {
        expect(screen.getByText('Search could not be completed. Please try again.')).toBeDefined()
      })

      const callsBeforeRetry = mockedSearch.mock.calls.length
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))

      // Retry should trigger at least one more search call
      await waitFor(() => {
        expect(mockedSearch.mock.calls.length).toBeGreaterThan(callsBeforeRetry)
      })
    })
  })

  describe('filters', () => {
    it('filter toggle button exists', async () => {
      render(<SearchInterface />)
      await openSearch()
      expect(screen.getByRole('button', { name: /toggle filters/i })).toBeDefined()
    })

    it('clicking filter toggle shows filter panel', async () => {
      render(<SearchInterface />)
      await openSearch()
      fireEvent.click(screen.getByRole('button', { name: /toggle filters/i }))
      await waitFor(() => {
        expect(screen.getByLabelText(/Filter by sender/i)).toBeDefined()
        expect(screen.getByLabelText(/Filter by recipient/i)).toBeDefined()
      })
    })

    it('filter inputs are rendered in the panel', async () => {
      render(<SearchInterface />)
      await openSearch()
      fireEvent.click(screen.getByRole('button', { name: /toggle filters/i }))
      await waitFor(() => {
        expect(screen.getByLabelText(/Filter by sender/i)).toBeDefined()
        expect(screen.getByLabelText(/Filter by recipient/i)).toBeDefined()
        expect(screen.getByLabelText(/Filter by folder/i)).toBeDefined()
        expect(screen.getByLabelText(/Filter by date after/i)).toBeDefined()
        expect(screen.getByLabelText(/Filter by date before/i)).toBeDefined()
        expect(screen.getByLabelText(/Filter by has attachments/i)).toBeDefined()
      })
    })
  })
})
