import { useEffect, useRef } from 'react'
import { useMailboxStore } from '../stores/mailboxStore'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'

/**
 * Switches the backend IDLE watcher to the currently selected folder.
 * When `mailboxStore.currentFolder` changes and the user is authenticated,
 * a POST /api/idle/switch request tells the backend to stop IDLE on the
 * previous folder and start on the new one.
 */
export function useIdleSwitch() {
  const currentFolder = useMailboxStore((state) => state.currentFolder)
  const accessToken = useAuthStore((state) => state.accessToken)
  const prevFolderRef = useRef<string>(currentFolder)

  useEffect(() => {
    // Only switch if the folder actually changed and user is authenticated
    if (!accessToken || currentFolder === prevFolderRef.current) {
      prevFolderRef.current = currentFolder
      return
    }

    prevFolderRef.current = currentFolder

    api.post('/idle/switch', { folder: currentFolder }).catch((err) => {
      // Non-critical: log but don't disrupt the user experience.
      // Common case: no active WebSocket yet (409) — the WS handler
      // will start IDLE on INBOX and the next folder switch will work.
      if (err?.response?.status !== 409) {
        console.warn('idle switch failed:', err?.response?.data || err.message)
      }
    })
  }, [currentFolder, accessToken])
}
