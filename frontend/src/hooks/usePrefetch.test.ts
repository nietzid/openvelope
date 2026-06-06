import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the messages service
vi.mock('../services/messages', () => ({
  getMessage: vi.fn(),
}))

import { usePrefetch, getPrefetchedMessage } from './usePrefetch'
import { getMessage } from '../services/messages'

const mockedGetMessage = vi.mocked(getMessage)

describe('usePrefetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedGetMessage.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns onMouseEnter and onMouseLeave handlers', () => {
    const { result } = renderHook(() => usePrefetch('INBOX', 1))
    expect(result.current.onMouseEnter).toBeInstanceOf(Function)
    expect(result.current.onMouseLeave).toBeInstanceOf(Function)
  })

  it('calls getMessage after 200ms hover', async () => {
    mockedGetMessage.mockResolvedValue('<p>Hello</p>')

    const { result } = renderHook(() => usePrefetch('INBOX', 42))

    act(() => {
      result.current.onMouseEnter()
    })

    // Before 200ms — should not have been called
    expect(mockedGetMessage).not.toHaveBeenCalled()

    // Advance past threshold
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(mockedGetMessage).toHaveBeenCalledWith('INBOX', 42)
  })

  it('does not call getMessage if hover ends before 200ms', () => {
    const { result } = renderHook(() => usePrefetch('INBOX', 10))

    act(() => {
      result.current.onMouseEnter()
    })

    // Leave before threshold
    act(() => {
      vi.advanceTimersByTime(100)
      result.current.onMouseLeave()
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(mockedGetMessage).not.toHaveBeenCalled()
  })

  it('caches the prefetched content', async () => {
    mockedGetMessage.mockResolvedValue('<p>Cached content</p>')

    const { result } = renderHook(() => usePrefetch('INBOX', 99))

    act(() => {
      result.current.onMouseEnter()
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Wait for the promise to resolve
    await vi.waitFor(() => {
      expect(getPrefetchedMessage('INBOX', 99)).toBe('<p>Cached content</p>')
    })
  })

  it('does not fetch again if already cached', async () => {
    mockedGetMessage.mockResolvedValue('<p>Content</p>')

    const { result } = renderHook(() => usePrefetch('INBOX', 99))

    // First hover — triggers prefetch
    act(() => {
      result.current.onMouseEnter()
      vi.advanceTimersByTime(200)
    })

    await vi.waitFor(() => {
      expect(getPrefetchedMessage('INBOX', 99)).toBeDefined()
    })

    mockedGetMessage.mockClear()

    // Second hover — should skip
    act(() => {
      result.current.onMouseEnter()
      vi.advanceTimersByTime(200)
    })

    expect(mockedGetMessage).not.toHaveBeenCalled()
  })

  it('aborts in-flight fetch on mouse leave', async () => {
    // Create a fetch that never resolves until we say so
    let rejectFn: (reason?: unknown) => void
    mockedGetMessage.mockImplementation(
      () => new Promise((_resolve, reject) => { rejectFn = reject })
    )

    const { result } = renderHook(() => usePrefetch('Sent', 5))

    act(() => {
      result.current.onMouseEnter()
      vi.advanceTimersByTime(200)
    })

    // Fetch is now in-flight; leave the row
    act(() => {
      result.current.onMouseLeave()
    })

    // Simulate the aborted fetch rejecting
    rejectFn!(new DOMException('Aborted', 'AbortError'))

    // Should not cache anything
    expect(getPrefetchedMessage('Sent', 5)).toBeUndefined()
  })

  it('silently ignores fetch errors', async () => {
    mockedGetMessage.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => usePrefetch('INBOX', 7))

    act(() => {
      result.current.onMouseEnter()
      vi.advanceTimersByTime(200)
    })

    // Should not throw — errors are swallowed
    await vi.waitFor(() => {
      expect(getPrefetchedMessage('INBOX', 7)).toBeUndefined()
    })
  })
})
