'use client'

import { loadAdminJson } from './adminClient'
import type {
  AdminAiModelMutationResource,
  AdminAiModelUpdateInput,
  AdminAiPricingRuleMutationResource,
  AdminAiPricingRuleUpdateInput,
  AdminAiProviderRouteMutationResource,
  AdminAiProviderRouteUpdateInput,
  AdminAiVersionMutationResource,
} from './adminAiTypes'

export async function patchAdminAiModel(modelKey: string, input: AdminAiModelUpdateInput): Promise<AdminAiModelMutationResource> {
  return loadAdminJson<AdminAiModelMutationResource>(`/api/v1/admin/ai/models/${encodeURIComponent(modelKey)}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export async function patchAdminAiProviderRoute(
  routeId: string,
  input: AdminAiProviderRouteUpdateInput,
): Promise<AdminAiProviderRouteMutationResource> {
  return loadAdminJson<AdminAiProviderRouteMutationResource>(`/api/v1/admin/ai/provider-routes/${encodeURIComponent(routeId)}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export async function patchAdminAiPricingRule(
  pricingRuleId: string,
  input: AdminAiPricingRuleUpdateInput,
): Promise<AdminAiPricingRuleMutationResource> {
  return loadAdminJson<AdminAiPricingRuleMutationResource>(`/api/v1/admin/ai/pricing-rules/${encodeURIComponent(pricingRuleId)}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  })
}

export async function publishAdminAiModel(modelKey: string, note?: string): Promise<AdminAiVersionMutationResource> {
  return loadAdminJson<AdminAiVersionMutationResource>(`/api/v1/admin/ai/models/${encodeURIComponent(modelKey)}/publish`, {
    body: JSON.stringify({ note }),
    method: 'POST',
  })
}

export async function rollbackAdminAiModel(modelKey: string, versionId: string, note?: string): Promise<AdminAiVersionMutationResource> {
  return loadAdminJson<AdminAiVersionMutationResource>(
    `/api/v1/admin/ai/models/${encodeURIComponent(modelKey)}/rollback/${encodeURIComponent(versionId)}`,
    {
      body: JSON.stringify({ note }),
      method: 'POST',
    },
  )
}

export async function publishAdminAiProviderRoute(routeId: string, note?: string): Promise<AdminAiVersionMutationResource> {
  return loadAdminJson<AdminAiVersionMutationResource>(`/api/v1/admin/ai/provider-routes/${encodeURIComponent(routeId)}/publish`, {
    body: JSON.stringify({ note }),
    method: 'POST',
  })
}

export async function rollbackAdminAiProviderRoute(routeId: string, versionId: string, note?: string): Promise<AdminAiVersionMutationResource> {
  return loadAdminJson<AdminAiVersionMutationResource>(
    `/api/v1/admin/ai/provider-routes/${encodeURIComponent(routeId)}/rollback/${encodeURIComponent(versionId)}`,
    {
      body: JSON.stringify({ note }),
      method: 'POST',
    },
  )
}

export async function publishAdminAiPricingRule(pricingRuleId: string, note?: string): Promise<AdminAiVersionMutationResource> {
  return loadAdminJson<AdminAiVersionMutationResource>(`/api/v1/admin/ai/pricing-rules/${encodeURIComponent(pricingRuleId)}/publish`, {
    body: JSON.stringify({ note }),
    method: 'POST',
  })
}

export async function rollbackAdminAiPricingRule(pricingRuleId: string, versionId: string, note?: string): Promise<AdminAiVersionMutationResource> {
  return loadAdminJson<AdminAiVersionMutationResource>(
    `/api/v1/admin/ai/pricing-rules/${encodeURIComponent(pricingRuleId)}/rollback/${encodeURIComponent(versionId)}`,
    {
      body: JSON.stringify({ note }),
      method: 'POST',
    },
  )
}
