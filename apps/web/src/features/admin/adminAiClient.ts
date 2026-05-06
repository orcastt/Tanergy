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
  routeId?: null | string
  routeKey?: null | string
  runId: string
  status: string
  userId?: null | string
  workspaceId?: null | string
}

export type AdminAiModelsResource = { error?: string; models: AdminAiModelRecord[]; ok: boolean }
export type AdminAiProviderRoutesResource = { error?: string; ok: boolean; routes: AdminAiProviderRouteRecord[] }
export type AdminAiPricingRulesResource = { error?: string; ok: boolean; pricingRules: AdminAiPricingRuleRecord[] }
export type AdminAiRunsResource = { error?: string; ok: boolean; runs: AdminAiRunRecord[] }
export type AdminAiApiCallsResource = { apiCalls: AdminAiApiCallRecord[]; error?: string; ok: boolean }

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
  limit?: number
  modelId?: string
  runType?: string
  status?: string
}

type AdminAiApiCallQuery = {
  limit?: number
  modelId?: string
  provider?: string
  status?: string
}

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
