'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { loadClientResource, readClientResource } from '@/features/shared/clientResourceCache'

type AdminAiResourceState = 'error' | 'loading' | 'partial' | 'ready'

type AdminAiResourceOptions = {
  apiCallBoardId?: string
  apiCallErrorCode?: string
  apiCallLimit: number
  apiCallModelId?: string
  apiCallProvider?: string
  apiCallPricingRuleId?: string
  apiCallRouteKey?: string
  apiCallRunId?: string
  apiCallStatus?: string
  apiCallWorkspaceId?: string
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
  runBoardId?: string
  runLimit: number
  runModelId?: string
  runPreflightStatus?: string
  runPricingRuleId?: string
  runProvider?: string
  runRouteKey?: string
  runRunId?: string
  runStatus?: string
  runType?: string
  runWorkspaceId?: string
}

const emptyModels: AdminAiModelsResource = { models: [], ok: false }
const emptyRoutes: AdminAiProviderRoutesResource = { ok: false, routes: [] }
const emptyPricingRules: AdminAiPricingRulesResource = { ok: false, pricingRules: [] }
const emptyRuns: AdminAiRunsResource = { ok: false, runs: [] }
const emptyApiCalls: AdminAiApiCallsResource = { apiCalls: [], ok: false }
const adminAiResourceMaxEntries = 16
type AdminAiBundle = {
  apiCalls: AdminAiApiCallsResource
  error: null | string
  models: AdminAiModelsResource
  pricingRules: AdminAiPricingRulesResource
  routes: AdminAiProviderRoutesResource
  runs: AdminAiRunsResource
  status: AdminAiResourceState
}
const adminAiResourceStore = new Map<string, {
  data?: AdminAiBundle
  error?: string | null
  promise?: Promise<AdminAiBundle>
  updatedAt: number
}>()

export function useAdminAiResources(enabled: boolean, options: AdminAiResourceOptions) {
  const requestOptions = useMemo(() => ({
    apiCallBoardId: options.apiCallBoardId,
    apiCallErrorCode: options.apiCallErrorCode,
    apiCallLimit: options.apiCallLimit,
    apiCallModelId: options.apiCallModelId,
    apiCallPricingRuleId: options.apiCallPricingRuleId,
    apiCallProvider: options.apiCallProvider,
    apiCallRouteKey: options.apiCallRouteKey,
    apiCallRunId: options.apiCallRunId,
    apiCallStatus: options.apiCallStatus,
    apiCallWorkspaceId: options.apiCallWorkspaceId,
    modelCapability: options.modelCapability,
    modelEnabled: options.modelEnabled,
    modelLimit: options.modelLimit,
    pricingLimit: options.pricingLimit,
    pricingModelKey: options.pricingModelKey,
    pricingStatus: options.pricingStatus,
    pricingTierKey: options.pricingTierKey,
    routeEnabled: options.routeEnabled,
    routeLimit: options.routeLimit,
    routeModelKey: options.routeModelKey,
    routeProviderKey: options.routeProviderKey,
    runBoardId: options.runBoardId,
    runLimit: options.runLimit,
    runModelId: options.runModelId,
    runPreflightStatus: options.runPreflightStatus,
    runPricingRuleId: options.runPricingRuleId,
    runProvider: options.runProvider,
    runRouteKey: options.runRouteKey,
    runRunId: options.runRunId,
    runStatus: options.runStatus,
    runType: options.runType,
    runWorkspaceId: options.runWorkspaceId,
  }), [
    options.apiCallBoardId,
    options.apiCallErrorCode,
    options.apiCallLimit,
    options.apiCallModelId,
    options.apiCallPricingRuleId,
    options.apiCallProvider,
    options.apiCallRouteKey,
    options.apiCallRunId,
    options.apiCallStatus,
    options.apiCallWorkspaceId,
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
    options.runBoardId,
    options.runLimit,
    options.runModelId,
    options.runPreflightStatus,
    options.runPricingRuleId,
    options.runProvider,
    options.runRouteKey,
    options.runRunId,
    options.runStatus,
    options.runType,
    options.runWorkspaceId,
  ])
  const requestKey = useMemo(() => JSON.stringify(requestOptions), [requestOptions])
  const snapshot = readClientResource(adminAiResourceStore, requestKey, {
    maxEntries: adminAiResourceMaxEntries,
    storage: 'session',
    storageKey: aiStorageKey(requestKey),
    storagePrefix: 'tanergy.admin-ai.',
    ttlMs: 300_000,
  })
  const [models, setModels] = useState<AdminAiModelsResource>(snapshot.data?.models ?? emptyModels)
  const [routes, setRoutes] = useState<AdminAiProviderRoutesResource>(snapshot.data?.routes ?? emptyRoutes)
  const [pricingRules, setPricingRules] = useState<AdminAiPricingRulesResource>(snapshot.data?.pricingRules ?? emptyPricingRules)
  const [runs, setRuns] = useState<AdminAiRunsResource>(snapshot.data?.runs ?? emptyRuns)
  const [apiCalls, setApiCalls] = useState<AdminAiApiCallsResource>(snapshot.data?.apiCalls ?? emptyApiCalls)
  const [status, setStatus] = useState<AdminAiResourceState>(snapshot.data?.status ?? (snapshot.error ? 'error' : 'loading'))
  const [error, setError] = useState<string | null>(snapshot.data?.error ?? snapshot.error ?? null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let isCancelled = false

    loadClientResource(
      adminAiResourceStore,
      requestKey,
      async () => {
        const results = await Promise.allSettled([
          loadAdminAiModels({
            capability: requestOptions.modelCapability,
            enabled: requestOptions.modelEnabled,
            limit: requestOptions.modelLimit,
          }),
          loadAdminAiProviderRoutes({
            enabled: requestOptions.routeEnabled,
            limit: requestOptions.routeLimit,
            modelKey: requestOptions.routeModelKey,
            providerKey: requestOptions.routeProviderKey,
          }),
          loadAdminAiPricingRules({
            limit: requestOptions.pricingLimit,
            modelKey: requestOptions.pricingModelKey,
            status: requestOptions.pricingStatus,
            tierKey: requestOptions.pricingTierKey,
          }),
          loadAdminAiRuns({
            boardId: requestOptions.runBoardId,
            limit: requestOptions.runLimit,
            modelId: requestOptions.runModelId,
            preflightStatus: requestOptions.runPreflightStatus,
            pricingRuleId: requestOptions.runPricingRuleId,
            provider: requestOptions.runProvider,
            routeKey: requestOptions.runRouteKey,
            runId: requestOptions.runRunId,
            runType: requestOptions.runType,
            status: requestOptions.runStatus,
            workspaceId: requestOptions.runWorkspaceId,
          }),
          loadAdminAiApiCalls({
            boardId: requestOptions.apiCallBoardId,
            errorCode: requestOptions.apiCallErrorCode,
            limit: requestOptions.apiCallLimit,
            modelId: requestOptions.apiCallModelId,
            provider: requestOptions.apiCallProvider,
            pricingRuleId: requestOptions.apiCallPricingRuleId,
            routeKey: requestOptions.apiCallRouteKey,
            runId: requestOptions.apiCallRunId,
            status: requestOptions.apiCallStatus,
            workspaceId: requestOptions.apiCallWorkspaceId,
          }),
        ])
        const [nextModels, nextModelsError] = resolveResource(results[0], emptyModels, 'Model registry')
        const [nextRoutes, nextRoutesError] = resolveResource(results[1], emptyRoutes, 'Provider routes')
        const [nextPricingRules, nextPricingRulesError] = resolveResource(results[2], emptyPricingRules, 'Pricing rules')
        const [nextRuns, nextRunsError] = resolveResource(results[3], emptyRuns, 'AI runs')
        const [nextApiCalls, nextApiCallsError] = resolveResource(results[4], emptyApiCalls, 'AI API calls')
        const failures = [nextModelsError, nextRoutesError, nextPricingRulesError, nextRunsError, nextApiCallsError].filter(Boolean)
        return {
          apiCalls: nextApiCalls,
          error: failures.length > 0 ? failures.join(' ') : null,
          models: nextModels,
          pricingRules: nextPricingRules,
          routes: nextRoutes,
          runs: nextRuns,
          status: failures.length === results.length ? 'error' : failures.length > 0 ? 'partial' : 'ready',
        } satisfies AdminAiBundle
      },
      {
        force: reloadToken > 0,
        maxEntries: adminAiResourceMaxEntries,
        storage: 'session',
        storageKey: aiStorageKey(requestKey),
        storagePrefix: 'tanergy.admin-ai.',
        ttlMs: 300_000,
      },
    ).then((bundle) => {
      if (isCancelled) return
      setModels(bundle.models)
      setRoutes(bundle.routes)
      setPricingRules(bundle.pricingRules)
      setRuns(bundle.runs)
      setApiCalls(bundle.apiCalls)
      setError(bundle.error)
      setStatus(bundle.status)
    })

    return () => {
      isCancelled = true
    }
  }, [
    enabled,
    requestKey,
    requestOptions,
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

function aiStorageKey(requestKey: string) {
  return `tanergy.admin-ai.${requestKey}`
}
