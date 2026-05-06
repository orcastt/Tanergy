'use client'

import { useMemo, useState } from 'react'
import { ModelsPanel, PricingRulesPanel, RoutesPanel } from './AdminAiPanels'
import { ApiCallsPanel, RunsPanel } from './AdminAiRuntimePanels'
import { useAdminAiResources } from './useAdminAiResources'
import { AiCallout, limitOptions, resolveBooleanFilter, uniqueValues, type BooleanFilter } from './adminAiShared'

export function AdminAiDashboard({ enabled }: { enabled: boolean }) {
  const [limit, setLimit] = useState<(typeof limitOptions)[number]>(25)
  const [modelCapability, setModelCapability] = useState('')
  const [modelEnabled, setModelEnabled] = useState<BooleanFilter>('all')
  const [routeModelKey, setRouteModelKey] = useState('')
  const [routeProviderKey, setRouteProviderKey] = useState('')
  const [routeEnabled, setRouteEnabled] = useState<BooleanFilter>('all')
  const [pricingModelKey, setPricingModelKey] = useState('')
  const [pricingTierKey, setPricingTierKey] = useState('')
  const [pricingStatus, setPricingStatus] = useState('')
  const [runModelId, setRunModelId] = useState('')
  const [runType, setRunType] = useState('')
  const [runStatus, setRunStatus] = useState('')
  const [apiCallModelId, setApiCallModelId] = useState('')
  const [apiCallProvider, setApiCallProvider] = useState('')
  const [apiCallStatus, setApiCallStatus] = useState('')
  const ai = useAdminAiResources(enabled, {
    apiCallLimit: limit,
    apiCallModelId: apiCallModelId || undefined,
    apiCallProvider: apiCallProvider || undefined,
    apiCallStatus: apiCallStatus || undefined,
    modelCapability: modelCapability || undefined,
    modelEnabled: resolveBooleanFilter(modelEnabled),
    modelLimit: limit,
    pricingLimit: limit,
    pricingModelKey: pricingModelKey || undefined,
    pricingStatus: pricingStatus || undefined,
    pricingTierKey: pricingTierKey || undefined,
    routeEnabled: resolveBooleanFilter(routeEnabled),
    routeLimit: limit,
    routeModelKey: routeModelKey || undefined,
    routeProviderKey: routeProviderKey || undefined,
    runLimit: limit,
    runModelId: runModelId || undefined,
    runStatus: runStatus || undefined,
    runType: runType || undefined,
  })
  const capabilityOptions = useMemo(() => uniqueValues(ai.models.models.flatMap((model) => [model.capability, ...model.capabilities])), [ai.models.models])
  const modelOptions = useMemo(() => uniqueValues([...ai.models.models.map((model) => model.modelKey), ...ai.routes.routes.map((route) => route.modelKey), ...ai.pricingRules.pricingRules.map((rule) => rule.modelKey), ...ai.runs.runs.map((run) => run.modelId), ...ai.apiCalls.apiCalls.map((apiCall) => apiCall.modelId)]), [ai.apiCalls.apiCalls, ai.models.models, ai.pricingRules.pricingRules, ai.routes.routes, ai.runs.runs])
  const providerOptions = useMemo(() => uniqueValues([...ai.models.models.map((model) => model.providerKey), ...ai.routes.routes.map((route) => route.providerKey), ...ai.runs.runs.map((run) => run.provider), ...ai.apiCalls.apiCalls.map((apiCall) => apiCall.provider)]), [ai.apiCalls.apiCalls, ai.models.models, ai.routes.routes, ai.runs.runs])
  const tierOptions = useMemo(() => uniqueValues([...ai.models.models.map((model) => model.defaultTierKey), ...ai.pricingRules.pricingRules.map((rule) => rule.tierKey), ...ai.runs.runs.map((run) => run.selectedTierKey)]), [ai.models.models, ai.pricingRules.pricingRules, ai.runs.runs])
  const pricingStatusOptions = useMemo(() => uniqueValues(['active', 'draft', 'retired', ...ai.pricingRules.pricingRules.map((rule) => rule.status)]), [ai.pricingRules.pricingRules])
  const runTypeOptions = useMemo(() => uniqueValues(['image_generation', 'image_analysis', 'chat', ...ai.runs.runs.map((run) => run.runType)]), [ai.runs.runs])
  const runtimeStatusOptions = useMemo(() => uniqueValues(['queued', 'running', 'succeeded', 'failed', 'cancelled', ...ai.runs.runs.map((run) => run.status), ...ai.apiCalls.apiCalls.map((apiCall) => apiCall.status)]), [ai.apiCalls.apiCalls, ai.runs.runs])
  const enabledModels = ai.models.models.filter((model) => model.enabled).length
  const enabledRoutes = ai.routes.routes.filter((route) => route.enabled).length
  const activePricingRules = ai.pricingRules.pricingRules.filter((rule) => rule.status === 'active').length
  const failedApiCalls = ai.apiCalls.apiCalls.filter((apiCall) => apiCall.status !== 'succeeded').length
  const groupedRunCount = useMemo(() => new Set(ai.apiCalls.apiCalls.map((apiCall) => apiCall.runId)).size, [ai.apiCalls.apiCalls])

  return (
    <>
      <section className="management-summary-grid" aria-label="AI admin summary">
        <AiCallout body="Enabled registry entries" label="Models" value={`${enabledModels}/${ai.models.models.length || 0}`} />
        <AiCallout body="Enabled provider routes" label="Routes" value={`${enabledRoutes}/${ai.routes.routes.length || 0}`} />
        <AiCallout body="Pricing rules in scope" label="Pricing" value={`${activePricingRules}/${ai.pricingRules.pricingRules.length || 0}`} />
        <AiCallout body="Grouped runs represented by the current attempt window" label="Attempt groups" value={groupedRunCount.toLocaleString('en-US')} />
        <AiCallout body="Non-succeeded attempts in the current window" label="Runtime" value={failedApiCalls.toLocaleString('en-US')} />
      </section>

      <section className="management-panel management-panel-wide" aria-label="AI admin control plane">
        <div className="management-panel-heading">
          <div><h2>AI control plane</h2><p>Read-only inventory for models, routes, pricing, runs and provider calls.</p></div>
          <div className="management-actions">
            <div className="management-segmented">{limitOptions.map((option) => <button key={option} className={option === limit ? 'is-active' : undefined} onClick={() => setLimit(option)} type="button">{option}</button>)}</div>
            <button className="product-button product-button-secondary" onClick={ai.reload} type="button">Reload</button>
            <span className={`management-status ${ai.status === 'ready' ? 'is-success' : ''}`}>{ai.status}</span>
          </div>
        </div>
        {ai.error ? <p>{ai.error}</p> : null}
      </section>

      <section className="management-section-grid" aria-label="AI registry and routing">
        <ModelsPanel capabilityOptions={capabilityOptions} enabledFilter={modelEnabled} models={ai.models} onCapabilityChange={setModelCapability} onEnabledChange={setModelEnabled} selectedCapability={modelCapability} />
        <RoutesPanel enabledFilter={routeEnabled} modelOptions={modelOptions} onEnabledChange={setRouteEnabled} onModelChange={setRouteModelKey} onProviderChange={setRouteProviderKey} providerOptions={providerOptions} routes={ai.routes} selectedModel={routeModelKey} selectedProvider={routeProviderKey} />
      </section>

      <section className="management-section-grid" aria-label="AI pricing and runtime">
        <PricingRulesPanel modelOptions={modelOptions} onModelChange={setPricingModelKey} onStatusChange={setPricingStatus} onTierChange={setPricingTierKey} pricingRules={ai.pricingRules} selectedModel={pricingModelKey} selectedStatus={pricingStatus} selectedTier={pricingTierKey} statusOptions={pricingStatusOptions} tierOptions={tierOptions} />
        <RunsPanel modelOptions={modelOptions} onModelChange={setRunModelId} onStatusChange={setRunStatus} onTypeChange={setRunType} runs={ai.runs} selectedModel={runModelId} selectedStatus={runStatus} selectedType={runType} statusOptions={runtimeStatusOptions} typeOptions={runTypeOptions} />
      </section>

      <section className="management-section-grid" aria-label="AI API calls">
        <ApiCallsPanel apiCalls={ai.apiCalls} modelOptions={modelOptions} onModelChange={setApiCallModelId} onProviderChange={setApiCallProvider} onStatusChange={setApiCallStatus} providerOptions={providerOptions} selectedModel={apiCallModelId} selectedProvider={apiCallProvider} selectedStatus={apiCallStatus} statusOptions={runtimeStatusOptions} />
      </section>
    </>
  )
}
