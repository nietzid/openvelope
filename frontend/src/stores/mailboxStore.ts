import { create } from 'zustand'
import type { Folder, MessageSummary } from '../types'

interface MailboxState {
  folders: Folder[]
  currentFolder: string
  selectedUID: number | null
  messages: MessageSummary[]
  currentMessage: string | null
  setFolders: (folders: Folder[]) => void
  setCurrentFolder: (name: string) => void
  setSelectedUID: (uid: number | null) => void
  setMessages: (messages: MessageSummary[]) => void
  setCurrentMessage: (msg: string | null) => void
}

export const useMailboxStore = create<MailboxState>((set) => ({
  folders: [],
  currentFolder: 'INBOX',
  selectedUID: null,
  messages: [],
  currentMessage: null,
  setFolders: (folders) => set({ folders }),
  setCurrentFolder: (name) => set({ currentFolder: name, selectedUID: null, messages: [], currentMessage: null }),
  setSelectedUID: (uid) => set({ selectedUID: uid }),
  setMessages: (messages) => set({ messages }),
  setCurrentMessage: (msg) => set({ currentMessage: msg }),
}))
