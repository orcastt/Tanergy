'use client'

import { type BillingInterval, type PlanCatalogRecord, type PlanKey } from './billingTypes'
import {
  formatDateOnly,
  formatBillingIntervalLabel,
  formatCredits,
  formatFactValue,
  formatPeriodRange,
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
      <PricingMetricList title="Plan scope">
        <PricingMetric label="Included credits" value={formatCredits(plan.includedCredits)} hint="Refresh every 30 days" />
        <PricingMetric label="Group create cap" value={formatFactValue(plan.groupWorkspaceLimit)} hint={`${formatFactValue(plan.groupMemberLimit)} members per Group`} />
        <PricingMetric label="Solo limits" value={`${formatFactValue(plan.boardLimit)} boards / ${formatFactValue(plan.pageLimit)} pages`} />
        <PricingMetric label="Billing mode" value={formatBillingIntervalLabel(isCurrent ? groupSummary.billingInterval : cycle)} hint={plan.planKey === 'free_canvas' ? 'Free tier' : 'Annual is billed upfront for 12 months'} />
      </PricingMetricList>

      <PricingMetricList title="Billing window">
        <PricingMetric label="Current period" value={formatPeriodRange(isCurrent ? groupSummary.currentPeriodStart : null, isCurrent ? groupSummary.currentPeriodEnd : null)} />
        <PricingMetric label="Valid until" value={formatDateOnly(isCurrent ? groupSummary.currentPeriodEnd : null)} />
        <PricingMetric label="Next refresh" value={formatDateOnly(isCurrent ? groupSummary.nextRefreshAt : null)} />
      </PricingMetricList>

      {isCurrent ? <BillingProgress total={usage.total} used={usage.used} /> : null}

      <PricingMetricList title="Current usage">
        <PricingMetric label="Used credits" value={isCurrent ? `${formatCredits(usage.used)} / ${formatCredits(usage.total)}` : '—'} hint={isCurrent ? 'Tracks current plan + top-up consumption' : 'Becomes active after checkout'} />
        <PricingMetric label="Top-up balance" value={isCurrent ? formatCredits(groupSummary.topUpBalance) : '—'} hint="Top-up credits stay separate" />
        <PricingMetric label="Groups now" value={isCurrent ? `${groupSummary.groupsCreated} created / ${groupSummary.joinedGroups} joined` : '—'} />
      </PricingMetricList>

      <PricingTagList
        items={[
          'Free users can join Team workspaces',
          'Group AI always charges the current actor',
          `Free-created Group envelope: ${formatFactValue(plan.boardLimit)} board / ${formatFactValue(plan.pageLimit)} pages`,
        ]}
      />
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
          <PricingMetric label="Seats" value={formatFactValue(plan.seatRange)} />
          <PricingMetric label="Credits" value="Contract" />
          <PricingMetric label="Billing" value="Enterprise pool" />
        </PricingMetricList>
      </PricingBand>
    )
  }

  const workspaceCount = ownedTeams.length
  const representative = ownedTeams[0] ?? null
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
      <PricingMetricList title="Workspace scope">
        <PricingMetric label="Included credits / seat" value={formatCredits(plan.includedCredits)} hint="Seat-based Team wallet grant" />
        <PricingMetric label="Seat cap" value={formatFactValue(plan.seatMax)} hint={formatFactValue(plan.seatRange)} />
        <PricingMetric label="Workspace billing" value="Team wallet" hint="Owner/admin can invite and manage seats" />
        <PricingMetric label="Billing mode" value={formatBillingIntervalLabel(representative?.billingInterval ?? cycle)} hint="Annual is billed upfront for 12 months" />
      </PricingMetricList>

      <PricingMetricList title="Billing window">
        <PricingMetric label="Current period" value={formatPeriodRange(representative?.currentPeriodStart ?? null, representative?.currentPeriodEnd ?? null)} />
        <PricingMetric label="Valid until" value={formatDateOnly(representative?.currentPeriodEnd ?? null)} />
        <PricingMetric label="Next refresh" value={formatDateOnly(representative?.nextRefreshAt ?? null)} />
      </PricingMetricList>

      {workspaceCount > 0 ? <BillingProgress total={totalCredits} used={usedCredits} /> : null}

      <PricingMetricList title="Current usage">
        <PricingMetric label="Team credits used" value={workspaceCount > 0 ? `${formatCredits(usedCredits)} / ${formatCredits(totalCredits)}` : '—'} hint="Across owned workspaces on this plan" />
        <PricingMetric label="Seats" value={workspaceCount > 0 ? `${seatsUsed} / ${seatLimit}` : '—'} hint={`${memberCount} members total`} />
        <PricingMetric label="Boards" value={workspaceCount > 0 ? boardCount : '—'} hint={`${workspaceCount} owned Team workspaces`} />
      </PricingMetricList>

      <PricingTagList
        items={[
          'Team AI always charges the Team wallet',
          'Owner/admin can invite members, remove them, and buy seats',
          'Seat purchases do not create personal payer accounts',
        ]}
      />
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
