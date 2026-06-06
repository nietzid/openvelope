/**
 * Formatting utilities for file sizes and badge counts.
 */

/**
 * Formats a byte count into a human-readable file size string.
 *
 * - < 1024: bytes with "B" suffix (e.g., "512 B")
 * - < 1,048,576: kilobytes with one decimal and "KB" suffix (e.g., "1.5 KB")
 * - ≥ 1,048,576: megabytes with one decimal and "MB" suffix (e.g., "2.3 MB")
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1_048_576) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

/**
 * Formats an unread badge count for display.
 *
 * - 0: returns empty string (no badge shown)
 * - 1–99: returns the count as a string
 * - > 99: returns "99+"
 */
export function formatBadgeCount(count: number): string {
  if (count <= 0) {
    return ''
  }

  if (count > 99) {
    return '99+'
  }

  return String(count)
}
