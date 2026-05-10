'use client'

import { useMemo } from 'react'
import type { AdminAiApiCallRecord, AdminAiProviderRouteRecord, AdminAiRunRecord } from './adminAiClient'
import { buildRouteRuntimeSummary, groupApiCallsByRun, routeMatchesApiCall, routeMatchesRun } from './adminAiRuntimeGrouping'
import { EmptyRow, MetaLine, formatCompactDateTime, formatNumber, truncate } from './adminAiShared'
import { useSelectedRunApiCalls } from './useAdminApiRouteRuntime'

export function AdminRouteRuntimeDetail({
  onSelectRun,
  route,
  routeApiCalls,
  routeRuns,
  routeRunsError,
  routeRunsStatus,
  selectedRunId,
}: {
  onSelectRun: (value: string) => void
  route: AdminAiProviderRouteRecord
  routeApiCalls: AdminAiApiCallRecord[]
  routeRuns: AdminAiRunRecord[]
  routeRunsError?: string
  routeRunsStatus: 'error' | 'loading' | 'ready'
  selectedRunId: string
}) {
  const resolvedSelectedRunId = routeRuns.some((run) => run.id === selectedRunId) ? selectedRunId : ''
  const selectedRun = routeRuns.find((run) => run.id === resolvedSelectedRunId) ?? null
  const routeHitCountByRun = useMemo(() => countRouteHitsByRun(routeApiCalls), [routeApiCalls])
  const runtimeSummary = useMemo(() => buildRouteRuntimeSummary(route, routeApiCalls, routeRuns), [route, routeApiCalls, routeRuns])
  const selectedRunApiCalls = useSelectedRunApiCalls({
    enabled: Boolean(selectedRun),
    runId: selectedRun?.id ?? null,
  })
  const selectedRunAttemptGroup = useMemo(() => {
    if (!selectedRun) return null
    return groupApiCallsByRun(selectedRunApiCalls.apiCalls, [selectedRun])[0] ?? null
  }, [selectedRun, selectedRunApiCalls.apiCalls])
  const runtimeStatus = routeRunsStatus === 'error' || selectedRunApiCalls.status === 'error'
    ? 'error'
    : routeRunsStatus === 'loading' || (selectedRun && selectedRunApiCalls.status === 'loading')
      ? 'loading'
      : 'ready'

  return (
    <section className="admin-route-release-shell" aria-label="Route runtime detail">
      <div className="management-panel-heading compact">
        <div><h2>Recent runs</h2></div>
        <span className={`management-status ${runtimeStatus === 'ready' ? 'is-success' : ''}`}>{runtimeStatus}</span>
      </div>
      {routeRunsError ? <span className="management-inline-note">{routeRunsError}</span> : null}
      <div className="admin-route-runtime-summary admin-route-runtime-overview">
        <RuntimeFact detail={`${runtimeSummary.observedAttempts} attempts across ${runtimeSummary.routeHitRuns} runs`} label="Observed runs" value={String(runtimeSummary.routeHitRuns)} />
        <RuntimeFact detail={runtimeSummary.directWinRate == null ? 'No recent final run data' : `${formatNumber(runtimeSummary.directWinRate)}% win rate`} label="Direct wins" value={String(runtimeSummary.directWins)} />
        <RuntimeFact detail="Another route/provider finished the run" label="Fallback away" value={String(runtimeSummary.fallbackWins)} />
        <RuntimeFact detail="Run ended failed, blocked or canceled" label="Terminal failures" value={String(runtimeSummary.terminalFailures)} />
        <RuntimeFact detail={runtimeSummary.routeAttemptSuccessRate == null ? 'No route attempts in window' : `${formatNumber(runtimeSummary.routeAttemptSuccessRate)}% attempt success`} label="Attempts / run" value={runtimeSummary.routeHitRuns ? formatNumber(runtimeSummary.averageAttemptsPerRun) : '-'} />
        <RuntimeFact detail={routeRuns.length ? `${routeRuns.filter((run) => routeMatchesRun(route, run)).length} current winners in recent finals` : 'No recent finals yet'} label="Last route hit" value={formatCompactDateTime(runtimeSummary.lastRouteHitAt)} />
      </div>
      <div className="management-table-wrap">
        <table className="management-table compact admin-route-run-table">
          <thead><tr><th>Run</th><th>Actor / workspace</th><th>Status</th><th>Route hits</th><th>Updated</th><th>Manage</th></tr></thead>
          <tbody>
            {routeRunsStatus === 'loading' ? <EmptyRow colSpan={6} message="Loading route runs..." /> : null}
            {routeRunsStatus !== 'loading' && routeRuns.length ? routeRuns.map((run) => (
              <tr className={run.id === resolvedSelectedRunId ? 'is-selected' : undefined} key={run.id}>
                <td>
                  <strong>{run.id}</strong>
                  <MetaLine>{run.modelId}</MetaLine>
                  <MetaLine>{truncate(run.promptPreview)}</MetaLine>
                </td>
                <td>
                  {run.userId ?? 'Unknown actor'}
                  <MetaLine>{run.workspaceId ?? 'No workspace'}</MetaLine>
                  <MetaLine>{run.boardId ?? 'No board'}</MetaLine>
                </td>
                <td>
                  <span className={`management-status ${run.status === 'succeeded' ? 'is-success' : ''}`}>{run.status}</span>
                  <MetaLine>{run.preflightStatus ?? 'No preflight state'}</MetaLine>
                  <MetaLine>{routeMatchesRun(route, run) ? 'Selected route won' : `Winner: ${run.routeKey ?? run.routeId ?? run.provider}`}</MetaLine>
                </td>
                <td>
                  {routeHitCountByRun.get(run.id) ?? 0}
                  <MetaLine>{formatNumber(run.costCredits)} charged</MetaLine>
                </td>
                <td>
                  {formatCompactDateTime(run.updatedAt)}
                  <MetaLine>{run.latencyMs.toLocaleString('en-US')} ms</MetaLine>
                </td>
                <td>
                  <button className="product-button product-button-secondary admin-table-button" onClick={() => onSelectRun(run.id === resolvedSelectedRunId ? '' : run.id)} type="button">
                    {run.id === resolvedSelectedRunId ? 'Hide' : 'Inspect'}
                  </button>
                </td>
              </tr>
            )) : null}
            {routeRunsStatus !== 'loading' && !routeRuns.length ? <EmptyRow colSpan={6} message="No runs recorded for this route." /> : null}
          </tbody>
        </table>
      </div>
      {selectedRun ? (
        <RouteRunAttemptPanel
          attemptError={selectedRunApiCalls.error}
          attemptGroup={selectedRunAttemptGroup}
          attemptStatus={selectedRunApiCalls.status}
          route={route}
          run={selectedRun}
        />
      ) : routeRunsStatus !== 'loading' && routeRuns.length ? <span className="management-inline-note">Select a run from either panel to inspect attempts.</span> : null}
    </section>
  )
}

function RouteRunAttemptPanel({
  attemptError,
  attemptGroup,
  attemptStatus,
  route,
  run,
}: {
  attemptError?: string
  attemptGroup: ReturnType<typeof groupApiCallsByRun>[number] | null
  attemptStatus: 'error' | 'loading' | 'ready'
  route: AdminAiProviderRouteRecord
  run: AdminAiRunRecord
}) {
  const selectedRouteAttemptNumbers = attemptGroup
    ? attemptGroup.attempts.filter((attempt) => routeMatchesApiCall(route, attempt)).map((attempt) => attempt.attemptNumber)
    : []
  const selectedRouteAttemptsText = selectedRouteAttemptNumbers.length ? selectedRouteAttemptNumbers.join(', ') : '-'

  return (
    <div className="admin-route-runtime-stack">
      <div className="management-panel-heading compact">
        <div><h2>Run attempts</h2><MetaLine>{run.id}</MetaLine></div>
        <span className={`management-status ${attemptStatus === 'ready' ? 'is-success' : ''}`}>{attemptStatus}</span>
      </div>
      {attemptError ? <span className="management-inline-note">{attemptError}</span> : null}
      <div className="admin-route-runtime-summary">
        <RuntimeFact label="Model" value={run.modelId} />
        <RuntimeFact label="Provider" value={run.provider} />
        <RuntimeFact label="Final status" value={attemptGroup?.finalStatus ?? run.status} />
        <RuntimeFact label="Selected route attempts" value={selectedRouteAttemptsText} />
      </div>
      <div className="management-table-wrap">
        <table className="management-table compact admin-route-attempt-table">
          <thead><tr><th>Attempt</th><th>Route</th><th>Status</th><th>Credits</th><th>Created</th></tr></thead>
          <tbody>
            {attemptStatus === 'loading' ? <EmptyRow colSpan={5} message="Loading run attempts..." /> : null}
            {attemptStatus !== 'loading' && attemptGroup?.attempts.length ? attemptGroup.attempts.map((attempt) => (
              <tr className={routeMatchesApiCall(route, attempt) ? 'is-selected-route' : undefined} key={attempt.id}>
                <td>
                  <strong>Attempt {attempt.attemptNumber}</strong>
                  <MetaLine>{attempt.id}</MetaLine>
                </td>
                <td>
                  {attempt.routeKey ?? attempt.routeId ?? 'No route'}
                  <MetaLine>{attempt.provider} · {attempt.modelId}</MetaLine>
                  <MetaLine>{routeMatchesApiCall(route, attempt) ? 'Selected route' : 'Other route'}</MetaLine>
                </td>
                <td>
                  <span className={`management-status ${attempt.status === 'succeeded' ? 'is-success' : ''}`}>{attempt.status}</span>
                  <MetaLine>{attempt.isFinalAttempt ? (attemptGroup.succeededAttemptNumber === attempt.attemptNumber ? 'Final winner' : 'Final attempt') : 'Intermediate attempt'}</MetaLine>
                  <MetaLine>{attempt.errorCode ?? 'No provider error'}</MetaLine>
                </td>
                <td>
                  {formatNumber(attempt.creditsCharged)} charged
                  <MetaLine>{formatNumber(attempt.creditsRefunded)} refunded</MetaLine>
                  <MetaLine>{attempt.providerCost == null ? 'Provider cost pending' : `${formatMoney(attempt.providerCost)} ${attempt.providerCurrency ?? 'USD'}`}</MetaLine>
                </td>
                <td>
                  {formatCompactDateTime(attempt.createdAt)}
                  <MetaLine>{attempt.latencyMs.toLocaleString('en-US')} ms</MetaLine>
                </td>
              </tr>
            )) : null}
            {attemptStatus !== 'loading' && !attemptGroup?.attempts.length ? <EmptyRow colSpan={5} message="No attempt records for this run." /> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RuntimeFact({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <div className="admin-route-runtime-fact">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  )
}

function countRouteHitsByRun(apiCalls: AdminAiApiCallRecord[]) {
  const counts = new Map<string, number>()
  for (const apiCall of apiCalls) counts.set(apiCall.runId, (counts.get(apiCall.runId) ?? 0) + 1)
  return counts
}

function formatMoney(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`
}
