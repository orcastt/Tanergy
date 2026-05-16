'use client'

import { useState } from 'react'
import {
  patchAdminAiProviderRoute,
  type AdminAiProviderRouteRecord,
} from './adminAiClient'
import { formatCompactDateTime, selectStyle } from './adminAiShared'

const providerKeyOptions = [
  { label: 'GeekAI', value: 'geekai' },
  { label: 'Jiekou AI', value: 'jiekou' },
  { label: 'Google', value: 'google' },
  { label: 'OpenAI', value: 'openai' },
]

export function AdminApiRouteEditorForm({
  onSaved,
  route,
}: {
  onSaved: () => void
  route: AdminAiProviderRouteRecord
}) {
  const [draft, setDraft] = useState(() => toRouteDraft(route))
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveRoute() {
    setSaving(true)
    setMessage('Saving...')
    try {
      await patchAdminAiProviderRoute(route.routeId, {
        enabled: draft.enabled,
        healthStatus: draft.healthStatus,
        modelKey: draft.modelKey,
        priority: toNumber(draft.priority, route.priority),
        providerKey: draft.providerKey,
        providerModel: draft.providerModel,
        retryPolicy: parseJson(draft.retryPolicy, route.retryPolicy),
        routeKey: draft.routeKey,
        timeoutMs: toNumber(draft.timeoutMs, route.timeoutMs),
        weight: toNumber(draft.weight, route.weight),
      })
      setMessage('Saved.')
      onSaved()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-route-form">
      <div className="management-field-grid two">
        <EditorInput label="Route key" onChange={(value) => setDraft({ ...draft, routeKey: value })} value={draft.routeKey} />
        <EditorInput label="Model key" onChange={(value) => setDraft({ ...draft, modelKey: value })} value={draft.modelKey} />
        <EditorSelectInput label="Provider key" onChange={(value) => setDraft({ ...draft, providerKey: value })} options={getProviderKeyOptions(draft.providerKey)} value={draft.providerKey} />
        <EditorInput label="Provider model" onChange={(value) => setDraft({ ...draft, providerModel: value })} value={draft.providerModel} />
        <EditorInput label="Priority" onChange={(value) => setDraft({ ...draft, priority: value })} value={draft.priority} />
        <EditorInput label="Weight" onChange={(value) => setDraft({ ...draft, weight: value })} value={draft.weight} />
        <EditorInput label="Timeout ms" onChange={(value) => setDraft({ ...draft, timeoutMs: value })} value={draft.timeoutMs} />
        <EditorInput label="Health" onChange={(value) => setDraft({ ...draft, healthStatus: value })} value={draft.healthStatus} />
      </div>
      <label className="manual-finance-toggle">
        <input checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} type="checkbox" />
        Enabled
      </label>
      <label className="admin-route-json">
        <span className="management-field-label">Retry policy</span>
        <textarea onChange={(event) => setDraft({ ...draft, retryPolicy: event.target.value })} style={{ ...selectStyle, minHeight: 108, padding: 12 }} value={draft.retryPolicy} />
      </label>
      <div className="management-actions">
        <button className="product-button" disabled={saving} onClick={saveRoute} type="button">Save route</button>
        <span className="management-inline-note">{message || `Updated ${formatCompactDateTime(route.updatedAt)}`}</span>
      </div>
    </div>
  )
}

function EditorInput({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="management-field-label">{label}</span>
      <input onChange={(event) => onChange(event.target.value)} style={selectStyle} type="text" value={value} />
    </label>
  )
}

function EditorSelectInput({
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
      <span className="management-field-label">{label}</span>
      <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function parseJson(value: string, fallback: Record<string, unknown>) {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return fallback
  }
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toRouteDraft(route: AdminAiProviderRouteRecord) {
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

function getProviderKeyOptions(currentValue: string) {
  if (providerKeyOptions.some((option) => option.value === currentValue)) return providerKeyOptions
  return [...providerKeyOptions, { label: currentValue, value: currentValue }]
}
