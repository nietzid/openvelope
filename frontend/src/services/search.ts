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
    },
    paramsSerializer: {
      indexes: null,
    },
  })
  return data
}
