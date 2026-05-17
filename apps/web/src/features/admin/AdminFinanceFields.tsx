'use client'

import { selectStyle } from './adminAiShared'
import { readAdminPlanCatalogResource } from './adminPlanCatalogCache'

export const collaboratePlans = ['collaborate_start', 'collaborate_plus']
export const effectModes = ['immediate', 'next_week'] as const
export const effectModeOptions = [
  { label: 'Now', value: 'immediate' },
  { label: 'Next week', value: 'next_week' },
] as const
export const teamPlans = ['team_start', 'team_growth']
export const durationMonthOptions = Array.from({ length: 12 }, (_value, index) => ({
  label: `${index + 1} ${index === 0 ? 'month' : 'months'}`,
  value: String(index + 1),
}))
export const subscriptionStatuses = ['active', 'trialing'] as const

type SelectOption = string | { label: string; value: string }

export function NumberInput({
  label,
  max,
  min = '0',
  onChange,
  value,
}: {
  label: string
  max?: string
  min?: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="management-field-label">{label}</span>
      <input max={max} min={min} onChange={(event) => onChange(event.target.value)} style={selectStyle} type="number" value={value} />
    </label>
  )
}

export function TextInput({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder?: string; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="management-field-label">{label}</span>
      <input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={selectStyle} type="text" value={value} />
    </label>
  )
}

export function StrictSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: readonly SelectOption[] | SelectOption[]; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="management-field-label">{label}</span>
      <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
        {options.map((option) => {
          const resolved = typeof option === 'string' ? { label: option, value: option } : option
          return <option key={resolved.value} value={resolved.value}>{resolved.label}</option>
        })}
      </select>
    </label>
  )
}

export function getCollaboratePlanOptions() {
  return buildPlanOptions(collaboratePlans)
}

export function getTeamPlanOptions() {
  return buildPlanOptions(teamPlans)
}

export function PlanScheduleFields({
  durationCount,
  effectMode,
  onDurationCountChange,
  onEffectModeChange,
}: {
  durationCount: string
  effectMode: string
  onDurationCountChange: (value: string) => void
  onEffectModeChange: (value: string) => void
}) {
  return (
    <>
      <StrictSelect label="Effective" onChange={onEffectModeChange} options={effectModeOptions} value={effectMode} />
      <StrictSelect label="Duration" onChange={onDurationCountChange} options={durationMonthOptions} value={durationCount} />
    </>
  )
}

export function TeamMonthlyScheduleFields({
  durationCount,
  effectMode,
  onDurationCountChange,
  onEffectModeChange,
}: {
  durationCount: string
  effectMode: string
  onDurationCountChange: (value: string) => void
  onEffectModeChange: (value: string) => void
}) {
  return (
    <>
      <StrictSelect label="Effective" onChange={onEffectModeChange} options={effectModeOptions} value={effectMode} />
      <StrictSelect label="Duration" onChange={onDurationCountChange} options={durationMonthOptions} value={durationCount} />
    </>
  )
}

export function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="manual-finance-toggle"><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>
}

export function toFloat(value: string) {
  return Math.max(0, Number.parseFloat(value) || 0)
}

export function toInt(value: string) {
  return Math.max(0, Math.trunc(Number.parseFloat(value) || 0))
}

function buildPlanOptions(planKeys: readonly string[]) {
  const catalog = readAdminPlanCatalogResource().data?.plans ?? []
  const names = new Map(catalog.map((plan) => [plan.planKey, plan.name] as const))
  return planKeys.map((planKey) => ({
    label: names.get(planKey) || humanizePlanKey(planKey),
    value: planKey,
  }))
}

function humanizePlanKey(value: string) {
  return value
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}
