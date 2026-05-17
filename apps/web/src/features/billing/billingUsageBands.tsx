'use client'

import Link from 'next/link'
import {
  formatBillingIntervalLabel,
  formatCredits,
  formatDate,
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
import type {
  CommerceGroupSummary,
  CommerceTeamCard,
} from './useWorkspaceCommerceOverview'

export type ActivityRow = {
  actionLabel: string
  amountLabel: string
  happenedAt: string
  id: string
  scopeLabel: string
}

export function UsageShell({ subtitle }: { subtitle: string }) {
  return (
    <div className="product-page workspace-commerce-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-copy">
          <h1 className="product-page-title">Usage</h1>
          <p className="workspace-commerce-status">{subtitle}</p>
        </div>
      </section>
    </div>
  )
}

export function PersonalUsageBand({
  groupSummary,
  isPending,
  onAddGroup,
  onTopUp,
}: {
  groupSummary: CommerceGroupSummary
  isPending: boolean
  onAddGroup: () => void
  onTopUp: () => void
}) {
  return (
    <BillingBand
      actions={(
        <>
          <Link className="workspace-commerce-secondary-button" href="/billing">Change plan</Link>
          <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onAddGroup} type="button">Create Group</button>
          <button className="workspace-commerce-primary-button" disabled={isPending} onClick={onTopUp} type="button">Top up</button>
        </>
      )}
      badge={<BillingStatusPill>{groupSummary.planName}</BillingStatusPill>}
      eyebrow="Personal usage"
      title="My personal plan"
      tone="group"
    >
      <BillingFactGrid columns={4}>
        <BillingFact label="Remaining credits" value={`${formatCredits(groupSummary.remainingCredits)} / ${formatCredits(groupSummary.totalCredits)}`} hint={`${formatCredits(groupSummary.topUpBalance)} top-up balance`} />
        <BillingFact label="Included credits" value={formatCredits(groupSummary.includedCredits)} hint="Refresh every 30 days" />
        <BillingFact label="Group capacity" value={`${groupSummary.groupsCreated} / ${groupSummary.groupLimit}`} hint={`${formatFact(groupSummary.groupMemberLimit)} members per Group`} />
        <BillingFact label="Billing mode" value={formatBillingIntervalLabel(groupSummary.billingInterval)} hint="Group AI charges your own personal credits" />
      </BillingFactGrid>
      <BillingPeriodFacts
        currentPeriodEnd={groupSummary.currentPeriodEnd}
        currentPeriodStart={groupSummary.currentPeriodStart}
        nextRefreshAt={groupSummary.nextRefreshAt}
      />
      <BillingProgress remaining={groupSummary.remainingCredits} total={groupSummary.totalCredits} />
      <BillingInlineList
        items={[
          `${groupSummary.joinedGroups} joined Groups`,
          `${formatFact(groupSummary.boardLimit)} board free envelope`,
          `${formatFact(groupSummary.pageLimit)} pages per board`,
        ]}
      />
    </BillingBand>
  )
}

export function TeamUsageBand({
  isPending = false,
  onBuySeat,
  onTopUp,
  team,
}: {
  isPending?: boolean
  onBuySeat?: () => void
  onTopUp?: () => void
  team: CommerceTeamCard
}) {
  const canManage = team.canManageBilling && onTopUp && onBuySeat
  return (
    <BillingBand
      actions={(
        <>
          <Link className="workspace-commerce-secondary-button" href={`/team/${encodeURIComponent(team.id)}`}>Open workspace</Link>
          {canManage ? <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onBuySeat} type="button">Buy seat</button> : null}
          {canManage ? <button className="workspace-commerce-primary-button" disabled={isPending} onClick={onTopUp} type="button">Top up</button> : null}
        </>
      )}
      badge={<BillingStatusPill>{team.relationship === 'created' ? 'Owned Team' : 'Joined Team'}</BillingStatusPill>}
      eyebrow="Team usage"
      title={team.name}
      tone="team"
    >
      <BillingFactGrid columns={4}>
        <BillingFact label="Plan" value={team.planName} hint={formatBillingIntervalLabel(team.billingInterval)} />
        <BillingFact label="Team credits" value={`${formatCredits(team.remainingCredits)} / ${formatCredits(team.totalCredits)}`} hint={`${formatCredits(team.topUpBalance)} top-up balance`} />
        <BillingFact label="Seats" value={`${team.seatsUsed} / ${team.seatLimit}`} hint={`${team.memberCount} members · ${team.boardCount} boards`} />
        <BillingFact label="Billing mode" value="Team wallet" hint="AI never charges each member personally here" />
      </BillingFactGrid>
      <BillingPeriodFacts
        currentPeriodEnd={team.currentPeriodEnd}
        currentPeriodStart={team.currentPeriodStart}
        nextRefreshAt={team.nextRefreshAt}
      />
      <BillingProgress remaining={team.remainingCredits} total={team.totalCredits} />
      <BillingInlineList
        items={[
          `${formatCredits(team.includedCredits)} included credits on current pack`,
          `${formatFact(team.seatMin)}-${formatFact(team.seatMax)} seat range`,
          canManage ? 'Owner/admin can invite, remove, and assign seats' : 'Read-only billing view for joined Team',
        ]}
      />
    </BillingBand>
  )
}

export function UsageActivityTable({
  activityRows,
}: {
  activityRows: ActivityRow[]
}) {
  return (
    <div className="workspace-commerce-ledger-table">
      <div className="workspace-commerce-ledger-head">
        <span>When</span>
        <span>Scope</span>
        <span>Action</span>
        <span>Change</span>
      </div>
      {activityRows.length ? activityRows.map((entry) => (
        <div className="workspace-commerce-ledger-row" key={entry.id}>
          <span>{formatDate(entry.happenedAt)}</span>
          <span>{entry.scopeLabel}</span>
          <span>{entry.actionLabel}</span>
          <span className="workspace-commerce-ledger-amount">{entry.amountLabel}</span>
        </div>
      )) : <div className="workspace-commerce-ledger-empty">No billing activity yet.</div>}
    </div>
  )
}

export function formatLedgerAction(reason: string) {
  if (reason === 'subscription_grant') return 'Subscription grant'
  if (reason === 'topup_purchase') return 'Top-up purchase'
  if (reason === 'usage_charge') return 'Usage charge'
  if (reason === 'usage_refund') return 'Usage refund'
  return reason.replace(/_/g, ' ')
}

export function formatPaymentAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    currency: currency.toUpperCase(),
    style: 'currency',
  }).format(amountCents / 100)
}

function formatFact(value?: null | number) {
  return value === null || value === undefined ? '—' : String(value)
}
