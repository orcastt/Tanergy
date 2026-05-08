'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  loadAdminAiRouteMetrics,
  type AdminAiModelRecord,
  type AdminAiProviderRouteRecord,
  type AdminAiRouteMetricRecord,
  type AdminAiRouteMetricsResource,
} from './adminAiClient'
import { useAdminAiResources } from './useAdminAiResources'
import { AiCallout, EmptyRow, FilterSelect, MetaLine, formatDate, formatNumber, limitOptions, type BooleanFilter } from './adminAiShared'

const routeKinds = ['image', 'text', 'video'] as const
type RouteKind = (typeof routeKinds)[number]

export function AdminApiRoutesDashboard({ enabled }: { enabled: boolean }) {
  const [limit, setLimit] = useState<(typeof limitOptions)[number]>(25)
  const [routeKind, setRouteKind] = useState<RouteKind>('image')
  const [routeEnabled, setRouteEnabled] = useState<BooleanFilter>('all')
  const [routeModelKey, setRouteModelKey] = useState('')
  const [routeProviderKey, setRouteProviderKey] = useState('')
  const [routeKey, setRouteKey] = useState('')

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
  const visibleRoutes = routesByKind[routeKind]
  const selectedRoute = visibleRoutes.find((route) => route.routeKey === routeKey) ?? visibleRoutes[0] ?? null
  const selectedRouteKey = selectedRoute?.routeKey ?? ''

  return (
    <>
      <section className="management-summary-grid" aria-label="AI route summary">
        <AiCallout body="图片、文本和未来视频线路的总数" label="线路" value={ai.routes.routes.length.toLocaleString('en-US')} />
        <AiCallout body="当前处于启用状态的候选线路" label="启用" value={ai.routes.routes.filter((route) => route.enabled).length.toLocaleString('en-US')} />
        <AiCallout body="后台记录到的调用总量" label="调用" value={metrics.totals.calls.toLocaleString('en-US')} />
        <AiCallout body="已扣费积分总量" label="扣费" value={formatNumber(metrics.totals.creditsCharged)} />
        <AiCallout body="线路侧 provider 成本" label="成本" value={formatMoney(metrics.totals.providerCost)} />
      </section>

      <section className="management-panel management-panel-wide management-routes-shell">
        <div className="management-panel-heading">
          <div><h2>AI 线路管理</h2><p>按图片、文本、视频分类切换，再查看下方具体 provider 线路。</p></div>
          <div className="management-actions">
            <div className="management-segmented">{limitOptions.map((option) => <button key={option} className={option === limit ? 'is-active' : undefined} onClick={() => setLimit(option)} type="button">{option}</button>)}</div>
            <span className={`management-status ${ai.status === 'ready' || metrics.status === 'ready' ? 'is-success' : ''}`}>{metrics.status === 'error' ? 'error' : ai.status}</span>
          </div>
        </div>
        {ai.error ? <p>{ai.error}</p> : null}
        {metrics.error ? <p>{metrics.error}</p> : null}

        <div className="management-segmented management-console-tabs" style={{ marginBottom: 16 }}>
          {routeKinds.map((kind) => (
            <button key={kind} className={kind === routeKind ? 'is-active' : undefined} onClick={() => setRouteKind(kind)} type="button">{routeKindLabel(kind)}</button>
          ))}
        </div>

        <div className="management-main-grid">
          <article className="management-subpanel">
            <div className="management-panel-heading compact">
              <div><h2>线路管理</h2><p>{routeKind} routes</p></div>
              <span className="management-badge">{visibleRoutes.length} routes</span>
            </div>
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <FilterSelect label="Enabled" onChange={(value) => setRouteEnabled(value as BooleanFilter)} options={[{ label: 'All', value: 'all' }, { label: 'Enabled', value: 'enabled' }, { label: 'Disabled', value: 'disabled' }]} value={routeEnabled} />
              <FilterSelect label="Model" onChange={setRouteModelKey} options={uniqueValues(ai.models.models.map((model) => model.modelKey))} value={routeModelKey} />
              <FilterSelect label="Provider" onChange={setRouteProviderKey} options={uniqueValues(ai.routes.routes.map((route) => route.providerKey))} value={routeProviderKey} />
            </div>
            <RouteList routes={visibleRoutes} routeKey={selectedRouteKey} onSelectRoute={setRouteKey} />
          </article>

          <article className="management-subpanel">
            {selectedRoute ? (
              <>
                <div className="management-panel-heading compact">
                  <div><h2>{selectedRoute.routeKey}</h2><p>{selectedRoute.providerKey} · {selectedRoute.modelKey}</p></div>
                  <span className="management-badge">{selectedRoute.healthStatus}</span>
                </div>
                <dl className="management-definition-list">
                  <div><dt>Provider model</dt><dd>{selectedRoute.providerModel}</dd></div>
                  <div><dt>Priority</dt><dd>{selectedRoute.priority}</dd></div>
                  <div><dt>Weight</dt><dd>{selectedRoute.weight}</dd></div>
                  <div><dt>Timeout</dt><dd>{selectedRoute.timeoutMs} ms</dd></div>
                  <div><dt>Enabled</dt><dd>{String(selectedRoute.enabled)}</dd></div>
                  <div><dt>Updated</dt><dd>{formatDate(selectedRoute.updatedAt)}</dd></div>
                </dl>
              </>
            ) : <p>Select a route to inspect details.</p>}
          </article>
        </div>
      </section>

      <section className="management-panel management-panel-wide">
        <div className="management-panel-heading">
          <div><h2>线路消耗</h2><p>图片、文本、视频三类线路分开显示，每条线路展示 calls、credits 和 provider cost。</p></div>
        </div>
        <div className="management-three-grid">
          <MetricPanel kind="image" metrics={routeMetricsByKind.image} title="图片线路" />
          <MetricPanel kind="text" metrics={routeMetricsByKind.text} title="文本线路" />
          <MetricPanel kind="video" metrics={routeMetricsByKind.video} title="视频线路" />
        </div>
      </section>
    </>
  )
}

function routeKindLabel(kind: RouteKind) {
  if (kind === 'image') return '图片'
  if (kind === 'text') return '文本'
  return '视频'
}

function useAdminRouteMetrics(enabled: boolean, limit: number) {
  const [metrics, setMetrics] = useState<AdminAiRouteMetricsResource>({
    metrics: [],
    ok: false,
    totals: { calls: 0, creditsCharged: 0, failedCalls: 0, providerCost: 0, succeededCalls: 0 },
  })
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>('loading')

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
          totals: { calls: 0, creditsCharged: 0, failedCalls: 0, providerCost: 0, succeededCalls: 0 },
        })
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, limit])

  return { ...metrics, status }
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

function RouteList({
  onSelectRoute,
  routeKey,
  routes,
}: {
  onSelectRoute: (value: string) => void
  routeKey: string
  routes: Array<{
    enabled: boolean
    healthStatus: string
    modelKey: string
    providerKey: string
    routeKey: string
    updatedAt: string
  }>
}) {
  return (
    <div className="management-table-wrap">
      <table className="management-table compact">
        <thead><tr><th>Route</th><th>Provider</th><th>Health</th><th>Updated</th></tr></thead>
        <tbody>{routes.length ? routes.map((route) => (
          <tr key={`${route.routeKey}-${route.providerKey}`} className={route.routeKey === routeKey ? 'is-selected' : undefined}>
            <td>
              <button className="product-text-link" onClick={() => onSelectRoute(route.routeKey)} type="button">{route.routeKey}</button>
              <MetaLine>{route.modelKey}</MetaLine>
            </td>
            <td>{route.providerKey}</td>
            <td><span className="management-badge">{route.healthStatus}</span><MetaLine>{route.enabled ? 'Enabled' : 'Disabled'}</MetaLine></td>
            <td>{formatDate(route.updatedAt)}</td>
          </tr>
        )) : <EmptyRow colSpan={4} message="No routes in this category." />}</tbody>
      </table>
    </div>
  )
}

function MetricPanel({
  kind,
  metrics,
  title,
}: {
  kind: RouteKind
  metrics: AdminAiRouteMetricRecord[]
  title: string
}) {
  return (
    <article className="management-subpanel">
      <h2>{title}</h2>
      <div className="management-table-wrap">
        <table className="management-table compact">
          <thead><tr><th>Route</th><th>Calls</th><th>Spend</th></tr></thead>
          <tbody>{metrics.length ? metrics.map((metric) => (
            <tr key={`${kind}-${metric.routeKey}`}>
              <td>
                <strong>{metric.routeKey}</strong>
                <MetaLine>{metric.provider} · {metric.modelId}</MetaLine>
              </td>
              <td>{metric.calls}<MetaLine>{metric.failedCalls} failed</MetaLine></td>
              <td>{formatNumber(metric.creditsCharged)}<MetaLine>{formatMoney(metric.providerCost)}</MetaLine></td>
            </tr>
          )) : <EmptyRow colSpan={3} message="No consumption data for this category." />}</tbody>
        </table>
      </div>
    </article>
  )
}

function uniqueValues(values: Array<null | string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right))
}

function routeKindForModel(model: AdminAiModelRecord | undefined, route: AdminAiProviderRouteRecord): RouteKind {
  const capabilityText = [model?.capability, ...(model?.capabilities ?? []), route.modelKey, route.routeKey].join(' ').toLowerCase()
  if (capabilityText.includes('video')) return 'video'
  if (capabilityText.includes('text') || capabilityText.includes('chat')) return 'text'
  return 'image'
}

function formatMoney(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`
}
