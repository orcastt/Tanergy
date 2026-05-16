'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  loadAdminAiVersions,
  patchAdminAiModel,
  patchAdminAiPricingRule,
  patchAdminAiProviderRoute,
  publishAdminAiModel,
  publishAdminAiPricingRule,
  publishAdminAiProviderRoute,
  rollbackAdminAiModel,
  rollbackAdminAiPricingRule,
  rollbackAdminAiProviderRoute,
  type AdminAiControlPlaneVersionRecord,
  type AdminAiModelRecord,
  type AdminAiModelsResource,
  type AdminAiPricingRuleRecord,
  type AdminAiPricingRulesResource,
  type AdminAiProviderRouteRecord,
  type AdminAiProviderRoutesResource,
} from './adminAiClient'
import { selectStyle } from './adminAiShared'

const textAreaStyle = {
  ...selectStyle,
  minHeight: 108,
  padding: '12px',
}

export function AdminAiMutationPanels({
  models,
  pricingRules,
  routes,
  onSaved,
}: {
  models: AdminAiModelsResource
  pricingRules: AdminAiPricingRulesResource
  routes: AdminAiProviderRoutesResource
  onSaved: (message: string) => void
}) {
  return (
    <section className="management-section-grid" aria-label="AI admin mutations">
      <ModelEditorPanel models={models} onSaved={onSaved} />
      <RouteEditorPanel onSaved={onSaved} routes={routes} />
      <PricingRuleEditorPanel onSaved={onSaved} pricingRules={pricingRules} />
    </section>
  )
}

function ModelEditorPanel({ models, onSaved }: { models: AdminAiModelsResource; onSaved: (message: string) => void }) {
  const firstKey = models.models[0]?.modelKey ?? ''
  const [selectedKey, setSelectedKey] = useState(firstKey)
  const selected = models.models.find((model) => model.modelKey === (selectedKey || firstKey)) ?? models.models[0] ?? null

  return (
    <article className="management-panel">
      <EditorHeading title="Model editor" />
      <EditorSelect label="Model" onChange={setSelectedKey} options={models.models.map((model) => ({ label: model.displayName, value: model.modelKey }))} value={selected?.modelKey ?? ''} />
      {selected ? <ModelEditorForm key={selected.modelKey} model={selected} onSaved={onSaved} /> : <p>No model selected.</p>}
    </article>
  )
}

function RouteEditorPanel({ onSaved, routes }: { onSaved: (message: string) => void; routes: AdminAiProviderRoutesResource }) {
  const firstId = routes.routes[0]?.routeId ?? ''
  const [selectedId, setSelectedId] = useState(firstId)
  const selected = routes.routes.find((route) => route.routeId === (selectedId || firstId)) ?? routes.routes[0] ?? null

  return (
    <article className="management-panel">
      <EditorHeading title="Provider route editor" />
      <EditorSelect label="Route" onChange={setSelectedId} options={routes.routes.map((route) => ({ label: `${route.modelKey} · ${route.routeKey}`, value: route.routeId }))} value={selected?.routeId ?? ''} />
      {selected ? <RouteEditorForm key={selected.routeId} onSaved={onSaved} route={selected} /> : <p>No provider route selected.</p>}
    </article>
  )
}

function PricingRuleEditorPanel({ onSaved, pricingRules }: { onSaved: (message: string) => void; pricingRules: AdminAiPricingRulesResource }) {
  const firstId = pricingRules.pricingRules[0]?.id ?? ''
  const [selectedId, setSelectedId] = useState(firstId)
  const selected = pricingRules.pricingRules.find((rule) => rule.id === (selectedId || firstId)) ?? pricingRules.pricingRules[0] ?? null

  return (
    <article className="management-panel">
      <EditorHeading title="Pricing rule editor" />
      <EditorSelect label="Pricing rule" onChange={setSelectedId} options={pricingRules.pricingRules.map((rule) => ({ label: `${rule.modelKey} · ${rule.id}`, value: rule.id }))} value={selected?.id ?? ''} />
      {selected ? <PricingRuleEditorForm key={selected.id} onSaved={onSaved} pricingRule={selected} /> : <p>No pricing rule selected.</p>}
    </article>
  )
}

function ModelEditorForm({ model, onSaved }: { model: AdminAiModelRecord; onSaved: (message: string) => void }) {
  const [draft, setDraft] = useState(() => toModelDraft(model))
  const [message, setMessage] = useState<string | null>(null)

  async function handleSave() {
    try {
      await patchAdminAiModel(model.modelKey, {
        capability: draft.capability,
        costHint: draft.costHint,
        defaultPricingRuleId: draft.defaultPricingRuleId || null,
        defaultTierKey: draft.defaultTierKey || null,
        displayName: draft.displayName,
        enabled: draft.enabled,
        estimatedLatency: draft.estimatedLatency,
        isDefault: draft.isDefault,
        parameterSchema: JSON.parse(draft.parameterSchema),
        providerKey: draft.providerKey || null,
      })
      const nextMessage = `Saved model ${model.modelKey}.`
      setMessage(nextMessage)
      onSaved(nextMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Model save failed.')
    }
  }

  return (
    <EditorFormShell message={message}>
      <EditorInput label="Display name" onChange={(value) => setDraft({ ...draft, displayName: value })} value={draft.displayName} />
      <EditorInput label="Provider key" onChange={(value) => setDraft({ ...draft, providerKey: value })} value={draft.providerKey} />
      <EditorInput label="Capability" onChange={(value) => setDraft({ ...draft, capability: value })} value={draft.capability} />
      <EditorInput label="Default tier" onChange={(value) => setDraft({ ...draft, defaultTierKey: value })} value={draft.defaultTierKey} />
      <EditorInput label="Default pricing rule" onChange={(value) => setDraft({ ...draft, defaultPricingRuleId: value })} value={draft.defaultPricingRuleId} />
      <EditorInput label="Estimated latency" onChange={(value) => setDraft({ ...draft, estimatedLatency: value })} value={draft.estimatedLatency} />
      <EditorInput label="Cost hint" onChange={(value) => setDraft({ ...draft, costHint: value })} value={draft.costHint} />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <EditorCheckbox checked={draft.enabled} label="Enabled" onChange={(checked) => setDraft({ ...draft, enabled: checked })} />
        <EditorCheckbox checked={draft.isDefault} label="Default model" onChange={(checked) => setDraft({ ...draft, isDefault: checked })} />
      </div>
      <EditorTextArea label="Parameter schema" onChange={(value) => setDraft({ ...draft, parameterSchema: value })} value={draft.parameterSchema} />
      <button className="product-button" onClick={handleSave} type="button">Save model</button>
      <VersionActions
        onSaved={onSaved}
        publishVersion={() => publishAdminAiModel(model.modelKey)}
        resourceId={model.modelKey}
        resourceType="model"
        rollbackVersion={(versionId) => rollbackAdminAiModel(model.modelKey, versionId)}
      />
    </EditorFormShell>
  )
}

function RouteEditorForm({ onSaved, route }: { onSaved: (message: string) => void; route: AdminAiProviderRouteRecord }) {
  const [draft, setDraft] = useState(() => toRouteDraft(route))
  const [message, setMessage] = useState<string | null>(null)

  async function handleSave() {
    try {
      await patchAdminAiProviderRoute(route.routeId, {
        enabled: draft.enabled,
        healthStatus: draft.healthStatus,
        modelKey: draft.modelKey,
        priority: Number(draft.priority),
        providerKey: draft.providerKey,
        providerModel: draft.providerModel,
        retryPolicy: JSON.parse(draft.retryPolicy),
        routeKey: draft.routeKey,
        timeoutMs: Number(draft.timeoutMs),
        weight: Number(draft.weight),
      })
      const nextMessage = `Saved route ${route.routeKey}.`
      setMessage(nextMessage)
      onSaved(nextMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Provider route save failed.')
    }
  }

  return (
    <EditorFormShell message={message}>
      <EditorInput label="Model key" onChange={(value) => setDraft({ ...draft, modelKey: value })} value={draft.modelKey} />
      <EditorInput label="Provider key" onChange={(value) => setDraft({ ...draft, providerKey: value })} value={draft.providerKey} />
      <EditorInput label="Provider model" onChange={(value) => setDraft({ ...draft, providerModel: value })} value={draft.providerModel} />
      <EditorInput label="Route key" onChange={(value) => setDraft({ ...draft, routeKey: value })} value={draft.routeKey} />
      <EditorInput label="Priority" onChange={(value) => setDraft({ ...draft, priority: value })} value={draft.priority} />
      <EditorInput label="Weight" onChange={(value) => setDraft({ ...draft, weight: value })} value={draft.weight} />
      <EditorInput label="Timeout ms" onChange={(value) => setDraft({ ...draft, timeoutMs: value })} value={draft.timeoutMs} />
      <EditorInput label="Health status" onChange={(value) => setDraft({ ...draft, healthStatus: value })} value={draft.healthStatus} />
      <EditorCheckbox checked={draft.enabled} label="Enabled" onChange={(checked) => setDraft({ ...draft, enabled: checked })} />
      <EditorTextArea label="Retry policy" onChange={(value) => setDraft({ ...draft, retryPolicy: value })} value={draft.retryPolicy} />
      <button className="product-button" onClick={handleSave} type="button">Save route</button>
      <VersionActions
        onSaved={onSaved}
        publishVersion={() => publishAdminAiProviderRoute(route.routeId)}
        resourceId={route.routeId}
        resourceType="provider_route"
        rollbackVersion={(versionId) => rollbackAdminAiProviderRoute(route.routeId, versionId)}
      />
    </EditorFormShell>
  )
}

function PricingRuleEditorForm({ onSaved, pricingRule }: { onSaved: (message: string) => void; pricingRule: AdminAiPricingRuleRecord }) {
  const [draft, setDraft] = useState(() => toPricingDraft(pricingRule))
  const [message, setMessage] = useState<string | null>(null)

  async function handleSave() {
    try {
      await patchAdminAiPricingRule(pricingRule.id, {
        billingUnit: draft.billingUnit,
        creditMultiplier: Number(draft.creditMultiplier),
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || null,
        estimatedCredits: Number(draft.estimatedCredits),
        minCredits: Number(draft.minCredits),
        modelKey: draft.modelKey,
        providerCostFormula: JSON.parse(draft.providerCostFormula),
        status: draft.status,
        tierKey: draft.tierKey || null,
      })
      const nextMessage = `Saved pricing rule ${pricingRule.id}.`
      setMessage(nextMessage)
      onSaved(nextMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pricing rule save failed.')
    }
  }

  return (
    <EditorFormShell message={message}>
      <EditorInput label="Model key" onChange={(value) => setDraft({ ...draft, modelKey: value })} value={draft.modelKey} />
      <EditorInput label="Tier key" onChange={(value) => setDraft({ ...draft, tierKey: value })} value={draft.tierKey} />
      <EditorInput label="Billing unit" onChange={(value) => setDraft({ ...draft, billingUnit: value })} value={draft.billingUnit} />
      <EditorInput label="Estimated credits" onChange={(value) => setDraft({ ...draft, estimatedCredits: value })} value={draft.estimatedCredits} />
      <EditorInput label="Minimum credits" onChange={(value) => setDraft({ ...draft, minCredits: value })} value={draft.minCredits} />
      <EditorInput label="Credit multiplier" onChange={(value) => setDraft({ ...draft, creditMultiplier: value })} value={draft.creditMultiplier} />
      <EditorInput label="Status" onChange={(value) => setDraft({ ...draft, status: value })} value={draft.status} />
      <EditorInput label="Effective from" onChange={(value) => setDraft({ ...draft, effectiveFrom: value })} value={draft.effectiveFrom} />
      <EditorInput label="Effective to" onChange={(value) => setDraft({ ...draft, effectiveTo: value })} value={draft.effectiveTo} />
      <EditorTextArea label="Provider cost formula" onChange={(value) => setDraft({ ...draft, providerCostFormula: value })} value={draft.providerCostFormula} />
      <button className="product-button" onClick={handleSave} type="button">Save pricing rule</button>
      <VersionActions
        onSaved={onSaved}
        publishVersion={() => publishAdminAiPricingRule(pricingRule.id)}
        resourceId={pricingRule.id}
        resourceType="pricing_rule"
        rollbackVersion={(versionId) => rollbackAdminAiPricingRule(pricingRule.id, versionId)}
      />
    </EditorFormShell>
  )
}

function EditorHeading({ title }: { title: string }) {
  return (
    <div className="management-panel-heading">
      <div>
        <h2>{title}</h2>
      </div>
    </div>
  )
}

function EditorFormShell({ children, message }: { children: ReactNode; message: null | string }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {message ? <p>{message}</p> : null}
      {children}
    </div>
  )
}

function EditorInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <input onChange={(event) => onChange(event.target.value)} style={selectStyle} type="text" value={value} />
    </label>
  )
}

function EditorTextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <textarea onChange={(event) => onChange(event.target.value)} style={textAreaStyle} value={value} />
    </label>
  )
}

function EditorSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function EditorCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>
}


function VersionActions({
  onSaved,
  publishVersion,
  resourceId,
  resourceType,
  rollbackVersion,
}: {
  onSaved: (message: string) => void
  publishVersion: () => Promise<{ error?: string; ok: boolean; version?: AdminAiControlPlaneVersionRecord }>
  resourceId: string
  resourceType: string
  rollbackVersion: (versionId: string) => Promise<{ error?: string; ok: boolean; version?: AdminAiControlPlaneVersionRecord }>
}) {
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [versions, setVersions] = useState<AdminAiControlPlaneVersionRecord[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(async () => {
        if (cancelled) return
        setHistoryStatus('loading')
        const payload = await loadAdminAiVersions({ limit: 5, resourceId, resourceType })
        if (cancelled) return
        setVersions(payload.versions)
        setHistoryStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setMessage(error instanceof Error ? error.message : 'Version history unavailable.')
        setHistoryStatus('idle')
      })
    return () => {
      cancelled = true
    }
  }, [resourceId, resourceType])

  async function handlePublish() {
    try {
      const payload = await publishVersion()
      const nextMessage = payload.version ? `Published version ${payload.version.versionNumber}.` : 'Published current version.'
      setMessage(nextMessage)
      onSaved(nextMessage)
      const reloaded = await loadAdminAiVersions({ limit: 5, resourceId, resourceType })
      setVersions(reloaded.versions)
      setHistoryStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Publish failed.')
    }
  }

  async function handleRollback(versionId: string) {
    try {
      const payload = await rollbackVersion(versionId)
      const nextMessage = payload.version ? `Rolled back to version ${payload.version.versionNumber}.` : 'Rollback completed.'
      setMessage(nextMessage)
      onSaved(nextMessage)
      const reloaded = await loadAdminAiVersions({ limit: 5, resourceId, resourceType })
      setVersions(reloaded.versions)
      setHistoryStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rollback failed.')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <strong style={{ fontSize: 13 }}>Version history</strong>
        <button className="product-button product-button-secondary" onClick={handlePublish} type="button">Publish current</button>
      </div>
      {message ? <p>{message}</p> : null}
      {historyStatus === 'loading' ? <p>Loading versions…</p> : null}
      {versions.length ? (
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Action</th>
                <th>Published</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td>v{version.versionNumber}</td>
                  <td>{formatVersionAction(version.action)}</td>
                  <td>{version.publishedAt ?? version.createdAt}</td>
                  <td>
                    <button className="product-button product-button-secondary" onClick={() => handleRollback(version.id)} type="button">Rollback</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : historyStatus === 'ready' ? <p>No published versions yet.</p> : null}
    </div>
  )
}

function formatVersionAction(value: string) {
  return value === 'rollback' ? 'Rollback' : 'Publish'
}

type ModelDraft = {
  capability: string
  costHint: string
  defaultPricingRuleId: string
  defaultTierKey: string
  displayName: string
  enabled: boolean
  estimatedLatency: string
  isDefault: boolean
  parameterSchema: string
  providerKey: string
}

type RouteDraft = {
  enabled: boolean
  healthStatus: string
  modelKey: string
  priority: string
  providerKey: string
  providerModel: string
  retryPolicy: string
  routeKey: string
  timeoutMs: string
  weight: string
}

type PricingDraft = {
  billingUnit: string
  creditMultiplier: string
  effectiveFrom: string
  effectiveTo: string
  estimatedCredits: string
  minCredits: string
  modelKey: string
  providerCostFormula: string
  status: string
  tierKey: string
}

function toModelDraft(model: AdminAiModelRecord): ModelDraft {
  return {
    capability: model.capability,
    costHint: model.costHint,
    defaultPricingRuleId: model.defaultPricingRuleId ?? '',
    defaultTierKey: model.defaultTierKey ?? '',
    displayName: model.displayName,
    enabled: model.enabled,
    estimatedLatency: model.estimatedLatency,
    isDefault: model.isDefault,
    parameterSchema: JSON.stringify(model.parameterSchema, null, 2),
    providerKey: model.providerKey ?? '',
  }
}

function toRouteDraft(route: AdminAiProviderRouteRecord): RouteDraft {
  return {
    enabled: route.enabled,
    healthStatus: route.healthStatus,
    modelKey: route.modelKey,
    priority: String(route.priority),
    providerKey: route.providerKey,
    providerModel: route.providerModel,
    retryPolicy: JSON.stringify(route.retryPolicy, null, 2),
    routeKey: route.routeKey,
    timeoutMs: String(route.timeoutMs),
    weight: String(route.weight),
  }
}

function toPricingDraft(rule: AdminAiPricingRuleRecord): PricingDraft {
  return {
    billingUnit: rule.billingUnit,
    creditMultiplier: String(rule.creditMultiplier),
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo ?? '',
    estimatedCredits: String(rule.estimatedCredits),
    minCredits: String(rule.minCredits),
    modelKey: rule.modelKey,
    providerCostFormula: JSON.stringify(rule.providerCostFormula, null, 2),
    status: rule.status,
    tierKey: rule.tierKey ?? '',
  }
}
