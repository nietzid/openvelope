import { api } from './api'
import type { AttachmentUpload, SendEmailRequest } from '../types'

export async function sendEmail(payload: SendEmailRequest): Promise<void> {
  await api.post('/send', payload)
}

export async function uploadAttachment(file: File): Promise<AttachmentUpload> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<AttachmentUpload>('/attachments/upload', formData)
  return data
}
