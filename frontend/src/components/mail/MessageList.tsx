import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMailboxStore } from '../../stores/mailboxStore'
import { listMessages } from '../../services/messages'
import { search } from '../../services/search'
import { staggerStyle } from '../../lib/motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { Skeleton } from '../primitives/Skeleton'
import { MessageRow } from './MessageRow'

const ESTIMATED_ROW_HEIGHT = 72

/**
 * Virtualized message list with embedded search bar, stagger entrance
 * animations, infinite scroll loading, loading skeleton, and error state.
 *
 * Validates: Requirements 9.1, 9.2, 9.4, 9.5, 9.6, 9.8, 9.9
 */
export function MessageList() {
  const currentFolder = useMailboxStore((s) => s.currentFolder)
  const messages = useMailboxStore((s) => s.messages)
  const setMessages = useMailboxStore((s) => s.setMessages)
  const appendMessages = useMailboxStore((s) => s.appendMessages)
  const selectedUID = useMailboxStore((s) => s.selectedUID)
  const setSelectedUID = useMailboxStore((s) => s.setSelectedUID)
  const selectedUIDs = useMailboxStore((s) => s.selectedUIDs)
  const toggleUID = useMailboxStore((s) => s.toggleUID)
  const page = useMailboxStore((s) => s.page)
  const pageSize = useMailboxStore((s) => s.pageSize)
  const total = useMailboxStore((s) => s.total)
  const setPage = useMailboxStore((s) => s.setPage)
  const setTotal = useMailboxStore((s) => s.setTotal)

  // Search state from store
  const searchMode = useMailboxStore((s) => s.searchMode)
  const searchResults = useMailboxStore((s) => s.searchResults)
  const searchTotal = useMailboxStore((s) => s.searchTotal)
  const searchLoading = useMailboxStore((s) => s.searchLoading)
  const setSearchMode = useMailboxStore((s) => s.setSearchMode)
  const setSearchQueryStore = useMailboxStore((s) => s.setSearchQuery)
  const setSearchResults = useMailboxStore((s) => s.setSearchResults)
  const setSearchLoading = useMailboxStore((s) => s.setSearchLoading)
  const clearSearch = useMailboxStore((s) => s.clearSearch)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  // Search bar local state
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterFolder, setFilterFolder] = useState('')
  const [filterDateAfter, setFilterDateAfter] = useState('')
  const [filterDateBefore, setFilterDateBefore] = useState('')
  const [filterHasAttachment, setFilterHasAttachment] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const parentRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  const hasMore = (page + 1) * pageSize < total

  // Active filter count
  const activeFilterCount =
    (filterFrom ? 1 : 0) +
    (filterTo ? 1 : 0) +
    (filterFolder ? 1 : 0) +
    (filterDateAfter ? 1 : 0) +
    (filterDateBefore ? 1 : 0) +
    (filterHasAttachment ? 1 : 0)

  // Display messages: search results when in search mode, normal messages otherwise
  const displayMessages = searchMode ? searchResults : messages

  // Fetch messages when folder/page/pageSize changes (not in search mode)
  useEffect(() => {
    if (searchMode) return

    let cancelled = false

    if (page === 0) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setError(null)
    if (page === 0) setHasAnimated(false)

    listMessages(currentFolder, page, pageSize)
      .then((res) => {
        if (cancelled) return
        if (page === 0) {
          setMessages(res.messages)
        } else {
          appendMessages(res.messages)
        }
        setTotal(res.total)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load messages', err)
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      })
      .finally(() => {
        if (!cancelled) {
          if (page === 0) setLoading(false)
          else setLoadingMore(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentFolder, page, pageSize, searchMode, setMessages, appendMessages, setTotal])

  // Trigger stagger animation after messages load
  useEffect(() => {
    if (!loading && displayMessages.length > 0 && !hasAnimated) {
      const id = requestAnimationFrame(() => {
        setHasAnimated(true)
      })
      return () => cancelAnimationFrame(id)
    }
  }, [loading, displayMessages.length, hasAnimated])

  // IntersectionObserver for infinite scroll — load next page when sentinel is visible
  useEffect(() => {
    if (searchMode) return // don't infinite-scroll in search mode
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage(page + 1)
        }
      },
      { threshold: 0 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, page, setPage, searchMode])

  const virtualizer = useVirtualizer({
    count: displayMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
  })

  const handleSelect = useCallback(
    (uid: number) => {
      setSelectedUID(uid)
    },
    [setSelectedUID],
  )

  const handleBatchToggle = useCallback(
    (uid: number) => {
      toggleUID(uid)
    },
    [toggleUID],
  )

  // Filter helpers
  const clearFilters = () => {
    setFilterFrom('')
    setFilterTo('')
    setFilterFolder('')
    setFilterDateAfter('')
    setFilterDateBefore('')
    setFilterHasAttachment(false)
  }

  const handleClearSearch = () => {
    clearSearch()
    setSearchQuery('')
    clearFilters()
    setShowFilters(false)
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setSearchQueryStore(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2 && activeFilterCount === 0) {
      clearSearch()
      return
    }

    debounceRef.current = setTimeout(() => {
      setSearchMode(true)
      setSearchLoading(true)
      search({
        text: value.trim() || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        folder: filterFolder || undefined,
        date_after: filterDateAfter || undefined,
        date_before: filterDateBefore || undefined,
        has_attachment: filterHasAttachment || undefined,
      })
        .then((res) => {
          setSearchResults(res.results, res.count)
        })
        .catch(() => {
          setSearchResults([], 0)
        })
        .finally(() => {
          setSearchLoading(false)
        })
    }, 300)
  }

  // Re-run search when filters change (if in search mode or query has content)
  useEffect(() => {
    if ((searchMode || searchQuery.trim().length >= 2) && debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      if (searchMode || searchQuery.trim().length >= 2) {
        setSearchLoading(true)
        search({
          text: searchQuery.trim() || undefined,
          from: filterFrom || undefined,
          to: filterTo || undefined,
          folder: filterFolder || undefined,
          date_after: filterDateAfter || undefined,
          date_before: filterDateBefore || undefined,
          has_attachment: filterHasAttachment || undefined,
        })
          .then((res) => setSearchResults(res.results, res.count))
          .catch(() => setSearchResults([], 0))
          .finally(() => setSearchLoading(false))
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo, filterFolder, filterDateAfter, filterDateBefore, filterHasAttachment])

  // Loading state: skeleton indicators (initial load only, not in search mode)
  if (loading && messages.length === 0 && !searchMode) {
    return (
      <div className="flex flex-col h-full">
        {/* Persistent search bar */}
        <div className="shrink-0 px-3 py-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M8.5 3a5.5 5.5 0 0 1 4.383 8.823l4.147 4.147a.75.75 0 0 1-1.06 1.06l-4.147-4.147A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              placeholder="Search messages…"
              aria-label="Search messages"
              className={[
                'flex-1 bg-transparent outline-none',
                'text-[var(--text-sm)] text-[var(--color-text-primary)]',
                'placeholder:text-[var(--color-text-secondary)]',
              ].join(' ')}
            />
            {searchLoading && (
              <div className="w-4 h-4 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin flex-shrink-0" aria-hidden="true" />
            )}
            {searchMode && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className={[
                  'flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-md)]',
                  'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                  'hover:bg-[var(--color-surface)]',
                  'transition-colors duration-[150ms] ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                ].join(' ')}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M6.28 6.28a.75.75 0 0 1 1.06 0L10 8.94l2.66-2.66a.75.75 0 1 1 1.06 1.06L11.06 10l2.66 2.66a.75.75 0 1 1-1.06 1.06L10 11.06 7.34 13.72a.75.75 0 0 1-1.06-1.06L8.94 10 6.28 7.34a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label={`Toggle filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
              aria-pressed={showFilters}
              className={[
                'relative flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-md)]',
                'transition-colors duration-[150ms] ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                activeFilterCount > 0
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]',
              ].join(' ')}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM4.25 8.5a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75ZM6 12.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z" fill="currentColor" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center text-[10px] font-semibold leading-none text-white bg-[var(--color-accent)] rounded-full px-1" aria-hidden="true">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-2 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1 p-3">
              <Skeleton width="60%" height={14} />
              <Skeleton width="80%" height={12} />
              <Skeleton width="40%" height={12} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error && !searchMode) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 px-3 py-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M8.5 3a5.5 5.5 0 0 1 4.383 8.823l4.147 4.147a.75.75 0 0 1-1.06 1.06l-4.147-4.147A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              placeholder="Search messages…"
              aria-label="Search messages"
              className={[
                'flex-1 bg-transparent outline-none',
                'text-[var(--text-sm)] text-[var(--color-text-primary)]',
                'placeholder:text-[var(--color-text-secondary)]',
              ].join(' ')}
            />
            {searchLoading && (
              <div className="w-4 h-4 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin flex-shrink-0" aria-hidden="true" />
            )}
            {searchMode && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className={[
                  'flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-md)]',
                  'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                  'hover:bg-[var(--color-surface)]',
                  'transition-colors duration-[150ms] ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                ].join(' ')}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M6.28 6.28a.75.75 0 0 1 1.06 0L10 8.94l2.66-2.66a.75.75 0 1 1 1.06 1.06L11.06 10l2.66 2.66a.75.75 0 1 1-1.06 1.06L10 11.06 7.34 13.72a.75.75 0 0 1-1.06-1.06L8.94 10 6.28 7.34a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label={`Toggle filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
              aria-pressed={showFilters}
              className={[
                'relative flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-md)]',
                'transition-colors duration-[150ms] ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                activeFilterCount > 0
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]',
              ].join(' ')}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM4.25 8.5a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75ZM6 12.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z" fill="currentColor" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center text-[10px] font-semibold leading-none text-white bg-[var(--color-accent)] rounded-full px-1" aria-hidden="true">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-[var(--color-error)] text-sm" role="alert">
            {error}
          </p>
        </div>
      </div>
    )
  }

  // Empty state (normal mode)
  if (messages.length === 0 && !searchMode && !loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 px-3 py-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M8.5 3a5.5 5.5 0 0 1 4.383 8.823l4.147 4.147a.75.75 0 0 1-1.06 1.06l-4.147-4.147A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              placeholder="Search messages…"
              aria-label="Search messages"
              className={[
                'flex-1 bg-transparent outline-none',
                'text-[var(--text-sm)] text-[var(--color-text-primary)]',
                'placeholder:text-[var(--color-text-secondary)]',
              ].join(' ')}
            />
            {searchLoading && (
              <div className="w-4 h-4 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin flex-shrink-0" aria-hidden="true" />
            )}
            {searchMode && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className={[
                  'flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-md)]',
                  'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                  'hover:bg-[var(--color-surface)]',
                  'transition-colors duration-[150ms] ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                ].join(' ')}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M6.28 6.28a.75.75 0 0 1 1.06 0L10 8.94l2.66-2.66a.75.75 0 1 1 1.06 1.06L11.06 10l2.66 2.66a.75.75 0 1 1-1.06 1.06L10 11.06 7.34 13.72a.75.75 0 0 1-1.06-1.06L8.94 10 6.28 7.34a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label={`Toggle filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
              aria-pressed={showFilters}
              className={[
                'relative flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-md)]',
                'transition-colors duration-[150ms] ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                activeFilterCount > 0
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]',
              ].join(' ')}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM4.25 8.5a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75ZM6 12.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z" fill="currentColor" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center text-[10px] font-semibold leading-none text-white bg-[var(--color-accent)] rounded-full px-1" aria-hidden="true">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-[var(--color-text-secondary)] text-sm">No messages in this folder</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Persistent search bar */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {/* Search icon */}
          <svg className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M8.5 3a5.5 5.5 0 0 1 4.383 8.823l4.147 4.147a.75.75 0 0 1-1.06 1.06l-4.147-4.147A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor" />
          </svg>

          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInputChange}
            placeholder="Search messages…"
            aria-label="Search messages"
            className={[
              'flex-1 bg-transparent outline-none',
              'text-[var(--text-sm)] text-[var(--color-text-primary)]',
              'placeholder:text-[var(--color-text-secondary)]',
            ].join(' ')}
          />

          {/* Loading spinner */}
          {searchLoading && (
            <div className="w-4 h-4 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin flex-shrink-0" aria-hidden="true" />
          )}

          {/* Clear search button — only shown when in search mode */}
          {searchMode && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className={[
                'flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-md)]',
                'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-surface)]',
                'transition-colors duration-[150ms] ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
              ].join(' ')}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M6.28 6.28a.75.75 0 0 1 1.06 0L10 8.94l2.66-2.66a.75.75 0 1 1 1.06 1.06L11.06 10l2.66 2.66a.75.75 0 1 1-1.06 1.06L10 11.06 7.34 13.72a.75.75 0 0 1-1.06-1.06L8.94 10 6.28 7.34a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
              </svg>
            </button>
          )}

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-label={`Toggle filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
            aria-pressed={showFilters}
            className={[
              'relative flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-md)]',
              'transition-colors duration-[150ms] ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
              activeFilterCount > 0
                ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]',
            ].join(' ')}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM4.25 8.5a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75ZM6 12.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z" fill="currentColor" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center text-[10px] font-semibold leading-none text-white bg-[var(--color-accent)] rounded-full px-1" aria-hidden="true">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel — collapsible */}
        <div
          className={[
            'overflow-hidden transition-[max-height,opacity] ease-out',
            showFilters ? 'max-h-[200px] opacity-100 mt-2' : 'max-h-0 opacity-0',
          ].join(' ')}
          style={{ transitionDuration: '200ms' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)]">
            {/* From filter */}
            <input
              type="text"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              placeholder="From"
              aria-label="Filter by sender"
              className="h-[36px] px-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            {/* To filter */}
            <input
              type="text"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              placeholder="To"
              aria-label="Filter by recipient"
              className="h-[36px] px-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            {/* Folder filter */}
            <input
              type="text"
              value={filterFolder}
              onChange={(e) => setFilterFolder(e.target.value)}
              placeholder="Folder"
              aria-label="Filter by folder"
              className="h-[36px] px-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            {/* Date after */}
            <input
              type="date"
              value={filterDateAfter}
              onChange={(e) => setFilterDateAfter(e.target.value)}
              aria-label="Filter by date after"
              className="h-[36px] px-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--text-sm)] text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            {/* Date before */}
            <input
              type="date"
              value={filterDateBefore}
              onChange={(e) => setFilterDateBefore(e.target.value)}
              aria-label="Filter by date before"
              className="h-[36px] px-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--text-sm)] text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            {/* Has attachments */}
            <label className="flex items-center gap-2 h-[36px] px-2">
              <input
                type="checkbox"
                checked={filterHasAttachment}
                onChange={(e) => setFilterHasAttachment(e.target.checked)}
                aria-label="Filter by has attachments"
                className="w-[16px] h-[16px] rounded-[var(--radius-sm)] border border-[var(--color-border)] accent-[var(--color-accent)]"
              />
              <span className="text-[var(--text-sm)] text-[var(--color-text-primary)] select-none">Has attachments</span>
            </label>
          </div>
          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={clearFilters}
                className="text-[var(--text-xs)] text-[var(--color-accent)] hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Virtualized message list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        role="list"
        aria-label="Messages"
      >
        {/* Search mode empty state */}
        {searchMode && !searchLoading && displayMessages.length === 0 && (
          <div className="flex items-center justify-center p-4">
            <p className="text-[var(--color-text-secondary)] text-sm">No results found</p>
          </div>
        )}

        {displayMessages.length > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const msg = displayMessages[virtualRow.index]
              const index = virtualRow.index
              const isSelected = selectedUID === msg.uid

              // Stagger entrance animation styles
              const animateEntrance = !reducedMotion && !hasAnimated
              const entranceStyle = animateEntrance
                ? staggerStyle(index)
                : undefined

              return (
                <div
                  key={msg.uid}
                  role="listitem"
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={[
                    'absolute top-0 left-0 w-full',
                    'transition-[background-color] duration-[150ms] ease-out',
                    isSelected ? 'bg-[var(--color-surface)]' : '',
                  ].join(' ')}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    style={
                      !reducedMotion
                        ? hasAnimated
                          ? index < 10
                            ? {
                                opacity: 1,
                                transform: 'translateY(0)',
                                transition: `opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1)`,
                                transitionDelay: `${index * 30}ms`,
                              }
                            : undefined
                          : entranceStyle
                        : undefined
                    }
                  >
                    <MessageRow
                      message={msg}
                      isSelected={isSelected}
                      isBatchSelected={selectedUIDs.has(msg.uid)}
                      onSelect={handleSelect}
                      onBatchToggle={handleBatchToggle}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Sentinel element for infinite scroll detection */}
        <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      </div>

      {/* Footer status */}
      <div
        className="flex items-center justify-center py-3 border-t border-[var(--color-border)]"
        aria-label="Message list status"
      >
        {searchMode ? (
          <span className="text-xs text-[var(--color-text-secondary)]">
            {searchLoading ? 'Searching…' : `${searchResults.length}${searchTotal > 0 ? ` of ${searchTotal}` : ''} results`}
          </span>
        ) : (
          <>
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <div
                  className="h-4 w-4 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin"
                  aria-hidden="true"
                />
                <span>Loading more messages…</span>
              </div>
            )}
            {!hasMore && messages.length > 0 && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                {messages.length} of {total} messages
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MessageList
