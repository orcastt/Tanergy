'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  loadAdminPlanCatalog,
  type AdminPlanCatalogRecord,
  updateAdminPlanCatalog,
} from './adminFinanceClient'
import { formatDate, selectStyle } from './adminAiShared'

type DraftFields = {
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

const emptyDrafts: Record<string, DraftFields> = {}
const billingPeriodOptions = [
  { label: 'none', value: 'none' },
  { label: 'monthly_or_annual', value: 'monthly_or_annual' },
  { label: 'contract', value: 'contract' },
]

export function AdminFinanceDashboard({
  enabled,
}: {
  enabled: boolean
  groupsSeed: unknown
  teamsSeed: unknown
}) {
  const [plans, setPlans] = useState<AdminPlanCatalogRecord[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftFields>>(emptyDrafts)
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [savingPlanKey, setSavingPlanKey] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadAdminPlanCatalog()
      .then((resource) => {
        if (cancelled) return
        setPlans(resource.plans)
        setDrafts(createDraftMap(resource.plans))
        setError(resource.error ?? null)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setPlans([])
        setDrafts(emptyDrafts)
        setError(nextError instanceof Error ? nextError.message : 'Plan catalog failed to load.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  const orderedPlans = useMemo(
    () => [...plans].sort((left, right) => planOrder(left.planKey) - planOrder(right.planKey)),
    [plans],
  )

  async function savePlan(plan: AdminPlanCatalogRecord) {
    const draft = drafts[plan.planKey]
    if (!draft) return
    setSavingPlanKey(plan.planKey)
    setMessage('')
    try {
      const result = await updateAdminPlanCatalog(plan.planKey, {
        annualPriceUsd: toNullableInt(draft.annualPriceUsd),
        billingPeriod: draft.billingPeriod,
        boardLimit: toNullableInt(draft.boardLimit),
        groupMemberLimit: toNullableInt(draft.groupMemberLimit),
        groupWorkspaceLimit: toNullableInt(draft.groupWorkspaceLimit),
        includedCredits: toInt(draft.includedCredits),
        monthlyPriceUsd: toNullableInt(draft.monthlyPriceUsd),
        name: draft.name.trim(),
        pageLimit: toNullableInt(draft.pageLimit),
        registrationCredits: toInt(draft.registrationCredits),
        seatMax: toNullableInt(draft.seatMax),
        seatMin: toNullableInt(draft.seatMin),
        seatRange: draft.seatRange.trim() || null,
      })
      const nextPlans = plans.map((item) => (item.planKey === plan.planKey ? result.plan : item))
      setPlans(nextPlans)
      setDrafts(createDraftMap(nextPlans))
      setMessage(`${result.plan.name} saved.`)
      setError(null)
      setStatus('ready')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Plan update failed.')
      setStatus('error')
    } finally {
      setSavingPlanKey('')
    }
  }

  return (
    <section className="management-stack admin-plan-catalog-shell" aria-label="Subscription plan catalog">
      <section className="management-panel management-panel-wide">
        <div className="management-panel-heading">
          <div><h2>Subscription plans</h2></div>
          <div className="management-actions">
            {message ? <span className="management-inline-note">{message}</span> : null}
            <span className={`management-status ${status === 'ready' ? 'is-success' : ''}`}>{status}</span>
          </div>
        </div>
        {error ? <p>{error}</p> : null}
      </section>

      {orderedPlans.map((plan) => {
        const draft = drafts[plan.planKey]
        if (!draft) return null
        return (
          <article className="management-panel management-panel-wide admin-plan-catalog-card" key={plan.planKey}>
            <div className="management-panel-heading">
              <div>
                <h2>{plan.name}</h2>
                <div className="admin-plan-catalog-meta">
                  <span className="management-badge">{plan.planKey}</span>
                  <span className="management-badge">{plan.planFamily}</span>
                  {plan.updatedAt ? <span className="admin-users-range-label">{formatDate(plan.updatedAt)}</span> : null}
                </div>
              </div>
              <button
                className="product-button"
                disabled={savingPlanKey === plan.planKey}
                onClick={() => savePlan(plan)}
                type="button"
              >
                {savingPlanKey === plan.planKey ? 'Saving' : 'Save'}
              </button>
            </div>

            <div className="admin-plan-catalog-grid">
              <TextField label="Plan name" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'name', value)} value={draft.name} />
              <SelectField label="Billing period" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'billingPeriod', value)} options={billingPeriodOptions} value={draft.billingPeriod} />
              <NumberField label="Monthly price USD" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'monthlyPriceUsd', value)} value={draft.monthlyPriceUsd} />
              <NumberField label="Annual price USD" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'annualPriceUsd', value)} value={draft.annualPriceUsd} />
              <NumberField label="Included credits" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'includedCredits', value)} value={draft.includedCredits} />
              <NumberField label="Board limit" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'boardLimit', value)} placeholder="blank = unlimited" value={draft.boardLimit} />
              <NumberField label="Page limit" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'pageLimit', value)} placeholder="blank = unlimited" value={draft.pageLimit} />
              <NumberField label="Registration credits" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'registrationCredits', value)} value={draft.registrationCredits} />
              {plan.planFamily === 'collaborate' ? (
                <>
                  <NumberField label="Group limit" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'groupWorkspaceLimit', value)} value={draft.groupWorkspaceLimit} />
                  <NumberField label="Group member cap" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'groupMemberLimit', value)} value={draft.groupMemberLimit} />
                </>
              ) : null}
              {plan.planFamily === 'team' ? (
                <>
                  <NumberField label="Seat min" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'seatMin', value)} value={draft.seatMin} />
                  <NumberField label="Seat max" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'seatMax', value)} value={draft.seatMax} />
                  <TextField label="Seat range" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'seatRange', value)} value={draft.seatRange} />
                </>
              ) : null}
            </div>
          </article>
        )
      })}
    </section>
  )
}

function createDraftMap(plans: AdminPlanCatalogRecord[]) {
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

function updateDraft(
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

function NumberField({
  label,
  onChange,
  placeholder,
  value,
}: {
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

function TextField({
  label,
  onChange,
  value,
}: {
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

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
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

function planOrder(planKey: string) {
  return ['free_canvas', 'collaborate_start', 'collaborate_plus', 'team_start', 'team_growth', 'enterprise'].indexOf(planKey)
}

function toFieldValue(value: null | number | string | undefined) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function toInt(value: string) {
  return Math.max(0, Math.trunc(Number.parseFloat(value) || 0))
}

function toNullableInt(value: string) {
  if (!value.trim()) return null
  return Math.max(0, Math.trunc(Number.parseFloat(value) || 0))
}
