import { useUIStore } from '../../stores/uiStore'

/**
 * Dispatches a custom event to signal the WebSocket hook to retry connection.
 * The useWebSocket hook listens for this event and re-initiates connection.
 */
export function manualRetry(): void {
  window.dispatchEvent(new CustomEvent('ws:manual-retry'))
}

/**
 * Connection status indicator driven by uiStore.wsStatus.
 *
 * - 'connected': renders nothing
 * - 'reconnecting': subtle amber banner with ARIA live polite
 * - 'disconnected': persistent red error banner with retry button, ARIA live assertive
 *
 * Uses translateY transition for smooth entrance/exit animation.
 */
export function ConnectionStatus() {
  const wsStatus = useUIStore((state) => state.wsStatus)

  if (wsStatus === 'connected') {
    return null
  }

  if (wsStatus === 'reconnecting') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={[
          'fixed top-0 left-0 right-0 z-50 flex items-center justify-center',
          'bg-amber-500/90 text-white text-sm py-1.5 px-4',
          'animate-[slideDown_200ms_var(--ease-out-expo)_forwards]',
          'transition-transform duration-[var(--duration-normal)]',
          '[transition-timing-function:var(--ease-out-expo)]',
        ].join(' ')}
        style={{
          transform: 'translateY(0)',
        }}
      >
        <svg
          className="h-4 w-4 animate-spin mr-2 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>Reconnecting to server…</span>
      </div>
    )
  }

  // wsStatus === 'disconnected'
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3',
        'bg-[var(--color-error)] text-white text-sm py-2 px-4',
        'transition-transform duration-[var(--duration-normal)]',
        '[transition-timing-function:var(--ease-out-expo)]',
      ].join(' ')}
      style={{
        transform: 'translateY(0)',
      }}
    >
      <span>Connection lost. Real-time updates unavailable.</span>
      <button
        type="button"
        onClick={manualRetry}
        className={[
          'inline-flex items-center px-3 py-1 rounded-[var(--radius-sm)]',
          'bg-white/20 hover:bg-white/30 text-white font-medium text-sm',
          'transition-[background-color] duration-[var(--duration-fast)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-error)]',
          'min-h-[44px] min-w-[44px]',
        ].join(' ')}
      >
        Retry
      </button>
    </div>
  )
}
