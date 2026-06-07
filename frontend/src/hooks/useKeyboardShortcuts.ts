import { useCallback, useEffect, useRef, useState } from 'react'
import { useMailboxStore } from '../stores/mailboxStore'
import { useUIStore } from '../stores/uiStore'
import { batchOperation, updateFlags } from '../services/messages'

// ─── Shortcut definitions ─────────────────────────────────────────────────────

export interface ShortcutDef {
  key: string
  label: string
  description: string
}

export const SHORTCUTS: ShortcutDef[] = [
  { key: 'J', label: 'J', description: 'Next message' },
  { key: 'K', label: 'K', description: 'Previous message' },
  { key: 'Enter', label: '↵', description: 'Open message' },
  { key: 'R', label: 'R', description: 'Reply' },
  { key: 'F', label: 'F', description: 'Forward' },
  { key: 'A', label: 'A', description: 'Reply all' },
  { key: 'E', label: 'E', description: 'Archive' },
  { key: 'Y', label: 'Y', description: 'Archive' },
  { key: '#', label: '#', description: 'Delete' },
  { key: 'S', label: 'S', description: 'Star / unstar' },
  { key: 'U', label: 'U', description: 'Toggle read / unread' },
  { key: '/', label: '/', description: 'Focus search' },
  { key: '?', label: '?', description: 'Show shortcuts' },
  { key: 'Escape', label: 'Esc', description: 'Close / deselect' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the user is typing in a text input context */
function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    target.isContentEditable
  )
}

// ─── Help Modal ───────────────────────────────────────────────────────────────

export function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  // Close on dialog cancel (Escape)
  const handleCancel = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault()
      onClose()
    },
    [onClose],
  )

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose()
      }
    },
    [onClose],
  )

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      aria-label="Keyboard shortcuts"
      className={[
        'backdrop:bg-black/40 rounded-[var(--radius-lg)]',
        'border border-[var(--color-border)]',
        'p-0 max-w-[480px] w-full',
      ].join(' ')}
      style={{ backgroundColor: 'var(--color-surface-elevated)' }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className={[
              'flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)]',
              'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              'hover:bg-[var(--color-surface)] transition-colors duration-[150ms]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
            ].join(' ')}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6.28 6.28a.75.75 0 0 1 1.06 0L10 8.94l2.66-2.66a.75.75 0 1 1 1.06 1.06L11.06 10l2.66 2.66a.75.75 0 1 1-1.06 1.06L10 11.06 7.34 13.72a.75.75 0 0 1-1.06-1.06L8.94 10 6.28 7.34a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* Shortcut grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {SHORTCUTS.filter((s) => s.key !== 'Escape').map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm text-[var(--color-text-primary)]">
                {shortcut.description}
              </span>
              <kbd
                className={[
                  'inline-flex items-center justify-center min-w-[28px] h-[24px] px-1.5',
                  'rounded-[var(--radius-sm)]',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-xs font-medium text-[var(--color-text-secondary)]',
                  'font-[var(--font-mono)]',
                ].join(' ')}
              >
                {shortcut.label}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <p className="mt-4 text-xs text-[var(--color-text-secondary)] text-center">
          Press <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">?</kbd> or <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">Esc</kbd> to close
        </p>
      </div>
    </dialog>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Registers global keyboard shortcuts for the mail interface.
 * Shortcuts are suppressed when the user is typing in an input/textarea/contenteditable.
 *
 * @param searchInputRef - Ref to the search input element for "/" focus shortcut
 * @param displayMessages - The currently displayed messages array (for J/K navigation bounds)
 */
export function useKeyboardShortcuts(
  searchInputRef?: React.RefObject<HTMLInputElement | null>,
  displayMessages?: readonly { uid: number }[],
) {
  const [helpOpen, setHelpOpen] = useState(false)

  // Mailbox store
  const focusedIndex = useMailboxStore((s) => s.focusedIndex)
  const setFocusedIndex = useMailboxStore((s) => s.setFocusedIndex)
  const setSelectedUID = useMailboxStore((s) => s.setSelectedUID)
  const selectedUID = useMailboxStore((s) => s.selectedUID)
  const currentFolder = useMailboxStore((s) => s.currentFolder)
  const updateMessageFlags = useMailboxStore((s) => s.updateMessageFlags)
  const searchMode = useMailboxStore((s) => s.searchMode)
  const messages = useMailboxStore((s) => s.messages)
  const searchResults = useMailboxStore((s) => s.searchResults)

  // UI store
  const openCompose = useUIStore((s) => s.openCompose)
  const composeOpen = useUIStore((s) => s.composeOpen)

  // Use passed displayMessages or derive from store
  const msgList = displayMessages ?? (searchMode ? searchResults : messages)

  // Refs to avoid stale closures
  const focusedIndexRef = useRef(focusedIndex)
  focusedIndexRef.current = focusedIndex
  const selectedUIDRef = useRef(selectedUID)
  selectedUIDRef.current = selectedUID
  const composeOpenRef = useRef(composeOpen)
  composeOpenRef.current = composeOpen
  const msgListRef = useRef(msgList)
  msgListRef.current = msgList
  const helpOpenRef = useRef(helpOpen)
  helpOpenRef.current = helpOpen

  // Toggle help modal
  const toggleHelp = useCallback(() => {
    setHelpOpen((prev) => !prev)
  }, [])

  // Close help
  const closeHelp = useCallback(() => {
    setHelpOpen(false)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Always allow Escape to close help modal (even in text inputs)
      if (e.key === 'Escape' && helpOpenRef.current) {
        setHelpOpen(false)
        return
      }

      // Don't fire shortcuts when typing in text fields
      if (isTextInput(e.target)) return

      // Escape deselects focused message (only when not in text input)
      if (e.key === 'Escape') {
        setFocusedIndex(null)
        setSelectedUID(null)
        return
      }

      // Don't fire shortcuts when typing in text fields
      if (isTextInput(e.target)) return

      // Don't fire when compose dialog is open
      if (composeOpenRef.current) return

      // Don't fire when help modal is open (except Escape handled above)
      if (helpOpenRef.current) return

      const msgs = msgListRef.current
      const currentFocused = focusedIndexRef.current

      // Guard against empty message list for navigation shortcuts
      if (msgs.length === 0 && (e.key === 'j' || e.key === 'J' || e.key === 'k' || e.key === 'K' || e.key === 'Enter')) {
        return
      }

      switch (e.key) {
        // ── Navigation ────────────────────────────────────────────────────
        case 'j':
        case 'J': {
          e.preventDefault()
          const next =
            currentFocused === null
              ? 0
              : Math.min(currentFocused + 1, msgs.length - 1)
          setFocusedIndex(next)
          // Also select the message so the view opens
          if (msgs[next]) {
            setSelectedUID(msgs[next].uid)
          }
          break
        }
        case 'k':
        case 'K': {
          e.preventDefault()
          if (currentFocused === null) break
          const prev = Math.max(currentFocused - 1, 0)
          setFocusedIndex(prev)
          if (msgs[prev]) {
            setSelectedUID(msgs[prev].uid)
          }
          break
        }

        // ── Open message ──────────────────────────────────────────────────
        case 'Enter': {
          if (currentFocused !== null && msgs[currentFocused]) {
            e.preventDefault()
            setSelectedUID(msgs[currentFocused].uid)
          }
          break
        }

        // ── Reply ─────────────────────────────────────────────────────────
        case 'r':
        case 'R': {
          if (selectedUIDRef.current === null) break
          e.preventDefault()
          openCompose('reply')
          break
        }

        // ── Forward ───────────────────────────────────────────────────────
        case 'f':
        case 'F': {
          if (selectedUIDRef.current === null) break
          e.preventDefault()
          openCompose('forward')
          break
        }

        // ── Reply all ─────────────────────────────────────────────────────
        case 'a':
        case 'A': {
          if (selectedUIDRef.current === null) break
          e.preventDefault()
          openCompose('reply')
          break
        }

        // ── Archive (E or Y) ──────────────────────────────────────────────
        case 'e':
        case 'E':
        case 'y':
        case 'Y': {
          e.preventDefault()
          const uid = selectedUIDRef.current
          if (uid === null) break
          batchOperation(currentFolder, [uid], 'move', 'Archive')
            .then(() => {
              // Remove archived message from list and update focus
              setFocusedIndex(null)
              setSelectedUID(null)
            })
            .catch(() => {})
          break
        }

        // ── Delete (#) ────────────────────────────────────────────────────
        case '#': {
          e.preventDefault()
          const uid = selectedUIDRef.current
          if (uid === null) break
          batchOperation(currentFolder, [uid], 'delete')
            .then(() => {
              setFocusedIndex(null)
              setSelectedUID(null)
            })
            .catch(() => {})
          break
        }

        // ── Star / unstar (S) ─────────────────────────────────────────────
        case 's':
        case 'S': {
          e.preventDefault()
          const uid = selectedUIDRef.current
          if (uid === null) break
          // Find current flagged state from messages list
          const msgs = msgListRef.current
          const msg = msgs.find((m) => m.uid === uid)
          if (!msg) break
          const newFlagged = !msg.flags.flagged
          updateFlags(currentFolder, [uid], 'flagged', newFlagged)
            .then(() => {
              updateMessageFlags(uid, { flagged: newFlagged })
            })
            .catch(() => {})
          break
        }

        // ── Toggle read/unread (U) ────────────────────────────────────────
        case 'u':
        case 'U': {
          e.preventDefault()
          const uid = selectedUIDRef.current
          if (uid === null) break
          const msgs = msgListRef.current
          const msg = msgs.find((m) => m.uid === uid)
          if (!msg) break
          const newSeen = !msg.flags.seen
          updateFlags(currentFolder, [uid], 'seen', newSeen)
            .then(() => {
              updateMessageFlags(uid, { seen: newSeen })
            })
            .catch(() => {})
          break
        }

        // ── Focus search (/) ──────────────────────────────────────────────
        case '/': {
          e.preventDefault()
          const input = searchInputRef?.current
          if (input) {
            input.focus()
          }
          break
        }

        // ── Show shortcuts (?) ────────────────────────────────────────────
        case '?': {
          e.preventDefault()
          toggleHelp()
          break
        }

        default:
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    currentFolder,
    openCompose,
    searchInputRef,
    setFocusedIndex,
    setSelectedUID,
    toggleHelp,
    updateMessageFlags,
  ])

  return { helpOpen, closeHelp, toggleHelp }
}
