'use client'

import { useMemo, useState } from 'react'
import type { AdminAiApiCallsResource, AdminAiRunsResource } from './adminAiClient'
import type { GroupedApiAttempt } from './adminAiRuntimeGrouping'
import { groupApiCallsByRun } from './adminAiRuntimeGrouping'
import {
  EmptyRow,
  FilterSelect,
  FilterTextInput,
  MetaLine,
  filterGridStyle,
  formatDate,
  formatNumber,
  truncate,
} from './adminAiShared'

export function RunsPanel(props: {
  boardOptions: string[]
  modelOptions: string[]
  onBoardChange: (value: string) => void
  onModelChange: (value: string) => void
  onPreflightStatusChange: (value: string) => void
  onPricingRuleChange: (value: string) => void
  onProviderChange: (value: string) => void
  onRouteKeyChange: (value: string) => void
  onRunIdChange: (value: string) => void
  onStatusChange: (value: string) => void
  onTypeChange: (value: string) => void
  onWorkspaceChange: (value: string) => void
  preflightStatusOptions: string[]
  pricingRuleOptions: string[]
  providerOptions: string[]
  routeKeyOptions: string[]
  runs: AdminAiRunsResource
  selectedBoard: string
  selectedModel: string
  selectedPreflightStatus: string
  selectedPricingRule: string
  selectedProvider: string
  selectedRouteKey: string
  selectedRunId: string
  selectedStatus: string
  selectedType: string
  selectedWorkspace: string
  statusOptions: string[]
  typeOptions: string[]
  workspaceOptions: string[]
}) {
  return (
    <article className="management-panel management-panel-wide">
      <PanelHeading rows={props.runs.runs.length} title="AI runs" />
      <div style={filterGridStyle(4)}>
        <FilterSelect label="Model" onChange={props.onModelChange} options={props.modelOptions} value={props.selectedModel} />
        <FilterSelect label="Provider" onChange={props.onProviderChange} options={props.providerOptions} value={props.selectedProvider} />
        <FilterSelect label="Run type" onChange={props.onTypeChange} options={props.typeOptions} value={props.selectedType} />
        <FilterSelect label="Status" onChange={props.onStatusChange} options={props.statusOptions} value={props.selectedStatus} />
        <FilterSelect label="Workspace" onChange={props.onWorkspaceChange} options={props.workspaceOptions} value={props.selectedWorkspace} />
        <FilterSelect label="Board" onChange={props.onBoardChange} options={props.boardOptions} value={props.selectedBoard} />
        <FilterSelect label="Route" onChange={props.onRouteKeyChange} options={props.routeKeyOptions} value={props.selectedRouteKey} />
        <FilterSelect label="Preflight" onChange={props.onPreflightStatusChange} options={props.preflightStatusOptions} value={props.selectedPreflightStatus} />
        <FilterSelect label="Pricing" onChange={props.onPricingRuleChange} options={props.pricingRuleOptions} value={props.selectedPricingRule} />
        <FilterTextInput label="Run id" onChange={props.onRunIdChange} placeholder="run_mock_..." value={props.selectedRunId} />
      </div>
      {props.runs.error ? <p>{props.runs.error}</p> : null}
      <div className="management-table-wrap">
        <table className="management-table">
          <thead><tr><th>Run</th><th>Model</th><th>Status</th><th>Credits</th><th>Updated</th></tr></thead>
          <tbody>{props.runs.runs.length > 0 ? props.runs.runs.map((run) => <tr key={run.id}><td><strong>{run.id}</strong><MetaLine>{run.userId ?? 'Unknown actor'}</MetaLine><MetaLine>{run.workspaceId ?? 'No workspace'}</MetaLine><MetaLine>{run.boardId ?? 'No board'}</MetaLine><MetaLine>{truncate(run.promptPreview)}</MetaLine></td><td>{run.modelId}<MetaLine>{run.runType}</MetaLine><MetaLine>{run.provider}</MetaLine><MetaLine>{run.routeKey ?? run.routeId ?? 'No route'}</MetaLine></td><td><span className="management-badge">{run.status}</span><MetaLine>{run.preflightStatus ?? 'No preflight state'}</MetaLine><MetaLine>{run.pricingRuleId ?? 'No pricing rule'}</MetaLine></td><td>{formatNumber(run.costCredits)} charged<MetaLine>{formatNumber(run.estimatedCredits)} est</MetaLine><MetaLine>{run.providerCost == null ? 'Provider cost pending' : `${formatNumber(run.providerCost)} ${run.providerCurrency ?? 'USD'}`}</MetaLine><MetaLine>{run.outputAssetIds.length} outputs</MetaLine></td><td>{formatDate(run.updatedAt)}<MetaLine>{run.latencyMs.toLocaleString('en-US')} ms</MetaLine><MetaLine>{run.errorMessage ?? `Tier ${run.selectedTierKey ?? 'default'}`}</MetaLine></td></tr>) : <EmptyRow colSpan={5} message="No AI runs match the current filters." />}</tbody>
        </table>
      </div>
    </article>
  )
}

export function ApiCallsPanel(props: {
  apiCalls: AdminAiApiCallsResource
  boardOptions: string[]
  errorCodeOptions: string[]
  modelOptions: string[]
  onBoardChange: (value: string) => void
  onErrorCodeChange: (value: string) => void
  onModelChange: (value: string) => void
  onPricingRuleChange: (value: string) => void
  onProviderChange: (value: string) => void
  onRouteKeyChange: (value: string) => void
  onRunIdChange: (value: string) => void
  onStatusChange: (value: string) => void
  onWorkspaceChange: (value: string) => void
  pricingRuleOptions: string[]
  providerOptions: string[]
  routeKeyOptions: string[]
  runs: AdminAiRunsResource
  selectedBoard: string
  selectedErrorCode: string
  selectedModel: string
  selectedPricingRule: string
  selectedProvider: string
  selectedRouteKey: string
  selectedRunId: string
  selectedStatus: string
  selectedWorkspace: string
  statusOptions: string[]
  workspaceOptions: string[]
}) {
  const groupedApiCalls = useMemo(() => groupApiCallsByRun(props.apiCalls.apiCalls, props.runs.runs), [props.apiCalls.apiCalls, props.runs.runs])
  const [drillDownRunId, setDrillDownRunId] = useState<string>('')
  const selectedGroup = groupedApiCalls.find((group) => group.runId === drillDownRunId) ?? groupedApiCalls[0]

  return (
    <article className="management-panel management-panel-wide">
      <PanelHeading rows={props.apiCalls.apiCalls.length} title="AI API calls" />
      <div style={filterGridStyle(4)}>
        <FilterSelect label="Model" onChange={props.onModelChange} options={props.modelOptions} value={props.selectedModel} />
        <FilterSelect label="Provider" onChange={props.onProviderChange} options={props.providerOptions} value={props.selectedProvider} />
        <FilterSelect label="Status" onChange={props.onStatusChange} options={props.statusOptions} value={props.selectedStatus} />
        <FilterSelect label="Workspace" onChange={props.onWorkspaceChange} options={props.workspaceOptions} value={props.selectedWorkspace} />
        <FilterSelect label="Board" onChange={props.onBoardChange} options={props.boardOptions} value={props.selectedBoard} />
        <FilterSelect label="Route" onChange={props.onRouteKeyChange} options={props.routeKeyOptions} value={props.selectedRouteKey} />
        <FilterSelect label="Pricing" onChange={props.onPricingRuleChange} options={props.pricingRuleOptions} value={props.selectedPricingRule} />
        <FilterSelect label="Error" onChange={props.onErrorCodeChange} options={props.errorCodeOptions} value={props.selectedErrorCode} />
        <FilterTextInput label="Run id" onChange={props.onRunIdChange} placeholder="run_mock_..." value={props.selectedRunId} />
      </div>
      {props.apiCalls.error ? <p>{props.apiCalls.error}</p> : null}
      {selectedGroup ? <RunAttemptDrillDown group={selectedGroup} /> : null}
      <div style={{ display: 'grid', gap: 16 }}>
        {groupedApiCalls.length > 0 ? groupedApiCalls.map((group) => (
          <section key={group.runId} style={{ border: '1px solid var(--color-hairline)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', padding: 16, borderBottom: '1px solid var(--color-hairline)', background: 'var(--color-surface-subtle)' }}>
              <div>
                <strong>{group.runId}</strong>
                <MetaLine>{group.attempts[0]?.modelId ?? 'Unknown model'}</MetaLine>
                <MetaLine>{group.attempts[0]?.workspaceId ?? 'No workspace'} · {group.attempts[0]?.boardId ?? 'No board'}</MetaLine>
              </div>
              <div style={{ textAlign: 'right' }}>
                <button className="product-button product-button-secondary" onClick={() => setDrillDownRunId(group.runId)} type="button">Inspect</button>
                <MetaLine><span className="management-badge">{group.finalStatus}</span></MetaLine>
                <MetaLine>{group.attempts.length} attempt{group.attempts.length === 1 ? '' : 's'}</MetaLine>
                <MetaLine>{group.succeededAttemptNumber ? `Winner: attempt ${group.succeededAttemptNumber}` : `Final attempt: ${group.finalAttemptNumber}`}</MetaLine>
              </div>
            </div>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead><tr><th>Attempt</th><th>Provider</th><th>Status</th><th>Credits</th><th>Latency</th><th>Created</th></tr></thead>
                <tbody>{group.attempts.map((attempt) => <tr key={attempt.id}><td><strong>Attempt {attempt.attemptNumber}</strong><MetaLine>{attempt.id}</MetaLine></td><td>{attempt.provider}<MetaLine>{attempt.routeKey ?? attempt.routeId ?? 'No route'}</MetaLine></td><td><span className="management-badge">{attempt.status}</span><MetaLine>{attempt.isFinalAttempt ? (group.succeededAttemptNumber === attempt.attemptNumber ? 'Final winner' : 'Final attempt') : 'Intermediate attempt'}</MetaLine><MetaLine>{attempt.errorCode ?? 'No provider error'}</MetaLine></td><td>{formatNumber(attempt.creditsCharged)} charged<MetaLine>{formatNumber(attempt.creditsRefunded)} refunded</MetaLine><MetaLine>{attempt.providerCost == null ? 'Provider cost pending' : `${formatNumber(attempt.providerCost)} ${attempt.providerCurrency ?? 'USD'}`}</MetaLine></td><td>{attempt.latencyMs.toLocaleString('en-US')} ms</td><td>{formatDate(attempt.createdAt)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )) : <div className="management-table-wrap"><table className="management-table"><tbody><EmptyRow colSpan={6} message="No AI API calls match the current filters." /></tbody></table></div>}
      </div>
    </article>
  )
}

function RunAttemptDrillDown({ group }: { group: GroupedApiAttempt }) {
  return (
    <section style={{ display: 'grid', gap: 12, marginBottom: 20, padding: 16, border: '1px solid var(--color-hairline)', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div><strong>{group.runId}</strong><MetaLine>{group.run?.modelId ?? group.attempts[0]?.modelId ?? 'Unknown model'}</MetaLine><MetaLine>{group.run?.promptPreview ? truncate(group.run.promptPreview) : 'No prompt preview'}</MetaLine></div>
        <div style={{ textAlign: 'right' }}><span className="management-badge">{group.finalStatus}</span><MetaLine>{group.succeededAttemptNumber ? `Succeeded on attempt ${group.succeededAttemptNumber}` : `Stopped on attempt ${group.finalAttemptNumber}`}</MetaLine></div>
      </div>
      <div style={filterGridStyle(4)}>
        <Detail label="Workspace" value={group.run?.workspaceId ?? group.attempts[0]?.workspaceId ?? 'No workspace'} />
        <Detail label="Board" value={group.run?.boardId ?? group.attempts[0]?.boardId ?? 'No board'} />
        <Detail label="Route" value={group.run?.routeKey ?? group.attempts[group.attempts.length - 1]?.routeKey ?? 'No route'} />
        <Detail label="Pricing" value={group.run?.pricingRuleId ?? group.attempts[group.attempts.length - 1]?.pricingRuleId ?? 'No pricing'} />
        <Detail label="Charge" value={group.run?.chargedScope ?? 'Unknown payer'} />
        <Detail label="Credits" value={`${formatNumber(group.run?.costCredits ?? 0)} charged`} />
        <Detail label="Provider cost" value={group.run?.providerCost == null ? 'Pending' : `${formatNumber(group.run.providerCost)} ${group.run.providerCurrency ?? 'USD'}`} />
        <Detail label="Preflight" value={group.run?.preflightStatus ?? 'No preflight'} />
      </div>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><strong>{label}</strong><MetaLine>{value}</MetaLine></div>
}

function PanelHeading({ rows, title }: { rows: number; title: string }) {
  return <div className="management-panel-heading"><div><h2>{title}</h2></div><span className="management-badge">{rows} rows</span></div>
}
