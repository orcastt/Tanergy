'use client'

import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { type AdminAiModelRecord, type AdminAiProviderRouteRecord, type AdminAiRouteMetricRecord } from './adminAiClient'
import { AdminApiRouteDetailForm, AdminApiRoutesTable, AdminRouteMetricsTable, routeKinds, routeKindLabel, type RouteKind } from './AdminApiRouteManagement'
import { AdminRouteApiCallLedger } from './AdminRouteApiCallLedger'
import { useAdminAiResources } from './useAdminAiResources'
import { useAdminRouteMetrics, useSelectedRouteApiCalls, useSelectedRouteRuns } from './useAdminApiRouteRuntime'
import { FilterSelect, FilterTextInput, limitOptions, uniqueValues, type BooleanFilter } from './adminAiShared'

export function AdminApiRoutesDashboard({ enabled }: { enabled: boolean }) {
  const [limit, setLimit] = useState<(typeof limitOptions)[number]>(25)
  const [routeKind, setRouteKind] = useState<RouteKind>('image')
  const [routeEnabled, setRouteEnabled] = useState<BooleanFilter>('all')
  const [routeModelKey, setRouteModelKey] = useState('')
  const [routeProviderKey, setRouteProviderKey] = useState('')
  const [routeSearchDraft, setRouteSearchDraft] = useState('')
  const [routeSearchQuery, setRouteSearchQuery] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [selectedRunSelection, setSelectedRunSelection] = useState<{ routeId: string; runId: string }>({ routeId: '', runId: '' })

  const ai = useAdminAiResources(enabled, {
    apiCallLimit: limit,
    modelLimit: limit,
    pricingLimit: limit,
    routeEnabled: routeEnabled === 'all' ? undefined : routeEnabled === 'enabled',
    routeLimit: limit,
    routeModelKey: routeModelKey || undefined,
    routeProviderKey: routeProviderKey || undefined,
    runLimit: limit,
  })
  const metrics = useAdminRouteMetrics(enabled, limit)
  const routesByKind = useMemo(() => groupRoutesByKind(ai.routes.routes, ai.models.models), [ai.models.models, ai.routes.routes])
  const routeMetricsByKind = useMemo(() => groupMetricsByKind(metrics.metrics), [metrics.metrics])
  const metricsByRoute = useMemo(() => buildRouteMetricsMap(metrics.metrics), [metrics.metrics])
  const visibleRoutes = useMemo(
    () => filterRoutes(routesByKind[routeKind], routeSearchQuery),
    [routeSearchQuery, routeKind, routesByKind],
  )
  const selectedRoute = visibleRoutes.find((route) => route.routeId === selectedRouteId) ?? visibleRoutes[0] ?? null
  const selectedRouteMetrics = selectedRoute
    ? metricsByRoute.get(routeMetricsKey(selectedRoute.routeId, selectedRoute.routeKey, selectedRoute.providerKey, selectedRoute.modelKey)) ?? null
    : null
  const routeApiCalls = useSelectedRouteApiCalls({
    enabled,
    limit,
    providerKey: selectedRoute?.providerKey ?? null,
    routeId: selectedRoute?.routeId ?? null,
    routeKey: selectedRoute?.routeKey ?? null,
  })
  const routeRuns = useSelectedRouteRuns({
    enabled,
    limit,
    providerKey: selectedRoute?.providerKey ?? null,
    routeId: selectedRoute?.routeId ?? null,
    routeKey: selectedRoute?.routeKey ?? null,
  })
  const hasRouteSearch = Boolean(routeSearchDraft.trim()) || Boolean(routeSearchQuery)
  const routeRangeLabel = `${visibleRoutes.length.toLocaleString('en-US')} routes`
  const topStatus = metrics.status === 'error' || routeApiCalls.status === 'error' || routeRuns.status === 'error' ? 'error' : ai.status
  const selectedRunId = selectedRoute && selectedRunSelection.routeId === selectedRoute.routeId ? selectedRunSelection.runId : ''

  function submitRouteSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setRouteSearchQuery(routeSearchDraft.trim())
  }

  function clearRouteSearch() {
    setRouteSearchDraft('')
    setRouteSearchQuery('')
  }

  function updateSelectedRun(runId: string) {
    setSelectedRunSelection({ routeId: selectedRoute?.routeId ?? '', runId })
  }

  return (
    <>
      <section className="admin-users-directory management-routes-shell" aria-label="AI route management">
        <div className="management-panel-heading">
          <div><h2>AI API Routes</h2></div>
          <div className="management-actions">
            <span className="management-inline-note">{routeRangeLabel}</span>
            <div className="management-segmented">
              {limitOptions.map((option) => (
                <button key={option} className={option === limit ? 'is-active' : undefined} onClick={() => setLimit(option)} type="button">
                  {option}
                </button>
              ))}
            </div>
            <button className="product-button product-button-secondary" onClick={() => { ai.reload(); metrics.reload() }} type="button">Reload</button>
            <span className={`management-status ${topStatus === 'ready' ? 'is-success' : ''}`}>{topStatus}</span>
          </div>
        </div>
        {ai.error ? <p>{ai.error}</p> : null}
        {metrics.error ? <p>{metrics.error}</p> : null}

        <div className="management-segmented management-console-tabs">
          {routeKinds.map((kind) => (
            <button key={kind} className={kind === routeKind ? 'is-active' : undefined} onClick={() => setRouteKind(kind)} type="button">
              {routeKindLabel(kind)}
            </button>
          ))}
        </div>

        <div className="admin-users-toolbar admin-route-toolbar">
          <form className="admin-users-search-form" onSubmit={submitRouteSearch}>
            <FilterTextInput
              label="Search routes"
              leadingIcon="search"
              onChange={setRouteSearchDraft}
              placeholder="route, provider, model"
              value={routeSearchDraft}
            />
            <button className="product-button" type="submit">Search</button>
            <button className="product-button product-button-secondary" disabled={!hasRouteSearch} onClick={clearRouteSearch} type="button">
              Clear
            </button>
          </form>
          <div className="admin-route-toolbar-filters">
            <FilterSelect label="Enabled" onChange={(value) => setRouteEnabled(value as BooleanFilter)} options={[{ label: 'All', value: 'all' }, { label: 'Enabled', value: 'enabled' }, { label: 'Disabled', value: 'disabled' }]} value={routeEnabled} />
            <FilterSelect label="Model" onChange={setRouteModelKey} options={uniqueValues(ai.models.models.map((model) => model.modelKey))} value={routeModelKey} />
            <FilterSelect label="Provider" onChange={setRouteProviderKey} options={uniqueValues(ai.routes.routes.map((route) => route.providerKey))} value={routeProviderKey} />
          </div>
        </div>

        <div className="admin-route-editor-grid">
          <article className="management-panel management-panel-wide admin-route-sidebar">
            <AdminApiRoutesTable metricsByRoute={metricsByRoute} onSelectRoute={setSelectedRouteId} routeId={selectedRoute?.routeId ?? ''} routes={visibleRoutes} />
          </article>

          <article className="management-panel admin-route-detail">
            {selectedRoute ? (
              <AdminApiRouteDetailForm
                key={selectedRoute.routeId}
                metric={selectedRouteMetrics}
                onSaved={() => { ai.reload(); metrics.reload(); routeApiCalls.reload(); routeRuns.reload() }}
                onSelectRun={updateSelectedRun}
                routeApiCalls={routeApiCalls.apiCalls}
                routeRunsError={routeRuns.error}
                routeRuns={routeRuns.runs}
                routeRunsStatus={routeRuns.status}
                route={selectedRoute}
                selectedRunId={selectedRunId}
              />
            ) : <p>Select a route to inspect details.</p>}
          </article>
        </div>
      </section>

      <section className="management-panel management-panel-wide">
        <div className="management-panel-heading">
          <div><h2>Route Metrics</h2></div>
        </div>
        <div className="management-three-grid">
          <MetricPanel metrics={routeMetricsByKind.image} title="Image routes" />
          <MetricPanel metrics={routeMetricsByKind.text} title="Text routes" />
          <MetricPanel metrics={routeMetricsByKind.video} title="Video routes" />
        </div>
      </section>

      <section className="management-panel management-panel-wide">
        <div className="management-panel-heading">
          <div><h2>API Calls</h2></div>
        </div>
        {routeApiCalls.error ? <p>{routeApiCalls.error}</p> : null}
        {selectedRoute ? <AdminRouteApiCallLedger apiCalls={routeApiCalls.apiCalls} onSelectRun={updateSelectedRun} route={selectedRoute} routeRuns={routeRuns.runs} selectedRunId={selectedRunId} /> : <p>Select a route to inspect call history.</p>}
      </section>
    </>
  )
}

function groupRoutesByKind(routes: AdminAiProviderRouteRecord[], models: AdminAiModelRecord[]) {
  const modelMap = new Map(models.map((model) => [model.modelKey, model]))
  const grouped: Record<RouteKind, AdminAiProviderRouteRecord[]> = { image: [], text: [], video: [] }
  for (const route of routes) {
    grouped[routeKindForModel(modelMap.get(route.modelKey), route)].push(route)
  }
  return grouped
}

function groupMetricsByKind(metrics: AdminAiRouteMetricRecord[]) {
  return {
    image: metrics.filter((metric) => metric.capability.startsWith('image')),
    text: metrics.filter((metric) => metric.capability === 'text'),
    video: metrics.filter((metric) => metric.capability.startsWith('video')),
  } satisfies Record<RouteKind, AdminAiRouteMetricRecord[]>
}

function buildRouteMetricsMap(metrics: AdminAiRouteMetricRecord[]) {
  return new Map(metrics.map((metric) => [routeMetricsKey(metric.routeId, metric.routeKey, metric.provider, metric.modelId), metric] as const))
}

function MetricPanel({
  metrics,
  title,
}: {
  metrics: AdminAiRouteMetricRecord[]
  title: string
}) {
  return (
    <article className="management-subpanel">
      <h2>{title}</h2>
      <AdminRouteMetricsTable metrics={metrics} />
    </article>
  )
}

function routeKindForModel(model: AdminAiModelRecord | undefined, route: AdminAiProviderRouteRecord): RouteKind {
  const capabilityText = [model?.capability, ...(model?.capabilities ?? []), route.modelKey, route.routeKey].join(' ').toLowerCase()
  if (capabilityText.includes('video')) return 'video'
  if (capabilityText.includes('text') || capabilityText.includes('chat')) return 'text'
  return 'image'
}

function routeMetricsKey(routeId: null | string | undefined, routeKey: string, providerKey: string, modelKey: string) {
  if (routeId) return `route:${routeId}`
  return `${providerKey}::${routeKey}::${modelKey}`
}

function filterRoutes(routes: AdminAiProviderRouteRecord[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return routes
  return routes.filter((route) => [
    route.routeId,
    route.routeKey,
    route.providerKey,
    route.providerModel,
    route.modelKey,
    route.healthStatus,
  ].some((value) => String(value ?? '').toLowerCase().includes(normalized)))
}
