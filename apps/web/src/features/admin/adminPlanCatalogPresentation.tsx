'use client'

import type { ReactNode } from 'react'
import type { AdminPlanCatalogRecord } from './adminFinanceClient'

export function AdminPlanCatalogSection({
  children,
  description,
  title,
}: {
  children: ReactNode
  description: string
  title: string
}) {
  return (
    <section className="management-stack admin-plan-catalog-section">
      <div className="management-panel management-panel-wide admin-plan-catalog-section-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export function AdminPlanCatalogHighlights({
  plan,
}: {
  plan: AdminPlanCatalogRecord
}) {
  const facts = buildPlanFacts(plan)
  return (
    <div className="admin-plan-catalog-facts">
      {facts.map((fact) => (
        <div className="admin-plan-catalog-fact" key={`${plan.planKey}:${fact.label}`}>
          <span>{fact.label}</span>
          <strong>{fact.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function AdminPlanCatalogRule({
  plan,
}: {
  plan: AdminPlanCatalogRecord
}) {
  return <p className="admin-plan-catalog-rule">{describePlanRule(plan)}</p>
}

export function formatAnnualUpfrontUsd(plan: AdminPlanCatalogRecord) {
  if (plan.annualPriceUsd === null || plan.annualPriceUsd === undefined) return 'Custom'
  return `$${plan.annualPriceUsd * 12}`
}

function buildPlanFacts(plan: AdminPlanCatalogRecord) {
  if (plan.planKey === 'free_canvas') {
    return [
      { label: 'Price', value: '$0' },
      { label: 'Signup credits', value: String(plan.registrationCredits) },
      { label: 'Group cap', value: formatNullableNumber(plan.groupWorkspaceLimit) },
      { label: 'Board / pages', value: `${formatNullableNumber(plan.boardLimit)} / ${formatNullableNumber(plan.pageLimit)}` },
    ]
  }

  if (plan.planFamily === 'collaborate') {
    return [
      { label: 'Monthly', value: `$${plan.monthlyPriceUsd ?? 0}/mo` },
      { label: 'Annual upfront', value: `${formatAnnualUpfrontUsd(plan)}/year` },
      { label: 'Credits / 30d', value: String(plan.includedCredits) },
      { label: 'Group cap', value: formatNullableNumber(plan.groupWorkspaceLimit) },
    ]
  }

  if (plan.planFamily === 'team') {
    return [
      { label: 'Monthly / seat', value: `$${plan.monthlyPriceUsd ?? 0}` },
      { label: 'Annual upfront / seat', value: formatAnnualUpfrontUsd(plan) },
      { label: 'Credits / seat / 30d', value: String(plan.includedCredits) },
      { label: 'Seat range', value: plan.seatRange ?? 'Custom' },
    ]
  }

  return [
    { label: 'Billing', value: 'Contract' },
    { label: 'Credits', value: 'Custom' },
    { label: 'Seats', value: plan.seatRange ?? 'Custom' },
    { label: 'Scope', value: 'Workspace pool' },
  ]
}

function describePlanRule(plan: AdminPlanCatalogRecord) {
  if (plan.planKey === 'free_canvas') {
    return 'Free users can join other Teams and Groups, but they can only create one Group, one Board inside it, and three Pages per Board.'
  }
  if (plan.planFamily === 'collaborate') {
    return 'Group collaboration is never a shared wallet. AI always charges the acting member’s personal credits, and included credits refresh every 30 days without rollover.'
  }
  if (plan.planFamily === 'team') {
    return 'Team billing is always per seat. Annual values are charged upfront for 365 days, and every seat carries its own included Team-wallet credit pack.'
  }
  return 'Enterprise is contract-governed. Billing, seat policy, and workspace pooling stay operator-controlled.'
}

function formatNullableNumber(value?: null | number) {
  return value === null || value === undefined ? 'Unlimited' : String(value)
}
