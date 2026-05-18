'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { planCatalog } from './billingContracts'
import type { BillingInterval, PlanKey, WorkspacePlanSummary } from './billingTypes'

type PricingCycle = Extract<BillingInterval, 'annual' | 'monthly'>

const personalPlanKeys: PlanKey[] = ['free_canvas', 'collaborate_start', 'collaborate_plus']
const teamPlanKeys: PlanKey[] = ['team_start', 'team_growth', 'enterprise']

const planCopy: Record<PlanKey, {
  audience: string
  cta: string
  href: string
  summary: string
  tags: string[]
}> = {
  collaborate_plus: {
    audience: 'For heavy personal and Group collaboration',
    cta: 'Join waitlist',
    href: '/sign-up',
    summary: 'More personal credits and Group capacity while every collaborator keeps their own wallet.',
    tags: ['2,000 personal credits', '20 Group workspaces', 'Personal billing'],
  },
  collaborate_start: {
    audience: 'For solo creators starting to collaborate',
    cta: 'Join waitlist',
    href: '/sign-up',
    summary: 'A larger personal workspace envelope with predictable monthly or annual credits.',
    tags: ['1,500 personal credits', '10 Group workspaces', 'Top-up ready'],
  },
  enterprise: {
    audience: 'For governed teams and finance review',
    cta: 'Contact us',
    href: '/sign-up',
    summary: 'Custom seat, credit, governance and support agreements for larger deployments.',
    tags: ['Custom credits', 'Custom controls', 'Rollout support'],
  },
  free_canvas: {
    audience: 'For private beta and first boards',
    cta: 'Start free',
    href: '/sign-up',
    summary: 'One private board with a small page envelope and registration credits for early testing.',
    tags: ['1 board', '3 pages', '50 registration credits'],
  },
  team_growth: {
    audience: 'For growing shared workspaces',
    cta: 'Join waitlist',
    href: '/sign-up',
    summary: 'Seat-based Team credits with a shared Team wallet and workspace-level spend control.',
    tags: ['5,500 credits / seat', 'Up to 15 seats', 'Team wallet'],
  },
  team_start: {
    audience: 'For small teams moving into shared billing',
    cta: 'Join waitlist',
    href: '/sign-up',
    summary: 'Create Team-owned boards, invite members and keep AI usage on the Team wallet.',
    tags: ['2,500 credits / seat', '1-15 seats', 'Team-owned boards'],
  },
}

export function PublicPricingPage() {
  const [cycle, setCycle] = useState<PricingCycle>('monthly')
  const personalPlans = useMemo(() => personalPlanKeys.map((key) => planCatalog[key]), [])
  const teamPlans = useMemo(() => teamPlanKeys.map((key) => planCatalog[key]), [])

  return (
    <main className="tanergy-public-pricing">
      <PublicPricingNav />

      <section className="public-pricing-hero">
        <div className="public-pricing-hero__copy">
          <span>Pricing</span>
          <h1>Plans for visual AI work before real payments are enabled.</h1>
          <p>
            Tanergy is in private beta. Pricing is public so teams can understand the product shape
            before sign-up, while checkout stays off until commercial readiness is complete.
          </p>
        </div>
        <div className="public-pricing-switch" aria-label="Billing cycle">
          <button className={cycle === 'monthly' ? 'is-active' : ''} onClick={() => setCycle('monthly')} type="button">Monthly</button>
          <button className={cycle === 'annual' ? 'is-active' : ''} onClick={() => setCycle('annual')} type="button">Annual</button>
        </div>
      </section>

      <section className="public-pricing-section" aria-labelledby="personal-pricing">
        <div className="public-pricing-section__head">
          <span>Personal</span>
          <h2 id="personal-pricing">Canvas and Group collaboration</h2>
        </div>
        <div className="public-pricing-grid">
          {personalPlans.map((plan) => <PublicPricingCard cycle={cycle} key={plan.planKey} plan={plan} />)}
        </div>
      </section>

      <section className="public-pricing-section" aria-labelledby="team-pricing">
        <div className="public-pricing-section__head">
          <span>Team</span>
          <h2 id="team-pricing">Shared workspaces and Team wallet billing</h2>
        </div>
        <div className="public-pricing-grid">
          {teamPlans.map((plan) => <PublicPricingCard cycle={cycle} key={plan.planKey} plan={plan} />)}
        </div>
      </section>

      <section className="public-pricing-note" aria-label="Commercial readiness note">
        <strong>Private beta payment boundary</strong>
        <p>
          Paid checkout, taxes, invoices and merchant-of-record routing are intentionally disabled
          until the legal, content-safety and payment-provider review work is complete.
        </p>
      </section>
    </main>
  )
}

function PublicPricingNav() {
  return (
    <nav className="public-pricing-nav" aria-label="Pricing navigation">
      <Link className="public-pricing-brand" href="/">Tanergy</Link>
      <div className="public-pricing-nav__links">
        <Link href="/#canvas">Canvas</Link>
        <Link href="/pricing" aria-current="page">Pricing</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
      <Link className="public-pricing-nav__cta" href="/sign-up">Start free</Link>
    </nav>
  )
}

function PublicPricingCard({ cycle, plan }: { cycle: PricingCycle; plan: WorkspacePlanSummary }) {
  const copy = planCopy[plan.planKey]

  return (
    <article className={`public-pricing-card is-${plan.planKey}`}>
      <div className="public-pricing-card__top">
        <span>{copy.audience}</span>
        <h3>{plan.name}</h3>
        <p>{copy.summary}</p>
      </div>
      <div className="public-pricing-card__price">
        <strong>{formatPrice(plan, cycle)}</strong>
        <small>{formatPriceHint(plan, cycle)}</small>
      </div>
      <Link className="public-pricing-card__cta" href={copy.href}>{copy.cta}</Link>
      <ul className="public-pricing-card__facts">
        {copy.tags.map((tag) => <li key={tag}>{tag}</li>)}
      </ul>
    </article>
  )
}

function formatPrice(plan: WorkspacePlanSummary, cycle: PricingCycle) {
  if (plan.planKey === 'enterprise') return 'Custom'
  if (plan.planKey === 'free_canvas') return '$0'
  if (cycle === 'annual') return `$${(plan.annualPriceUsd ?? 0) * 12}`
  return `$${plan.monthlyPriceUsd ?? 0}`
}

function formatPriceHint(plan: WorkspacePlanSummary, cycle: PricingCycle) {
  if (plan.planKey === 'enterprise') return 'Contract pricing'
  if (plan.planKey === 'free_canvas') return 'Free private beta entry'
  if (plan.planKey === 'team_growth' || plan.planKey === 'team_start') {
    return cycle === 'annual' ? 'per seat / year' : 'per seat / month'
  }
  return cycle === 'annual' ? 'per year' : 'per month'
}
