import { api } from './api'
import type { SendEmailRequest } from '../types'

export async function sendEmail(payload: SendEmailRequest): Promise<void> {
  await api.post('/send', payload)
}
