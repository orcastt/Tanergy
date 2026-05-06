'use client'

import { useMemo } from 'react'
import type { AdminAiApiCallsResource, AdminAiRunsResource } from './adminAiClient'
import {
  EmptyRow,
  FilterSelect,
  MetaLine,
  filterGridStyle,
  formatDate,
  formatNumber,
  truncate,
} from './adminAiShared'

export function RunsPanel({
  modelOptions,
  onModelChange,
  onStatusChange,
  onTypeChange,
  runs,
  selectedModel,
  selectedStatus,
  selectedType,
  statusOptions,
  typeOptions,
}: {
  modelOptions: string[]
  onModelChange: (value: string) => void
  onStatusChange: (value: string) => void
  onTypeChange: (value: string) => void
  runs: AdminAiRunsResource
  selectedModel: string
  selectedStatus: string
  selectedType: string
  statusOptions: string[]
  typeOptions: string[]
}) {
  return (
    <article className="management-panel">
      <PanelHeading body="Persisted run records with route, tier and charge ownership." rows={runs.runs.length} title="AI runs" />
      <div style={filterGridStyle(3)}>
        <FilterSelect label="Model" onChange={onModelChange} options={modelOptions} value={selectedModel} />
        <FilterSelect label="Run type" onChange={onTypeChange} options={typeOptions} value={selectedType} />
        <FilterSelect label="Status" onChange={onStatusChange} options={statusOptions} value={selectedStatus} />
      </div>
      {runs.error ? <p>{runs.error}</p> : null}
      <div className="management-table-wrap">
        <table className="management-table">
          <thead><tr><th>Run</th><th>Model</th><th>Status</th><th>Credits</th><th>Updated</th></tr></thead>
          <tbody>{runs.runs.length > 0 ? runs.runs.map((run) => <tr key={run.id}><td><strong>{run.id}</strong><MetaLine>{run.userId ?? 'Unknown actor'}</MetaLine><MetaLine>{run.workspaceId ?? 'No workspace'}</MetaLine><MetaLine>{truncate(run.promptPreview)}</MetaLine></td><td>{run.modelId}<MetaLine>{run.runType}</MetaLine><MetaLine>{run.provider}</MetaLine></td><td><span className="management-badge">{run.status}</span><MetaLine>{run.preflightStatus ?? 'No preflight state'}</MetaLine><MetaLine>{run.routeKey ?? run.routeId ?? 'No route'}</MetaLine></td><td>{formatNumber(run.costCredits)} charged<MetaLine>{formatNumber(run.estimatedCredits)} est</MetaLine><MetaLine>{run.chargedScope ?? 'No payer scope'}</MetaLine><MetaLine>{run.outputAssetIds.length} outputs</MetaLine></td><td>{formatDate(run.updatedAt)}<MetaLine>{run.latencyMs.toLocaleString('en-US')} ms</MetaLine><MetaLine>{run.errorMessage ?? `Tier ${run.selectedTierKey ?? 'default'}`}</MetaLine></td></tr>) : <EmptyRow colSpan={5} message="No AI runs match the current filters." />}</tbody>
        </table>
      </div>
    </article>
  )
}

type GroupedApiAttempt = {
  attempts: Array<{
    attemptNumber: number
    createdAt: string
    creditsCharged: number
    creditsRefunded: number
    errorCode?: null | string
    id: string
    isFinalAttempt: boolean
    latencyMs: number
    modelId: string
    provider: string
    providerCost?: null | number
    routeId?: null | string
    routeKey?: null | string
    runId: string
    status: string
    userId?: null | string
    workspaceId?: null | string
  }>
  finalAttemptNumber: number
  finalStatus: string
  runId: string
  succeededAttemptNumber: null | number
}

export function ApiCallsPanel({
  apiCalls,
  modelOptions,
  onModelChange,
  onProviderChange,
  onStatusChange,
  providerOptions,
  selectedModel,
  selectedProvider,
  selectedStatus,
  statusOptions,
}: {
  apiCalls: AdminAiApiCallsResource
  modelOptions: string[]
  onModelChange: (value: string) => void
  onProviderChange: (value: string) => void
  onStatusChange: (value: string) => void
  providerOptions: string[]
  selectedModel: string
  selectedProvider: string
  selectedStatus: string
  statusOptions: string[]
}) {
  const groupedApiCalls = useMemo(() => groupApiCallsByRun(apiCalls.apiCalls), [apiCalls.apiCalls])

  return (
    <article className="management-panel management-panel-wide">
      <PanelHeading body="Attempt timelines grouped by run, including the final winning attempt." rows={apiCalls.apiCalls.length} title="AI API calls" />
      <div style={filterGridStyle(3)}>
        <FilterSelect label="Model" onChange={onModelChange} options={modelOptions} value={selectedModel} />
        <FilterSelect label="Provider" onChange={onProviderChange} options={providerOptions} value={selectedProvider} />
        <FilterSelect label="Status" onChange={onStatusChange} options={statusOptions} value={selectedStatus} />
      </div>
      {apiCalls.error ? <p>{apiCalls.error}</p> : null}
      <div style={{ display: 'grid', gap: 16 }}>
        {groupedApiCalls.length > 0 ? groupedApiCalls.map((group) => (
          <section key={group.runId} style={{ border: '1px solid var(--color-hairline)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', padding: 16, borderBottom: '1px solid var(--color-hairline)', background: 'var(--color-surface-subtle)' }}>
              <div>
                <strong>{group.runId}</strong>
                <MetaLine>{group.attempts[0]?.modelId ?? 'Unknown model'}</MetaLine>
                <MetaLine>{group.attempts[0]?.workspaceId ?? 'No workspace'} · {group.attempts[0]?.userId ?? 'No actor'}</MetaLine>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="management-badge">{group.finalStatus}</span>
                <MetaLine>{group.attempts.length} attempt{group.attempts.length === 1 ? '' : 's'}</MetaLine>
                <MetaLine>{group.succeededAttemptNumber ? `Winner: attempt ${group.succeededAttemptNumber}` : `Final attempt: ${group.finalAttemptNumber}`}</MetaLine>
              </div>
            </div>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead><tr><th>Attempt</th><th>Provider</th><th>Status</th><th>Credits</th><th>Latency</th><th>Created</th></tr></thead>
                <tbody>{group.attempts.map((attempt) => <tr key={attempt.id}><td><strong>Attempt {attempt.attemptNumber}</strong><MetaLine>{attempt.id}</MetaLine></td><td>{attempt.provider}<MetaLine>{attempt.routeKey ?? attempt.routeId ?? 'No route'}</MetaLine></td><td><span className="management-badge">{attempt.status}</span><MetaLine>{attempt.isFinalAttempt ? (group.succeededAttemptNumber === attempt.attemptNumber ? 'Final winner' : 'Final attempt') : 'Intermediate attempt'}</MetaLine><MetaLine>{attempt.errorCode ?? 'No provider error'}</MetaLine></td><td>{formatNumber(attempt.creditsCharged)} charged<MetaLine>{formatNumber(attempt.creditsRefunded)} refunded</MetaLine><MetaLine>{attempt.providerCost == null ? 'Provider cost pending' : `${formatNumber(attempt.providerCost)} cost`}</MetaLine></td><td>{attempt.latencyMs.toLocaleString('en-US')} ms</td><td>{formatDate(attempt.createdAt)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )) : (
          <div className="management-table-wrap">
            <table className="management-table">
              <tbody><EmptyRow colSpan={6} message="No AI API calls match the current filters." /></tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  )
}

function PanelHeading({ body, rows, title }: { body: string; rows: number; title: string }) {
  return <div className="management-panel-heading"><div><h2>{title}</h2><p>{body}</p></div><span className="management-badge">{rows} rows</span></div>
}

function groupApiCallsByRun(apiCalls: AdminAiApiCallsResource['apiCalls']): GroupedApiAttempt[] {
  const groups = new Map<string, AdminAiApiCallsResource['apiCalls']>()
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
        if (leftTime !== rightTime) return leftTime - rightTime
        return parseAttemptNumber(left.id) - parseAttemptNumber(right.id)
      })
      const finalAttemptNumber = parseAttemptNumber(sortedAttempts[sortedAttempts.length - 1]?.id ?? '')
      const finalStatus = sortedAttempts[sortedAttempts.length - 1]?.status ?? 'unknown'
      const succeededAttemptNumber = finalStatus === 'succeeded' ? finalAttemptNumber : null
      return {
        attempts: sortedAttempts.map((attempt) => ({
          ...attempt,
          attemptNumber: parseAttemptNumber(attempt.id),
          isFinalAttempt: parseAttemptNumber(attempt.id) === finalAttemptNumber,
        })),
        finalAttemptNumber,
        finalStatus,
        runId,
        succeededAttemptNumber,
      }
    })
    .sort((left, right) => {
      const leftTime = new Date(left.attempts[left.attempts.length - 1]?.createdAt ?? '').getTime()
      const rightTime = new Date(right.attempts[right.attempts.length - 1]?.createdAt ?? '').getTime()
      return rightTime - leftTime
    })
}

function parseAttemptNumber(id: string) {
  const match = /_a(\d+)$/.exec(id)
  return match ? Number(match[1]) : 1
}
