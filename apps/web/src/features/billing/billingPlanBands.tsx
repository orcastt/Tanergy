'use client'

import { type BillingInterval, type PlanCatalogRecord, type PlanKey } from './billingTypes'
import {
  formatBillingIntervalLabel,
  formatCredits,
  formatFactValue,
} from './billingPresentation'
import {
  BillingBand,
  BillingFact,
  BillingFactGrid,
  BillingInlineList,
  BillingPeriodFacts,
  BillingProgress,
  BillingStatusPill,
} from './billingSurfaceBlocks'
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

  return (
    <BillingBand
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
      title={plan.name}
      tone={isCurrent ? 'group' : 'muted'}
    >
      <BillingFactGrid columns={4}>
        <BillingFact label="Price" value={formatPersonalPlanPrice(plan, cycle)} hint={formatBillingHint(plan, cycle)} />
        <BillingFact label="Included credits" value={formatCredits(plan.includedCredits)} hint="Refresh every 30 days" />
        <BillingFact label="Group create cap" value={formatFactValue(plan.groupWorkspaceLimit)} hint={`${formatFactValue(plan.groupMemberLimit)} members per Group`} />
        <BillingFact label="Solo limits" value={`${formatFactValue(plan.boardLimit)} boards / ${formatFactValue(plan.pageLimit)} pages`} />
      </BillingFactGrid>

      <BillingPeriodFacts
        currentPeriodEnd={isCurrent ? groupSummary.currentPeriodEnd : null}
        currentPeriodStart={isCurrent ? groupSummary.currentPeriodStart : null}
        nextRefreshAt={isCurrent ? groupSummary.nextRefreshAt : null}
      />

      {isCurrent ? <BillingProgress remaining={groupSummary.remainingCredits} total={groupSummary.totalCredits} /> : null}

      <BillingFactGrid columns={4}>
        <BillingFact label="Remaining credits" value={isCurrent ? formatCredits(groupSummary.remainingCredits) : '—'} hint={isCurrent ? `${formatCredits(groupSummary.totalCredits)} total available` : 'Becomes active after checkout'} />
        <BillingFact label="Top-up balance" value={isCurrent ? formatCredits(groupSummary.topUpBalance) : '—'} hint="Top-up credits stay separate" />
        <BillingFact label="Groups now" value={isCurrent ? `${groupSummary.groupsCreated} created / ${groupSummary.joinedGroups} joined` : '—'} />
        <BillingFact label="Billing mode" value={formatBillingIntervalLabel(isCurrent ? groupSummary.billingInterval : cycle)} hint={plan.planKey === 'free_canvas' ? 'Free tier' : 'Annual is billed upfront for 12 months'} />
      </BillingFactGrid>

      <BillingInlineList
        items={[
          'Free users can join Team workspaces',
          'Group AI always charges the current actor',
          `Free-created Group envelope: ${formatFactValue(plan.boardLimit)} board / ${formatFactValue(plan.pageLimit)} pages`,
        ]}
      />
    </BillingBand>
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
      <BillingBand
        actions={<SubscriptionPlanAction activeCount={0} className="workspace-commerce-secondary-button" href="/admin?tab=finance" label="Contact" planKey="enterprise" planName={plan.name} />}
        badge={<BillingStatusPill>Custom</BillingStatusPill>}
        eyebrow="Workspace plan"
        title={plan.name}
        tone="muted"
      >
        <BillingFactGrid columns={4}>
          <BillingFact label="Price" value="Custom" hint="Contract pricing" />
          <BillingFact label="Seats" value={formatFactValue(plan.seatRange)} />
          <BillingFact label="Credits" value="Contract" />
          <BillingFact label="Billing" value="Enterprise pool" />
        </BillingFactGrid>
      </BillingBand>
    )
  }

  const workspaceCount = ownedTeams.length
  const representative = ownedTeams[0] ?? null
  const remainingCredits = ownedTeams.reduce((total, team) => total + team.remainingCredits, 0)
  const totalCredits = ownedTeams.reduce((total, team) => total + team.totalCredits, 0)
  const seatsUsed = ownedTeams.reduce((total, team) => total + team.seatsUsed, 0)
  const seatLimit = ownedTeams.reduce((total, team) => total + team.seatLimit, 0)
  const boardCount = ownedTeams.reduce((total, team) => total + team.boardCount, 0)
  const memberCount = ownedTeams.reduce((total, team) => total + team.memberCount, 0)
  const status = workspaceCount > 0 ? `${workspaceCount} active workspace${workspaceCount > 1 ? 's' : ''}` : 'Available'

  return (
    <BillingBand
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
      title={plan.name}
      tone={workspaceCount > 0 ? 'team' : 'muted'}
    >
      <BillingFactGrid columns={4}>
        <BillingFact label="Seat price" value={formatWorkspacePlanPrice(plan, cycle)} hint={formatBillingHint(plan, cycle)} />
        <BillingFact label="Included credits / seat" value={formatCredits(plan.includedCredits)} hint="Seat-based Team wallet grant" />
        <BillingFact label="Seat cap" value={formatFactValue(plan.seatMax)} hint={formatFactValue(plan.seatRange)} />
        <BillingFact label="Workspace billing" value="Team wallet" hint="Owner/admin can invite and manage seats" />
      </BillingFactGrid>

      <BillingPeriodFacts
        currentPeriodEnd={representative?.currentPeriodEnd ?? null}
        currentPeriodStart={representative?.currentPeriodStart ?? null}
        nextRefreshAt={representative?.nextRefreshAt ?? null}
      />

      {workspaceCount > 0 ? <BillingProgress remaining={remainingCredits} total={totalCredits} /> : null}

      <BillingFactGrid columns={4}>
        <BillingFact label="Team credits" value={workspaceCount > 0 ? `${formatCredits(remainingCredits)} / ${formatCredits(totalCredits)}` : '—'} hint="Across owned workspaces on this plan" />
        <BillingFact label="Seats" value={workspaceCount > 0 ? `${seatsUsed} / ${seatLimit}` : '—'} hint={`${memberCount} members total`} />
        <BillingFact label="Boards" value={workspaceCount > 0 ? boardCount : '—'} hint={`${workspaceCount} owned Team workspaces`} />
        <BillingFact label="Billing mode" value={formatBillingIntervalLabel(representative?.billingInterval ?? cycle)} hint="Annual is billed upfront for 12 months" />
      </BillingFactGrid>

      <BillingInlineList
        items={[
          'Team AI always charges the Team wallet',
          'Owner/admin can invite, remove, and assign seats',
          'Seat purchases do not create personal payer accounts',
        ]}
      />
    </BillingBand>
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
