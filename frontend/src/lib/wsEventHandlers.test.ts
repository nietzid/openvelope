import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import type { MessageSummary, MessageFlags } from '../types'
import { useMailboxStore } from '../stores/mailboxStore'
import {
  handleNewMessage,
  handleFlagsChanged,
  handleMessageDeleted,
  handleWebSocketEvent,
} from './wsEventHandlers'

// --- Helpers ---

function makeMessage(overrides: Partial<MessageSummary> = {}): MessageSummary {
  return {
    uid: 1,
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Test Subject',
    date: '2025-01-01T00:00:00Z',
    size: 1024,
    flags: { seen: false, flagged: false, answered: false, draft: false, deleted: false },
    has_attach: false,
    preview: 'Preview text',
    ...overrides,
  }
}

function resetStore(overrides: Partial<{ currentFolder: string; messages: MessageSummary[]; total: number }> = {}) {
  useMailboxStore.setState({
    currentFolder: 'INBOX',
    messages: [],
    total: 0,
    ...overrides,
  })
}

// --- fast-check arbitraries ---

const arbMessageFlags = fc.record({
  seen: fc.boolean(),
  flagged: fc.boolean(),
  answered: fc.boolean(),
  draft: fc.boolean(),
  deleted: fc.boolean(),
})

const arbMessageSummary = fc.record({
  uid: fc.nat({ max: 100000 }),
  from: fc.emailAddress(),
  to: fc.emailAddress(),
  subject: fc.string({ minLength: 1, maxLength: 100 }),
  date: fc.integer({ min: 946684800000, max: 1924991999000 }).map((ts) => new Date(ts).toISOString()),
  size: fc.nat({ max: 10_000_000 }),
  flags: arbMessageFlags,
  has_attach: fc.boolean(),
  preview: fc.string({ maxLength: 120 }),
})

const arbFolderName = fc.stringMatching(/^[A-Za-z][A-Za-z0-9./]{0,30}$/)

// --- Unit tests ---

describe('handleNewMessage', () => {
  beforeEach(() => resetStore())

  it('prepends message when folder matches current folder', () => {
    const existing = makeMessage({ uid: 10 })
    resetStore({ currentFolder: 'INBOX', messages: [existing], total: 1 })

    const newMsg = makeMessage({ uid: 20, subject: 'New' })
    const result = handleNewMessage({ folder: 'INBOX', message: newMsg })

    expect(result).toBe(true)
    const state = useMailboxStore.getState()
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0].uid).toBe(20)
    expect(state.messages[1].uid).toBe(10)
    expect(state.total).toBe(2)
  })

  it('does not modify store when folder does not match', () => {
    const existing = makeMessage({ uid: 10 })
    resetStore({ currentFolder: 'INBOX', messages: [existing], total: 1 })

    const newMsg = makeMessage({ uid: 20 })
    const result = handleNewMessage({ folder: 'Sent', message: newMsg })

    expect(result).toBe(false)
    expect(useMailboxStore.getState().messages).toHaveLength(1)
  })

  it('returns false for invalid data', () => {
    expect(handleNewMessage(null as any)).toBe(false)
    expect(handleNewMessage({ folder: 123, message: null } as any)).toBe(false)
    expect(handleNewMessage({ folder: 'INBOX', message: null } as any)).toBe(false)
  })
})

describe('handleFlagsChanged', () => {
  beforeEach(() => resetStore())

  it('updates flags on matching UID', () => {
    const msg = makeMessage({ uid: 5, flags: { seen: false, flagged: false, answered: false, draft: false, deleted: false } })
    resetStore({ currentFolder: 'INBOX', messages: [msg] })

    const result = handleFlagsChanged({ folder: 'INBOX', uid: 5, flags: { seen: true, flagged: true } })

    expect(result).toBe(true)
    const updated = useMailboxStore.getState().messages[0]
    expect(updated.flags.seen).toBe(true)
    expect(updated.flags.flagged).toBe(true)
    expect(updated.flags.answered).toBe(false)
  })

  it('returns false when UID not found in messages', () => {
    const msg = makeMessage({ uid: 5 })
    resetStore({ currentFolder: 'INBOX', messages: [msg] })

    const result = handleFlagsChanged({ folder: 'INBOX', uid: 999, flags: { seen: true } })

    expect(result).toBe(false)
  })

  it('returns false when folder does not match', () => {
    const msg = makeMessage({ uid: 5 })
    resetStore({ currentFolder: 'INBOX', messages: [msg] })

    const result = handleFlagsChanged({ folder: 'Sent', uid: 5, flags: { seen: true } })

    expect(result).toBe(false)
    expect(useMailboxStore.getState().messages[0].flags.seen).toBe(false)
  })

  it('returns false for invalid data', () => {
    expect(handleFlagsChanged(null as any)).toBe(false)
    expect(handleFlagsChanged({ folder: 'INBOX', uid: 'bad', flags: {} } as any)).toBe(false)
    expect(handleFlagsChanged({ folder: 'INBOX', uid: 1, flags: null } as any)).toBe(false)
  })
})

describe('handleMessageDeleted', () => {
  beforeEach(() => resetStore())

  it('removes message with matching UID', () => {
    const msgs = [makeMessage({ uid: 1 }), makeMessage({ uid: 2 }), makeMessage({ uid: 3 })]
    resetStore({ currentFolder: 'INBOX', messages: msgs, total: 3 })

    const result = handleMessageDeleted({ folder: 'INBOX', uid: 2 })

    expect(result).toBe(true)
    const state = useMailboxStore.getState()
    expect(state.messages).toHaveLength(2)
    expect(state.messages.map((m) => m.uid)).toEqual([1, 3])
    expect(state.total).toBe(2)
  })

  it('returns false when UID not found', () => {
    const msgs = [makeMessage({ uid: 1 })]
    resetStore({ currentFolder: 'INBOX', messages: msgs, total: 1 })

    const result = handleMessageDeleted({ folder: 'INBOX', uid: 999 })

    expect(result).toBe(false)
    expect(useMailboxStore.getState().messages).toHaveLength(1)
  })

  it('returns false when folder does not match', () => {
    const msgs = [makeMessage({ uid: 1 })]
    resetStore({ currentFolder: 'INBOX', messages: msgs, total: 1 })

    const result = handleMessageDeleted({ folder: 'Sent', uid: 1 })

    expect(result).toBe(false)
    expect(useMailboxStore.getState().messages).toHaveLength(1)
  })

  it('returns false for invalid data', () => {
    expect(handleMessageDeleted(null as any)).toBe(false)
    expect(handleMessageDeleted({ folder: 'INBOX', uid: 'bad' } as any)).toBe(false)
  })
})

describe('handleWebSocketEvent', () => {
  beforeEach(() => resetStore())

  it('dispatches new_message events', () => {
    resetStore({ currentFolder: 'INBOX' })
    const msg = makeMessage({ uid: 42 })
    const result = handleWebSocketEvent({ event: 'new_message', data: { folder: 'INBOX', message: msg } })
    expect(result).toBe(true)
    expect(useMailboxStore.getState().messages[0].uid).toBe(42)
  })

  it('dispatches flags_changed events', () => {
    resetStore({ currentFolder: 'INBOX', messages: [makeMessage({ uid: 7 })] })
    const result = handleWebSocketEvent({ event: 'flags_changed', data: { folder: 'INBOX', uid: 7, flags: { seen: true } } })
    expect(result).toBe(true)
    expect(useMailboxStore.getState().messages[0].flags.seen).toBe(true)
  })

  it('dispatches message_deleted events', () => {
    resetStore({ currentFolder: 'INBOX', messages: [makeMessage({ uid: 3 })], total: 1 })
    const result = handleWebSocketEvent({ event: 'message_deleted', data: { folder: 'INBOX', uid: 3 } })
    expect(result).toBe(true)
    expect(useMailboxStore.getState().messages).toHaveLength(0)
  })

  it('returns false for unknown events', () => {
    const result = handleWebSocketEvent({ event: 'unknown' as any, data: {} as any })
    expect(result).toBe(false)
  })
})

// --- Property-based tests ---
// **Validates: Requirements 13.1, 13.2, 13.3**

describe('Property: WebSocket event store mutations', () => {
  beforeEach(() => resetStore())

  it('new_message prepends to store when folder matches', () => {
    fc.assert(
      fc.property(
        arbMessageSummary,
        fc.array(arbMessageSummary, { minLength: 0, maxLength: 20 }),
        arbFolderName,
        (newMsg, existingMsgs, folder) => {
          // Ensure unique UIDs
          const existing = existingMsgs.map((m, i) => ({ ...m, uid: i + 1000 }))
          const incoming = { ...newMsg, uid: 999 }

          resetStore({ currentFolder: folder, messages: existing, total: existing.length })

          handleNewMessage({ folder, message: incoming })

          const state = useMailboxStore.getState()
          // Message is prepended
          expect(state.messages[0]).toEqual(incoming)
          // Length increased by 1
          expect(state.messages).toHaveLength(existing.length + 1)
          // Total incremented
          expect(state.total).toBe(existing.length + 1)
          // Existing messages preserved in order
          expect(state.messages.slice(1)).toEqual(existing)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('new_message does not modify store when folder does not match', () => {
    fc.assert(
      fc.property(
        arbMessageSummary,
        fc.array(arbMessageSummary, { minLength: 0, maxLength: 10 }),
        arbFolderName,
        arbFolderName,
        (newMsg, existingMsgs, currentFolder, eventFolder) => {
          fc.pre(currentFolder !== eventFolder)

          const existing = existingMsgs.map((m, i) => ({ ...m, uid: i + 1 }))
          resetStore({ currentFolder, messages: existing, total: existing.length })

          const result = handleNewMessage({ folder: eventFolder, message: newMsg })

          expect(result).toBe(false)
          expect(useMailboxStore.getState().messages).toEqual(existing)
          expect(useMailboxStore.getState().total).toBe(existing.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('flags_changed updates flags on matching UID', () => {
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

          // Filter out undefined values to get the actual partial flags
          const definedFlags: Partial<MessageFlags> = {}
          for (const [k, v] of Object.entries(newFlags)) {
            if (v !== undefined) {
              (definedFlags as any)[k] = v
            }
          }

          // Skip if no flags are defined
          if (Object.keys(definedFlags).length === 0) return

          const result = handleFlagsChanged({ folder, uid: 42, flags: definedFlags })

          expect(result).toBe(true)
          const updated = useMailboxStore.getState().messages[0]
          // Verify updated flags match
          for (const [key, value] of Object.entries(definedFlags)) {
            expect((updated.flags as any)[key]).toBe(value)
          }
          // Verify non-updated fields preserved
          expect(updated.uid).toBe(targetMsg.uid)
          expect(updated.from).toBe(targetMsg.from)
          expect(updated.subject).toBe(targetMsg.subject)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('flags_changed returns false when UID not in messages', () => {
    fc.assert(
      fc.property(
        fc.array(arbMessageSummary, { minLength: 1, maxLength: 10 }),
        fc.nat({ max: 100000 }),
        arbFolderName,
        (msgs, targetUid, folder) => {
          const existing = msgs.map((m, i) => ({ ...m, uid: i + 1 }))
          // Ensure target UID is not in the list
          fc.pre(!existing.some((m) => m.uid === targetUid))

          resetStore({ currentFolder: folder, messages: existing })

          const result = handleFlagsChanged({ folder, uid: targetUid, flags: { seen: true } })

          expect(result).toBe(false)
          // Messages unchanged
          expect(useMailboxStore.getState().messages).toEqual(existing)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('message_deleted removes message with matching UID', () => {
    fc.assert(
      fc.property(
        fc.array(arbMessageSummary, { minLength: 1, maxLength: 20 }),
        arbFolderName,
        (msgs, folder) => {
          const existing = msgs.map((m, i) => ({ ...m, uid: i + 1 }))
          // Pick a random message to delete
          const deleteIndex = Math.floor(Math.random() * existing.length)
          const deleteUid = existing[deleteIndex].uid

          resetStore({ currentFolder: folder, messages: existing, total: existing.length })

          const result = handleMessageDeleted({ folder, uid: deleteUid })

          expect(result).toBe(true)
          const state = useMailboxStore.getState()
          // Length decreased by 1
          expect(state.messages).toHaveLength(existing.length - 1)
          // The deleted UID is gone
          expect(state.messages.every((m) => m.uid !== deleteUid)).toBe(true)
          // Total decremented
          expect(state.total).toBe(existing.length - 1)
          // Other messages preserved in order
          const expected = existing.filter((m) => m.uid !== deleteUid)
          expect(state.messages).toEqual(expected)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('message_deleted returns false when UID not in messages', () => {
    fc.assert(
      fc.property(
        fc.array(arbMessageSummary, { minLength: 1, maxLength: 10 }),
        fc.nat({ max: 100000 }),
        arbFolderName,
        (msgs, targetUid, folder) => {
          const existing = msgs.map((m, i) => ({ ...m, uid: i + 1 }))
          fc.pre(!existing.some((m) => m.uid === targetUid))

          resetStore({ currentFolder: folder, messages: existing, total: existing.length })

          const result = handleMessageDeleted({ folder, uid: targetUid })

          expect(result).toBe(false)
          expect(useMailboxStore.getState().messages).toEqual(existing)
          expect(useMailboxStore.getState().total).toBe(existing.length)
        },
      ),
      { numRuns: 100 },
    )
  })
})
