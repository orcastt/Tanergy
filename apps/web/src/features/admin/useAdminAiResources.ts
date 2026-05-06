'use client'

import { useEffect, useState } from 'react'
import {
  loadAdminAiApiCalls,
  loadAdminAiModels,
  loadAdminAiPricingRules,
  loadAdminAiProviderRoutes,
  loadAdminAiRuns,
  type AdminAiApiCallsResource,
  type AdminAiModelsResource,
  type AdminAiPricingRulesResource,
  type AdminAiProviderRoutesResource,
  type AdminAiRunsResource,
} from './adminAiClient'

type AdminAiResourceState = 'error' | 'loading' | 'partial' | 'ready'

type AdminAiResourceOptions = {
  apiCallLimit: number
  apiCallModelId?: string
  apiCallProvider?: string
  apiCallStatus?: string
  modelCapability?: string
  modelEnabled?: boolean
  modelLimit: number
  pricingLimit: number
  pricingModelKey?: string
  pricingStatus?: string
  pricingTierKey?: string
  routeEnabled?: boolean
  routeLimit: number
  routeModelKey?: string
  routeProviderKey?: string
  runLimit: number
  runModelId?: string
  runStatus?: string
  runType?: string
}

const emptyModels: AdminAiModelsResource = { models: [], ok: false }
const emptyRoutes: AdminAiProviderRoutesResource = { ok: false, routes: [] }
const emptyPricingRules: AdminAiPricingRulesResource = { ok: false, pricingRules: [] }
const emptyRuns: AdminAiRunsResource = { ok: false, runs: [] }
const emptyApiCalls: AdminAiApiCallsResource = { apiCalls: [], ok: false }

export function useAdminAiResources(enabled: boolean, options: AdminAiResourceOptions) {
  const [models, setModels] = useState<AdminAiModelsResource>(emptyModels)
  const [routes, setRoutes] = useState<AdminAiProviderRoutesResource>(emptyRoutes)
  const [pricingRules, setPricingRules] = useState<AdminAiPricingRulesResource>(emptyPricingRules)
  const [runs, setRuns] = useState<AdminAiRunsResource>(emptyRuns)
  const [apiCalls, setApiCalls] = useState<AdminAiApiCallsResource>(emptyApiCalls)
  const [status, setStatus] = useState<AdminAiResourceState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let isCancelled = false

    Promise.allSettled([
      loadAdminAiModels({
        capability: options.modelCapability,
        enabled: options.modelEnabled,
        limit: options.modelLimit,
      }),
      loadAdminAiProviderRoutes({
        enabled: options.routeEnabled,
        limit: options.routeLimit,
        modelKey: options.routeModelKey,
        providerKey: options.routeProviderKey,
      }),
      loadAdminAiPricingRules({
        limit: options.pricingLimit,
        modelKey: options.pricingModelKey,
        status: options.pricingStatus,
        tierKey: options.pricingTierKey,
      }),
      loadAdminAiRuns({
        limit: options.runLimit,
        modelId: options.runModelId,
        runType: options.runType,
        status: options.runStatus,
      }),
      loadAdminAiApiCalls({
        limit: options.apiCallLimit,
        modelId: options.apiCallModelId,
        provider: options.apiCallProvider,
        status: options.apiCallStatus,
      }),
    ]).then((results) => {
      if (isCancelled) return
      const [nextModels, nextModelsError] = resolveResource(results[0], emptyModels, 'Model registry')
      const [nextRoutes, nextRoutesError] = resolveResource(results[1], emptyRoutes, 'Provider routes')
      const [nextPricingRules, nextPricingRulesError] = resolveResource(results[2], emptyPricingRules, 'Pricing rules')
      const [nextRuns, nextRunsError] = resolveResource(results[3], emptyRuns, 'AI runs')
      const [nextApiCalls, nextApiCallsError] = resolveResource(results[4], emptyApiCalls, 'AI API calls')
      const failures = [nextModelsError, nextRoutesError, nextPricingRulesError, nextRunsError, nextApiCallsError].filter(Boolean)

      setModels(nextModels)
      setRoutes(nextRoutes)
      setPricingRules(nextPricingRules)
      setRuns(nextRuns)
      setApiCalls(nextApiCalls)
      setError(failures.length > 0 ? failures.join(' ') : null)
      setStatus(failures.length === results.length ? 'error' : failures.length > 0 ? 'partial' : 'ready')
    })

    return () => {
      isCancelled = true
    }
  }, [
    enabled,
    options.apiCallLimit,
    options.apiCallModelId,
    options.apiCallProvider,
    options.apiCallStatus,
    options.modelCapability,
    options.modelEnabled,
    options.modelLimit,
    options.pricingLimit,
    options.pricingModelKey,
    options.pricingStatus,
    options.pricingTierKey,
    options.routeEnabled,
    options.routeLimit,
    options.routeModelKey,
    options.routeProviderKey,
    options.runLimit,
    options.runModelId,
    options.runStatus,
    options.runType,
    reloadToken,
  ])

  return {
    apiCalls: enabled ? apiCalls : emptyApiCalls,
    error: enabled ? error : null,
    models: enabled ? models : emptyModels,
    pricingRules: enabled ? pricingRules : emptyPricingRules,
    reload: () => setReloadToken((value) => value + 1),
    routes: enabled ? routes : emptyRoutes,
    runs: enabled ? runs : emptyRuns,
    status: enabled ? status : 'ready',
  }
}

function resolveResource<T extends { error?: string; ok: boolean }>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
): [T, null | string] {
  if (result.status === 'rejected') {
    const message = result.reason instanceof Error ? result.reason.message : `${label} failed to load.`
    return [{ ...fallback, error: message }, `${label}: ${message}`]
  }
  if (!result.value.ok && result.value.error) {
    return [result.value, `${label}: ${result.value.error}`]
  }
  return [result.value, null]
}
