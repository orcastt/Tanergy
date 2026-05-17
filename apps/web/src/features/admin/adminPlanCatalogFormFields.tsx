'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { AdminPlanCatalogRecord } from './adminFinanceClient'
import { selectStyle } from './adminAiShared'

export type DraftFields = {
  annualPriceUsd: string
  billingPeriod: string
  boardLimit: string
  groupMemberLimit: string
  groupWorkspaceLimit: string
  includedCredits: string
  monthlyPriceUsd: string
  name: string
  pageLimit: string
  registrationCredits: string
  seatMax: string
  seatMin: string
  seatRange: string
}

export const billingPeriodOptions = [
  { label: 'none', value: 'none' },
  { label: 'monthly_or_annual', value: 'monthly_or_annual' },
  { label: 'contract', value: 'contract' },
]

export function createDraftMap(plans: AdminPlanCatalogRecord[]) {
  return Object.fromEntries(plans.map((plan) => [plan.planKey, {
    annualPriceUsd: toFieldValue(plan.annualPriceUsd),
    billingPeriod: plan.billingPeriod,
    boardLimit: toFieldValue(plan.boardLimit),
    groupMemberLimit: toFieldValue(plan.groupMemberLimit),
    groupWorkspaceLimit: toFieldValue(plan.groupWorkspaceLimit),
    includedCredits: String(plan.includedCredits ?? 0),
    monthlyPriceUsd: toFieldValue(plan.monthlyPriceUsd),
    name: plan.name,
    pageLimit: toFieldValue(plan.pageLimit),
    registrationCredits: String(plan.registrationCredits ?? 0),
    seatMax: toFieldValue(plan.seatMax),
    seatMin: toFieldValue(plan.seatMin),
    seatRange: plan.seatRange ?? '',
  } satisfies DraftFields]))
}

export function updateDraft(
  setDrafts: Dispatch<SetStateAction<Record<string, DraftFields>>>,
  planKey: string,
  field: keyof DraftFields,
  value: string,
) {
  setDrafts((current) => ({
    ...current,
    [planKey]: {
      ...current[planKey],
      [field]: value,
    },
  }))
}

export function NumberField({ label, onChange, placeholder, value }: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <label className="admin-plan-catalog-field">
      <span className="management-field-label">{label}</span>
      <input min="0" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={selectStyle} type="number" value={value} />
    </label>
  )
}

export function TextField({ label, onChange, value }: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="admin-plan-catalog-field">
      <span className="management-field-label">{label}</span>
      <input onChange={(event) => onChange(event.target.value)} style={selectStyle} type="text" value={value} />
    </label>
  )
}

export function SelectField({ label, onChange, options, value }: {
  label: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
  value: string
}) {
  return (
    <label className="admin-plan-catalog-field">
      <span className="management-field-label">{label}</span>
      <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

export function ReadOnlyField({ label, value }: {
  label: string
  value: string
}) {
  return (
    <label className="admin-plan-catalog-field">
      <span className="management-field-label">{label}</span>
      <div className="admin-plan-catalog-readonly">{value}</div>
    </label>
  )
}

export function planOrder(planKey: string) {
  return ['free_canvas', 'collaborate_start', 'collaborate_plus', 'team_start', 'team_growth', 'enterprise'].indexOf(planKey)
}

export function toInt(value: string) {
  return Math.max(0, Math.trunc(Number.parseFloat(value) || 0))
}

export function toNullableInt(value: string) {
  if (!value.trim()) return null
  return Math.max(0, Math.trunc(Number.parseFloat(value) || 0))
}

function toFieldValue(value: null | number | string | undefined) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}
