'use client'

import { useState } from 'react'
import {
  patchAdminAiModel,
  patchAdminAiPricingRule,
  patchAdminAiProviderRoute,
  publishAdminAiModel,
  publishAdminAiPricingRule,
  publishAdminAiProviderRoute,
  rollbackAdminAiModel,
  rollbackAdminAiPricingRule,
  rollbackAdminAiProviderRoute,
  type AdminAiModelRecord,
  type AdminAiModelsResource,
  type AdminAiPricingRuleRecord,
  type AdminAiPricingRulesResource,
  type AdminAiProviderRouteRecord,
  type AdminAiProviderRoutesResource,
} from './adminAiClient'
import {
  toModelDraft,
  toPricingDraft,
  toRouteDraft,
} from './adminAiMutationDrafts'
import {
  EditorCheckbox,
  EditorFormShell,
  EditorHeading,
  EditorInput,
  EditorSelect,
  EditorTextArea,
  VersionActions,
} from './adminAiMutationPanelSupport'

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
