import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import type { MessageSummary, MessageFlags } from '../../types'
import { useMailboxStore } from '../../stores/mailboxStore'
import {
  handleNewMessage,
  handleFlagsChanged,
  handleMessageDeleted,
} from '../../lib/wsEventHandlers'

/**
 * Property 18: WebSocket event store mutations
 *
 * For any `new_message` event matching the current folder, the message SHALL be prepended
 * to the store's message list. For any `flags_changed` event with a valid uid present in the
 * current message list, the corresponding message's flags SHALL be updated to reflect the new
 * values. For any `message_deleted` event with a valid uid, that message SHALL be removed
 * from the store's message list.
 *
 * NOTE: Comprehensive property-based tests also exist in `src/lib/wsEventHandlers.test.ts`.
 * This file provides the canonical property test location for the spec's test suite.
 *
 * **Validates: Requirements 13.1, 13.2, 13.3**
 */

// --- Generators ---

const arbMessageFlags = fc.record({
  seen: fc.boolean(),
  flagged: fc.boolean(),
  answered: fc.boolean(),
  draft: fc.boolean(),
  deleted: fc.boolean(),
})

const arbMessageSummary: fc.Arbitrary<MessageSummary> = fc.record({
  uid: fc.nat({ max: 100000 }),
  from: fc.emailAddress(),
  to: fc.emailAddress(),
  subject: fc.string({ minLength: 1, maxLength: 80 }),
  date: fc.integer({ min: 946684800000, max: 1924991999000 }).map((ts) => new Date(ts).toISOString()),
  size: fc.nat({ max: 10_000_000 }),
  flags: arbMessageFlags,
  has_attach: fc.boolean(),
  preview: fc.string({ maxLength: 120 }),
})

const arbFolderName = fc.stringMatching(/^[A-Za-z][A-Za-z0-9.]{0,20}$/)

function resetStore(overrides: Partial<{ currentFolder: string; messages: MessageSummary[]; total: number }> = {}) {
  useMailboxStore.setState({
    currentFolder: 'INBOX',
    messages: [],
    total: 0,
    ...overrides,
  })
}

describe('Property: WebSocket event store mutations', () => {
  beforeEach(() => resetStore())

  it('new_message prepends message to store when folder matches', () => {
    fc.assert(
      fc.property(
        arbMessageSummary,
        fc.array(arbMessageSummary, { minLength: 0, maxLength: 15 }),
        arbFolderName,
        (newMsg, existingMsgs, folder) => {
          const existing = existingMsgs.map((m, i) => ({ ...m, uid: i + 1000 }))
          const incoming = { ...newMsg, uid: 999 }

          resetStore({ currentFolder: folder, messages: existing, total: existing.length })

          handleNewMessage({ folder, message: incoming })

          const state = useMailboxStore.getState()
          expect(state.messages[0]).toEqual(incoming)
          expect(state.messages).toHaveLength(existing.length + 1)
          expect(state.total).toBe(existing.length + 1)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('flags_changed updates correct UID flags', () => {
    fc.assert(
      fc.property(
        arbMessageSummary,
        fc.record({
          seen: fc.option(fc.boolean(), { nil: undefined }),
          flagged: fc.option(fc.boolean(), { nil: undefined }),
          answered: fc.option(fc.boolean(), { nil: undefined }),
          draft: fc.option(fc.boolean(), { nil: undefined }),
          deleted: fc.option(fc.boolean(), { nil: undefined }),
        }),
        arbFolderName,
        (msg, newFlags, folder) => {
          const targetMsg = { ...msg, uid: 42 }
          resetStore({ currentFolder: folder, messages: [targetMsg] })

          const definedFlags: Partial<MessageFlags> = {}
          for (const [k, v] of Object.entries(newFlags)) {
            if (v !== undefined) (definedFlags as any)[k] = v
          }
          if (Object.keys(definedFlags).length === 0) return

          const result = handleFlagsChanged({ folder, uid: 42, flags: definedFlags })

          expect(result).toBe(true)
          const updated = useMailboxStore.getState().messages[0]
          for (const [key, value] of Object.entries(definedFlags)) {
            expect((updated.flags as any)[key]).toBe(value)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('message_deleted removes message with matching UID', () => {
    fc.assert(
      fc.property(
        fc.array(arbMessageSummary, { minLength: 1, maxLength: 15 }),
        arbFolderName,
        (msgs, folder) => {
          const existing = msgs.map((m, i) => ({ ...m, uid: i + 1 }))
          const deleteIndex = Math.floor(Math.random() * existing.length)
          const deleteUid = existing[deleteIndex].uid

          resetStore({ currentFolder: folder, messages: existing, total: existing.length })

          const result = handleMessageDeleted({ folder, uid: deleteUid })

          expect(result).toBe(true)
          const state = useMailboxStore.getState()
          expect(state.messages).toHaveLength(existing.length - 1)
          expect(state.messages.every((m) => m.uid !== deleteUid)).toBe(true)
          expect(state.total).toBe(existing.length - 1)
        },
      ),
      { numRuns: 100 },
    )
  })
})
