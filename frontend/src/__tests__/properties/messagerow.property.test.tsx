import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render } from '@testing-library/react'
import { MessageRow } from '../../components/mail/MessageRow'
import type { MessageSummary } from '../../types'

/**
 * Property 10: Message row rendering completeness
 * Validates: Requirements 9.2, 9.3
 *
 * For any valid MessageSummary object, the rendered message row SHALL contain:
 * sender name, subject line, preview text (≤120 characters), formatted timestamp,
 * and — when `flags.seen` is false — a 6px accent-colored unread dot.
 */

/** Arbitrary generator for MessageFlags */
const arbMessageFlags = fc.record({
  seen: fc.boolean(),
  flagged: fc.boolean(),
  answered: fc.boolean(),
  draft: fc.boolean(),
  deleted: fc.boolean(),
})

/** Arbitrary generator for MessageSummary */
const arbMessageSummary: fc.Arbitrary<MessageSummary> = fc.record({
  uid: fc.nat({ max: 100000 }),
  from: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  to: fc.string({ minLength: 1, maxLength: 50 }),
  subject: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  date: fc.integer({ min: 946684800000, max: 1924905600000 }).map((ts) => new Date(ts).toISOString()),
  size: fc.nat({ max: 10_000_000 }),
  flags: arbMessageFlags,
  has_attach: fc.boolean(),
  preview: fc.string({ minLength: 0, maxLength: 200 }),
})

describe('Property 10: Message row rendering completeness', () => {
  const noop = () => {}

  it('always renders sender, subject, and timestamp for any MessageSummary', () => {
    fc.assert(
      fc.property(arbMessageSummary, (message) => {
        const { container } = render(
          <MessageRow
            message={message}
            isSelected={false}
            isBatchSelected={false}
            onSelect={noop}
            onBatchToggle={noop}
          />,
        )

        // Sender should be present
        expect(container.textContent).toContain(message.from)
        // Subject should be present
        expect(container.textContent).toContain(message.subject)
        // Timestamp element should exist (a <time> element)
        const timeEl = container.querySelector('time')
        expect(timeEl).not.toBeNull()
        expect(timeEl!.getAttribute('dateTime')).toBe(message.date)
      }),
      { numRuns: 100 },
    )
  })

  it('preview text is always ≤120 characters when rendered', () => {
    fc.assert(
      fc.property(arbMessageSummary, (message) => {
        const { container } = render(
          <MessageRow
            message={message}
            isSelected={false}
            isBatchSelected={false}
            onSelect={noop}
            onBatchToggle={noop}
          />,
        )

        // If preview is non-empty, the truncated text should be ≤120 chars (+ ellipsis character)
        if (message.preview && message.preview.length > 0) {
          // The rendered preview is in the last span within the content area
          const spans = container.querySelectorAll('span')
          // Find span containing preview-like content (not sender/subject)
          // The preview is truncated to 120 chars
          const previewSpans = Array.from(spans).filter(
            (el) =>
              !el.textContent?.includes(message.from) &&
              !el.textContent?.includes(message.subject),
          )
          for (const span of previewSpans) {
            const text = span.textContent || ''
            // The truncated preview should be at most 121 chars (120 + ellipsis "…")
            if (text.length > 0) {
              expect(text.length).toBeLessThanOrEqual(121)
            }
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  it('shows unread dot when flags.seen is false', () => {
    const arbUnreadMessage = arbMessageSummary.map((msg) => ({
      ...msg,
      flags: { ...msg.flags, seen: false },
    }))

    fc.assert(
      fc.property(arbUnreadMessage, (message) => {
        const { container } = render(
          <MessageRow
            message={message}
            isSelected={false}
            isBatchSelected={false}
            onSelect={noop}
            onBatchToggle={noop}
          />,
        )

        // Should have an unread dot indicator
        const unreadDot = container.querySelector('[aria-label="Unread"]')
        expect(unreadDot).not.toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  it('does NOT show unread dot when flags.seen is true', () => {
    const arbReadMessage = arbMessageSummary.map((msg) => ({
      ...msg,
      flags: { ...msg.flags, seen: true },
    }))

    fc.assert(
      fc.property(arbReadMessage, (message) => {
        const { container } = render(
          <MessageRow
            message={message}
            isSelected={false}
            isBatchSelected={false}
            onSelect={noop}
            onBatchToggle={noop}
          />,
        )

        // Should NOT have an unread dot indicator
        const unreadDot = container.querySelector('[aria-label="Unread"]')
        expect(unreadDot).toBeNull()
      }),
      { numRuns: 100 },
    )
  })
})
