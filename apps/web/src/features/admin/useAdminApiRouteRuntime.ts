'use client'

import { useEffect, useState } from 'react'
import {
  loadAdminAiApiCalls,
  type AdminAiApiCallsResource,
  loadAdminAiRuns,
  type AdminAiRunsResource,
  loadAdminAiRouteMetrics,
  type AdminAiRouteMetricsResource,
} from './adminAiClient'

const emptyRouteMetricTotals = {
  averageAttemptsPerRun: 0,
  calls: 0,
  creditsCharged: 0,
  directWinRate: 0,
  directWins: 0,
  failedCalls: 0,
  fallbackWins: 0,
  providerCost: 0,
  routeAttemptSuccessRate: 0,
  routeHitRuns: 0,
  succeededCalls: 0,
  terminalFailures: 0,
}

export function useAdminRouteMetrics(enabled: boolean, limit: number) {
  const [metrics, setMetrics] = useState<AdminAiRouteMetricsResource>({
    metrics: [],
    ok: false,
    totals: emptyRouteMetricTotals,
  })
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>('loading')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadAdminAiRouteMetrics({ limit })
      .then((payload) => {
        if (cancelled) return
        setMetrics(payload)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setMetrics({
          error: error instanceof Error ? error.message : 'AI route metrics failed to load.',
          metrics: [],
          ok: false,
          totals: emptyRouteMetricTotals,
        })
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, limit, reloadToken])

  return { ...metrics, reload: () => setReloadToken((value) => value + 1), status }
}

export function useSelectedRouteApiCalls({
  enabled,
  limit,
  providerKey,
  routeId,
  routeKey,
}: {
  enabled: boolean
  limit: number
  providerKey: null | string
  routeId: null | string
  routeKey: null | string
}) {
  const [resource, setResource] = useState<AdminAiApiCallsResource>({ apiCalls: [], ok: true })
  const [resolvedKey, setResolvedKey] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = enabled && routeId ? JSON.stringify({ limit, providerKey, reloadToken, routeId, routeKey }) : ''

  useEffect(() => {
    if (!enabled || !routeId) return
    let cancelled = false
    loadAdminAiApiCalls({
      limit,
      provider: providerKey || undefined,
      routeId,
      routeKey: routeKey || undefined,
    })
      .then((payload) => {
        if (cancelled) return
        setResource(payload)
        setResolvedKey(requestKey)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResource({
          apiCalls: [],
          error: error instanceof Error ? error.message : 'Route API calls failed to load.',
          ok: false,
        })
        setResolvedKey(requestKey)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, limit, providerKey, requestKey, routeId, routeKey])

  if (!enabled || !routeId) {
    return { apiCalls: [], error: undefined, ok: true, reload: () => setReloadToken((value) => value + 1), status: 'ready' as const }
  }

  const isResolved = resolvedKey === requestKey
  return {
    apiCalls: isResolved ? resource.apiCalls : [],
    error: isResolved ? resource.error : undefined,
    ok: isResolved ? resource.ok : true,
    reload: () => setReloadToken((value) => value + 1),
    status: isResolved ? (resource.ok ? 'ready' : 'error') : 'loading',
  }
}

export function useSelectedRouteRuns({
  enabled,
  limit,
  providerKey,
  routeId,
  routeKey,
}: {
  enabled: boolean
  limit: number
  providerKey: null | string
  routeId: null | string
  routeKey: null | string
}): {
  error?: string
  ok: boolean
  reload: () => void
  runs: AdminAiRunsResource['runs']
  status: 'error' | 'loading' | 'ready'
} {
  const [resource, setResource] = useState<AdminAiRunsResource>({ ok: true, runs: [] })
  const [resolvedKey, setResolvedKey] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = enabled && routeId ? JSON.stringify({ limit, providerKey, reloadToken, routeId, routeKey }) : ''

  useEffect(() => {
    if (!enabled || !routeId) return
    let cancelled = false
    loadAdminAiRuns({
      limit,
      provider: providerKey || undefined,
      routeId,
      routeKey: routeKey || undefined,
    })
      .then((payload) => {
        if (cancelled) return
        setResource(payload)
        setResolvedKey(requestKey)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResource({
          error: error instanceof Error ? error.message : 'Route runs failed to load.',
          ok: false,
          runs: [],
        })
        setResolvedKey(requestKey)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, limit, providerKey, requestKey, routeId, routeKey])

  if (!enabled || !routeId) {
    return { error: undefined, ok: true, reload: () => setReloadToken((value) => value + 1), runs: [], status: 'ready' as const }
  }

  const isResolved = resolvedKey === requestKey
  return {
    error: isResolved ? resource.error : undefined,
    ok: isResolved ? resource.ok : true,
    reload: () => setReloadToken((value) => value + 1),
    runs: isResolved ? resource.runs : [],
    status: isResolved ? (resource.ok ? 'ready' : 'error') : 'loading',
  }
}

export function useSelectedRunApiCalls({
  enabled,
  limit = 40,
  runId,
}: {
  enabled: boolean
  limit?: number
  runId: null | string
}): {
  apiCalls: AdminAiApiCallsResource['apiCalls']
  error?: string
  ok: boolean
  reload: () => void
  status: 'error' | 'loading' | 'ready'
} {
  const [resource, setResource] = useState<AdminAiApiCallsResource>({ apiCalls: [], ok: true })
  const [resolvedKey, setResolvedKey] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = enabled && runId ? JSON.stringify({ limit, reloadToken, runId }) : ''

  useEffect(() => {
    if (!enabled || !runId) return
    let cancelled = false
    loadAdminAiApiCalls({ limit, runId })
      .then((payload) => {
        if (cancelled) return
        setResource(payload)
        setResolvedKey(requestKey)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResource({
          apiCalls: [],
          error: error instanceof Error ? error.message : 'Run attempts failed to load.',
          ok: false,
        })
        setResolvedKey(requestKey)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, limit, requestKey, runId])

  if (!enabled || !runId) {
    return { apiCalls: [], error: undefined, ok: true, reload: () => setReloadToken((value) => value + 1), status: 'ready' as const }
  }

  const isResolved = resolvedKey === requestKey
  return {
    apiCalls: isResolved ? resource.apiCalls : [],
    error: isResolved ? resource.error : undefined,
    ok: isResolved ? resource.ok : true,
    reload: () => setReloadToken((value) => value + 1),
    status: isResolved ? (resource.ok ? 'ready' : 'error') : 'loading',
  }
}
