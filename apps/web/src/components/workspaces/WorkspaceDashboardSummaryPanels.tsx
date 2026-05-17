'use client'

import Link from 'next/link'
import { resolveCreditUsageMetrics } from '@/features/billing/billingCreditUsage'
import { formatCredits, formatDateOnly } from '@/features/billing/billingPresentation'
import type {
  GroupWorkspaceDashboardRecord,
  TeamWorkspaceDashboardRecord,
} from '@/features/workspaces/workspaceDashboardTypes'

export function TeamDashboardSummaryPanel({ record }: { record: TeamWorkspaceDashboardRecord }) {
  const usage = resolveCreditUsageMetrics(record.totalCreditsRemaining, record.totalCredits)

  return (
    <section className="workspace-detail-panel workspace-detail-side-panel">
      <div className="workspace-detail-panel-head"><h2>Usage</h2></div>
      <div className="workspace-detail-dark-card">
        <div className="workspace-detail-dark-row">
          <strong>{formatCredits(usage.used)} / {formatCredits(usage.total)}</strong>
          <Link className="workspace-detail-danger-button" href={`/usage?scope=teams&workspace=${encodeURIComponent(record.id)}`}>
            Top Up
          </Link>
        </div>
        <small>{formatCredits(record.includedCredits)} included + {formatCredits(record.topUpBalance)} top-up</small>
        <div className="workspace-detail-progress"><span style={{ width: `${usage.percent}%` }} /></div>
      </div>
      <div className="workspace-detail-summary-list">
        <SummaryRow label="Plan" value={record.planName} />
        <SummaryRow label="Billing" value="Team wallet" />
        <SummaryRow label="Seats" value={`${record.seatsUsed} / ${record.seatLimit}`} />
        {record.seatMax && record.seatMax > record.seatLimit ? (
          <SummaryRow label="Expandable to" value={`${record.seatMax} seats`} />
        ) : null}
        <SummaryRow label="Members" value={String(record.memberCount)} />
        <SummaryRow label="Next refresh" value={formatPeriodFact(record.nextRefreshAt, 'Rolling 30d')} />
        <SummaryRow label="Valid until" value={formatPeriodFact(record.currentPeriodEnd, 'No expiry')} />
      </div>
      <div className="workspace-detail-usage-list">
        {record.members.map((member) => (
          <div className="workspace-detail-usage-row" key={member.id}>
            <span className="workspace-detail-avatar">{member.initials}</span>
            <div className="workspace-detail-progress is-light">
              <span style={{ width: `${Math.min(100, Math.round(((member.usageCredits ?? 0) / record.memberUsageLimit) * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
      <small className="workspace-detail-status">Seat packs and Team credits stay on the subscribed workspace plan even if this Team is cleared.</small>
    </section>
  )
}

export function GroupDashboardSummaryPanel({ record }: { record: GroupWorkspaceDashboardRecord }) {
  const usage = resolveCreditUsageMetrics(record.totalCreditsRemaining, record.totalCredits)

  return (
    <section className="workspace-detail-panel workspace-detail-side-panel">
      <div className="workspace-detail-panel-head"><h2>My credits</h2></div>
      <div className="workspace-detail-dark-card">
        <div className="workspace-detail-dark-row">
          <strong>{formatCredits(usage.used)} / {formatCredits(usage.total)}</strong>
          <Link className="workspace-detail-danger-button" href="/usage?scope=group">
            Top Up
          </Link>
        </div>
        <small>{formatCredits(record.includedCredits)} included + {formatCredits(record.topUpBalance)} top-up</small>
        <div className="workspace-detail-progress"><span style={{ width: `${usage.percent}%` }} /></div>
      </div>
      <div className="workspace-detail-summary-list">
        <SummaryRow label="My personal plan" value={record.planName} />
        <SummaryRow label="Billing" value="Personal credits" />
        <SummaryRow label="Members" value={String(record.memberCount)} />
        <SummaryRow label="Board envelope" value={formatEnvelope(record.boardLimit, record.pageLimit)} />
        <SummaryRow label="Next refresh" value={formatPeriodFact(record.nextRefreshAt, 'Rolling 30d')} />
        <SummaryRow label="Valid until" value={formatPeriodFact(record.currentPeriodEnd, 'No expiry')} />
      </div>
      <small className="workspace-detail-status">AI runs in this Group always charge your own personal credits. Removing the Group does not move or merge credits.</small>
    </section>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-detail-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatEnvelope(boardLimit?: null | number, pageLimit?: null | number) {
  const boards = boardLimit === null || boardLimit === undefined ? 'Unlimited boards' : `${boardLimit} board${boardLimit === 1 ? '' : 's'}`
  const pages = pageLimit === null || pageLimit === undefined ? 'unlimited pages' : `${pageLimit} page${pageLimit === 1 ? '' : 's'}`
  return `${boards} / ${pages}`
}

function formatPeriodFact(value: null | string | undefined, fallback: string) {
  return value ? formatDateOnly(value) : fallback
}
