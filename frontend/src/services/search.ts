import { api } from './api'
import type { SearchQuery, SearchResponse } from '../types'

export async function search(query: SearchQuery): Promise<SearchResponse> {
  const { data } = await api.get<SearchResponse>('/search', {
    params: {
      folder: query.folder,
      text: query.text,
      from: query.from,
      to: query.to,
      subject: query.subject,
      date_after: query.date_after,
      date_before: query.date_before,
      has_attachment: query.has_attachment,
      page: query.page,
      page_size: query.page_size,
    },
    paramsSerializer: {
      indexes: null,
    },
  })
  return data
}
