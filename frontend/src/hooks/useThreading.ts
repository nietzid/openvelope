import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MessageSummary } from '../types'

export type ThreadViewMode = 'conversation' | 'flat'

interface ThreadingState {
  viewMode: ThreadViewMode
  setViewMode: (mode: ThreadViewMode) => void
  toggleViewMode: () => void
}

/**
 * Store for thread view mode preference.
 * Persisted to localStorage so the user's preference is remembered.
 */
export const useThreadingStore = create<ThreadingState>()(
  persist(
    (set) => ({
      viewMode: 'flat',
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === 'conversation' ? 'flat' : 'conversation',
        })),
    }),
    {
      name: 'webmail-threading',
      partialize: (state) => ({ viewMode: state.viewMode }),
    },
  ),
)

/**
 * Groups messages by their thread_id.
 * Messages without a thread_id are placed in their own group keyed by `__uid_<uid>`.
 * Within each group, messages are sorted by date ascending.
 *
 * @returns A Map where keys are thread IDs and values are arrays of messages in that thread.
 */
export function groupByThread(
  messages: MessageSummary[],
): Map<string, MessageSummary[]> {
  const map = new Map<string, MessageSummary[]>()

  for (const msg of messages) {
    const key = msg.thread_id || `__uid_${msg.uid}`
    const group = map.get(key)
    if (group) {
      group.push(msg)
    } else {
      map.set(key, [msg])
    }
  }

  // Sort each group by date ascending
  for (const [, group] of map) {
    group.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
  }

  return map
}
