import { create } from 'zustand'
import type { Folder, MessageSummary } from '../types'

interface MailboxState {
  folders: Folder[]
  currentFolder: string
  selectedUID: number | null
  selectedUIDs: Set<number>
  messages: MessageSummary[]
  currentMessage: string | null
  currentMessageText: { html: string; text: string } | null
  page: number
  pageSize: number
  total: number
  // Keyboard navigation
  focusedIndex: number | null
  // Search state
  searchMode: boolean
  searchQuery: string
  searchResults: MessageSummary[]
  searchTotal: number
  searchLoading: boolean
  setFolders: (folders: Folder[]) => void
  setCurrentFolder: (name: string) => void
  setSelectedUID: (uid: number | null) => void
  toggleUID: (uid: number) => void
  clearSelection: () => void
  selectAll: (uids: number[]) => void
  setMessages: (messages: MessageSummary[]) => void
  appendMessages: (messages: MessageSummary[]) => void
  setCurrentMessage: (msg: string | null) => void
  setCurrentMessageText: (text: { html: string; text: string } | null) => void
  updateMessageFlags: (uid: number, flags: Partial<MessageSummary['flags']>) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setTotal: (total: number) => void
  setFocusedIndex: (index: number | null) => void
  setSearchMode: (mode: boolean) => void
  setSearchQuery: (query: string) => void
  setSearchResults: (results: MessageSummary[], total: number) => void
  setSearchLoading: (loading: boolean) => void
  clearSearch: () => void
}

export const useMailboxStore = create<MailboxState>((set) => ({
  folders: [],
  currentFolder: 'INBOX',
  selectedUID: null,
  selectedUIDs: new Set(),
  messages: [],
  currentMessage: null,
  currentMessageText: null,
  page: 0,
  pageSize: 50,
  total: 0,
  focusedIndex: null,
  searchMode: false,
  searchQuery: '',
  searchResults: [],
  searchTotal: 0,
  searchLoading: false,
  setFolders: (folders) => set({ folders }),
  setCurrentFolder: (name) => set({
    currentFolder: name,
    selectedUID: null,
    selectedUIDs: new Set(),
    messages: [],
    currentMessage: null,
    currentMessageText: null,
    page: 0,
    total: 0,
    focusedIndex: null,
    searchMode: false,
    searchQuery: '',
    searchResults: [],
    searchTotal: 0,
    searchLoading: false,
  }),
  setSelectedUID: (uid) => set({ selectedUID: uid }),
  toggleUID: (uid) => set((state) => {
    const next = new Set(state.selectedUIDs)
    if (next.has(uid)) {
      next.delete(uid)
    } else {
      next.add(uid)
    }
    return { selectedUIDs: next }
  }),
  clearSelection: () => set({ selectedUIDs: new Set() }),
  selectAll: (uids) => set({ selectedUIDs: new Set(uids) }),
  setMessages: (messages) => set({ messages }),
  appendMessages: (messages) => set((state) => ({
    messages: [...state.messages, ...messages],
  })),
  setCurrentMessage: (msg) => set({ currentMessage: msg }),
  setCurrentMessageText: (text) => set({ currentMessageText: text }),
  updateMessageFlags: (uid, flags) => set((state) => ({
    messages: state.messages.map((m) =>
      m.uid === uid ? { ...m, flags: { ...m.flags, ...flags } } : m
    ),
  })),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 0 }),
  setTotal: (total) => set({ total }),
  setFocusedIndex: (index) => set({ focusedIndex: index }),
  setSearchMode: (mode) => set({ searchMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results, total) => set({ searchResults: results, searchTotal: total }),
  setSearchLoading: (loading) => set({ searchLoading: loading }),
  clearSearch: () => set({
    searchMode: false,
    searchQuery: '',
    searchResults: [],
    searchTotal: 0,
    searchLoading: false,
  }),
}))
