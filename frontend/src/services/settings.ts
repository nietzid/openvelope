import { api } from './api'
import type { Identity, Signature } from '../types'

// Identities
export async function listIdentities() {
  const { data } = await api.get('/identities')
  return data.identities ?? data
}

export async function createIdentity(identity: Partial<Identity>) {
  const { data } = await api.post('/identities', identity)
  return data
}

export async function updateIdentity(id: number, identity: Partial<Identity>) {
  const { data } = await api.patch(`/identities/${id}`, identity)
  return data
}

export async function deleteIdentity(id: number) {
  const { data } = await api.delete(`/identities/${id}`)
  return data
}

// Signatures
export async function listSignatures() {
  const { data } = await api.get('/signatures')
  return data.signatures ?? data
}

export async function createSignature(signature: Partial<Signature>) {
  const { data } = await api.post('/signatures', signature)
  return data
}

export async function updateSignature(id: number, signature: Partial<Signature>) {
  const { data } = await api.patch(`/signatures/${id}`, signature)
  return data
}

export async function deleteSignature(id: number) {
  const { data } = await api.delete(`/signatures/${id}`)
  return data
}
