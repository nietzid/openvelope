import { api } from './api'
import type {
  AttachmentInfo,
  MessageFlagName,
  MessageHeaders,
  MessageListResponse,
  MessageSummary,
} from '../types'

export async function listMessages(
  folder: string,
  page: number,
  pageSize: number,
): Promise<MessageListResponse> {
  const { data } = await api.get<MessageListResponse>('/messages', {
    params: { folder, page, page_size: pageSize },
  })
  return data
}

export async function getMessage(folder: string, uid: number): Promise<string> {
  const { data } = await api.get<string>(`/messages/${uid}`, {
    params: { folder },
    responseType: 'text',
    transformResponse: [(d) => d],
  })
  return data
}

export async function updateFlags(
  folder: string,
  uids: number[],
  flag: MessageFlagName,
  value: boolean,
): Promise<void> {
  await api.post('/messages/flags', { folder, uids, flag, value })
}

export async function deleteMessage(folder: string, uid: number): Promise<void> {
  await api.delete(`/messages/${uid}`, { params: { folder } })
}

export async function moveMessage(
  folder: string,
  uid: number,
  destFolder: string,
): Promise<void> {
  await api.post('/messages/move', { uid, dest_folder: destFolder }, {
    params: { folder },
  })
}

export async function batchOperation(
  folder: string,
  uids: number[],
  action: string,
  destFolder?: string,
): Promise<void> {
  await api.post('/messages/batch', {
    folder,
    uids,
    action,
    dest_folder: destFolder,
  })
}

// Re-export for convenience to consumers that need the type alongside the call.
export type { MessageSummary }

export async function getMessageHeaders(folder: string, uid: number): Promise<MessageHeaders> {
  const { data } = await api.get<MessageHeaders>(`/messages/${uid}/headers`, {
    params: { folder },
  })
  return data
}

export async function listAttachments(folder: string, uid: number): Promise<AttachmentInfo[]> {
  const { data } = await api.get<{ attachments: AttachmentInfo[] }>(`/messages/${uid}/attachments`, {
    params: { folder },
  })
  return data.attachments ?? []
}

export async function downloadAttachment(folder: string, uid: number, partId: string): Promise<Blob> {
  const response = await api.get(`/messages/${uid}/attachments/${partId}`, {
    params: { folder },
    responseType: 'blob',
  })
  return response.data
}

// ── Folder CRUD ──────────────────────────────────────────────────────

export async function createFolder(name: string): Promise<void> {
  await api.post('/folders', { name })
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
  await api.patch('/folders', { old_name: oldName, new_name: newName })
}

export async function deleteFolder(name: string): Promise<void> {
  await api.delete(`/folders/${encodeURIComponent(name)}`)
}
