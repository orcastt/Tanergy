'use client'

import { createQuery, loadAdminJson } from './adminClient'

export type AdminAiModelRecord = {
  capabilities: string[]
  capability: string
  costHint: string
  createdAt: string
  defaultPricingRuleId?: null | string
  defaultTierKey?: null | string
  displayName: string
  enabled: boolean
  estimatedLatency: string
  isDefault: boolean
  modelKey: string
  parameterSchema: Record<string, unknown>
  providerKey?: null | string
  updatedAt: string
}

export type AdminAiProviderRouteRecord = {
  createdAt: string
  enabled: boolean
  healthStatus: string
  modelKey: string
  priority: number
  providerKey: string
  providerModel: string
  retryPolicy: Record<string, unknown>
  routeId: string
  routeKey: string
  timeoutMs: number
  updatedAt: string
  weight: number
}

export type AdminAiPricingRuleRecord = {
  billingUnit: string
  createdAt: string
  creditMultiplier: number
  effectiveFrom: string
  effectiveTo?: null | string
  estimatedCredits: number
  id: string
  minCredits: number
  modelKey: string
  providerCostFormula: Record<string, unknown>
  status: string
  tierKey?: null | string
  updatedAt: string
}

export type AdminAiRunRecord = {
  boardId?: null | string
  chargedAccountId?: null | string
  chargedScope?: null | string
  costCredits: number
  createdAt: string
  errorMessage?: null | string
  estimatedCredits: number
  id: string
  inputAssetIds: string[]
  latencyMs: number
  modelId: string
  nodeId?: null | string
  outputAssetIds: string[]
  preflightStatus?: null | string
  pricingRuleId?: null | string
  promptPreview?: null | string
  provider: string
  providerCost?: null | number
  providerCurrency?: null | string
  routeId?: null | string
  routeKey?: null | string
  runType: string
  selectedTierKey?: null | string
  status: string
  updatedAt: string
  userId?: null | string
  workspaceId?: null | string
}

export type AdminAiApiCallRecord = {
  boardId?: null | string
  createdAt: string
  creditsCharged: number
  creditsRefunded: number
  errorCode?: null | string
  id: string
  latencyMs: number
  modelId: string
  nodeId?: null | string
  pricingRuleId?: null | string
  provider: string
  providerCost?: null | number
  providerCurrency?: null | string
  routeId?: null | string
  routeKey?: null | string
  runId: string
  status: string
  userId?: null | string
  workspaceId?: null | string
}

export type AdminAiModelsResource = { error?: string; models: AdminAiModelRecord[]; ok: boolean }
export type AdminAiModelMutationResource = { error?: string; model?: AdminAiModelRecord; ok: boolean }
export type AdminAiProviderRoutesResource = { error?: string; ok: boolean; routes: AdminAiProviderRouteRecord[] }
export type AdminAiProviderRouteMutationResource = { error?: string; ok: boolean; route?: AdminAiProviderRouteRecord }
export type AdminAiPricingRulesResource = { error?: string; ok: boolean; pricingRules: AdminAiPricingRuleRecord[] }
export type AdminAiPricingRuleMutationResource = { error?: string; ok: boolean; pricingRule?: AdminAiPricingRuleRecord }
export type AdminAiRunsResource = { error?: string; ok: boolean; runs: AdminAiRunRecord[] }
export type AdminAiApiCallsResource = { apiCalls: AdminAiApiCallRecord[]; error?: string; ok: boolean }
export type AdminAiControlPlaneVersionRecord = {
  action: string
  actorUserId?: null | string
  createdAt: string
  id: string
  note?: null | string
  publishedAt?: null | string
  resourceId: string
  resourceType: string
  snapshot: Record<string, unknown>
  versionNumber: number
  workspaceId?: null | string
}
export type AdminAiControlPlaneVersionsResource = { error?: string; ok: boolean; versions: AdminAiControlPlaneVersionRecord[] }
export type AdminAiVersionMutationResource = { error?: string; ok: boolean; version?: AdminAiControlPlaneVersionRecord }

type AdminAiModelQuery = {
  capability?: string
  enabled?: boolean
  limit?: number
}

type AdminAiProviderRouteQuery = {
  enabled?: boolean
  limit?: number
  modelKey?: string
  providerKey?: string
}

type AdminAiPricingRuleQuery = {
  limit?: number
  modelKey?: string
  status?: string
  tierKey?: string
}

type AdminAiRunQuery = {
  boardId?: string
  limit?: number
  modelId?: string
  preflightStatus?: string
  pricingRuleId?: string
  provider?: string
  routeKey?: string
  runId?: string
  runType?: string
  status?: string
  workspaceId?: string
}

type AdminAiApiCallQuery = {
  boardId?: string
  errorCode?: string
  limit?: number
  modelId?: string
  provider?: string
  pricingRuleId?: string
  routeKey?: string
  runId?: string
  status?: string
  workspaceId?: string
}

type AdminAiVersionQuery = {
  limit?: number
  resourceId: string
  resourceType: string
}

export type AdminAiModelUpdateInput = Partial<Pick<
  AdminAiModelRecord,
  'capabilities' | 'capability' | 'costHint' | 'defaultPricingRuleId' | 'defaultTierKey' | 'displayName' | 'enabled' | 'estimatedLatency' | 'isDefault' | 'parameterSchema' | 'providerKey'
>>

export type AdminAiProviderRouteUpdateInput = Partial<Pick<
  AdminAiProviderRouteRecord,
  'enabled' | 'healthStatus' | 'modelKey' | 'priority' | 'providerKey' | 'providerModel' | 'retryPolicy' | 'routeKey' | 'timeoutMs' | 'weight'
>>

export type AdminAiPricingRuleUpdateInput = Partial<Pick<
  AdminAiPricingRuleRecord,
  'billingUnit' | 'creditMultiplier' | 'effectiveFrom' | 'effectiveTo' | 'estimatedCredits' | 'minCredits' | 'modelKey' | 'providerCostFormula' | 'status' | 'tierKey'
>>

export async function loadAdminAiModels(query: AdminAiModelQuery): Promise<AdminAiModelsResource> {
  return loadAdminJson<AdminAiModelsResource>(`/api/v1/admin/ai/models${createQuery(query)}`)
}

export async function loadAdminAiProviderRoutes(query: AdminAiProviderRouteQuery): Promise<AdminAiProviderRoutesResource> {
  return loadAdminJson<AdminAiProviderRoutesResource>(`/api/v1/admin/ai/provider-routes${createQuery(query)}`)
}

export async function loadAdminAiPricingRules(query: AdminAiPricingRuleQuery): Promise<AdminAiPricingRulesResource> {
  return loadAdminJson<AdminAiPricingRulesResource>(`/api/v1/admin/ai/pricing-rules${createQuery(query)}`)
}

export async function loadAdminAiRuns(query: AdminAiRunQuery): Promise<AdminAiRunsResource> {
  return loadAdminJson<AdminAiRunsResource>(`/api/v1/admin/ai/runs${createQuery(query)}`)
}

export async function loadAdminAiApiCalls(query: AdminAiApiCallQuery): Promise<AdminAiApiCallsResource> {
  return loadAdminJson<AdminAiApiCallsResource>(`/api/v1/admin/ai/api-calls${createQuery(query)}`)
}

export async function loadAdminAiVersions(query: AdminAiVersionQuery): Promise<AdminAiControlPlaneVersionsResource> {
  return loadAdminJson<AdminAiControlPlaneVersionsResource>(`/api/v1/admin/ai/versions${createQuery(query)}`)
}

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
