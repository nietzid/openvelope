import { useEffect, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useMailboxStore } from '../stores/mailboxStore'

// ─── Constants ──────────────────────────────────────────────────────

const STORAGE_KEY = 'notifications_enabled'
const PERMISSION_REQUESTED_KEY = 'notifications_permission_requested'

// ─── Module-level state ─────────────────────────────────────────────

let notificationsEnabled = loadNotificationsEnabled()

function loadNotificationsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored !== null ? stored === 'true' : true // default: enabled
  } catch {
    return true
  }
}

function persistNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ─── Browser notification helpers ───────────────────────────────────

function getBrowserPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

function requestBrowserPermission(): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    try {
      Notification.requestPermission()
    } catch {
      // Graceful degradation: request failed, skip silently
    }
  }
}

function showBrowserNotification(data: NewMessageData): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return

  try {
    const notification = new Notification('New message', {
      body: `From: ${data.from} — ${data.subject}`,
      icon: '/favicon.ico',
      tag: `new-message-${data.folder}-${data.uid}`,
    })

    notification.onclick = () => {
      window.focus()
      // Navigate to the mailbox — the message will be visible when the user opens the folder
      window.location.href = '/mailbox'
      notification.close()
    }
  } catch {
    // Graceful degradation: notification creation failed, skip silently
  }
}

// ─── Sonner toast notification ──────────────────────────────────────

function showToastNotification(data: NewMessageData): void {
  toast.info('New message', {
    description: `From: ${data.from} — ${data.subject}`,
    duration: 4000,
  })
}

// ─── Types ──────────────────────────────────────────────────────────

export interface NewMessageData {
  folder: string
  uid: number
  from: string
  subject: string
}

// ─── Public API (used by wsEventHandlers) ───────────────────────────

/**
 * Dispatches a new_message notification via the appropriate channel.
 * - Tab hidden  → browser notification (if permission granted)
 * - Tab visible → Sonner toast
 *
 * Respects the `notifications_enabled` localStorage setting.
 * Skips notification if the message is in the currently selected folder.
 */
export function notifyNewMessage(data: NewMessageData): void {
  // Respect the user preference
  if (!notificationsEnabled) return

  // Don't notify if the message is in the currently selected folder
  const { currentFolder } = useMailboxStore.getState()
  if (data.folder === currentFolder) return

  if (document.hidden) {
    // Tab is in background — use browser notification
    showBrowserNotification(data)
  } else {
    // Tab is in foreground — use Sonner toast
    showToastNotification(data)
  }
}

// ─── React Hook ─────────────────────────────────────────────────────

/**
 * Hook that manages notification lifecycle:
 * - Checks browser notification permission on mount
 * - Requests permission on first user interaction (if 'default')
 * - Exposes settings to enable/disable notifications
 * - Exposes the current browser permission status
 */
export function useNotifications() {
  const [enabled, setEnabledState] = useState(notificationsEnabled)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getBrowserPermissionStatus,
  )

  // Request permission on first user interaction if not yet decided
  useEffect(() => {
    if (permission !== 'default') return

    function handleInteraction() {
      requestBrowserPermission()
      // Re-check permission after request (user may have responded)
      setTimeout(() => {
        setPermission(getBrowserPermissionStatus())
      }, 1000)
    }

    // Use { once: true } to avoid repeated requests
    const events = ['click', 'keydown', 'mousedown', 'touchstart']
    for (const event of events) {
      document.addEventListener(event, handleInteraction, { once: true })
    }

    return () => {
      for (const event of events) {
        document.removeEventListener(event, handleInteraction)
      }
    }
  }, [permission])

  // Mark that we've attempted a permission request
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(PERMISSION_REQUESTED_KEY)) {
        sessionStorage.setItem(PERMISSION_REQUESTED_KEY, 'true')
      }
    } catch {
      // Ignore
    }
  }, [])

  const setEnabled = useCallback((value: boolean) => {
    notificationsEnabled = value
    persistNotificationsEnabled(value)
    setEnabledState(value)
  }, [])

  const requestPermission = useCallback(() => {
    requestBrowserPermission()
    setTimeout(() => {
      setPermission(getBrowserPermissionStatus())
    }, 1000)
  }, [])

  return {
    enabled,
    setEnabled,
    permission,
    requestPermission,
  }
}
