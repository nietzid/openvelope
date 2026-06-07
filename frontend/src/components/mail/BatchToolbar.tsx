import { useMailboxStore } from '../../stores/mailboxStore'
import { batchOperation } from '../../services/messages'
import { showUndoToast } from '../../hooks/useUndo'
import { Button } from '../primitives/Button'

/**
 * BatchToolbar slides in from the top when messages are selected.
 * Shows selected count and batch actions: Mark Read, Mark Unread, Delete, Move.
 *
 * Animation: translateY(-100%) → translateY(0), 250ms ease-out-expo
 * Reverse on deselect.
 */
export function BatchToolbar() {
  const selectedUIDs = useMailboxStore((s) => s.selectedUIDs)
  const currentFolder = useMailboxStore((s) => s.currentFolder)
  const clearSelection = useMailboxStore((s) => s.clearSelection)

  const count = selectedUIDs.size
  const visible = count > 0

  const handleMarkRead = async () => {
    const uids = Array.from(selectedUIDs)
    await batchOperation(currentFolder, uids, 'mark_read')
    clearSelection()
    showUndoToast(`${uids.length} messages marked as read`, () => {
      batchOperation(currentFolder, uids, 'mark_unread').catch(() => {})
    })
  }

  const handleMarkUnread = async () => {
    const uids = Array.from(selectedUIDs)
    await batchOperation(currentFolder, uids, 'mark_unread')
    clearSelection()
    showUndoToast(`${uids.length} messages marked as unread`, () => {
      batchOperation(currentFolder, uids, 'mark_read').catch(() => {})
    })
  }

  const handleDelete = async () => {
    const uids = Array.from(selectedUIDs)
    await batchOperation(currentFolder, uids, 'delete')
    clearSelection()
    showUndoToast(`${uids.length} messages deleted`, () => {
      batchOperation('Trash', uids, 'move', 'INBOX').catch(() => {})
    })
  }

  const handleMove = async () => {
    const uids = Array.from(selectedUIDs)
    // Move to Archive as a default batch move action
    await batchOperation(currentFolder, uids, 'move', 'Archive')
    clearSelection()
    showUndoToast(`${uids.length} messages moved to Archive`, () => {
      batchOperation('Archive', uids, 'move', currentFolder).catch(() => {})
    })
  }

  return (
    <div
      role="toolbar"
      aria-label={`Batch actions for ${count} selected messages`}
      aria-hidden={!visible}
      className={[
        'flex items-center gap-3 px-4 py-2',
        'bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)]',
        'shadow-[var(--shadow-low)]',
        // Animation: slide from top
        'transition-transform duration-[250ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
        visible ? 'translate-y-0' : '-translate-y-full',
        // Hide from layout when not visible
        !visible && 'pointer-events-none',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="text-sm font-medium text-[var(--color-text-primary)] mr-2">
        {count} selected
      </span>

      <Button variant="ghost" size="sm" onClick={handleMarkRead}>
        Mark Read
      </Button>
      <Button variant="ghost" size="sm" onClick={handleMarkUnread}>
        Mark Unread
      </Button>
      <Button variant="ghost" size="sm" onClick={handleDelete}>
        Delete
      </Button>
      <Button variant="ghost" size="sm" onClick={handleMove}>
        Move
      </Button>
    </div>
  )
}
