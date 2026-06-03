import { useEffect } from 'react'
import { useWebSocket } from './useWebSocket'
import { useMailboxStore } from '../stores/mailboxStore'
import { listMessages } from '../services/messages'

const PAGE = 1
const PAGE_SIZE = 50

interface NewMessageData {
  folder: string
  uid: number
  from?: string
  subject?: string
}

interface FlagsChangedData {
  folder: string
  uid: number
  flags: Record<string, boolean>
}

interface MessageDeletedData {
  folder: string
  uid: number
}

export function useMailboxUpdates() {
  const { on } = useWebSocket()

  useEffect(() => {
    const offNew = on('new_message', (data: NewMessageData) => {
      if (!data || typeof data.folder !== 'string') return
      const { currentFolder, setMessages } = useMailboxStore.getState()
      if (data.folder !== currentFolder) return
      listMessages(currentFolder, PAGE, PAGE_SIZE)
        .then((res) => setMessages(res.messages))
        .catch((err) => console.error('[useMailboxUpdates] refetch failed', err))
    })

    const offFlags = on('flags_changed', (data: FlagsChangedData) => {
      if (!data || typeof data.folder !== 'string' || typeof data.uid !== 'number' || !data.flags) return
      const { currentFolder, messages, setMessages } = useMailboxStore.getState()
      if (data.folder !== currentFolder) return
      const updated = messages.map((m) =>
        m.uid === data.uid ? { ...m, flags: { ...m.flags, ...data.flags } } : m,
      )
      setMessages(updated)
    })

    const offDeleted = on('message_deleted', (data: MessageDeletedData) => {
      if (!data || typeof data.folder !== 'string' || typeof data.uid !== 'number') return
      const { currentFolder, messages, setMessages } = useMailboxStore.getState()
      if (data.folder !== currentFolder) return
      setMessages(messages.filter((m) => m.uid !== data.uid))
    })

    return () => {
      offNew()
      offFlags()
      offDeleted()
    }
  }, [on])
}
