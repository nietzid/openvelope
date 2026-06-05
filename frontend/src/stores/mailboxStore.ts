import { create } from 'zustand'
import type { Folder, MessageSummary } from '../types'

interface MailboxState {
  folders: Folder[]
  currentFolder: string
  selectedUID: number | null
  selectedUIDs: Set<number>
  messages: MessageSummary[]
  currentMessage: string | null
  setFolders: (folders: Folder[]) => void
  setCurrentFolder: (name: string) => void
  setSelectedUID: (uid: number | null) => void
  toggleUID: (uid: number) => void
  clearSelection: () => void
  selectAll: (uids: number[]) => void
  setMessages: (messages: MessageSummary[]) => void
  setCurrentMessage: (msg: string | null) => void
}

export const useMailboxStore = create<MailboxState>((set) => ({
  folders: [],
  currentFolder: 'INBOX',
  selectedUID: null,
  selectedUIDs: new Set(),
  messages: [],
  currentMessage: null,
  setFolders: (folders) => set({ folders }),
  setCurrentFolder: (name) => set({ currentFolder: name, selectedUID: null, selectedUIDs: new Set(), messages: [], currentMessage: null }),
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
  setCurrentMessage: (msg) => set({ currentMessage: msg }),
}))
