import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMailboxStore } from '../stores/mailboxStore'
import { listMessages, batchOperation } from '../services/messages'
import type { MessageSummary } from '../types'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso

  const now = new Date()
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')

  if (isSameDay) {
    return `${hours}:${minutes}`
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const month = months[d.getMonth()]
  const day = d.getDate()

  if (d.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`
  }

  return `${month} ${day}, ${d.getFullYear()}`
}

function MessageRow({
  msg,
  isSelected,
  onSelect,
  isBatchSelected,
  onBatchToggle,
  style,
}: {
  msg: MessageSummary
  isSelected: boolean
  onSelect: (uid: number) => void
  isBatchSelected: boolean
  onBatchToggle: (uid: number) => void
  style?: CSSProperties
}) {
  const isUnread = !msg.flags.seen
  return (
    <div
      onClick={() => onSelect(msg.uid)}
      style={style}
      className={`absolute top-0 left-0 w-full px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
        isSelected ? 'bg-gray-100' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input
            type="checkbox"
            checked={isBatchSelected}
            onChange={() => onBatchToggle(msg.uid)}
            onClick={(e) => e.stopPropagation()}
            className="mr-2 cursor-pointer"
          />
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
          <span
            className={`truncate ${isUnread ? 'font-bold' : 'font-normal'} text-black`}
          >
            {msg.from}
          </span>
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
          {formatDate(msg.date)}
        </span>
      </div>
      <div
        className={`truncate ${isUnread ? 'font-bold' : 'font-normal'} text-black text-sm mt-1`}
      >
        {msg.subject}
      </div>
      <div className="truncate text-gray-500 text-sm mt-1">{msg.preview}</div>
    </div>
  )
}

function MessageList() {
  const currentFolder = useMailboxStore((state) => state.currentFolder)
  const messages = useMailboxStore((state) => state.messages)
  const setMessages = useMailboxStore((state) => state.setMessages)
  const selectedUID = useMailboxStore((state) => state.selectedUID)
  const setSelectedUID = useMailboxStore((state) => state.setSelectedUID)
  const selectedUIDs = useMailboxStore((state) => state.selectedUIDs)
  const toggleUID = useMailboxStore((state) => state.toggleUID)
  const clearSelection = useMailboxStore((state) => state.clearSelection)
  const selectAll = useMailboxStore((state) => state.selectAll)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listMessages(currentFolder, 0, 200)
      .then((res) => {
        if (cancelled) return
        setMessages(res.messages)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load messages', err)
        setError('Failed to load messages')
        setMessages([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentFolder, setMessages])

  const handleMarkRead = async () => {
    await batchOperation(currentFolder, Array.from(selectedUIDs), 'mark_read')
    setMessages(messages.map(m => selectedUIDs.has(m.uid) ? { ...m, flags: { ...m.flags, seen: true } } : m))
    clearSelection()
  }

  const handleMarkUnread = async () => {
    await batchOperation(currentFolder, Array.from(selectedUIDs), 'mark_unread')
    setMessages(messages.map(m => selectedUIDs.has(m.uid) ? { ...m, flags: { ...m.flags, seen: false } } : m))
    clearSelection()
  }

  const handleFlag = async () => {
    await batchOperation(currentFolder, Array.from(selectedUIDs), 'flag')
    setMessages(messages.map(m => selectedUIDs.has(m.uid) ? { ...m, flags: { ...m.flags, flagged: true } } : m))
    clearSelection()
  }

  const handleDelete = async () => {
    await batchOperation(currentFolder, Array.from(selectedUIDs), 'delete')
    setMessages(messages.filter(m => !selectedUIDs.has(m.uid)))
    clearSelection()
  }

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  return (
    <section className="w-[400px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <input
          type="checkbox"
          checked={selectedUIDs.size === messages.length && messages.length > 0}
          onChange={() => {
            if (selectedUIDs.size === messages.length) {
              clearSelection()
            } else {
              selectAll(messages.map(m => m.uid))
            }
          }}
          className="cursor-pointer"
        />
        <span className="text-lg font-semibold text-black">{currentFolder}</span>
      </header>
      {selectedUIDs.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
          <span className="text-xs text-gray-600">{selectedUIDs.size} selected</span>
          <button onClick={handleMarkRead} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100">Mark read</button>
          <button onClick={handleMarkUnread} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100">Mark unread</button>
          <button onClick={handleFlag} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100">Flag</button>
          <button onClick={handleDelete} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 text-red-600">Delete</button>
          <button onClick={clearSelection} className="text-xs px-2 py-1 text-gray-500 hover:text-black">Clear</button>
        </div>
      )}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-gray-500 text-sm">Loading...</div>
        ) : error ? (
          <div className="p-4 text-red-500 text-sm">{error}</div>
        ) : messages.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm">No messages</div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const msg = messages[virtualRow.index]
              return (
                <MessageRow
                  key={msg.uid}
                  msg={msg}
                  isSelected={selectedUID === msg.uid}
                  onSelect={setSelectedUID}
                  isBatchSelected={selectedUIDs.has(msg.uid)}
                  onBatchToggle={toggleUID}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default MessageList
