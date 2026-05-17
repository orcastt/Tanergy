'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  type AdminPlanCatalogRecord,
  updateAdminPlanCatalog,
} from './adminFinanceClient'
import {
  loadAdminPlanCatalogResource,
  primeAdminPlanCatalogResource,
  readAdminPlanCatalogResource,
} from './adminPlanCatalogCache'
import { clearCachedBillingResources } from '@/features/billing/billingResourceCache'
import { formatDate } from './adminAiShared'
import {
  billingPeriodOptions,
  createDraftMap,
  type DraftFields,
  NumberField,
  planOrder,
  ReadOnlyField,
  SelectField,
  TextField,
  toInt,
  toNullableInt,
  updateDraft,
} from './adminPlanCatalogFormFields'
import {
  AdminPlanCatalogHighlights,
  AdminPlanCatalogRule,
  AdminPlanCatalogSection,
  formatAnnualUpfrontUsd,
} from './adminPlanCatalogPresentation'

export function AdminFinanceDashboard({
  enabled,
}: {
  enabled: boolean
}) {
  const cachedCatalog = readAdminPlanCatalogResource()
  const cachedPlans = cachedCatalog.data?.plans ?? []
  const [plans, setPlans] = useState<AdminPlanCatalogRecord[]>(cachedPlans)
  const [drafts, setDrafts] = useState<Record<string, DraftFields>>(() => createDraftMap(cachedPlans))
  const [status, setStatus] = useState<'error' | 'loading' | 'ready' | 'refreshing'>(cachedCatalog.data ? 'ready' : cachedCatalog.status === 'error' ? 'error' : 'loading')
  const [error, setError] = useState<string | null>(cachedCatalog.error ?? null)
  const [reloadToken, setReloadToken] = useState(0)
  const [savingPlanKey, setSavingPlanKey] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadAdminPlanCatalogResource({ force: reloadToken > 0 })
      .then((resource) => {
        if (cancelled) return
        setPlans(resource.plans)
        setDrafts(createDraftMap(resource.plans))
        setError(resource.error ?? null)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setError(nextError instanceof Error ? nextError.message : 'Plan catalog failed to load.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  function refreshPlans() {
    setMessage('')
    setStatus((current) => (current === 'ready' ? 'refreshing' : 'loading'))
    setReloadToken((value) => value + 1)
  }

  const orderedPlans = useMemo(
    () => [...plans].sort((left, right) => planOrder(left.planKey) - planOrder(right.planKey)),
    [plans],
  )
  const personalPlans = useMemo(
    () => orderedPlans.filter((plan) => plan.planFamily === 'free' || plan.planFamily === 'collaborate'),
    [orderedPlans],
  )
  const workspacePlans = useMemo(
    () => orderedPlans.filter((plan) => plan.planFamily === 'team' || plan.planFamily === 'enterprise'),
    [orderedPlans],
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
      primeAdminPlanCatalogResource({ ok: true, plans: nextPlans })
      clearCachedBillingResources('plans')
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
      <section className="management-panel management-panel-wide admin-plan-catalog-overview">
        <div className="management-panel-heading">
          <div><h2>Subscription plans</h2></div>
          <div className="management-actions">
            {message ? <span className="management-inline-note">{message}</span> : null}
            <button
              className="product-button product-button-secondary"
              disabled={status === 'loading' || status === 'refreshing'}
              onClick={refreshPlans}
              type="button"
            >
              Refresh
            </button>
            <span className={`management-status ${status === 'ready' ? 'is-success' : ''}`}>{status}</span>
          </div>
        </div>
        {error ? <p>{error}</p> : null}
        <div className="admin-plan-catalog-overview-grid">
          <div className="management-mini-stat">
            <span>Personal plans</span>
            <strong>{personalPlans.length}</strong>
          </div>
          <div className="management-mini-stat">
            <span>Workspace plans</span>
            <strong>{workspacePlans.length}</strong>
          </div>
          <div className="management-mini-stat">
            <span>Credits rule</span>
            <strong>Refresh every 30 days, no rollover</strong>
          </div>
          <div className="management-mini-stat">
            <span>Annual billing</span>
            <strong>Upfront 12-month charge</strong>
          </div>
        </div>
      </section>

      <AdminPlanCatalogSection
        description="Personal plans drive signup bonus credits, personal monthly credit refresh, and Group creation capacity. Group AI always charges the acting member’s own credits."
        title="Personal plans"
      >
        {personalPlans.map((plan) => renderPlanCard(plan))}
      </AdminPlanCatalogSection>

      <AdminPlanCatalogSection
        description="Workspace plans are Team and Enterprise surfaces. Team pricing is per seat, Team wallet credits refresh by seat pack, and annual billing always charges twelve months upfront."
        title="Workspace plans"
      >
        {workspacePlans.map((plan) => renderPlanCard(plan))}
      </AdminPlanCatalogSection>
    </section>
  )

  function renderPlanCard(plan: AdminPlanCatalogRecord) {
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

        <AdminPlanCatalogHighlights plan={plan} />
        <AdminPlanCatalogRule plan={plan} />

        <div className="admin-plan-catalog-grid">
          <TextField label="Plan name" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'name', value)} value={draft.name} />
          <SelectField label="Billing period" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'billingPeriod', value)} options={billingPeriodOptions} value={draft.billingPeriod} />
          <NumberField label="Monthly price USD" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'monthlyPriceUsd', value)} value={draft.monthlyPriceUsd} />
          <NumberField label="Annual rate / month USD" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'annualPriceUsd', value)} value={draft.annualPriceUsd} />
          <ReadOnlyField label="Annual upfront total" value={formatAnnualUpfrontUsd(plan)} />
          <NumberField label="Included credits / 30d" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'includedCredits', value)} value={draft.includedCredits} />
          <NumberField label="Board limit" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'boardLimit', value)} placeholder="blank = unlimited" value={draft.boardLimit} />
          <NumberField label="Page limit" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'pageLimit', value)} placeholder="blank = unlimited" value={draft.pageLimit} />
          <NumberField label="Signup bonus credits" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'registrationCredits', value)} value={draft.registrationCredits} />
          {plan.planFamily === 'collaborate' || plan.planFamily === 'free' ? (
            <>
              <NumberField label="Group workspace cap" onChange={(value) => updateDraft(setDrafts, plan.planKey, 'groupWorkspaceLimit', value)} value={draft.groupWorkspaceLimit} />
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
  }
}
