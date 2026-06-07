export interface Folder {
  name: string;
  count: number;
  unseen: number;
  delimiter: string;
}

export interface MessageFlags {
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  draft: boolean;
  deleted: boolean;
}

export interface MessageSummary {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  size: number;
  flags: MessageFlags;
  has_attach: boolean;
  preview: string;
}

export interface MessageListResponse {
  messages: MessageSummary[];
  page: number;
  page_size: number;
  total: number;
}

export interface SendEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  is_html: boolean;
  in_reply_to?: string;
  references?: string[];
  attachments?: AttachmentUpload[];
}

export interface SearchQuery {
  folder?: string;
  text?: string;
  from?: string;
  to?: string;
  subject?: string;
  date_after?: string;
  date_before?: string;
  has_attachment?: boolean;
  page?: number;
  page_size?: number;
}

export interface SearchResponse {
  results: MessageSummary[];
  count: number;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email: string;
}

export interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

export interface MeResponse {
  email: string;
}

export interface MessageHeaders {
  uid: number;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  message_id: string;
  in_reply_to: string;
  references: string;
  flags: MessageFlags;
}

export type MessageFlagName = keyof MessageFlags;

export interface AttachmentInfo {
  part_id: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface AttachmentUpload {
  filename: string;
  content_type: string;
  content: string;
  size: number;
}

export interface Contact {
  id: number;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email_addr: string;
  phone: string;
  company: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ContactAutocompleteItem {
  id: number;
  display_name: string;
  email_addr: string;
}

export interface Identity {
  id: number;
  email: string;
  name: string;
  from_email: string;
  reply_to: string;
  is_default: boolean;
  signature_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Signature {
  id: number;
  email: string;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
