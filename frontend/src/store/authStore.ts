import { create } from "zustand"
import { getMe, logout as logoutApi } from "../services/auth"
import type { User } from "../types/auth"

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  restore: () => Promise<void>
}

const TOKEN_KEY = "tanvas_token"

function mapUser(raw: Awaited<ReturnType<typeof getMe>>): User {
  return {
    id: raw.id,
    email: raw.email,
    displayName: raw.display_name,
    avatarUrl: raw.avatar_url,
    createdAt: raw.created_at,
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ token, user, isLoading: false })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, user: null, isLoading: false })
    logoutApi().catch(() => {})
    window.location.href = "/login"
  },

  restore: async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ isLoading: false })
      return
    }
    try {
      const raw = await getMe()
      set({ token, user: mapUser(raw), isLoading: false })
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      set({ token: null, user: null, isLoading: false })
    }
  },
}))

useAuthStore.getState().restore()
