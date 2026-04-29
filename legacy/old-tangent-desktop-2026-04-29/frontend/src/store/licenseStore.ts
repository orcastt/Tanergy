import { create } from "zustand"
import type { LicenseStatus, LicensePlan } from "../types/license"
import { tauri } from "../services/tauri"

interface LicenseState {
  status: LicenseStatus
  plan: LicensePlan
  trialEndsAt: string | null
  expiresAt: string | null
  isLoading: boolean

  checkStatus: () => Promise<void>
  activate: (licenseKey: string) => Promise<boolean>
  deactivate: () => Promise<void>
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status: "unknown",
  plan: "free",
  trialEndsAt: null,
  expiresAt: null,
  isLoading: false,

  checkStatus: async () => {
    set({ isLoading: true })
    try {
      const info = await tauri.checkLicenseStatus()
      set({
        status: info.status,
        plan: info.plan,
        expiresAt: info.expires_at,
        trialEndsAt: info.trial_ends_at,
        isLoading: false,
      })
    } catch {
      set({ status: "unknown", isLoading: false })
    }
  },

  activate: async (key: string) => {
    try {
      const info = await tauri.activateLicense(key)
      set({
        status: info.status,
        plan: info.plan,
        expiresAt: info.expires_at,
        trialEndsAt: info.trial_ends_at,
      })
      return true
    } catch {
      return false
    }
  },

  deactivate: async () => {
    try {
      await tauri.deactivateLicense()
      set({ status: "trial", plan: "free", expiresAt: null, trialEndsAt: null })
    } catch { /* ignore */ }
  },
}))
