import { useRef, useCallback } from 'react'
import { getMessage } from '../services/messages'

/** Hover threshold before triggering prefetch (ms) */
const PREFETCH_DELAY_MS = 200

/** Cache of prefetched message content keyed by "folder:uid" */
const prefetchCache = new Map<string, string>()

function cacheKey(folder: string, uid: number): string {
  return `${folder}:${uid}`
}

/**
 * Returns cached prefetch content if available, or undefined.
 */
export function getPrefetchedMessage(folder: string, uid: number): string | undefined {
  return prefetchCache.get(cacheKey(folder, uid))
}

/**
 * usePrefetch — triggers message content prefetch after 200ms hover.
 * Returns onMouseEnter/onMouseLeave handlers bound to a specific folder+uid.
 * Uses AbortController to cancel if hover ends before threshold.
 *
 * Validates: Requirement 15.5
 */
export function usePrefetch(folder: string, uid: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const onMouseEnter = useCallback(() => {
    const key = cacheKey(folder, uid)

    // Skip if already prefetched
    if (prefetchCache.has(key)) return

    // Start a timer — if hover lasts 200ms, prefetch
    timerRef.current = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller

      getMessage(folder, uid)
        .then((content) => {
          // Only cache if not aborted
          if (!controller.signal.aborted) {
            prefetchCache.set(key, content)
          }
        })
        .catch(() => {
          // Silently ignore prefetch failures — they are opportunistic
        })
    }, PREFETCH_DELAY_MS)
  }, [folder, uid])

  const onMouseLeave = useCallback(() => {
    // Cancel pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // Abort in-flight prefetch request
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  return { onMouseEnter, onMouseLeave }
}
