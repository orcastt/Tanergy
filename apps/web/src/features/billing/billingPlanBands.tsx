'use client'

import { type BillingInterval, type PlanCatalogRecord, type PlanKey } from './billingTypes'
import {
  formatDateOnly,
  formatCredits,
  formatFactValue,
} from './billingPresentation'
import {
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
  const pageEnvelope = formatBoardPageEnvelope(plan)

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
        />
      )}
      badge={<BillingStatusPill>{status}</BillingStatusPill>}
      eyebrow="Personal plan"
      price={formatPersonalPlanPrice(plan, cycle)}
      priceHint={formatBillingHint(plan, cycle)}
      title={plan.name}
      tone={isCurrent ? 'group' : 'muted'}
    >
      <PricingMetricList>
        <PricingMetric label="Credits" value={`${formatCredits(plan.includedCredits)} / cycle`} />
        <PricingMetric label="Groups" value={formatGroupCap(groupCap, plan.groupMemberLimit)} />
        <PricingMetric label="Boards" value={pageEnvelope} />
        <PricingMetric label="Top-up" value={isCurrent ? formatCredits(groupSummary.topUpBalance) : 'Available'} />
        {isCurrent ? <PricingMetric label="Current usage" value={`${formatCredits(usage.used)} / ${formatCredits(usage.total)}`} /> : null}
      </PricingMetricList>

      <PricingTagList items={buildPersonalPlanTerms(plan, isCurrent ? groupSummary.currentPeriodEnd : null)} />
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
        actions={<SubscriptionPlanAction activeCount={0} className="workspace-commerce-secondary-button" href="/admin?tab=finance" label="Contact" planKey="enterprise" />}
        badge={<BillingStatusPill>Custom</BillingStatusPill>}
        eyebrow="Workspace plan"
        price="Custom"
        priceHint="Contract pricing"
        title={plan.name}
        tone="enterprise"
      >
        <PricingMetricList>
          <PricingMetric label="Seats" value={formatFactValue(plan.seatRange)} />
          <PricingMetric label="Credits" value="Custom" />
          <PricingMetric label="Billing" value="Contract" />
        </PricingMetricList>
        <PricingTagList items={['Custom limits and governance.', 'Manual finance review.']} />
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
        />
      )}
      badge={<BillingStatusPill>{status}</BillingStatusPill>}
      eyebrow="Workspace plan"
      price={formatWorkspacePlanPrice(plan, cycle)}
      priceHint={formatBillingHint(plan, cycle)}
      title={plan.name}
      tone={workspaceCount > 0 ? 'team' : 'muted'}
    >
      <PricingMetricList>
        <PricingMetric label="Credits" value={`${formatCredits(plan.includedCredits)} / seat`} />
        <PricingMetric label="Seats" value={workspaceCount > 0 ? `${seatsUsed} / ${seatLimit}` : formatFactValue(plan.seatRange)} />
        <PricingMetric label="Boards" value={formatBoardPageEnvelope(plan)} />
        <PricingMetric label="Top-up" value={workspaceCount > 0 ? formatCredits(ownedTeams.reduce((total, team) => total + team.topUpBalance, 0)) : 'Available'} />
        <PricingMetric label="Billing" value="Team wallet" />
        {workspaceCount > 0 ? <PricingMetric label="Team usage" value={`${formatCredits(usedCredits)} / ${formatCredits(totalCredits)}`} /> : null}
        {workspaceCount > 0 ? <PricingMetric label="Active boards" value={String(boardCount)} /> : null}
      </PricingMetricList>

      <PricingTagList items={buildWorkspacePlanTerms(plan, workspaceCount, memberCount)} />
    </PricingBand>
  )
}

function formatBillingHint(plan: PlanCatalogRecord, cycle: PricingCycle) {
  if (plan.planKey === 'free_canvas') return 'Always free'
  if (cycle === 'annual') {
    return plan.planKey === 'team_start' || plan.planKey === 'team_growth'
      ? 'per seat / month, billed annually'
      : 'per month, billed annually'
  }
  return plan.planKey === 'team_start' || plan.planKey === 'team_growth' ? 'per seat / month' : 'per month'
}

function formatPersonalPlanPrice(plan: PlanCatalogRecord, cycle: PricingCycle) {
  if (plan.planKey === 'free_canvas') return '$0'
  if (cycle === 'annual') return `$${plan.annualPriceUsd ?? plan.monthlyPriceUsd ?? 0}`
  return `$${plan.monthlyPriceUsd ?? 0}`
}

function formatWorkspacePlanPrice(plan: PlanCatalogRecord, cycle: PricingCycle) {
  if (cycle === 'annual') return `$${plan.annualPriceUsd ?? plan.monthlyPriceUsd ?? 0}`
  return `$${plan.monthlyPriceUsd ?? 0}`
}

function formatBoardPageEnvelope(plan: PlanCatalogRecord) {
  const boardLimit = typeof plan.boardLimit === 'number' ? formatFactValue(plan.boardLimit) : 'Unlimited'
  const pageLimit = typeof plan.pageLimit === 'number' ? Math.min(plan.pageLimit, 10) : 10
  return `${boardLimit} board${plan.boardLimit === 1 ? '' : 's'} / ${formatFactValue(pageLimit)} pages per board`
}

function formatGroupCap(groupCap: number, memberLimit?: null | number) {
  if (groupCap === 0) return 'No create access'
  return `${groupCap} Group${groupCap === 1 ? '' : 's'} · ${formatFactValue(memberLimit)} members`
}

function buildPersonalPlanTerms(plan: PlanCatalogRecord, currentPeriodEnd?: null | string) {
  if (plan.planKey === 'free_canvas') {
    return [
      'Can join Teams; cannot create Team workspaces.',
      'Group AI uses personal credits.',
    ]
  }
  return [
    ...(currentPeriodEnd ? [`Valid until ${formatDateOnly(currentPeriodEnd)}.`] : []),
    'No shared Group wallet.',
  ]
}

function buildWorkspacePlanTerms(plan: PlanCatalogRecord, workspaceCount: number, memberCount: number) {
  if (plan.planKey === 'enterprise') return ['Contract limits.', 'Manual finance review.']
  if (workspaceCount > 0) return [`${memberCount} active member${memberCount === 1 ? '' : 's'}.`]
  return [
    'Shared Team wallet.',
  ]
}
