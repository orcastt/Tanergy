import { planCatalog } from '@/features/billing/billingContracts'
import type { PlanKey } from '@/features/billing/billingTypes'

export type GroupPersonalPlanKey = Extract<PlanKey, 'collaborate_plus' | 'collaborate_start' | 'free_canvas'>

export function normalizeGroupPersonalPlanKey(value?: null | string): GroupPersonalPlanKey {
  if (value === 'collaborate_plus' || value === 'collaborate_start' || value === 'free_canvas') return value
  return 'free_canvas'
}

export function resolveGroupWorkspaceLimit(value?: null | string) {
  return planCatalog[normalizeGroupPersonalPlanKey(value)].groupWorkspaceLimit ?? 0
}
