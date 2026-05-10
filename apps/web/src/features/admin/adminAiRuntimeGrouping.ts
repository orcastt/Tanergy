'use client'

import type { AdminAiApiCallRecord, AdminAiProviderRouteRecord, AdminAiRunRecord } from './adminAiClient'

export type GroupedApiAttempt = {
  attempts: Array<AdminAiApiCallRecord & { attemptNumber: number; isFinalAttempt: boolean }>
  finalAttemptNumber: number
  finalStatus: string
  run?: AdminAiRunRecord
  runId: string
  succeededAttemptNumber: null | number
}

export type RouteRuntimeSummary = {
  averageAttemptsPerRun: number
  directWinRate: null | number
  directWins: number
  fallbackWins: number
  lastRouteHitAt: null | string
  observedAttempts: number
  routeAttemptSuccessRate: null | number
  routeHitRuns: number
  terminalFailures: number
}

export function groupApiCallsByRun(apiCalls: AdminAiApiCallRecord[], runs: AdminAiRunRecord[]): GroupedApiAttempt[] {
  const groups = new Map<string, AdminAiApiCallRecord[]>()
  for (const apiCall of apiCalls) {
    const current = groups.get(apiCall.runId)
    if (current) current.push(apiCall)
    else groups.set(apiCall.runId, [apiCall])
  }
  return Array.from(groups.entries())
    .map(([runId, attempts]) => {
      const sortedAttempts = [...attempts].sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime()
        const rightTime = new Date(right.createdAt).getTime()
        return leftTime !== rightTime ? leftTime - rightTime : parseAttemptNumber(left.id) - parseAttemptNumber(right.id)
      })
      const finalAttemptNumber = parseAttemptNumber(sortedAttempts[sortedAttempts.length - 1]?.id ?? '')
      const finalStatus = sortedAttempts[sortedAttempts.length - 1]?.status ?? 'unknown'
      return {
        attempts: sortedAttempts.map((attempt) => ({
          ...attempt,
          attemptNumber: parseAttemptNumber(attempt.id),
          isFinalAttempt: parseAttemptNumber(attempt.id) === finalAttemptNumber,
        })),
        finalAttemptNumber,
        finalStatus,
        run: runs.find((run) => run.id === runId),
        runId,
        succeededAttemptNumber: finalStatus === 'succeeded' ? finalAttemptNumber : null,
      }
    })
    .sort(
      (left, right) =>
        new Date(right.attempts[right.attempts.length - 1]?.createdAt ?? '').getTime() -
        new Date(left.attempts[left.attempts.length - 1]?.createdAt ?? '').getTime(),
    )
}

export function routeMatchesApiCall(route: AdminAiProviderRouteRecord, attempt: AdminAiApiCallRecord) {
  if (attempt.routeId && attempt.routeId === route.routeId) return true
  return !attempt.routeId && attempt.routeKey === route.routeKey && attempt.provider === route.providerKey
}

export function routeMatchesRun(route: AdminAiProviderRouteRecord, run: AdminAiRunRecord) {
  if (run.routeId && run.routeId === route.routeId) return true
  return !run.routeId && run.routeKey === route.routeKey && run.provider === route.providerKey
}

export function buildRouteRuntimeSummary(
  route: AdminAiProviderRouteRecord,
  apiCalls: AdminAiApiCallRecord[],
  runs: AdminAiRunRecord[],
): RouteRuntimeSummary {
  const groupedAttempts = groupApiCallsByRun(apiCalls, runs)
  const observedAttempts = apiCalls.length
  const routeHitRuns = groupedAttempts.length
  const recentRuns = runs.length
  const directWins = runs.filter((run) => run.status === 'succeeded' && routeMatchesRun(route, run)).length
  const fallbackWins = runs.filter((run) => run.status === 'succeeded' && !routeMatchesRun(route, run)).length
  const terminalFailures = runs.filter((run) => run.status !== 'succeeded').length
  const routeAttemptSuccesses = apiCalls.filter((apiCall) => apiCall.status === 'succeeded').length
  return {
    averageAttemptsPerRun: routeHitRuns ? observedAttempts / routeHitRuns : 0,
    directWinRate: recentRuns ? (directWins / recentRuns) * 100 : null,
    directWins,
    fallbackWins,
    lastRouteHitAt: resolveLatestRouteHitAt(apiCalls),
    observedAttempts,
    routeAttemptSuccessRate: observedAttempts ? (routeAttemptSuccesses / observedAttempts) * 100 : null,
    routeHitRuns,
    terminalFailures,
  }
}

function parseAttemptNumber(id: string) {
  const match = /_a(\d+)$/.exec(id)
  return match ? Number(match[1]) : 1
}

function resolveLatestRouteHitAt(apiCalls: AdminAiApiCallRecord[]) {
  let latestAt: null | string = null
  let latestTime = Number.NEGATIVE_INFINITY
  for (const apiCall of apiCalls) {
    const nextTime = new Date(apiCall.createdAt).getTime()
    if (Number.isNaN(nextTime) || nextTime <= latestTime) continue
    latestTime = nextTime
    latestAt = apiCall.createdAt
  }
  return latestAt
}
