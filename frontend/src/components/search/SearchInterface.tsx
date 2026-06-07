import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '../../stores/uiStore'
import { useMailboxStore } from '../../stores/mailboxStore'
import { search } from '../../services/search'
import { easing, duration } from '../../lib/motion'
import type { MessageSummary } from '../../types'

/** Selector for all focusable elements inside the search overlay */
const FOCUSABLE_SELECTOR = [
  'input:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Formats a date string into a short, readable timestamp.
 * Shows "HH:MM" for today, "Mon DD" for this year, "MM/DD/YY" otherwise.
 */
function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const isThisYear = date.getFullYear() === now.getFullYear()

  if (isThisYear) {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  return date.toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  })
}

/**
 * Truncates a string to a max length, adding ellipsis if exceeded.
 */
function truncatePreview(text: string, maxLength: number = 120): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

/** Maximum number of results to display */
const MAX_RESULTS = 50

/** Debounce delay in ms */
const DEBOUNCE_MS = 300

/** Minimum characters before search triggers */
const MIN_CHARS = 2

/**
 * SearchInterface — Command-palette style search overlay.
 *
 * Opens via Cmd/Ctrl+K. Provides a debounced text input that searches
 * across from/to/subject/body fields. Results displayed in a scrollable
 * list with MessageRow-style layout. Supports keyboard navigation,
 * focus trap, and animated enter/exit transitions.
 */
export function SearchInterface() {
  const searchOpen = useUIStore((s) => s.searchOpen)
  const toggleSearch = useUIStore((s) => s.toggleSearch)
  const setCurrentFolder = useMailboxStore((s) => s.setCurrentFolder)
  const setSelectedUID = useMailboxStore((s) => s.setSelectedUID)

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MessageSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterFolder, setFilterFolder] = useState('')
  const [filterDateBefore, setFilterDateBefore] = useState('')
  const [filterDateAfter, setFilterDateAfter] = useState('')
  const [filterHasAttachment, setFilterHasAttachment] = useState(false)

  // Count active filters
  const activeFilterCount =
    (filterFrom ? 1 : 0) +
    (filterTo ? 1 : 0) +
    (filterFolder ? 1 : 0) +
    (filterDateBefore ? 1 : 0) +
    (filterDateAfter ? 1 : 0) +
    (filterHasAttachment ? 1 : 0)

  const hasActiveFilters = activeFilterCount > 0

  const overlayRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Global keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleSearch()
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [toggleSearch])

  // Mount/unmount with animation support
  useEffect(() => {
    if (searchOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      setMounted(true)
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      })
    } else {
      setVisible(false)
    }
  }, [searchOpen])

  // Handle transitionend for unmount
  const handleTransitionEnd = useCallback(() => {
    if (!visible && !searchOpen) {
      setMounted(false)
      // Reset state
      setQuery('')
      setResults([])
      setError(null)
      setHasSearched(false)
      setActiveIndex(-1)
      setShowFilters(false)
      setFilterFrom('')
      setFilterTo('')
      setFilterFolder('')
      setFilterDateBefore('')
      setFilterDateAfter('')
      setFilterHasAttachment(false)
      // Return focus to previously focused element
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [visible, searchOpen])

  // Focus input when visible
  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus()
    }
  }, [visible])

  // Close handler
  const closeSearch = useCallback(() => {
    if (searchOpen) {
      toggleSearch()
    }
  }, [searchOpen, toggleSearch])

  // Escape key handler
  useEffect(() => {
    if (!mounted) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeSearch()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mounted, closeSearch])

  // Focus trap
  useEffect(() => {
    if (!visible || !overlayRef.current) return

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !overlayRef.current) return

      const focusableElements =
        overlayRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusableElements.length === 0) {
        e.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [visible])

  // Prevent body scroll when open
  useEffect(() => {
    if (mounted) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [mounted])

  // Perform search
  const performSearch = useCallback(async (text: string) => {
    if (text.trim().length < MIN_CHARS && !hasActiveFilters) {
      setResults([])
      setHasSearched(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setHasSearched(true)
    setActiveIndex(-1)

    try {
      const response = await search({
        text: text.trim() || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        folder: filterFolder || undefined,
        date_after: filterDateAfter || undefined,
        date_before: filterDateBefore || undefined,
        has_attachment: filterHasAttachment || undefined,
      })
      setResults(response.results.slice(0, MAX_RESULTS))
    } catch {
      setError('Search could not be completed. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [filterFrom, filterTo, filterFolder, filterDateAfter, filterDateBefore, filterHasAttachment, hasActiveFilters])

  // Handle input change with debounce
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (value.trim().length < MIN_CHARS && !hasActiveFilters) {
        setResults([])
        setHasSearched(false)
        setError(null)
        return
      }

      debounceRef.current = setTimeout(() => {
        performSearch(value)
      }, DEBOUNCE_MS)
    },
    [performSearch, hasActiveFilters],
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Select a result: close overlay, navigate to message
  const handleSelectResult = useCallback(
    (message: MessageSummary) => {
      closeSearch()
      // Navigate to the message's folder and select it
      setCurrentFolder('INBOX')
      setSelectedUID(message.uid)
    },
    [closeSearch, setCurrentFolder, setSelectedUID],
  )

  // Retry search
  const handleRetry = useCallback(() => {
    performSearch(query)
  }, [performSearch, query])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterFrom('')
    setFilterTo('')
    setFilterFolder('')
    setFilterDateBefore('')
    setFilterDateAfter('')
    setFilterHasAttachment(false)
  }, [])

  // Re-run search when filters change (if we already have a query)
  useEffect(() => {
    if (hasSearched || hasActiveFilters) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        performSearch(query)
      }, DEBOUNCE_MS)
    }
    // Only trigger on filter changes, not on query changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo, filterFolder, filterDateAfter, filterDateBefore, filterHasAttachment])

  // Keyboard navigation for results
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => {
          const next = prev + 1
          return next >= results.length ? 0 : next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => {
          const next = prev - 1
          return next < 0 ? results.length - 1 : next
        })
      } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault()
        handleSelectResult(results[activeIndex])
      }
    },
    [results, activeIndex, handleSelectResult],
  )

  // Scroll active result into view
  useEffect(() => {
    if (activeIndex >= 0 && resultsRef.current) {
      const activeElement = resultsRef.current.querySelector(
        `[data-result-index="${activeIndex}"]`,
      )
      activeElement?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  // Click outside handler
  const handleBackdropClick = useCallback(() => {
    closeSearch()
  }, [closeSearch])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={!visible}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-[250ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
        style={{ opacity: visible ? 0.3 : 0 }}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Search panel */}
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search messages"
        className={[
          'relative z-10 w-full max-w-[640px] mx-4',
          'bg-[var(--color-surface-elevated)] rounded-[var(--radius-lg)]',
          'shadow-[var(--shadow-high)]',
          'flex flex-col overflow-hidden',
          'outline-none',
          'transition-[transform,opacity]',
          visible
            ? 'scale-100 opacity-100 duration-[250ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'
            : searchOpen
              ? 'scale-[0.96] opacity-0 duration-[250ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'
              : 'scale-[0.96] opacity-0 duration-[150ms] [transition-timing-function:cubic-bezier(0.55,0.085,0.68,0.53)]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          {/* Search icon */}
          <svg
            className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8.5 3a5.5 5.5 0 0 1 4.383 8.823l4.147 4.147a.75.75 0 0 1-1.06 1.06l-4.147-4.147A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
              fill="currentColor"
            />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Search messages…"
            aria-label="Search messages"
            aria-activedescendant={
              activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
            }
            aria-controls="search-results-list"
            className={[
              'flex-1 bg-transparent outline-none',
              'text-[var(--text-base)] text-[var(--color-text-primary)]',
              'placeholder:text-[var(--color-text-secondary)]',
            ].join(' ')}
          />

          {/* Filter toggle button */}
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-label={`Toggle filters${hasActiveFilters ? ` (${activeFilterCount} active)` : ''}`}
            aria-pressed={showFilters}
            className={[
              'relative flex items-center justify-center w-[44px] h-[44px] -mr-2 rounded-[var(--radius-md)]',
              'transition-colors duration-[150ms] ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2',
              hasActiveFilters
                ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]',
            ].join(' ')}
          >
            {/* Filter/funnel icon */}
            <svg
              className="w-5 h-5"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM4.25 8.5a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75ZM6 12.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z"
                fill="currentColor"
              />
            </svg>
            {/* Active filter badge */}
            {hasActiveFilters && (
              <span
                className={[
                  'absolute -top-0.5 -right-0.5',
                  'min-w-[18px] h-[18px] flex items-center justify-center',
                  'text-[10px] font-semibold leading-none',
                  'text-white bg-[var(--color-accent)]',
                  'rounded-full px-1',
                ].join(' ')}
                aria-hidden="true"
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Keyboard shortcut hint */}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-[var(--text-xs)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
            Esc
          </kbd>
        </div>

        {/* Filter panel */}
        <div
          role="region"
          aria-label="Search filters"
          className={[
            'overflow-hidden border-b border-[var(--color-border)]',
            'transition-[max-height,opacity] ease-out',
            showFilters
              ? 'max-h-[300px] opacity-100'
              : 'max-h-0 opacity-0',
          ].join(' ')}
          style={{
            transitionDuration: `${duration.normal}ms`,
            transitionTimingFunction: showFilters ? easing.outExpo : easing.inQuad,
          }}
        >
          <div className="px-4 py-3 bg-[var(--color-surface)]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* From */}
              <label className="flex flex-col gap-1">
                <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                  From
                </span>
                <input
                  type="text"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  placeholder="From"
                  aria-label="Filter by sender"
                  className={[
                    'h-[44px] px-3 rounded-[var(--radius-md)]',
                    'bg-[var(--color-surface-elevated)] border border-[var(--color-border)]',
                    'text-[var(--text-sm)] text-[var(--color-text-primary)]',
                    'placeholder:text-[var(--color-text-secondary)]',
                    'outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
                    'transition-[border-color,box-shadow] duration-[150ms] ease-out',
                  ].join(' ')}
                />
              </label>

              {/* To */}
              <label className="flex flex-col gap-1">
                <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                  To
                </span>
                <input
                  type="text"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  placeholder="To"
                  aria-label="Filter by recipient"
                  className={[
                    'h-[44px] px-3 rounded-[var(--radius-md)]',
                    'bg-[var(--color-surface-elevated)] border border-[var(--color-border)]',
                    'text-[var(--text-sm)] text-[var(--color-text-primary)]',
                    'placeholder:text-[var(--color-text-secondary)]',
                    'outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
                    'transition-[border-color,box-shadow] duration-[150ms] ease-out',
                  ].join(' ')}
                />
              </label>

              {/* Folder */}
              <label className="flex flex-col gap-1">
                <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                  Folder
                </span>
                <input
                  type="text"
                  value={filterFolder}
                  onChange={(e) => setFilterFolder(e.target.value)}
                  placeholder="Folder (e.g. INBOX)"
                  aria-label="Filter by folder"
                  className={[
                    'h-[44px] px-3 rounded-[var(--radius-md)]',
                    'bg-[var(--color-surface-elevated)] border border-[var(--color-border)]',
                    'text-[var(--text-sm)] text-[var(--color-text-primary)]',
                    'placeholder:text-[var(--color-text-secondary)]',
                    'outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
                    'transition-[border-color,box-shadow] duration-[150ms] ease-out',
                  ].join(' ')}
                />
              </label>

              {/* Date after */}
              <label className="flex flex-col gap-1">
                <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                  Date after
                </span>
                <input
                  type="date"
                  value={filterDateAfter}
                  onChange={(e) => setFilterDateAfter(e.target.value)}
                  aria-label="Filter by date after"
                  className={[
                    'h-[44px] px-3 rounded-[var(--radius-md)]',
                    'bg-[var(--color-surface-elevated)] border border-[var(--color-border)]',
                    'text-[var(--text-sm)] text-[var(--color-text-primary)]',
                    'placeholder:text-[var(--color-text-secondary)]',
                    'outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
                    'transition-[border-color,box-shadow] duration-[150ms] ease-out',
                  ].join(' ')}
                />
              </label>

              {/* Date before */}
              <label className="flex flex-col gap-1">
                <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                  Date before
                </span>
                <input
                  type="date"
                  value={filterDateBefore}
                  onChange={(e) => setFilterDateBefore(e.target.value)}
                  aria-label="Filter by date before"
                  className={[
                    'h-[44px] px-3 rounded-[var(--radius-md)]',
                    'bg-[var(--color-surface-elevated)] border border-[var(--color-border)]',
                    'text-[var(--text-sm)] text-[var(--color-text-primary)]',
                    'placeholder:text-[var(--color-text-secondary)]',
                    'outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
                    'transition-[border-color,box-shadow] duration-[150ms] ease-out',
                  ].join(' ')}
                />
              </label>

              {/* Has attachments */}
              <label className="flex items-end gap-2 h-[44px]">
                <input
                  type="checkbox"
                  checked={filterHasAttachment}
                  onChange={(e) => setFilterHasAttachment(e.target.checked)}
                  aria-label="Filter by has attachments"
                  className={[
                    'w-[18px] h-[18px] rounded-[var(--radius-sm)]',
                    'border border-[var(--color-border)]',
                    'accent-[var(--color-accent)]',
                    'cursor-pointer',
                  ].join(' ')}
                />
                <span className="text-[var(--text-sm)] text-[var(--color-text-primary)] select-none cursor-pointer">
                  Has attachments
                </span>
              </label>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className={[
                    'h-[44px] px-4 rounded-[var(--radius-md)]',
                    'text-[var(--text-sm)] font-medium',
                    'text-[var(--color-accent)]',
                    'hover:bg-[var(--color-accent)]/10',
                    'transition-colors duration-[150ms] ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2',
                  ].join(' ')}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results area */}
        <div
          ref={resultsRef}
          id="search-results-list"
          role="listbox"
          aria-label="Search results"
          className="max-h-[400px] overflow-y-auto"
        >
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <div className="py-1">
              {results.map((message, index) => (
                <SearchResultRow
                  key={message.uid}
                  message={message}
                  index={index}
                  isActive={index === activeIndex}
                  onSelect={handleSelectResult}
                  onHover={setActiveIndex}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                No messages matched your search.
              </p>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-8 px-4 gap-3">
              <p className="text-[var(--text-sm)] text-[var(--color-error)]">
                {error}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className={[
                  'px-3 py-1.5 rounded-[var(--radius-md)]',
                  'bg-[var(--color-accent)] text-white text-[var(--text-sm)]',
                  'hover:bg-[var(--color-accent-hover)]',
                  'transition-colors duration-[150ms] ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2',
                ].join(' ')}
              >
                Retry
              </button>
            </div>
          )}

          {/* Initial state (no query yet) */}
          {!loading && !error && !hasSearched && query.trim().length < MIN_CHARS && (
            <div className="flex items-center justify-center py-8 px-4">
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                Type at least 2 characters to search
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

SearchInterface.displayName = 'SearchInterface'

// --- Internal sub-component ---

interface SearchResultRowProps {
  message: MessageSummary
  index: number
  isActive: boolean
  onSelect: (message: MessageSummary) => void
  onHover: (index: number) => void
}

function SearchResultRow({
  message,
  index,
  isActive,
  onSelect,
  onHover,
}: SearchResultRowProps) {
  const isUnread = !message.flags.seen
  const preview = truncatePreview(message.preview || '')

  return (
    <div
      id={`search-result-${index}`}
      role="option"
      aria-selected={isActive}
      data-result-index={index}
      tabIndex={-1}
      className={`
        flex items-center gap-3 px-4 h-[72px] cursor-pointer
        transition-colors duration-[150ms] ease-out
        ${isActive ? 'bg-[var(--color-accent)]/10' : 'hover:bg-[var(--color-surface)]'}
      `}
      onClick={() => onSelect(message)}
      onMouseEnter={() => onHover(index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(message)
        }
      }}
    >
      {/* Unread indicator */}
      <div className="flex-shrink-0 w-[6px]">
        {isUnread && (
          <div
            className="w-[6px] h-[6px] rounded-full bg-[var(--color-accent)]"
            aria-label="Unread"
          />
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        {/* Top row: sender + timestamp */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`
              truncate text-[var(--text-sm)] leading-[var(--leading-tight)]
              text-[var(--color-text-primary)]
              ${isUnread ? 'font-semibold' : 'font-normal'}
            `}
          >
            {message.from}
          </span>
          <time
            dateTime={message.date}
            className="flex-shrink-0 text-[var(--text-xs)] text-[var(--color-text-secondary)]"
          >
            {formatTimestamp(message.date)}
          </time>
        </div>

        {/* Subject */}
        <span
          className={`
            truncate text-[var(--text-sm)] leading-[var(--leading-tight)]
            text-[var(--color-text-primary)]
            ${isUnread ? 'font-semibold' : 'font-normal'}
          `}
        >
          {message.subject}
        </span>

        {/* Preview */}
        {preview && (
          <span className="truncate text-[var(--text-xs)] leading-[var(--leading-normal)] text-[var(--color-text-secondary)]">
            {preview}
          </span>
        )}
      </div>
    </div>
  )
}
