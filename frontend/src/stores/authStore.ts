import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  accessToken: string | null
  email: string | null
  setAuth: (token: string, email: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      email: null,
      setAuth: (token, email) => set({ accessToken: token, email }),
      clearAuth: () => set({ accessToken: null, email: null }),
    }),
    {
      name: 'openvelope-auth',
    },
  ),
)
