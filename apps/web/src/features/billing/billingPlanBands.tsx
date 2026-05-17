'use client'

import { type BillingInterval, type PlanCatalogRecord, type PlanKey } from './billingTypes'
import {
  formatDateOnly,
  formatBillingIntervalLabel,
  formatCredits,
  formatFactValue,
} from './billingPresentation'
import {
  BillingProgress,
  BillingStatusPill,
} from './billingSurfaceBlocks'
import { resolveCreditUsageMetrics } from './billingCreditUsage'
import {
  PricingBand,
  PricingMetric,
  PricingMetricList,
  PricingTagList,
} from './billingPricingBlocks'
import { SubscriptionPlanAction } from './SubscriptionPlanAction'
import type {
  CommerceGroupSummary,
  CommerceTeamCard,
} from './useWorkspaceCommerceOverview'

export type PricingCycle = Extract<BillingInterval, 'annual' | 'monthly'>

export function SubscriptionShell({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <div className="product-page workspace-commerce-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-copy">
          <h1 className="product-page-title">{title}</h1>
          <p className="workspace-commerce-status">{subtitle}</p>
        </div>
      </section>
    </div>
  )
}

export function PersonalPlanBand({
  currentPlanKey,
  cycle,
  groupSummary,
  plan,
}: {
  currentPlanKey: PlanKey
  cycle: PricingCycle
  groupSummary: CommerceGroupSummary
  plan: PlanCatalogRecord
}) {
  const isCurrent = currentPlanKey === plan.planKey
  const status = isCurrent ? 'Current plan' : currentPlanKey === 'free_canvas' ? 'Available' : 'Upgrade'
  const actionHref = isCurrent ? '/usage' : plan.planKey === 'free_canvas' ? '/usage' : '/billing'
  const actionLabel = isCurrent ? 'Manage' : plan.planKey === 'free_canvas' ? 'Open' : 'Select'
  const usage = resolveCreditUsageMetrics(groupSummary.remainingCredits, groupSummary.totalCredits)
  const groupCap = plan.groupWorkspaceLimit ?? 0
  const pageEnvelope = `${formatFactValue(plan.boardLimit)} board${plan.boardLimit === 1 ? '' : 's'} / ${formatFactValue(plan.pageLimit)} pages`

  return (
    <PricingBand
      actions={(
        <SubscriptionPlanAction
          activeCount={isCurrent ? 1 : 0}
          billingInterval={cycle}
          className={isCurrent ? 'workspace-commerce-primary-button' : 'workspace-commerce-secondary-button'}
          href={actionHref}
          label={actionLabel}
          planKey={plan.planKey as PlanKey}
          planName={plan.name}
        />
      )}
      badge={<BillingStatusPill>{status}</BillingStatusPill>}
      eyebrow="Personal plan"
      price={formatPersonalPlanPrice(plan, cycle)}
      priceHint={formatBillingHint(plan, cycle)}
      title={plan.name}
      tone={isCurrent ? 'group' : 'muted'}
    >
      <PricingMetricList title="Included">
        <PricingMetric label="Credits / cycle" value={formatCredits(plan.includedCredits)} hint="Refreshes every 30 days, does not roll over." />
        <PricingMetric label="Group create cap" value={groupCap === 0 ? 'No Group create access' : `${groupCap} Group${groupCap === 1 ? '' : 's'}`} hint={`${formatFactValue(plan.groupMemberLimit)} members per Group`} />
        <PricingMetric label="Solo envelope" value={pageEnvelope} hint={plan.planKey === 'free_canvas' ? 'One private board stays inside Free Canvas.' : 'Higher plans expand your own working envelope.'} />
      </PricingMetricList>

      {isCurrent ? <BillingProgress total={usage.total} used={usage.used} /> : null}

      <PricingMetricList title={isCurrent ? 'Current usage' : 'Billing'}>
        <PricingMetric label="Used credits" value={isCurrent ? `${formatCredits(usage.used)} / ${formatCredits(usage.total)}` : formatBillingIntervalLabel(cycle)} hint={isCurrent ? 'Includes plan credits plus any top-up usage.' : cycle === 'annual' ? 'Annual is billed upfront for 12 months.' : 'Monthly renews every 30 days.'} />
        <PricingMetric label="Top-up balance" value={isCurrent ? formatCredits(groupSummary.topUpBalance) : 'Pay as you go'} hint={isCurrent ? 'Top-up credits stay personal and separate.' : 'Top-up stays available without changing your Group wallet rules.'} />
        <PricingMetric label="Valid until" value={isCurrent ? formatDateOnly(groupSummary.currentPeriodEnd) : 'Starts at checkout'} hint={isCurrent ? `Next refresh ${formatDateOnly(groupSummary.nextRefreshAt)}` : 'Invite acceptance still depends on workspace capacity, not the invitee plan.'} />
      </PricingMetricList>

      <PricingTagList items={buildPersonalPlanFeatures(plan)} />
    </PricingBand>
  )
}

export function WorkspacePlanBand({
  cycle,
  ownedTeams,
  plan,
}: {
  cycle: PricingCycle
  ownedTeams: CommerceTeamCard[]
  plan: PlanCatalogRecord
}) {
  if (plan.planKey === 'enterprise') {
    return (
      <PricingBand
        actions={<SubscriptionPlanAction activeCount={0} className="workspace-commerce-secondary-button" href="/admin?tab=finance" label="Contact" planKey="enterprise" planName={plan.name} />}
        badge={<BillingStatusPill>Custom</BillingStatusPill>}
        eyebrow="Workspace plan"
        price="Custom"
        priceHint="Contract pricing"
        title={plan.name}
        tone="muted"
      >
        <PricingMetricList title="Enterprise scope">
          <PricingMetric label="Seat range" value={formatFactValue(plan.seatRange)} hint="Workspace limits are contract-defined." />
          <PricingMetric label="Credits" value="Custom credit pack" hint="Supports tailored wallet and SLA agreements." />
          <PricingMetric label="Billing" value="Enterprise contract" hint="Handled outside self-serve checkout." />
        </PricingMetricList>
        <PricingTagList items={['Dedicated rollout support', 'Custom seat envelopes and governance', 'Operator and finance workflows stay auditable']} />
      </PricingBand>
    )
  }

  const workspaceCount = ownedTeams.length
  const totalCredits = ownedTeams.reduce((total, team) => total + team.totalCredits, 0)
  const usedCredits = ownedTeams.reduce((total, team) => total + resolveCreditUsageMetrics(team.remainingCredits, team.totalCredits).used, 0)
  const seatsUsed = ownedTeams.reduce((total, team) => total + team.seatsUsed, 0)
  const seatLimit = ownedTeams.reduce((total, team) => total + team.seatLimit, 0)
  const boardCount = ownedTeams.reduce((total, team) => total + team.boardCount, 0)
  const memberCount = ownedTeams.reduce((total, team) => total + team.memberCount, 0)
  const status = workspaceCount > 0 ? `${workspaceCount} active workspace${workspaceCount > 1 ? 's' : ''}` : 'Available'

  return (
    <PricingBand
      actions={(
        <SubscriptionPlanAction
          activeCount={workspaceCount}
          billingInterval={cycle}
          className={workspaceCount > 0 ? 'workspace-commerce-primary-button' : 'workspace-commerce-secondary-button'}
          href={workspaceCount > 0 ? '/usage?scope=teams' : '/billing'}
          label={workspaceCount > 0 ? 'Manage' : 'Select'}
          planKey={plan.planKey as PlanKey}
          planName={plan.name}
        />
      )}
      badge={<BillingStatusPill>{status}</BillingStatusPill>}
      eyebrow="Workspace plan"
      price={formatWorkspacePlanPrice(plan, cycle)}
      priceHint={formatBillingHint(plan, cycle)}
      title={plan.name}
      tone={workspaceCount > 0 ? 'team' : 'muted'}
    >
      <PricingMetricList title="Included">
        <PricingMetric label="Credits / seat" value={formatCredits(plan.includedCredits)} hint="Every paid seat adds one Team credit pack." />
        <PricingMetric label="Seat envelope" value={formatFactValue(plan.seatRange)} hint={plan.seatMax ? `Expandable up to ${plan.seatMax} seats.` : 'Seat growth follows plan rules.'} />
        <PricingMetric label="Billing model" value="Team wallet" hint="All Team AI usage charges the workspace wallet, never each member personally." />
      </PricingMetricList>

      {workspaceCount > 0 ? <BillingProgress total={totalCredits} used={usedCredits} /> : null}

      <PricingMetricList title={workspaceCount > 0 ? 'Current usage' : 'Checkout'}>
        <PricingMetric label="Team credits used" value={workspaceCount > 0 ? `${formatCredits(usedCredits)} / ${formatCredits(totalCredits)}` : formatBillingIntervalLabel(cycle)} hint={workspaceCount > 0 ? 'Across all owned Teams on this plan.' : cycle === 'annual' ? 'Annual is billed once for the full 12-month term.' : 'Monthly is charged per active seat every 30 days.'} />
        <PricingMetric label="Seats" value={workspaceCount > 0 ? `${seatsUsed} / ${seatLimit}` : `${plan.seatMin ?? 1}+ seats`} hint={workspaceCount > 0 ? `${memberCount} members currently assigned.` : 'Seat purchases happen at checkout and can be expanded later.'} />
        <PricingMetric label="Boards now" value={workspaceCount > 0 ? String(boardCount) : 'Create after purchase'} hint={workspaceCount > 0 ? `${workspaceCount} owned Team workspace${workspaceCount > 1 ? 's' : ''}.` : 'Team creation depends on the purchased workspace plan.'} />
      </PricingMetricList>

      <PricingTagList items={buildWorkspacePlanFeatures(plan)} />
    </PricingBand>
  )
}

function formatBillingHint(plan: PlanCatalogRecord, cycle: PricingCycle) {
  if (plan.planKey === 'free_canvas') return 'Always free'
  if (cycle === 'annual') {
    return `Charged upfront as ${formatAnnualUpfront(plan)} for 365 days`
  }
  return 'Renews every 30 days'
}

function formatPersonalPlanPrice(plan: PlanCatalogRecord, cycle: PricingCycle) {
  if (plan.planKey === 'free_canvas') return '$0'
  if (cycle === 'annual') return `${formatAnnualUpfront(plan)}/year`
  return `$${plan.monthlyPriceUsd ?? 0}/mo`
}

function formatWorkspacePlanPrice(plan: PlanCatalogRecord, cycle: PricingCycle) {
  if (cycle === 'annual') return `${formatAnnualUpfront(plan)}/seat/year`
  return `$${plan.monthlyPriceUsd ?? 0}/seat/mo`
}

function formatAnnualUpfront(plan: PlanCatalogRecord) {
  const annualRate = plan.annualPriceUsd ?? 0
  return `$${annualRate * 12}`
}

function buildPersonalPlanFeatures(plan: PlanCatalogRecord) {
  if (plan.planKey === 'free_canvas') {
    return [
      'Free users cannot create Team workspaces, but they can join Teams.',
      'Free users can create one Group and still join other Groups.',
      'Group AI always charges the current actor’s own credits.',
    ]
  }
  if (plan.planKey === 'collaborate_start') {
    return [
      'Expands your personal credits without creating any shared Group wallet.',
      'Keeps Group collaboration personal-credit based for every member.',
      'Works with top-up credits when you need extra capacity between refreshes.',
    ]
  }
  return [
    'Highest personal collaboration tier before moving into Team wallets.',
    'Best fit for heavy Group participation while keeping spend personal.',
    'Annual pricing pays once for the full 12-month 365-day term.',
  ]
}

function buildWorkspacePlanFeatures(plan: PlanCatalogRecord) {
  if (plan.planKey === 'team_start') {
    return [
      'Built for small Teams that need seat-based AI credits and board ownership.',
      'Owner and admin roles can invite members, remove them, and manage boards.',
      'Workspace billing stays attached to the Team plan even if members rotate out.',
    ]
  }
  if (plan.planKey === 'team_growth') {
    return [
      'Scales Team seats and Team wallet credits together as the workspace grows.',
      'Seats are bought per member, not as one fixed workspace bundle.',
      'Best choice when multiple editors need shared Team-board access and spend control.',
    ]
  }
  return [
    'Enterprise pricing is contract-managed.',
    'Custom envelopes can cover seats, boards, credits, and governance.',
    'Designed for admin-operated rollout and finance review.',
  ]
}
