import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMailboxStore } from '../../stores/mailboxStore'
import { listMessages } from '../../services/messages'
import { staggerStyle } from '../../lib/motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { Skeleton } from '../primitives/Skeleton'
import { MessageRow } from './MessageRow'

const PAGE_SIZES = [25, 50, 100, 200] as const
const ESTIMATED_ROW_HEIGHT = 72

/**
 * Virtualized message list with stagger entrance animations,
 * pagination controls, loading skeleton, and error state.
 *
 * Validates: Requirements 9.1, 9.2, 9.4, 9.5, 9.6, 9.8, 9.9
 */
export function MessageList() {
  const currentFolder = useMailboxStore((s) => s.currentFolder)
  const messages = useMailboxStore((s) => s.messages)
  const setMessages = useMailboxStore((s) => s.setMessages)
  const selectedUID = useMailboxStore((s) => s.selectedUID)
  const setSelectedUID = useMailboxStore((s) => s.setSelectedUID)
  const selectedUIDs = useMailboxStore((s) => s.selectedUIDs)
  const toggleUID = useMailboxStore((s) => s.toggleUID)
  const page = useMailboxStore((s) => s.page)
  const pageSize = useMailboxStore((s) => s.pageSize)
  const total = useMailboxStore((s) => s.total)
  const setPage = useMailboxStore((s) => s.setPage)
  const setPageSize = useMailboxStore((s) => s.setPageSize)
  const setTotal = useMailboxStore((s) => s.setTotal)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  // Fetch messages when folder/page/pageSize changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setHasAnimated(false)

    listMessages(currentFolder, page, pageSize)
      .then((res) => {
        if (cancelled) return
        setMessages(res.messages)
        setTotal(res.total)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load messages', err)
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentFolder, page, pageSize, setMessages, setTotal])

  // Trigger stagger animation after messages load
  useEffect(() => {
    if (!loading && messages.length > 0 && !hasAnimated) {
      // Use rAF to allow initial styles to paint before transitioning
      const id = requestAnimationFrame(() => {
        setHasAnimated(true)
      })
      return () => cancelAnimationFrame(id)
    }
  }, [loading, messages.length, hasAnimated])

  const virtualizer = useVirtualizer({
    count: messages.length,
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

  const handlePageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setPageSize(Number(e.target.value))
    },
    [setPageSize],
  )

  const handlePrev = useCallback(() => {
    setPage(page - 1)
  }, [page, setPage])

  const handleNext = useCallback(() => {
    setPage(page + 1)
  }, [page, setPage])

  const isPrevDisabled = page <= 0
  const isNextDisabled = (page + 1) * pageSize >= total

  // Loading state: skeleton indicators
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden p-2 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1 p-3">
              <Skeleton width="60%" height={14} />
              <Skeleton width="80%" height={12} />
              <Skeleton width="40%" height={12} />
            </div>
          ))}
        </div>
        {/* Pagination footer — disabled during loading */}
        <PaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          isPrevDisabled={true}
          isNextDisabled={true}
          disabled={true}
          onPageSizeChange={handlePageSizeChange}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>
    )
  }

  // Error state: error message, preserve pagination
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-error text-sm" role="alert">
            {error}
          </p>
        </div>
        <PaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          isPrevDisabled={isPrevDisabled}
          isNextDisabled={isNextDisabled}
          disabled={false}
          onPageSizeChange={handlePageSizeChange}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>
    )
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-text-secondary text-sm">No messages in this folder</p>
        </div>
        <PaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          isPrevDisabled={true}
          isNextDisabled={true}
          disabled={false}
          onPageSizeChange={handlePageSizeChange}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Virtualized message list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        role="list"
        aria-label="Messages"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const msg = messages[virtualRow.index]
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
                  isSelected ? 'bg-surface' : '',
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
      </div>

      {/* Pagination footer */}
      <PaginationFooter
        page={page}
        pageSize={pageSize}
        total={total}
        isPrevDisabled={isPrevDisabled}
        isNextDisabled={isNextDisabled}
        disabled={false}
        onPageSizeChange={handlePageSizeChange}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  )
}

/**
 * Pagination footer with page size selector and Prev/Next buttons.
 */
function PaginationFooter({
  page,
  pageSize,
  total,
  isPrevDisabled,
  isNextDisabled,
  disabled,
  onPageSizeChange,
  onPrev,
  onNext,
}: {
  page: number
  pageSize: number
  total: number
  isPrevDisabled: boolean
  isNextDisabled: boolean
  disabled: boolean
  onPageSizeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onPrev: () => void
  onNext: () => void
}) {
  const rangeStart = total > 0 ? page * pageSize + 1 : 0
  const rangeEnd = total > 0 ? Math.min((page + 1) * pageSize, total) : 0

  return (
    <footer
      className="flex items-center justify-between px-4 py-2 border-t border-border text-sm text-text-secondary"
      aria-label="Pagination"
    >
      <span>
        {total > 0 ? `${rangeStart}–${rangeEnd} of ${total}` : 'No messages'}
      </span>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="page-size-select">
          Messages per page
        </label>
        <select
          id="page-size-select"
          value={pageSize}
          onChange={onPageSizeChange}
          disabled={disabled}
          className="text-sm border border-border rounded-sm px-2 py-1 bg-bg text-text-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={isPrevDisabled || disabled}
          onClick={onPrev}
          aria-label="Previous page"
          className="px-3 py-1 border border-border rounded-sm text-sm hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-[150ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        >
          Prev
        </button>

        <button
          type="button"
          disabled={isNextDisabled || disabled}
          onClick={onNext}
          aria-label="Next page"
          className="px-3 py-1 border border-border rounded-sm text-sm hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-[150ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        >
          Next
        </button>
      </div>
    </footer>
  )
}

export default MessageList
