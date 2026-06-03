import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MessageList from '../components/MessageList'
import MessageView from '../components/MessageView'
import ComposePanel, { type ComposePanelHandle } from '../components/ComposePanel'
import { useAuthStore } from '../stores/authStore'
import { logout as logoutRequest } from '../services/auth'
import { useMailboxUpdates } from '../hooks/useMailboxUpdates'

function Mailbox() {
  const navigate = useNavigate()
  const email = useAuthStore((state) => state.email)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const composeRef = useRef<ComposePanelHandle>(null)

  useMailboxUpdates()

  const handleLogout = async () => {
    try {
      await logoutRequest()
    } catch {
      // ignore — proceed with local logout
    }
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-screen bg-white text-black">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <span className="text-sm text-gray-700">{email ?? ''}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-black px-3 py-1 hover:bg-gray-100 cursor-pointer"
        >
          Logout
        </button>
      </header>
      <div className="flex flex-1 min-h-0">
        <Sidebar onCompose={() => composeRef.current?.open()} />
        <MessageList />
        <MessageView />
      </div>
      <ComposePanel ref={composeRef} />
    </div>
  )
}

export default Mailbox
