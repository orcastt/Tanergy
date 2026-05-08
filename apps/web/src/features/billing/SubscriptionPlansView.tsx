'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatCredits } from './billingPresentation'
import { SubscriptionPlanAction } from './SubscriptionPlanAction'
import {
  formatPlanBadge,
  formatPlanPrice,
  getSubscriptionOverview,
  getSubscriptionPlanCards,
  type PricingCycle,
  type SubscriptionPlanCard,
} from './workspaceCommerceMock'
import type { PlanKey } from './billingTypes'

export function SubscriptionPlansView() {
  const [cycle, setCycle] = useState<PricingCycle>('monthly')
  const overview = useMemo(() => getSubscriptionOverview(), [])
  const plans = useMemo(() => getSubscriptionPlanCards(), [])

  const activePlanCounts = useMemo(() => {
    const next: Partial<Record<PlanKey, number>> = {
      [overview.groupSummary.planKey]: 1,
    }
    for (const card of overview.ownedTeams) {
      next[card.planKey] = (next[card.planKey] ?? 0) + 1
    }
    return next
  }, [overview.groupSummary.planKey, overview.ownedTeams])

  const visiblePlans = [...plans.primary, ...plans.secondary]

  return (
    <div className="product-page workspace-commerce-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-row">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Subscription</h1>
          </div>
          <div className="workspace-commerce-switch" aria-label="Billing cycle">
            <button className={cycle === 'monthly' ? 'is-active' : ''} onClick={() => setCycle('monthly')} type="button">Monthly</button>
            <button className={cycle === 'annual' ? 'is-active' : ''} onClick={() => setCycle('annual')} type="button">Annually</button>
          </div>
        </div>
      </section>

      <section className="workspace-commerce-summary-grid" aria-label="Subscription summary">
        <SummaryCard
          label="Group"
          meta={`${overview.groupSummary.groupsCreated}/${overview.groupSummary.groupLimit} groups`}
          value={formatPlanBadge(overview.groupSummary.planKey)}
        />
        <SummaryCard
          label="Created teams"
          meta="Billed separately"
          value={String(overview.ownedTeams.length)}
        />
        <SummaryCard
          label="Joined teams"
          meta="Not billed here"
          value={String(overview.joinedTeams.length)}
        />
        <SummaryCard
          label="Seats"
          meta="Across created teams"
          value={`${overview.totalSeatsUsed}/${overview.totalSeatLimit}`}
        />
      </section>

      <section className="workspace-commerce-section">
        <div className="workspace-commerce-section-head">
          <h2>Current</h2>
          <Link className="workspace-commerce-tertiary-link" href="/usage">
            Open usage
          </Link>
        </div>

        <div className="workspace-commerce-active-grid">
          <article className="workspace-commerce-active-card" data-tone="group">
            <div className="workspace-commerce-card-head">
              <div>
                <span className="workspace-commerce-card-eyebrow">Group</span>
                <h3>Personal collaboration</h3>
              </div>
              <span className="workspace-commerce-plan-badge">{formatPlanBadge(overview.groupSummary.planKey)}</span>
            </div>
            <div className="workspace-commerce-card-stats">
              <div className="workspace-commerce-stat">
                <span>Credits</span>
                <strong>{formatCredits(overview.groupSummary.remainingCredits)} / {formatCredits(overview.groupSummary.totalCredits)}</strong>
              </div>
              <div className="workspace-commerce-stat">
                <span>Groups</span>
                <strong>{overview.groupSummary.groupsCreated} / {overview.groupSummary.groupLimit}</strong>
              </div>
            </div>
            <div className="workspace-commerce-card-actions">
              <Link className="workspace-commerce-secondary-button" href="/usage?scope=group">
                Usage
              </Link>
              <Link className="workspace-commerce-secondary-button" href="/group">
                Group
              </Link>
            </div>
          </article>

          {overview.ownedTeams.map((card, index) => (
            <article className="workspace-commerce-active-card" data-tone="team" key={card.id}>
              <div className="workspace-commerce-card-head">
                <div>
                  <span className="workspace-commerce-card-eyebrow">Team</span>
                  <h3>{card.name}</h3>
                </div>
                <span className="workspace-commerce-plan-badge">{formatPlanBadge(card.planKey)}</span>
              </div>
              <div className="workspace-commerce-card-stats">
                <div className="workspace-commerce-stat">
                  <span>Credits</span>
                  <strong>{formatCredits(card.remainingCredits)} / {formatCredits(card.totalCredits)}</strong>
                </div>
                <div className="workspace-commerce-stat">
                  <span>Seats</span>
                  <strong>{card.seatsUsed} / {card.seatLimit}</strong>
                </div>
              </div>
              <div className="workspace-commerce-card-footer">
                <span className="workspace-commerce-note">{index === 0 ? 'This cycle' : 'Separate renewal'}</span>
                <div className="workspace-commerce-card-actions">
                  <Link className="workspace-commerce-secondary-button" href={`/usage?scope=teams&workspace=${encodeURIComponent(card.id)}`}>
                    Usage
                  </Link>
                  <Link className="workspace-commerce-secondary-button" href={`/team/${encodeURIComponent(card.id)}`}>
                    Team
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-commerce-section">
        <div className="workspace-commerce-section-head">
          <h2>Available plans</h2>
          <span className="workspace-commerce-note">{formatCredits(overview.totalIncludedCredits)} included credits in active subscriptions</span>
        </div>

        <div className="workspace-commerce-plan-grid">
          {visiblePlans.map((plan) => (
            <PlanCard
              activeCount={activePlanCounts[plan.key] ?? 0}
              cycle={cycle}
              key={plan.key}
              plan={plan}
            />
          ))}
        </div>

        {plans.enterprise ? (
          <article className="workspace-commerce-enterprise">
            <div>
              <span className="workspace-commerce-card-eyebrow">Enterprise</span>
              <h3>{plans.enterprise.name}</h3>
            </div>
            <button className="workspace-commerce-secondary-button" type="button">
              Contact
            </button>
          </article>
        ) : null}
      </section>
    </div>
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

function PlanCard({
  activeCount,
  cycle,
  plan,
}: {
  activeCount: number
  cycle: PricingCycle
  plan: SubscriptionPlanCard
}) {
  const price = formatPlanPrice(plan.key, cycle)
  const [priceValue, priceSuffix] = splitPlanPrice(price)
  const statusLabel = resolveStatusLabel(plan.key, activeCount)
  const href = resolvePlanHref(plan.key, activeCount)
  const buttonLabel = plan.key === 'free_canvas'
    ? 'Open'
    : activeCount > 0
      ? 'Manage'
      : 'Select'

  return (
    <article className={`workspace-commerce-plan-card${activeCount > 0 ? ' is-current' : ''}`} data-plan={plan.key}>
      <div className="workspace-commerce-plan-head">
        <div>
          <span className="workspace-commerce-card-eyebrow">{plan.name}</span>
          <strong className="workspace-commerce-plan-status">{statusLabel}</strong>
        </div>
      </div>
      <div className="workspace-commerce-plan-price">
        <strong>{priceValue}</strong>
        <small>{priceSuffix}</small>
      </div>
      <ul className="workspace-commerce-plan-list">
        {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
      <SubscriptionPlanAction
        activeCount={activeCount}
        className={activeCount > 0 ? 'workspace-commerce-primary-button' : 'workspace-commerce-secondary-button'}
        href={href}
        label={buttonLabel}
        planKey={plan.key}
        planName={plan.name}
      />
    </article>
  )
}

function resolveStatusLabel(planKey: PlanKey, activeCount: number) {
  if (planKey === 'free_canvas') return 'Default'
  if (activeCount === 0) return 'Available'
  if (planKey.startsWith('team_')) return `${activeCount} active`
  return 'Active'
}

function resolvePlanHref(planKey: PlanKey, activeCount: number) {
  if (planKey === 'enterprise') return '/billing'
  if (planKey.startsWith('team_')) {
    return activeCount > 0 ? '/usage?scope=teams' : '/team'
  }
  if (planKey === 'free_canvas') return '/workspaces'
  return activeCount > 0 ? '/usage?scope=group' : '/group'
}

function splitPlanPrice(value: string) {
  if (!value.includes('/')) return [value, '']
  const [head, ...tail] = value.split('/')
  return [head, `/${tail.join('/')}`]
}
