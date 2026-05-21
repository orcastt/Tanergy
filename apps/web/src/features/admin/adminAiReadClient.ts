'use client'

import { createQuery, loadAdminJson } from './adminClient'
import type {
  AdminAiApiCallQuery,
  AdminAiApiCallsResource,
  AdminAiControlPlaneVersionsResource,
  AdminAiModelQuery,
  AdminAiModelsResource,
  AdminAiPricingRuleQuery,
  AdminAiPricingRulesResource,
  AdminAiProviderRouteQuery,
  AdminAiProviderRoutesResource,
  AdminAiRouteMetricsResource,
  AdminAiRunQuery,
  AdminAiRunsResource,
  AdminAiVersionQuery,
} from './adminAiTypes'

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

export async function loadAdminAiRouteMetrics(query: { capability?: string; limit?: number }): Promise<AdminAiRouteMetricsResource> {
  return loadAdminJson<AdminAiRouteMetricsResource>(`/api/v1/admin/ai/route-metrics${createQuery(query)}`)
}

export async function loadAdminAiVersions(query: AdminAiVersionQuery): Promise<AdminAiControlPlaneVersionsResource> {
  return loadAdminJson<AdminAiControlPlaneVersionsResource>(`/api/v1/admin/ai/versions${createQuery(query)}`)
}
