import { api } from './api'
import type { Contact, ContactAutocompleteItem, ContactGroup } from '../types'

export async function listContacts(params?: { q?: string; page?: number; page_size?: number }) {
  const { data } = await api.get('/contacts', { params })
  return data
}

export async function createContact(contact: Partial<Contact>) {
  const { data } = await api.post('/contacts', contact)
  return data
}

export async function updateContact(id: number, contact: Partial<Contact>) {
  const { data } = await api.patch(`/contacts/${id}`, contact)
  return data
}

export async function deleteContact(id: number) {
  const { data } = await api.delete(`/contacts/${id}`)
  return data
}

export async function autocompleteContacts(q: string): Promise<ContactAutocompleteItem[]> {
  if (!q || q.trim().length < 2) return []
  const { data } = await api.get('/contacts/autocomplete', { params: { q } })
  return data.results ?? data.contacts ?? []
}


// Contact Groups
export async function listGroups(): Promise<ContactGroup[]> {
  const { data } = await api.get('/contacts/groups')
  return data.groups ?? []
}

export async function createGroup(name: string, memberIds: number[]): Promise<ContactGroup> {
  const { data } = await api.post('/contacts/groups', { name, member_ids: memberIds })
  return data.group
}

export async function updateGroup(id: number, payload: { name?: string; member_ids?: number[] }): Promise<ContactGroup> {
  const { data } = await api.patch(`/contacts/groups/${id}`, payload)
  return data.group
}

export async function deleteGroup(id: number): Promise<void> {
  await api.delete(`/contacts/groups/${id}`)
}
