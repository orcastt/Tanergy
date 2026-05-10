'use client'

import { selectStyle } from './adminAiShared'

export const collaboratePlans = ['collaborate_start', 'collaborate_plus']
export const durationUnitDayOptions = ['7', '30', '365'] as const
export const effectModes = ['immediate', 'next_week'] as const
export const teamPlans = ['team_start', 'team_growth']
export const subscriptionStatuses = ['active', 'trialing'] as const

export function NumberInput({ label, min = '0', onChange, value }: { label: string; min?: string; onChange: (value: string) => void; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="management-field-label">{label}</span>
      <input min={min} onChange={(event) => onChange(event.target.value)} style={selectStyle} type="number" value={value} />
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

export function StrictSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: readonly string[] | string[]; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="management-field-label">{label}</span>
      <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

export function PlanScheduleFields({
  durationCount,
  durationUnitDays,
  effectMode,
  onDurationCountChange,
  onDurationUnitDaysChange,
  onEffectModeChange,
}: {
  durationCount: string
  durationUnitDays: string
  effectMode: string
  onDurationCountChange: (value: string) => void
  onDurationUnitDaysChange: (value: string) => void
  onEffectModeChange: (value: string) => void
}) {
  return (
    <>
      <StrictSelect label="Effective" onChange={onEffectModeChange} options={effectModes} value={effectMode} />
      <NumberInput label="Duration count" min="0" onChange={onDurationCountChange} value={durationCount} />
      <StrictSelect label="Days per unit" onChange={onDurationUnitDaysChange} options={durationUnitDayOptions} value={durationUnitDays} />
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
