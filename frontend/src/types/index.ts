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
}

export interface SearchQuery {
  folder?: string;
  text?: string;
  from?: string;
  to?: string;
  subject?: string;
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

export type MessageFlagName = keyof MessageFlags;
