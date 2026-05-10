'use client'

import {
  publishAdminAiProviderRoute,
  rollbackAdminAiProviderRoute,
  type AdminAiApiCallRecord,
  type AdminAiProviderRouteRecord,
  type AdminAiRunRecord,
  type AdminAiRouteMetricRecord,
} from './adminAiClient'
import { AdminApiRouteEditorForm } from './AdminApiRouteEditorForm'
import { AdminAiVersionHistoryPanel } from './AdminAiVersionHistoryPanel'
import { AdminRouteRuntimeDetail } from './AdminRouteRuntimeDetail'
import { EmptyRow, MetaLine, formatCompactDateTime, formatNumber } from './adminAiShared'

export const routeKinds = ['image', 'text', 'video'] as const
export type RouteKind = (typeof routeKinds)[number]

export function routeKindLabel(kind: RouteKind) {
  if (kind === 'image') return 'Image'
  if (kind === 'text') return 'Text'
  return 'Video'
}

export function AdminApiRoutesTable({
  metricsByRoute,
  onSelectRoute,
  routeId,
  routes,
}: {
  metricsByRoute: Map<string, AdminAiRouteMetricRecord>
  onSelectRoute: (value: string) => void
  routeId: string
  routes: Array<Pick<AdminAiProviderRouteRecord, 'enabled' | 'healthStatus' | 'modelKey' | 'providerKey' | 'routeId' | 'routeKey'>>
}) {
  return (
    <div className="management-table-wrap">
      <table className="management-table admin-routes-table">
        <thead>
          <tr>
            <th>Route</th>
            <th>Provider</th>
            <th>Model</th>
            <th>Health</th>
            <th>Calls</th>
            <th>Runs</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {routes.length ? routes.map((route) => {
            const metric = metricsByRoute.get(routeMetricsKey(route.routeId, route.routeKey, route.providerKey, route.modelKey))
            return (
              <tr
                key={route.routeId}
                className={route.routeId === routeId ? 'is-selected' : undefined}
                onClick={() => onSelectRoute(route.routeId)}
              >
                <td>
                  <strong>{route.routeKey}</strong>
                  <MetaLine>{route.routeId}</MetaLine>
                </td>
                <td>
                  {route.providerKey}
                  <MetaLine>{route.enabled ? 'enabled' : 'disabled'}</MetaLine>
                </td>
                <td>{route.modelKey}</td>
                <td><span className={`management-status ${route.enabled ? 'is-success' : ''}`}>{route.healthStatus}</span></td>
                <td>{formatNumber(metric?.calls ?? 0)}<MetaLine>{formatNumber(metric?.creditsCharged ?? 0)} credits</MetaLine></td>
                <td>{formatNumber(metric?.routeHitRuns ?? 0)}<MetaLine>{formatNumber(metric?.directWins ?? 0)} direct</MetaLine><MetaLine>{formatNumber(metric?.fallbackWins ?? 0)} fallback</MetaLine></td>
                <td>{formatMoney(metric?.providerCost ?? 0)}<MetaLine>{formatNumber(metric?.avgLatencyMs ?? 0)} ms avg</MetaLine></td>
              </tr>
            )
          }) : <EmptyRow colSpan={7} message="No routes in this category." />}
        </tbody>
      </table>
    </div>
  )
}

export function AdminApiRouteDetailForm({
  metric,
  onSaved,
  onSelectRun,
  routeApiCalls,
  routeRunsError,
  routeRuns,
  routeRunsStatus,
  route,
  selectedRunId,
}: {
  metric: AdminAiRouteMetricRecord | null
  onSaved: () => void
  onSelectRun: (value: string) => void
  routeApiCalls: AdminAiApiCallRecord[]
  routeRunsError?: string
  routeRuns: AdminAiRunRecord[]
  routeRunsStatus: 'error' | 'loading' | 'ready'
  route: AdminAiProviderRouteRecord
  selectedRunId: string
}) {
  return (
    <div className="admin-route-form">
      <div className="management-panel-heading compact">
        <div><h2>{route.routeKey}</h2><MetaLine>{route.routeId}</MetaLine></div>
        <span className={`management-status ${route.enabled ? 'is-success' : ''}`}>{route.healthStatus}</span>
      </div>
      <div className="admin-route-fact-grid">
        <RouteFact label="Provider" value={route.providerKey} />
        <RouteFact label="Model" value={route.modelKey} />
        <RouteFact label="Calls" value={formatNumber(metric?.calls ?? 0)} />
        <RouteFact label="Route runs" value={formatNumber(metric?.routeHitRuns ?? 0)} />
        <RouteFact label="Direct wins" value={formatNumber(metric?.directWins ?? 0)} />
        <RouteFact label="Fallback wins" value={formatNumber(metric?.fallbackWins ?? 0)} />
        <RouteFact label="Terminal fails" value={formatNumber(metric?.terminalFailures ?? 0)} />
        <RouteFact label="Avg tries/run" value={formatDecimal(metric?.averageAttemptsPerRun ?? 0)} />
        <RouteFact label="Attempt success" value={formatPercent(metric?.routeAttemptSuccessRate)} />
        <RouteFact label="Credits" value={formatNumber(metric?.creditsCharged ?? 0)} />
        <RouteFact label="Avg latency" value={`${formatNumber(metric?.avgLatencyMs ?? 0)} ms`} />
        <RouteFact label="Failures" value={formatNumber(metric?.failedCalls ?? 0)} />
        <RouteFact label="Provider cost" value={formatMoney(metric?.providerCost ?? 0)} />
        <RouteFact label="Updated" value={formatCompactDateTime(route.updatedAt)} />
      </div>
      <AdminApiRouteEditorForm key={`${route.routeId}:${route.updatedAt}`} onSaved={onSaved} route={route} />
      <AdminAiVersionHistoryPanel
        onChanged={onSaved}
        publishVersion={(note) => publishAdminAiProviderRoute(route.routeId, note)}
        resourceId={route.routeId}
        resourceLabel="route versions"
        resourceType="provider_route"
        rollbackVersion={(versionId, note) => rollbackAdminAiProviderRoute(route.routeId, versionId, note)}
        title="Release history"
      />
      <AdminRouteRuntimeDetail onSelectRun={onSelectRun} route={route} routeApiCalls={routeApiCalls} routeRuns={routeRuns} routeRunsError={routeRunsError} routeRunsStatus={routeRunsStatus} selectedRunId={selectedRunId} />
    </div>
  )
}

export function AdminRouteMetricsTable({
  metrics,
}: {
  metrics: AdminAiRouteMetricRecord[]
}) {
  return (
    <div className="management-table-wrap">
      <table className="management-table compact">
        <thead><tr><th>Route</th><th>Provider</th><th>Runs</th><th>Outcomes</th><th>Attempts</th><th>Credits</th><th>Cost</th><th>Last called</th></tr></thead>
        <tbody>{metrics.length ? metrics.map((metric) => (
          <tr key={`${metric.capability}-${metric.routeKey}-${metric.provider}`}>
            <td><strong>{metric.routeKey}</strong><MetaLine>{metric.capability}</MetaLine></td>
            <td>{metric.provider}<MetaLine>{metric.modelId}</MetaLine></td>
            <td>{metric.routeHitRuns}<MetaLine>{formatNumber(metric.avgLatencyMs)} ms avg</MetaLine><MetaLine>{formatPercent(metric.directWinRate)} direct</MetaLine></td>
            <td>{metric.directWins}<MetaLine>{metric.fallbackWins} fallback</MetaLine><MetaLine>{metric.terminalFailures} final fail</MetaLine></td>
            <td>{metric.calls}<MetaLine>{formatDecimal(metric.averageAttemptsPerRun)} avg/run</MetaLine><MetaLine>{formatPercent(metric.routeAttemptSuccessRate)} success</MetaLine></td>
            <td>{formatNumber(metric.creditsCharged)}</td>
            <td>{formatMoney(metric.providerCost)}</td>
            <td>{metric.lastCalledAt ? formatCompactDateTime(metric.lastCalledAt) : 'No calls'}</td>
          </tr>
        )) : <EmptyRow colSpan={8} message="No consumption data for this category." />}</tbody>
      </table>
    </div>
  )
}

function RouteFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-route-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatMoney(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`
}

function formatDecimal(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
}

function formatPercent(value: null | number | undefined) {
  if (value == null) return '--'
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`
}

function routeMetricsKey(routeId: null | string | undefined, routeKey: string, providerKey: string, modelKey: string) {
  if (routeId) return `route:${routeId}`
  return `${providerKey}::${routeKey}::${modelKey}`
}
