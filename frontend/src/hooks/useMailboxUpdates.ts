import { useEffect, type RefObject } from 'react'
import type { WebSocketService } from '../services/websocket'
import {
  handleWebSocketEvent,
  type NewMessageEvent,
  type FlagsChangedEvent,
  type MessageDeletedEvent,
} from '../lib/wsEventHandlers'

/**
 * Subscribes to WebSocket mailbox events and dispatches store mutations.
 * Handles: new_message, flags_changed, message_deleted
 *
 * @param serviceRef - A ref to the WebSocketService instance from useWebSocket
 */
export function useMailboxUpdates(serviceRef: RefObject<WebSocketService | null>) {
  useEffect(() => {
    const service = serviceRef.current
    if (!service) return

    const unsubNew = service.on('new_message', (data: unknown) => {
      handleWebSocketEvent({
        event: 'new_message',
        data: data as NewMessageEvent,
      })
    })

    const unsubFlags = service.on('flags_changed', (data: unknown) => {
      handleWebSocketEvent({
        event: 'flags_changed',
        data: data as FlagsChangedEvent,
      })
    })

    const unsubDeleted = service.on('message_deleted', (data: unknown) => {
      handleWebSocketEvent({
        event: 'message_deleted',
        data: data as MessageDeletedEvent,
      })
    })

    return () => {
      unsubNew()
      unsubFlags()
      unsubDeleted()
    }
  }, [serviceRef.current])
}
