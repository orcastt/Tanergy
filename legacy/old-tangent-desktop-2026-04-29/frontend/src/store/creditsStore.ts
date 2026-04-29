import { create } from "zustand"
import { tauri } from "../services/tauri"

interface CreditsState {
  balance: number
  isLoggedIn: boolean
  isLoading: boolean
  error: string | null

  refresh: () => Promise<void>
  login: (email: string) => Promise<void>
  verify: (email: string, token: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useCreditsStore = create<CreditsState>((set) => ({
  balance: 0,
  isLoggedIn: false,
  isLoading: false,
  error: null,

  refresh: async () => {
    set({ isLoading: true })
    try {
      const info = await tauri.getCreditBalance()
      set({ balance: info.balance, isLoggedIn: info.is_logged_in, isLoading: false })
    } catch {
      set({ isLoggedIn: false, isLoading: false })
    }
  },

  login: async (email: string) => {
    set({ isLoading: true, error: null })
    try {
      await tauri.loginOfficial(email)
      set({ isLoading: false })
    } catch (e) {
      set({ error: String(e), isLoading: false })
    }
  },

  verify: async (email: string, token: string) => {
    set({ isLoading: true, error: null })
    try {
      await tauri.verifyOtp(email, token)
      const info = await tauri.refreshCredits()
      set({ balance: info.balance, isLoggedIn: info.is_logged_in, isLoading: false })
    } catch (e) {
      set({ error: String(e), isLoading: false })
    }
  },

  logout: async () => {
    try {
      await tauri.logoutOfficial()
      set({ balance: 0, isLoggedIn: false })
    } catch { /* ignore */ }
  },

  clearError: () => set({ error: null }),
}))
