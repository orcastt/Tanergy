'use client'

import { loadAdminJson } from './adminClient'
import type {
  AdminPlanCatalogMutationResource,
  AdminPlanCatalogResource,
  AdminPlanCatalogUpdateInput,
} from './adminFinanceTypes'

export function loadAdminPlanCatalog() {
  return loadAdminJson<AdminPlanCatalogResource>('/api/v1/admin/finance/plan-catalog')
}

export function updateAdminPlanCatalog(planKey: string, input: AdminPlanCatalogUpdateInput) {
  return loadAdminJson<AdminPlanCatalogMutationResource>(`/api/v1/admin/finance/plan-catalog/${encodeURIComponent(planKey)}`, {
    body: JSON.stringify(input),
    method: 'PUT',
  })
}
