import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ComposeReplyTo {
  to: string
  subject: string
  body: string
  uid?: number
  folder?: string
}

interface UIState {
  // Panel visibility (mobile)
  activePanel: 'sidebar' | 'list' | 'view'
  // Sidebar compact mode
  sidebarCompact: boolean
  // Compose dialog
  composeOpen: boolean
  composeMode: 'new' | 'reply' | 'forward' | null
  composeReplyTo: ComposeReplyTo | null
  // Search
  searchOpen: boolean
  // Connection
  wsStatus: 'connected' | 'reconnecting' | 'disconnected'
  wsRetryCount: number
  // Actions
  setActivePanel: (panel: 'sidebar' | 'list' | 'view') => void
  toggleSidebarCompact: () => void
  openCompose: (mode: 'new' | 'reply' | 'forward', replyTo?: ComposeReplyTo) => void
  closeCompose: () => void
  toggleSearch: () => void
  setWsStatus: (status: UIState['wsStatus'], retryCount?: number) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Panel visibility (mobile) — default to message list
      activePanel: 'list',
      // Sidebar compact mode — off by default (full sidebar)
      sidebarCompact: false,
      // Compose dialog — closed by default
      composeOpen: false,
      composeMode: null,
      composeReplyTo: null,
      // Search — closed by default
      searchOpen: false,
      // Connection — assume disconnected until WebSocket connects
      wsStatus: 'disconnected',
      wsRetryCount: 0,

      setActivePanel: (panel) => set({ activePanel: panel }),

      toggleSidebarCompact: () =>
        set((state) => ({ sidebarCompact: !state.sidebarCompact })),

      openCompose: (mode, replyTo) =>
        set({
          composeOpen: true,
          composeMode: mode,
          composeReplyTo: replyTo ?? null,
        }),

      closeCompose: () =>
        set({
          composeOpen: false,
          composeMode: null,
          composeReplyTo: null,
        }),

      toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),

      setWsStatus: (status, retryCount) =>
        set((state) => ({
          wsStatus: status,
          wsRetryCount: retryCount ?? (status === 'connected' ? 0 : state.wsRetryCount),
        })),
    }),
    {
      name: 'openvelope-ui',
      partialize: (state) => ({ sidebarCompact: state.sidebarCompact }),
    },
  ),
)
