import type React from 'react'
import type { MessageSummary } from '../../types'

export interface MessageRowProps {
  message: MessageSummary
  isSelected: boolean
  isFocused?: boolean
  isBatchSelected: boolean
  onSelect: (uid: number) => void
  onBatchToggle: (uid: number) => void
  style?: React.CSSProperties
  animationStyle?: React.CSSProperties
}

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

/**
 * MessageRow renders a single message in the message list.
 *
 * Displays sender, subject, preview (≤120 chars), and timestamp.
 * Unread messages show a 6px accent dot and semibold sender/subject.
 * Includes a checkbox for batch selection.
 */
export function MessageRow({
  message,
  isSelected,
  isFocused = false,
  isBatchSelected,
  onSelect,
  onBatchToggle,
  style,
  animationStyle,
}: MessageRowProps) {
  const isUnread = !message.flags.seen
  const preview = truncatePreview(message.preview || '')

  function handleRowClick() {
    onSelect(message.uid)
  }

  function handleCheckboxClick(e: React.MouseEvent) {
    e.stopPropagation()
    onBatchToggle(message.uid)
  }

  function handleCheckboxKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      onBatchToggle(message.uid)
    }
  }

  return (
    <div
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      className={`
        group flex items-center gap-3 px-4 h-[72px] cursor-pointer
        transition-colors duration-[150ms] ease-out select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        ${isSelected ? 'bg-[var(--color-accent)]/10' : ''}
        ${isFocused && !isSelected ? 'bg-[var(--color-surface)]' : ''}
        ${!isSelected && !isFocused ? 'hover:bg-[var(--color-surface)]' : ''}
        ${isFocused ? 'border-l-2 border-l-[var(--color-accent)]' : 'border-l-2 border-l-transparent'}
      `}
      style={{ ...style, ...animationStyle }}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleRowClick()
        }
      }}
    >
      {/* Batch selection checkbox */}
      <div
        role="checkbox"
        aria-checked={isBatchSelected}
        aria-label={`Select message from ${message.from}`}
        tabIndex={-1}
        className={`
          flex-shrink-0 w-5 h-5 rounded-[var(--radius-sm)] border
          flex items-center justify-center cursor-pointer
          transition-colors duration-[150ms] ease-out
          ${
            isBatchSelected
              ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
              : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
          }
        `}
        onClick={handleCheckboxClick}
        onKeyDown={handleCheckboxKeyDown}
      >
        {isBatchSelected && (
          <svg
            className="w-3 h-3 text-white"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 6L5 8.5L9.5 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

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
          {(message.thread_count ?? 0) > 1 && (
            <span
              className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 text-[10px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded-full leading-none"
              aria-label={`${message.thread_count} messages in thread`}
            >
              {message.thread_count}
            </span>
          )}
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
