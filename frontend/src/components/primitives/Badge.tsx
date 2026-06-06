import { formatBadgeCount } from '../../lib/format'

interface BadgeProps {
  count: number
}

/**
 * Badge displays an unread count as a small rounded pill.
 * Renders nothing when count is 0.
 * Displays "99+" when count exceeds 99.
 */
export function Badge({ count }: BadgeProps) {
  const formatted = formatBadgeCount(count)

  if (!formatted) {
    return null
  }

  return (
    <span
      className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-medium text-white bg-accent rounded-full leading-tight"
      aria-label={`${count} unread`}
    >
      {formatted}
    </span>
  )
}
