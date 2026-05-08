import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatCredits } from './billingPresentation'
import {
  formatPlanBadge,
  formatRenewLabel,
  type GroupBillingSummary,
  type TeamBillingCard,
} from './workspaceCommerceMock'

type UsageSectionProps = {
  children: ReactNode
  count: number
  title: string
}

type UsageCardProps = {
  canManageBilling: boolean
  card: TeamBillingCard
  index: number
  isPending?: boolean
  onBuySeat?: () => void
  onTopUp?: () => void
}

type UsageGroupCardProps = {
  groupSummary: GroupBillingSummary
  isPending?: boolean
  onAddGroup: () => void
  onTopUp: () => void
}

type SummaryCardProps = {
  label: string
  meta: string
  value: string
}

export function UsageSection({ children, count, title }: UsageSectionProps) {
  return (
    <section className="workspace-commerce-section">
      <div className="workspace-commerce-section-head">
        <h2>{title}</h2>
        <span className="workspace-commerce-note">{count}</span>
      </div>
      {children}
    </section>
  )
}

export function UsageCard({
  canManageBilling,
  card,
  index,
  isPending = false,
  onBuySeat,
  onTopUp,
}: UsageCardProps) {
  const creditPercent = Math.min(100, Math.round((card.remainingCredits / card.totalCredits) * 100))
  const seatPercent = Math.min(100, Math.round((card.seatsUsed / card.seatLimit) * 100))

  return (
    <article className={`workspace-commerce-usage-card${canManageBilling ? '' : ' is-muted'}`} data-tone="team">
      <div className="workspace-commerce-card-top">
        <div>
          <span className="workspace-commerce-card-eyebrow">Team</span>
          <h3>{card.name}</h3>
        </div>
        <span className="workspace-commerce-plan-badge">{formatPlanBadge(card.planKey)}</span>
      </div>
      <div className="workspace-commerce-usage-tag-row">
        <span className="workspace-commerce-usage-tag">{card.relationship === 'created' ? 'Owned' : 'Joined'}</span>
        <span className="workspace-commerce-usage-tag">{card.membershipRole}</span>
        <span className="workspace-commerce-note">{formatRenewLabel(index)}</span>
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
      <div className="workspace-commerce-progress"><span style={{ width: `${creditPercent}%` }} /></div>
      <div className="workspace-commerce-progress is-light"><span style={{ width: `${seatPercent}%` }} /></div>
      <div className="workspace-commerce-card-actions">
        <Link className="workspace-commerce-secondary-button" href={`/team/${encodeURIComponent(card.id)}`}>
          Open
        </Link>
        {canManageBilling ? (
          <>
            <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onTopUp} type="button">
              Top up
            </button>
            <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onBuySeat} type="button">
              Buy seat
            </button>
          </>
        ) : null}
      </div>
    </article>
  )
}

export function UsageGroupCard({
  groupSummary,
  isPending = false,
  onAddGroup,
  onTopUp,
}: UsageGroupCardProps) {
  const creditPercent = Math.min(100, Math.round((groupSummary.remainingCredits / groupSummary.totalCredits) * 100))
  const groupPercent = Math.min(100, Math.round((groupSummary.groupsCreated / groupSummary.groupLimit) * 100))

  return (
    <article className="workspace-commerce-usage-card" data-tone="group">
      <div className="workspace-commerce-card-top">
        <div>
          <span className="workspace-commerce-card-eyebrow">Group</span>
          <h3>Personal collaboration</h3>
        </div>
        <span className="workspace-commerce-plan-badge">{formatPlanBadge(groupSummary.planKey)}</span>
      </div>
      <div className="workspace-commerce-usage-tag-row">
        <span className="workspace-commerce-usage-tag">Owned</span>
        <span className="workspace-commerce-note">{groupSummary.groupsCreated} groups</span>
      </div>
      <div className="workspace-commerce-card-stats">
        <div className="workspace-commerce-stat">
          <span>Credits</span>
          <strong>{formatCredits(groupSummary.remainingCredits)} / {formatCredits(groupSummary.totalCredits)}</strong>
        </div>
        <div className="workspace-commerce-stat">
          <span>Groups</span>
          <strong>{groupSummary.groupsCreated} / {groupSummary.groupLimit}</strong>
        </div>
      </div>
      <div className="workspace-commerce-progress"><span style={{ width: `${creditPercent}%` }} /></div>
      <div className="workspace-commerce-progress is-light"><span style={{ width: `${groupPercent}%` }} /></div>
      <div className="workspace-commerce-card-actions">
        <Link className="workspace-commerce-secondary-button" href="/group">
          Open
        </Link>
        <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onTopUp} type="button">
          Top up
        </button>
        <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onAddGroup} type="button">
          Add group
        </button>
      </div>
    </article>
  )
}

export function SummaryCard({ label, meta, value }: SummaryCardProps) {
  return (
    <article className="workspace-commerce-summary-card">
      <span className="workspace-commerce-summary-label">{label}</span>
      <strong className="workspace-commerce-summary-value">{value}</strong>
      <span className="workspace-commerce-summary-meta">{meta}</span>
    </article>
  )
}

export function prioritizeTeamCards(cards: TeamBillingCard[], workspaceId: string | null) {
  if (!workspaceId) return cards
  return [...cards].sort((left, right) => {
    if (left.id === workspaceId) return -1
    if (right.id === workspaceId) return 1
    return 0
  })
}
