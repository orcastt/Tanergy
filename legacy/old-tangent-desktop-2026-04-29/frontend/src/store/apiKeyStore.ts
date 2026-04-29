import { create } from "zustand"
import type { ProviderInfo } from "../types/license"
import { tauri } from "../services/tauri"

interface ApiKeyState {
  providers: ProviderInfo[]
  testing: Record<string, boolean>
  isLoading: boolean

  loadProviders: () => Promise<void>
  setKey: (providerId: string, key: string) => Promise<void>
  testKey: (providerId: string) => Promise<boolean>
  removeKey: (providerId: string) => Promise<void>
  isProviderReady: (providerId: string) => boolean
  hasAnyKey: () => boolean
}

export const useApiKeyStore = create<ApiKeyState>((set, get) => ({
  providers: [],
  testing: {},
  isLoading: false,

  loadProviders: async () => {
    set({ isLoading: true })
    try {
      const providers = await tauri.getAllProviders()
      set({ providers, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  setKey: async (providerId: string, key: string) => {
    await tauri.setApiKey(providerId, key)
    await get().loadProviders()
  },

  testKey: async (providerId: string) => {
    set((s) => ({ testing: { ...s.testing, [providerId]: true } }))
    try {
      const ok = await tauri.testApiKey(providerId)
      await get().loadProviders()
      return ok
    } catch {
      await get().loadProviders()
      return false
    } finally {
      set((s) => {
        const next = { ...s.testing }
        delete next[providerId]
        return { testing: next }
      })
    }
  },

  removeKey: async (providerId: string) => {
    await tauri.removeApiKey(providerId)
    await get().loadProviders()
  },

  isProviderReady: (providerId: string) => {
    const p = get().providers.find((x) => x.id === providerId)
    return p?.is_set === true && p?.is_valid === true
  },

  hasAnyKey: () => {
    return get().providers.some((p) => p.is_set)
  },
}))
