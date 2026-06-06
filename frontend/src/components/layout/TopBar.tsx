import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useMailboxStore } from '../../stores/mailboxStore'
import { logout } from '../../services/auth'
import { batchOperation } from '../../services/messages'
import { Button } from '../primitives/Button'

/**
 * Top bar with date display, message action toolbar, and logout button.
 * Actions are always visible:
 * - When messages are batch-selected: actions apply to selected messages
 * - When a single message is open (selectedUID): actions apply to that message
 * - When nothing is selected/open: actions are disabled
 */
export function TopBar() {
  const navigate = useNavigate()
  const email = useAuthStore((s) => s.email)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const selectedUIDs = useMailboxStore((s) => s.selectedUIDs)
  const selectedUID = useMailboxStore((s) => s.selectedUID)
  const currentFolder = useMailboxStore((s) => s.currentFolder)
  const clearSelection = useMailboxStore((s) => s.clearSelection)

  // Determine which UIDs to operate on
  const batchCount = selectedUIDs.size
  const hasSelection = batchCount > 0
  const hasOpenMessage = selectedUID !== null
  const canAct = hasSelection || hasOpenMessage

  // Get target UIDs for actions
  const getTargetUIDs = (): number[] => {
    if (hasSelection) return Array.from(selectedUIDs)
    if (hasOpenMessage) return [selectedUID!]
    return []
  }

  const handleMarkRead = useCallback(async () => {
    const uids = getTargetUIDs()
    if (uids.length === 0) return
    await batchOperation(currentFolder, uids, 'mark_read')
    if (hasSelection) clearSelection()
  }, [currentFolder, selectedUIDs, selectedUID, hasSelection, clearSelection])

  const handleMarkUnread = useCallback(async () => {
    const uids = getTargetUIDs()
    if (uids.length === 0) return
    await batchOperation(currentFolder, uids, 'mark_unread')
    if (hasSelection) clearSelection()
  }, [currentFolder, selectedUIDs, selectedUID, hasSelection, clearSelection])

  const handleDelete = useCallback(async () => {
    const uids = getTargetUIDs()
    if (uids.length === 0) return
    await batchOperation(currentFolder, uids, 'delete')
    if (hasSelection) clearSelection()
  }, [currentFolder, selectedUIDs, selectedUID, hasSelection, clearSelection])

  const handleMove = useCallback(async () => {
    const uids = getTargetUIDs()
    if (uids.length === 0) return
    await batchOperation(currentFolder, uids, 'move', 'Archive')
    if (hasSelection) clearSelection()
  }, [currentFolder, selectedUIDs, selectedUID, hasSelection, clearSelection])

  const handleLogout = useCallback(async () => {
    try {
      await logout()
    } catch {}
    clearAuth()
    navigate('/login')
  }, [clearAuth, navigate])

  // Format today's date
  const today = new Date()
  const dateStr = today.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)] shrink-0">
      {/* Date display */}
      <time
        dateTime={today.toISOString().split('T')[0]}
        className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap"
      >
        {dateStr}
      </time>

      {/* Separator */}
      <div className="h-4 w-px bg-[var(--color-border)]" />

      {/* Action toolbar — always visible */}
      <div role="toolbar" aria-label="Message actions" className="flex items-center gap-1">
        {hasSelection && (
          <span className="text-xs font-medium text-[var(--color-accent)] mr-1">
            {batchCount} selected
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkRead}
          disabled={!canAct}
          tooltip="Mark as read"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkUnread}
          disabled={!canAct}
          tooltip="Mark as unread"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={!canAct}
          tooltip="Delete"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleMove}
          disabled={!canAct}
          tooltip="Move to Archive"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User email + Logout */}
      <span className="text-sm text-[var(--color-text-secondary)] hidden sm:inline truncate max-w-[200px]">
        {email ?? ''}
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        tooltip="Logout"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </Button>
    </header>
  )
}
