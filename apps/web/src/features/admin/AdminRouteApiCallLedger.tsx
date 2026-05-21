'use client'

import { Fragment, useMemo } from 'react'
import type { AdminAiApiCallRecord, AdminAiProviderRouteRecord, AdminAiRunRecord } from './adminAiClient'
import { groupApiCallsByRun, routeMatchesApiCall, routeMatchesRun, type GroupedApiAttempt } from './adminAiRuntimeGrouping'
import { EmptyRow, MetaLine, formatCompactDateTime, formatNumber, truncate } from './adminAiShared'
import { useSelectedRunApiCalls } from './useAdminApiRouteRuntime'

export function AdminRouteApiCallLedger({
  apiCalls,
  onSelectRun,
  route,
  routeRuns,
  selectedRunId,
}: {
  apiCalls: AdminAiApiCallRecord[]
  onSelectRun: (value: string) => void
  route: AdminAiProviderRouteRecord
  routeRuns: AdminAiRunRecord[]
  selectedRunId: string
}) {
  const groupedApiCalls = useMemo(() => groupApiCallsByRun(apiCalls, routeRuns), [apiCalls, routeRuns])
  const resolvedSelectedRunId = groupedApiCalls.some((group) => group.runId === selectedRunId) ? selectedRunId : ''
  const selectedSummaryGroup = groupedApiCalls.find((group) => group.runId === resolvedSelectedRunId) ?? null
  const selectedRun = selectedSummaryGroup?.run ?? routeRuns.find((run) => run.id === resolvedSelectedRunId) ?? null
  const selectedRunApiCalls = useSelectedRunApiCalls({
    enabled: Boolean(resolvedSelectedRunId),
    runId: resolvedSelectedRunId || null,
  })
  const selectedAttemptGroup = useMemo(() => {
    if (!resolvedSelectedRunId) return null
    return groupApiCallsByRun(selectedRunApiCalls.apiCalls, selectedRun ? [selectedRun] : [])[0] ?? null
  }, [resolvedSelectedRunId, selectedRun, selectedRunApiCalls.apiCalls])

  return (
    <div className="management-table-wrap">
      <table className="management-table compact admin-route-ledger-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Actor / workspace</th>
            <th>Final</th>
            <th>Route hits</th>
            <th>Credits</th>
            <th>Cost</th>
            <th>Latest</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          {groupedApiCalls.length ? groupedApiCalls.map((group) => {
            const latestRouteAttempt = group.attempts[group.attempts.length - 1]
            const routeAttemptNumbers = group.attempts.map((attempt) => attempt.attemptNumber).join(', ')
            const selectedRouteCredits = sumCredits(group.attempts)
            const selectedRouteRefunded = sumRefunds(group.attempts)
            const selectedRouteCost = sumProviderCost(group.attempts)
            const runStatus = group.run?.status ?? group.finalStatus
            const isExpanded = group.runId === resolvedSelectedRunId
            return (
              <Fragment key={group.runId}>
                <tr className={isExpanded ? 'is-selected' : undefined}>
                  <td>
                    <strong>{group.runId}</strong>
                    <MetaLine>{group.run?.modelId ?? latestRouteAttempt?.modelId ?? 'Unknown model'}</MetaLine>
                    <MetaLine>{group.run?.promptPreview ? truncate(group.run.promptPreview) : (latestRouteAttempt?.routeKey ?? latestRouteAttempt?.routeId ?? 'No route')}</MetaLine>
                  </td>
                  <td>
                    {group.run?.userId ?? latestRouteAttempt?.userId ?? 'Unknown actor'}
                    <MetaLine>{group.run?.workspaceId ?? latestRouteAttempt?.workspaceId ?? 'No workspace'}</MetaLine>
                    <MetaLine>{group.run?.boardId ?? latestRouteAttempt?.boardId ?? 'No board'}</MetaLine>
                  </td>
                  <td>
                    <span className={`management-status ${runStatus === 'succeeded' ? 'is-success' : ''}`}>{runStatus}</span>
                    <MetaLine>{group.run?.preflightStatus ?? 'No preflight state'}</MetaLine>
                    <MetaLine>{describeRunOutcome(route, group)}</MetaLine>
                  </td>
                  <td>
                    {group.attempts.length}
                    <MetaLine>Attempts {routeAttemptNumbers}</MetaLine>
                    <MetaLine>{latestRouteAttempt ? `${latestRouteAttempt.provider} · ${latestRouteAttempt.modelId}` : 'No route hits'}</MetaLine>
                  </td>
                  <td>
                    {formatNumber(group.run?.costCredits ?? selectedRouteCredits)} charged
                    <MetaLine>{formatNumber(selectedRouteCredits)} route</MetaLine>
                    <MetaLine>{formatNumber(selectedRouteRefunded)} refunded</MetaLine>
                  </td>
                  <td>
                    {formatCost(group.run?.providerCost ?? selectedRouteCost, group.run?.providerCurrency ?? latestRouteAttempt?.providerCurrency)}
                    <MetaLine>{selectedRouteCost == null ? 'Route cost pending' : `${formatCost(selectedRouteCost, latestRouteAttempt?.providerCurrency)} route`}</MetaLine>
                  </td>
                  <td>
                    {formatCompactDateTime(latestRouteAttempt?.createdAt)}
                    <MetaLine>{group.run ? `Run updated ${formatCompactDateTime(group.run.updatedAt)}` : 'Run detail outside window'}</MetaLine>
                    <MetaLine>{latestRouteAttempt?.latencyMs.toLocaleString('en-US') ?? '0'} ms route hit</MetaLine>
                  </td>
                  <td>
                    <button
                      className="product-button product-button-secondary admin-table-button"
                      onClick={() => onSelectRun(isExpanded ? '' : group.runId)}
                      type="button"
                    >
                      {isExpanded ? 'Hide' : 'Inspect'}
                    </button>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="admin-route-ledger-expanded-row">
                    <td colSpan={8}>
                      <AdminRouteApiCallLedgerDetail
                        attemptError={selectedRunApiCalls.error}
                        attemptGroup={selectedAttemptGroup}
                        attemptStatus={selectedRunApiCalls.status}
                        route={route}
                        summaryGroup={group}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          }) : <EmptyRow colSpan={8} message="No API call records match the selected route." />}
        </tbody>
      </table>
    </div>
  )
}

function AdminRouteApiCallLedgerDetail({
  attemptError,
  attemptGroup,
  attemptStatus,
  route,
  summaryGroup,
}: {
  attemptError?: string
  attemptGroup: GroupedApiAttempt | null
  attemptStatus: 'error' | 'loading' | 'ready'
  route: AdminAiProviderRouteRecord
  summaryGroup: GroupedApiAttempt
}) {
  const detailGroup = attemptStatus === 'ready' ? attemptGroup : null
  const selectedRouteAttempts = summaryGroup.attempts
    .filter((attempt) => routeMatchesApiCall(route, attempt))
    .map((attempt) => attempt.attemptNumber)
  const winningAttempt = detailGroup?.succeededAttemptNumber == null
    ? null
    : detailGroup.attempts.find((attempt) => attempt.attemptNumber === detailGroup.succeededAttemptNumber) ?? null

  return (
    <div className="admin-route-ledger-detail">
      <div className="management-panel-heading compact">
        <div>
          <h2>Run attempts</h2>
          <MetaLine>{summaryGroup.runId}</MetaLine>
        </div>
        <span className={`management-status ${attemptStatus === 'ready' ? 'is-success' : ''}`}>{attemptStatus}</span>
      </div>
      {attemptError ? <span className="management-inline-note">{attemptError}</span> : null}
      <div className="admin-route-runtime-summary admin-route-ledger-summary">
        <RuntimeFact label="Final status" value={detailGroup?.finalStatus ?? (summaryGroup.run?.status ?? summaryGroup.finalStatus)} />
        <RuntimeFact label="Total attempts" value={detailGroup ? String(detailGroup.attempts.length) : '-'} />
        <RuntimeFact label="Selected route" value={selectedRouteAttempts.length ? selectedRouteAttempts.join(', ') : '-'} />
        <RuntimeFact label="Winner" value={winningAttempt ? `${winningAttempt.routeKey ?? winningAttempt.routeId ?? 'No route'} · ${winningAttempt.provider}` : 'No winner'} />
      </div>
      <div className="management-table-wrap">
        <table className="management-table compact admin-route-attempt-table">
          <thead><tr><th>Attempt</th><th>Route</th><th>Status</th><th>Credits</th><th>Created</th></tr></thead>
          <tbody>
            {attemptStatus === 'loading' ? <EmptyRow colSpan={5} message="Loading run attempts..." /> : null}
            {attemptStatus !== 'loading' && detailGroup?.attempts.length ? detailGroup.attempts.map((attempt) => (
              <tr className={routeMatchesApiCall(route, attempt) ? 'is-selected-route' : undefined} key={attempt.id}>
                <td>
                  <strong>Attempt {attempt.attemptNumber}</strong>
                  <MetaLine>{attempt.id}</MetaLine>
                </td>
                <td>
                  {attempt.routeKey ?? attempt.routeId ?? 'No route'}
                  <MetaLine>{attempt.provider} · {attempt.modelId}</MetaLine>
                  <MetaLine>{routeMatchesApiCall(route, attempt) ? 'Selected route' : 'Failover route'}</MetaLine>
                </td>
                <td>
                  <span className={`management-status ${attempt.status === 'succeeded' ? 'is-success' : ''}`}>{attempt.status}</span>
                  <MetaLine>{describeAttemptRole(detailGroup, attempt)}</MetaLine>
                  <MetaLine>{attempt.errorCode ?? 'No provider error'}</MetaLine>
                </td>
                <td>
                  {formatNumber(attempt.creditsCharged)} charged
                  <MetaLine>{formatNumber(attempt.creditsRefunded)} refunded</MetaLine>
                  <MetaLine>{formatCost(attempt.providerCost, attempt.providerCurrency)}</MetaLine>
                </td>
                <td>
                  {formatCompactDateTime(attempt.createdAt)}
                  <MetaLine>{attempt.latencyMs.toLocaleString('en-US')} ms</MetaLine>
                  <MetaLine>{attempt.pricingRuleId ?? detailGroup.run?.pricingRuleId ?? 'No pricing rule'}</MetaLine>
                </td>
              </tr>
            )) : null}
            {attemptStatus !== 'loading' && !detailGroup?.attempts.length ? <EmptyRow colSpan={5} message="No attempt records for this run." /> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RuntimeFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-route-runtime-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function describeAttemptRole(group: GroupedApiAttempt, attempt: GroupedApiAttempt['attempts'][number]) {
  if (group.succeededAttemptNumber === attempt.attemptNumber) return 'Final winner'
  if (attempt.isFinalAttempt) return 'Final attempt'
  return 'Intermediate attempt'
}

function describeFinalRouteHit(group: GroupedApiAttempt) {
  if (group.succeededAttemptNumber) return `Won on attempt ${group.succeededAttemptNumber}`
  return `Last route hit ${group.finalAttemptNumber}`
}

function describeRunOutcome(route: AdminAiProviderRouteRecord, group: GroupedApiAttempt) {
  if (!group.run) return describeFinalRouteHit(group)
  if (group.run.status !== 'succeeded') return `Ended ${group.run.status}`
  if (routeMatchesRun(route, group.run)) return 'Selected route won'
  return `Winner: ${group.run.routeKey ?? group.run.routeId ?? group.run.provider}`
}

function formatCost(value: null | number | undefined, currency?: null | string) {
  if (value == null) return 'Provider cost pending'
  return `${formatMoney(value)} ${currency ?? 'USD'}`
}

function formatMoney(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`
}

function sumCredits(attempts: AdminAiApiCallRecord[]) {
  return attempts.reduce((total, attempt) => total + attempt.creditsCharged, 0)
}

function sumRefunds(attempts: AdminAiApiCallRecord[]) {
  return attempts.reduce((total, attempt) => total + attempt.creditsRefunded, 0)
}

function sumProviderCost(attempts: AdminAiApiCallRecord[]) {
  const costs = attempts
    .map((attempt) => attempt.providerCost)
    .filter((value): value is number => typeof value === 'number')
  if (!costs.length) return null
  return costs.reduce((total, value) => total + value, 0)
}
