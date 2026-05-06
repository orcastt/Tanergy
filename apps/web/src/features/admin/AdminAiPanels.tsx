'use client'

import type {
  AdminAiModelsResource,
  AdminAiPricingRulesResource,
  AdminAiProviderRoutesResource,
} from './adminAiClient'
import {
  EmptyRow,
  FilterSelect,
  MetaLine,
  filterGridStyle,
  formatDate,
  formatNumber,
  schemaPreview,
  type BooleanFilter,
} from './adminAiShared'

export function ModelsPanel({
  capabilityOptions,
  enabledFilter,
  models,
  onCapabilityChange,
  onEnabledChange,
  selectedCapability,
}: {
  capabilityOptions: string[]
  enabledFilter: BooleanFilter
  models: AdminAiModelsResource
  onCapabilityChange: (value: string) => void
  onEnabledChange: (value: BooleanFilter) => void
  selectedCapability: string
}) {
  return (
    <article className="management-panel">
      <PanelHeading body="Registry defaults, parameter schemas and routing affinity." rows={models.models.length} title="Models" />
      <div style={filterGridStyle(2)}>
        <FilterSelect label="Capability" onChange={onCapabilityChange} options={capabilityOptions} value={selectedCapability} />
        <FilterSelect label="Enabled" onChange={(value) => onEnabledChange(value as BooleanFilter)} options={[{ label: 'All', value: 'all' }, { label: 'Enabled', value: 'enabled' }, { label: 'Disabled', value: 'disabled' }]} value={enabledFilter} />
      </div>
      {models.error ? <p>{models.error}</p> : null}
      <div className="management-table-wrap">
        <table className="management-table">
          <thead><tr><th>Model</th><th>Capability</th><th>Provider</th><th>Defaults</th><th>Updated</th></tr></thead>
          <tbody>{models.models.length > 0 ? models.models.map((model) => <tr key={model.modelKey}><td><strong>{model.displayName}</strong><MetaLine>{model.modelKey}</MetaLine><MetaLine>{model.costHint}</MetaLine></td><td><span className="management-badge">{model.capability}</span><MetaLine>{model.capabilities.join(', ') || '—'}</MetaLine></td><td>{model.providerKey ?? '—'}<MetaLine>{model.estimatedLatency}</MetaLine></td><td>{model.defaultTierKey ?? '—'}<MetaLine>{model.defaultPricingRuleId ?? 'No rule linked'}</MetaLine><MetaLine>{model.isDefault ? 'Default model' : model.enabled ? 'Enabled' : 'Disabled'}</MetaLine></td><td>{formatDate(model.updatedAt)}<MetaLine>{schemaPreview(model.parameterSchema)}</MetaLine></td></tr>) : <EmptyRow colSpan={5} message="No models match the current filters." />}</tbody>
        </table>
      </div>
    </article>
  )
}

export function RoutesPanel({
  enabledFilter,
  modelOptions,
  onEnabledChange,
  onModelChange,
  onProviderChange,
  providerOptions,
  routes,
  selectedModel,
  selectedProvider,
}: {
  enabledFilter: BooleanFilter
  modelOptions: string[]
  onEnabledChange: (value: BooleanFilter) => void
  onModelChange: (value: string) => void
  onProviderChange: (value: string) => void
  providerOptions: string[]
  routes: AdminAiProviderRoutesResource
  selectedModel: string
  selectedProvider: string
}) {
  return (
    <article className="management-panel">
      <PanelHeading body="Failover candidates, priority order and health flags." rows={routes.routes.length} title="Provider routes" />
      <div style={filterGridStyle(3)}>
        <FilterSelect label="Model" onChange={onModelChange} options={modelOptions} value={selectedModel} />
        <FilterSelect label="Provider" onChange={onProviderChange} options={providerOptions} value={selectedProvider} />
        <FilterSelect label="Enabled" onChange={(value) => onEnabledChange(value as BooleanFilter)} options={[{ label: 'All', value: 'all' }, { label: 'Enabled', value: 'enabled' }, { label: 'Disabled', value: 'disabled' }]} value={enabledFilter} />
      </div>
      {routes.error ? <p>{routes.error}</p> : null}
      <div className="management-table-wrap">
        <table className="management-table">
          <thead><tr><th>Route</th><th>Target</th><th>Priority</th><th>Health</th><th>Updated</th></tr></thead>
          <tbody>{routes.routes.length > 0 ? routes.routes.map((route) => <tr key={route.routeId}><td><strong>{route.routeKey}</strong><MetaLine>{route.routeId}</MetaLine></td><td>{route.modelKey}<MetaLine>{route.providerKey}</MetaLine><MetaLine>{route.providerModel}</MetaLine></td><td>#{route.priority}<MetaLine>Weight {route.weight}</MetaLine></td><td><span className="management-badge">{route.healthStatus}</span><MetaLine>{route.enabled ? 'Enabled' : 'Disabled'}</MetaLine><MetaLine>{route.timeoutMs.toLocaleString('en-US')} ms</MetaLine></td><td>{formatDate(route.updatedAt)}<MetaLine>{schemaPreview(route.retryPolicy)}</MetaLine></td></tr>) : <EmptyRow colSpan={5} message="No provider routes match the current filters." />}</tbody>
        </table>
      </div>
    </article>
  )
}

export function PricingRulesPanel({
  modelOptions,
  onModelChange,
  onStatusChange,
  onTierChange,
  pricingRules,
  selectedModel,
  selectedStatus,
  selectedTier,
  statusOptions,
  tierOptions,
}: {
  modelOptions: string[]
  onModelChange: (value: string) => void
  onStatusChange: (value: string) => void
  onTierChange: (value: string) => void
  pricingRules: AdminAiPricingRulesResource
  selectedModel: string
  selectedStatus: string
  selectedTier: string
  statusOptions: string[]
  tierOptions: string[]
}) {
  return (
    <article className="management-panel">
      <PanelHeading body="Tiered credit rules that the backend quote path resolves." rows={pricingRules.pricingRules.length} title="Pricing rules" />
      <div style={filterGridStyle(3)}>
        <FilterSelect label="Model" onChange={onModelChange} options={modelOptions} value={selectedModel} />
        <FilterSelect label="Tier" onChange={onTierChange} options={tierOptions} value={selectedTier} />
        <FilterSelect label="Status" onChange={onStatusChange} options={statusOptions} value={selectedStatus} />
      </div>
      {pricingRules.error ? <p>{pricingRules.error}</p> : null}
      <div className="management-table-wrap">
        <table className="management-table">
          <thead><tr><th>Rule</th><th>Model</th><th>Credits</th><th>Window</th><th>Status</th></tr></thead>
          <tbody>{pricingRules.pricingRules.length > 0 ? pricingRules.pricingRules.map((rule) => <tr key={rule.id}><td><strong>{rule.id}</strong><MetaLine>{rule.billingUnit}</MetaLine></td><td>{rule.modelKey}<MetaLine>{rule.tierKey ?? 'Base tier'}</MetaLine></td><td>{formatNumber(rule.estimatedCredits)} est<MetaLine>{formatNumber(rule.minCredits)} min</MetaLine><MetaLine>{formatNumber(rule.creditMultiplier)}x multiplier</MetaLine></td><td>{formatDate(rule.effectiveFrom)}<MetaLine>{rule.effectiveTo ? formatDate(rule.effectiveTo) : 'Open-ended'}</MetaLine></td><td><span className="management-badge">{rule.status}</span><MetaLine>{schemaPreview(rule.providerCostFormula)}</MetaLine></td></tr>) : <EmptyRow colSpan={5} message="No pricing rules match the current filters." />}</tbody>
        </table>
      </div>
    </article>
  )
}

function PanelHeading({ body, rows, title }: { body: string; rows: number; title: string }) {
  return <div className="management-panel-heading"><div><h2>{title}</h2><p>{body}</p></div><span className="management-badge">{rows} rows</span></div>
}
