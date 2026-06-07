import type { MessageSummary, MessageFlags } from '../types'
import { useMailboxStore } from '../stores/mailboxStore'
import { notifyNewMessage } from '../hooks/useNotifications'

// --- Event payload types ---

export interface NewMessageEvent {
  folder: string
  message: MessageSummary
}

export interface FlagsChangedEvent {
  folder: string
  uid: number
  flags: Partial<MessageFlags>
}

export interface MessageDeletedEvent {
  folder: string
  uid: number
}

export type WebSocketEvent =
  | { event: 'new_message'; data: NewMessageEvent }
  | { event: 'flags_changed'; data: FlagsChangedEvent }
  | { event: 'message_deleted'; data: MessageDeletedEvent }

// --- Handler functions ---

/**
 * Handles a new_message WebSocket event.
 * If the event's folder matches the current folder in the store,
 * prepends the message summary to the messages array.
 */
export function handleNewMessage(data: NewMessageEvent): boolean {
  if (!data || typeof data.folder !== 'string' || !data.message) return false

  const state = useMailboxStore.getState()

  // If folder matches, prepend to store
  if (data.folder === state.currentFolder) {
    useMailboxStore.setState({
      messages: [data.message, ...state.messages],
      total: state.total + 1,
    })
  }

  // Notify via browser notification or Sonner toast
  // (notifyNewMessage internally checks: notifications setting, same-folder skip, tab visibility)
  notifyNewMessage({
    folder: data.folder,
    uid: data.message.uid,
    from: data.message.from,
    subject: data.message.subject,
  })

  return true
}

/**
 * Handles a flags_changed WebSocket event.
 * Finds the message by UID in the current messages and updates its flags.
 */
export function handleFlagsChanged(data: FlagsChangedEvent): boolean {
  if (
    !data ||
    typeof data.folder !== 'string' ||
    typeof data.uid !== 'number' ||
    !data.flags
  ) {
    return false
  }

  const state = useMailboxStore.getState()
  if (data.folder !== state.currentFolder) return false

  const messageIndex = state.messages.findIndex((m) => m.uid === data.uid)
  if (messageIndex === -1) return false

  const updatedMessages = state.messages.map((m) =>
    m.uid === data.uid ? { ...m, flags: { ...m.flags, ...data.flags } } : m,
  )

  useMailboxStore.setState({ messages: updatedMessages })
  return true
}

/**
 * Handles a message_deleted WebSocket event.
 * Removes the message with the matching UID from the store's message list.
 */
export function handleMessageDeleted(data: MessageDeletedEvent): boolean {
  if (
    !data ||
    typeof data.folder !== 'string' ||
    typeof data.uid !== 'number'
  ) {
    return false
  }

  const state = useMailboxStore.getState()
  if (data.folder !== state.currentFolder) return false

  const messageExists = state.messages.some((m) => m.uid === data.uid)
  if (!messageExists) return false

  useMailboxStore.setState({
    messages: state.messages.filter((m) => m.uid !== data.uid),
    total: Math.max(0, state.total - 1),
  })
  return true
}

/**
 * Unified handler that dispatches WebSocket events to the appropriate handler.
 * Returns true if the event was handled, false otherwise.
 */
export function handleWebSocketEvent(event: WebSocketEvent): boolean {
  switch (event.event) {
    case 'new_message':
      return handleNewMessage(event.data)
    case 'flags_changed':
      return handleFlagsChanged(event.data)
    case 'message_deleted':
      return handleMessageDeleted(event.data)
    default:
      return false
  }
}
