'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  BillingSectionHeader,
} from './billingSurfaceBlocks'
import {
  type PricingCycle,
  PersonalPlanBand,
  SubscriptionShell,
  WorkspacePlanBand,
} from './billingPlanBands'
import {
  useWorkspaceCommerceOverview,
} from './useWorkspaceCommerceOverview'

export function SubscriptionPlansView() {
  const [cycle, setCycle] = useState<PricingCycle>('monthly')
  const { error, overview, status } = useWorkspaceCommerceOverview()

  const personalPlans = useMemo(
    () => (overview?.plans ?? []).filter((plan) => ['free_canvas', 'collaborate_start', 'collaborate_plus'].includes(plan.planKey)),
    [overview],
  )
  const workspacePlans = useMemo(
    () => (overview?.plans ?? []).filter((plan) => ['team_start', 'team_growth', 'enterprise'].includes(plan.planKey)),
    [overview],
  )

  if (!overview && status === 'loading') {
    return <SubscriptionShell subtitle="Loading live plans, workspace limits, and seat pricing…" title="Subscription" />
  }

  if (!overview) {
    return <SubscriptionShell subtitle={error ?? 'Subscription plans failed to load.'} title="Subscription" />
  }

  const ownedTeams = overview.teamCards.filter((card) => card.relationship === 'created')

  return (
    <div className="product-page workspace-commerce-page workspace-subscription-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-row">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Subscription</h1>
            <p className="product-hero-copy">
              Personal plans use your own credits. Team plans use a Team wallet.
            </p>
            {error ? <p className="workspace-commerce-status" role="status">{error}</p> : null}
          </div>
          <div className="workspace-commerce-switch" aria-label="Billing cycle">
            <button className={cycle === 'monthly' ? 'is-active' : ''} onClick={() => setCycle('monthly')} type="button">Monthly</button>
            <button className={cycle === 'annual' ? 'is-active' : ''} onClick={() => setCycle('annual')} type="button">Annual</button>
          </div>
        </div>
      </section>

      <section className="workspace-commerce-section-shell">
        <BillingSectionHeader
          action={<Link className="workspace-commerce-tertiary-link" href="/usage">Open Usage</Link>}
          title="Personal Plans"
        />
        <div className="workspace-commerce-band-stack workspace-commerce-band-stack--pricing">
          {personalPlans.map((plan) => (
            <PersonalPlanBand
              cycle={cycle}
              currentPlanKey={overview.groupSummary.planKey}
              groupSummary={overview.groupSummary}
              key={plan.planKey}
              plan={plan}
            />
          ))}
        </div>
      </section>

      <section className="workspace-commerce-section-shell">
        <BillingSectionHeader
          title="Workspace / Team Plans"
        />
        <div className="workspace-commerce-band-stack workspace-commerce-band-stack--pricing">
          {workspacePlans.map((plan) => (
            <WorkspacePlanBand
              cycle={cycle}
              key={plan.planKey}
              ownedTeams={ownedTeams.filter((team) => team.planKey === plan.planKey)}
              plan={plan}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
