'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatCredits } from './billingPresentation'
import { SubscriptionPlanAction } from './SubscriptionPlanAction'
import { useWorkspaceCommerceOverview, type CommercePlanMap } from './useWorkspaceCommerceOverview'
import type { PlanCatalogRecord, PlanKey } from './billingTypes'

type PricingCycle = 'annual' | 'monthly'

export function SubscriptionPlansView() {
  const [cycle, setCycle] = useState<PricingCycle>('monthly')
  const { error, overview, status } = useWorkspaceCommerceOverview()

  const activePlanCounts = useMemo(() => {
    if (!overview) return {} as Partial<Record<PlanKey, number>>
    const counts: Partial<Record<PlanKey, number>> = {
      [overview.groupSummary.planKey]: overview.groupSummary.planKey === 'free_canvas' ? 0 : 1,
    }
    for (const team of overview.teamCards.filter((card) => card.relationship === 'created')) {
      counts[team.planKey] = (counts[team.planKey] ?? 0) + 1
    }
    return counts
  }, [overview])

  const orderedPlans = useMemo(() => {
    if (!overview) return []
    return [...overview.plans].sort((left, right) => planOrder(left.planKey) - planOrder(right.planKey))
  }, [overview])

  if (!overview && status === 'loading') {
    return (
      <div className="product-page workspace-commerce-page">
        <section className="product-page-header workspace-commerce-header">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Subscription</h1>
            <p className="workspace-commerce-status">Loading live plans and workspace billing…</p>
          </div>
        </section>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="product-page workspace-commerce-page">
        <section className="product-page-header workspace-commerce-header">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Subscription</h1>
            <p className="workspace-commerce-status">{error ?? 'Workspace billing failed to load.'}</p>
          </div>
        </section>
      </div>
    )
  }

  const ownedTeams = overview.teamCards.filter((card) => card.relationship === 'created')
  const joinedTeams = overview.teamCards.filter((card) => card.relationship === 'joined')

  return (
    <div className="product-page workspace-commerce-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-row">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Subscription</h1>
            <p className="product-hero-copy">
              Real-time plan, credit, and seat state across your personal collaboration space and Team workspaces.
            </p>
            {error ? <p className="workspace-commerce-status" role="status">{error}</p> : null}
          </div>
          <div className="workspace-commerce-switch" aria-label="Billing cycle">
            <button className={cycle === 'monthly' ? 'is-active' : ''} onClick={() => setCycle('monthly')} type="button">Monthly</button>
            <button className={cycle === 'annual' ? 'is-active' : ''} onClick={() => setCycle('annual')} type="button">Annually</button>
          </div>
        </div>
      </section>

      <section className="workspace-commerce-summary-grid" aria-label="Subscription summary">
        <SummaryCard
          label="Personal plan"
          meta={`${overview.groupSummary.groupsCreated} created · ${overview.groupSummary.joinedGroups} joined`}
          value={overview.groupSummary.workspace.kind === 'solo_workspace' ? 'Free Canvas' : formatPlanName(overview.groupSummary.planKey, overview.planMap)}
        />
        <SummaryCard
          label="Included credits"
          meta="Personal + owned teams"
          value={formatCredits(overview.totalIncludedCredits)}
        />
        <SummaryCard
          label="Owned teams"
          meta={joinedTeams.length ? `${joinedTeams.length} joined separately` : 'All billed here'}
          value={String(ownedTeams.length)}
        />
        <SummaryCard
          label="Seats"
          meta="Across owned teams"
          value={`${overview.totalSeatsUsed}/${overview.totalSeatLimit || 0}`}
        />
      </section>

      <section className="workspace-commerce-section">
        <div className="workspace-commerce-section-head">
          <h2>Current coverage</h2>
          <Link className="workspace-commerce-tertiary-link" href="/usage">
            Open usage
          </Link>
        </div>

        <div className="workspace-commerce-active-grid">
          <article className="workspace-commerce-active-card" data-tone="group">
            <div className="workspace-commerce-card-head">
              <div>
                <span className="workspace-commerce-card-eyebrow">Personal collaboration</span>
                <h3>{overview.groupSummary.workspace.kind === 'solo_workspace' ? 'Free Canvas' : overview.groupSummary.name}</h3>
              </div>
              <span className="workspace-commerce-plan-badge">{formatPlanName(overview.groupSummary.planKey, overview.planMap)}</span>
            </div>
            <div className="workspace-commerce-card-stats">
              <Stat label="Credits" value={`${formatCredits(overview.groupSummary.remainingCredits)} / ${formatCredits(overview.groupSummary.totalCredits)}`} />
              <Stat label="Groups" value={`${overview.groupSummary.groupsCreated} / ${overview.groupSummary.groupLimit || 0}`} />
            </div>
            <div className="workspace-commerce-card-footer">
              <span className="workspace-commerce-note">{overview.groupSummary.topUpBalance ? `${formatCredits(overview.groupSummary.topUpBalance)} top-up credits live` : 'Usage is synced from the current billing contract'}</span>
              <div className="workspace-commerce-card-actions">
                <Link className="workspace-commerce-secondary-button" href="/usage?scope=group">Usage</Link>
                <Link className="workspace-commerce-secondary-button" href="/group">Groups</Link>
              </div>
            </div>
          </article>

          {ownedTeams.map((card) => (
            <article className="workspace-commerce-active-card" data-tone="team" key={card.id}>
              <div className="workspace-commerce-card-head">
                <div>
                  <span className="workspace-commerce-card-eyebrow">Team workspace</span>
                  <h3>{card.name}</h3>
                </div>
                <span className="workspace-commerce-plan-badge">{formatPlanName(card.planKey, overview.planMap)}</span>
              </div>
              <div className="workspace-commerce-card-stats">
                <Stat label="Credits" value={`${formatCredits(card.remainingCredits)} / ${formatCredits(card.totalCredits)}`} />
                <Stat label="Seats" value={`${card.seatsUsed} / ${card.seatLimit}`} />
              </div>
              <div className="workspace-commerce-card-footer">
                <span className="workspace-commerce-note">{card.topUpBalance ? `${formatCredits(card.topUpBalance)} top-up credits live` : `${card.memberCount} members in this cycle`}</span>
                <div className="workspace-commerce-card-actions">
                  <Link className="workspace-commerce-secondary-button" href={`/usage?scope=teams&workspace=${encodeURIComponent(card.id)}`}>Usage</Link>
                  <Link className="workspace-commerce-secondary-button" href={`/team/${encodeURIComponent(card.id)}`}>Team</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-commerce-section">
        <div className="workspace-commerce-section-head">
          <h2>Available plans</h2>
          <span className="workspace-commerce-note">Plan definitions are loaded from the live catalog</span>
        </div>

        <div className="workspace-commerce-plan-grid">
          {orderedPlans.map((plan) => (
            <PlanCard
              activeCount={activePlanCounts[plan.planKey as PlanKey] ?? 0}
              cycle={cycle}
              key={plan.planKey}
              plan={plan}
            />
          ))}
        </div>
      </section>

      <section className="workspace-commerce-section workspace-commerce-compare">
        <div className="workspace-commerce-section-head">
          <h2>Compare plans</h2>
        </div>
        <div className="workspace-commerce-compare-table">
          <div className="workspace-commerce-compare-row is-head">
            <span>Feature</span>
            {orderedPlans.map((plan) => <span key={plan.planKey}>{plan.name}</span>)}
          </div>
          {comparisonRows(orderedPlans).map((row) => (
            <div className="workspace-commerce-compare-row" key={row.label}>
              <span>{row.label}</span>
              {row.values.map((value, index) => <span key={`${row.label}-${orderedPlans[index]?.planKey ?? index}`}>{value}</span>)}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function PlanCard({
  activeCount,
  cycle,
  plan,
}: {
  activeCount: number
  cycle: PricingCycle
  plan: PlanCatalogRecord
}) {
  const price = formatPlanPrice(plan, cycle)
  const [priceValue, priceSuffix] = splitPlanPrice(price)
  const statusLabel = resolveStatusLabel(plan.planKey as PlanKey, activeCount)
  const href = resolvePlanHref(plan.planKey as PlanKey, activeCount)
  const buttonLabel = plan.planKey === 'free_canvas'
    ? 'Open'
    : activeCount > 0
      ? 'Manage'
      : plan.planKey === 'enterprise'
        ? 'Contact'
        : 'Select'

  return (
    <article className={`workspace-commerce-plan-card${activeCount > 0 ? ' is-current' : ''}`} data-plan={plan.planKey}>
      <div className="workspace-commerce-plan-head">
        <div>
          <span className="workspace-commerce-card-eyebrow">{plan.planFamily}</span>
          <strong className="workspace-commerce-plan-status">{statusLabel}</strong>
        </div>
      </div>
      <div>
        <h3>{plan.name}</h3>
      </div>
      <div className="workspace-commerce-plan-price">
        <strong>{priceValue}</strong>
        <small>{priceSuffix}</small>
      </div>
      <ul className="workspace-commerce-plan-list">
        {planHighlights(plan).map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
      <SubscriptionPlanAction
        activeCount={activeCount}
        className={activeCount > 0 || plan.planKey === 'enterprise' ? 'workspace-commerce-primary-button' : 'workspace-commerce-secondary-button'}
        href={href}
        label={buttonLabel}
        planKey={plan.planKey as PlanKey}
        planName={plan.name}
      />
    </article>
  )
}

function SummaryCard({
  label,
  meta,
  value,
}: {
  label: string
  meta: string
  value: string
}) {
  return (
    <article className="workspace-commerce-summary-card">
      <span className="workspace-commerce-summary-label">{label}</span>
      <strong className="workspace-commerce-summary-value">{value}</strong>
      <span className="workspace-commerce-summary-meta">{meta}</span>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-commerce-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function comparisonRows(plans: PlanCatalogRecord[]) {
  return [
    { label: 'Boards', values: plans.map((plan) => formatLimit(plan.boardLimit, 'Unlimited')) },
    { label: 'Pages', values: plans.map((plan) => formatLimit(plan.pageLimit, 'Unlimited')) },
    { label: 'Included credits', values: plans.map((plan) => plan.includedCredits ? formatCredits(plan.includedCredits) : 'Custom') },
    { label: 'Team seats', values: plans.map((plan) => plan.seatRange ?? '-') },
    { label: 'Group workspaces', values: plans.map((plan) => formatLimit(plan.groupWorkspaceLimit, '-')) },
    { label: 'Registration credits', values: plans.map((plan) => plan.registrationCredits ? formatCredits(plan.registrationCredits) : '-') },
  ]
}

function planHighlights(plan: PlanCatalogRecord) {
  return [
    `Boards: ${formatLimit(plan.boardLimit, 'Unlimited')}`,
    `Pages: ${formatLimit(plan.pageLimit, 'Unlimited')}`,
    `Credits: ${plan.includedCredits ? formatCredits(plan.includedCredits) : 'Custom'}`,
    `Seats: ${plan.seatRange ?? 'Single workspace'}`,
  ]
}

function formatLimit(value: null | number | undefined, fallback: string) {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function formatPlanName(planKey: PlanKey, planMap: CommercePlanMap) {
  return planMap?.[planKey]?.name ?? planKey.replace(/_/g, ' ')
}

function formatPlanPrice(plan: PlanCatalogRecord, cycle: PricingCycle) {
  if (plan.planKey === 'enterprise') return 'Custom'
  const amount = cycle === 'annual' ? plan.annualPriceUsd : plan.monthlyPriceUsd
  if (amount === null || amount === undefined) return 'Custom'
  if (amount === 0) return '$0'
  const suffix = plan.planFamily === 'team' ? '/seat/mo' : '/mo'
  return `$${amount}${suffix}`
}

function resolveStatusLabel(planKey: PlanKey, activeCount: number) {
  if (planKey === 'free_canvas') return 'Default'
  if (activeCount === 0) return 'Available'
  if (planKey.startsWith('team_')) return `${activeCount} active`
  return 'Active'
}

function resolvePlanHref(planKey: PlanKey, activeCount: number) {
  if (planKey === 'enterprise') return '/billing'
  if (planKey.startsWith('team_')) return activeCount > 0 ? '/usage?scope=teams' : '/team'
  if (planKey === 'free_canvas') return '/workspaces'
  return activeCount > 0 ? '/usage?scope=group' : '/group'
}

function splitPlanPrice(value: string) {
  if (!value.includes('/')) return [value, '']
  const [head, ...tail] = value.split('/')
  return [head, `/${tail.join('/')}`]
}

function planOrder(planKey: string) {
  return ['free_canvas', 'collaborate_start', 'collaborate_plus', 'team_start', 'team_growth', 'enterprise'].indexOf(planKey)
}
