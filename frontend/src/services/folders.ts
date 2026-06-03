import { api } from './api'
import type { Folder } from '../types'

interface FoldersResponse {
  folders: Folder[]
}

export async function listFolders(): Promise<Folder[]> {
  const { data } = await api.get<FoldersResponse>('/folders')
  return data.folders
}

export async function createFolder(name: string): Promise<void> {
  await api.post('/folders', { name })
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
  await api.patch('/folders', { old_name: oldName, new_name: newName })
}

export async function deleteFolder(name: string): Promise<void> {
  await api.delete(`/folders/${encodeURIComponent(name)}`)
}
