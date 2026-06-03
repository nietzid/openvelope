import { api } from './api'
import type { LoginResponse, MeResponse, RefreshResponse } from '../types'

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', {
    email,
    password,
  })
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function refresh(refreshToken?: string): Promise<RefreshResponse> {
  const { data } = await api.post<RefreshResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  })
  return data
}

export async function me(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me')
  return data
}
