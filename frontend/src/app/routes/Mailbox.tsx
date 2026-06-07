import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutShell } from '../../components/layout/LayoutShell'
import { TopBar } from '../../components/layout/TopBar'
import { Sidebar } from '../../components/layout/Sidebar'
import { MessageList } from '../../components/mail/MessageList'
import { MessageView } from '../../components/mail/MessageView'
import { ComposeDialog } from '../../components/mail/ComposeDialog'
import { SearchInterface } from '../../components/search/SearchInterface'
import { ConnectionStatus } from '../../components/layout/ConnectionStatus'
import { useAuthStore } from '../../stores/authStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useMailboxUpdates } from '../../hooks/useMailboxUpdates'
import { useKeyboardShortcuts, KeyboardShortcutsModal } from '../../hooks/useKeyboardShortcuts'

/**
 * Mailbox route — assembles the LayoutShell with all feature components.
 * Top bar always visible with date, actions, and logout.
 */
export default function Mailbox() {
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)

  // WebSocket lifecycle — connect on auth, disconnect on logout
  const wsServiceRef = useWebSocket()
  useMailboxUpdates(wsServiceRef)

  // Redirect to login if token cleared (e.g. after logout)
  useEffect(() => {
    if (!accessToken) {
      navigate('/login', { replace: true })
    }
  }, [accessToken, navigate])

  // Keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { helpOpen, closeHelp } = useKeyboardShortcuts(searchInputRef)

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-bg">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-md focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        onClick={(e) => {
          e.preventDefault()
          const target =
            document.getElementById('main-content') ??
            document.querySelector<HTMLElement>('[data-main-content]')
          if (target) target.focus()
        }}
      >
        Skip to main content
      </a>

      {/* Connection status indicator */}
      <ConnectionStatus />

      {/* Top bar: date + actions + logout (always visible) */}
      <TopBar />

      {/* Main three-panel layout (fills remaining height) */}
      <div className="flex-1 min-h-0">
        <LayoutShell
          sidebar={<Sidebar />}
          messageList={<MessageList searchInputRef={searchInputRef} />}
          messageView={<MessageView />}
        />
      </div>

      {/* Overlays */}
      <ComposeDialog />
      <SearchInterface />
      <KeyboardShortcutsModal open={helpOpen} onClose={closeHelp} />
    </div>
  )
}
