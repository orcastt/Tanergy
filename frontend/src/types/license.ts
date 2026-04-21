export type LicenseStatus = "active" | "trial" | "expired" | "unknown"
export type LicensePlan = "free" | "pro"

export interface LicenseInfo {
  status: LicenseStatus
  plan: LicensePlan
  expires_at: string | null
  trial_ends_at: string | null
}

export interface KeyStatus {
  is_set: boolean
  is_valid: boolean | null
  last_tested: string | null
}

export interface ProviderInfo {
  id: string
  name: string
  key_prefix: string
  base_url: string
  is_set: boolean
  is_valid: boolean | null
  last_tested: string | null
}
