import { toast } from 'sonner'

/**
 * Shows a Sonner toast with an Undo action button.
 * The toast auto-dismisses after 5 seconds.
 * Multiple toasts stack automatically (Sonner default behavior).
 *
 * @param message - Description of what happened (e.g. "Message deleted")
 * @param onUndo - Callback to execute when the user clicks Undo
 */
export function showUndoToast(message: string, onUndo: () => void) {
  toast(message, {
    action: {
      label: 'Undo',
      onClick: onUndo,
    },
    duration: 5000,
  })
}
