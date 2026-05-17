'use client'

import { resolveCreditUsageMetrics } from '@/features/billing/billingCreditUsage'
import { EmptyRow, MetaLine, formatCompactDate, formatNumber } from './adminAiShared'
import type {
  AdminOperatorBillingHistoryRow,
  AdminOperatorCreditSummary,
  AdminOperatorWorkspacePlan,
} from './adminTypes'

export function BillingHistoryTable({ rows }: { rows: AdminOperatorBillingHistoryRow[] }) {
  return (
    <article className="management-panel admin-operator-section">
      <div className="management-panel-heading compact"><h2>Billing history</h2></div>
      <div className="management-table-wrap">
        <table className="management-table admin-billing-history-table">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '33%' }} />
          </colgroup>
          <thead><tr><th>Item</th><th>Amount</th><th>Team credit</th><th>Personal credits</th><th>Date</th><th>Reason</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.id}>
                <td className="admin-billing-item-cell"><strong>{row.item}</strong></td>
                <td>{moneyText(row)}</td>
                <td className={deltaClass(row.teamCreditsDelta)}>{signed(row.teamCreditsDelta)}</td>
                <td className={deltaClass(row.personalCreditsDelta)}>{signed(row.personalCreditsDelta)}</td>
                <td>{formatCompactDate(row.createdAt)}</td>
                <td>{billingReason(row)}</td>
              </tr>
            )) : <EmptyRow colSpan={6} message="No billing history." />}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function WorkspaceTable({
  actions,
  emptyMessage,
  rows,
  showOwner,
  showRole,
  usageOnly = false,
}: {
  actions: (workspace: AdminOperatorWorkspacePlan) => Array<{ label: string; onClick: () => void }>
  emptyMessage: string
  rows: AdminOperatorWorkspacePlan[]
  showOwner: boolean
  showRole: boolean
  usageOnly?: boolean
}) {
  const colSpan = 8 + (showOwner ? 1 : 0) + (showRole ? 1 : 0)
  return (
    <div className="management-table-wrap">
      <table className="management-table admin-operator-workspace-table">
        <thead>
          <tr>
            <th>Workspace</th>
            {showOwner ? <th>Created by</th> : null}
            <th>Plan</th>
            <th>Status</th>
            <th>Credit</th>
            <th>Seats</th>
            <th>Members</th>
            <th>Boards</th>
            {showRole ? <th>Role</th> : null}
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((workspace) => (
            <tr key={workspace.id}>
              <td><strong>{workspace.workspaceName}</strong><MetaLine>{workspace.id}</MetaLine></td>
              {showOwner ? <td>{workspace.ownerEmail ?? workspace.ownerId ?? '-'}</td> : null}
              <td><strong>{formatPlanKey(workspace.planKey)}</strong><MetaLine>{periodText(workspace.periodStart, workspace.periodEnd)}</MetaLine></td>
              <td><span className="management-badge">{workspace.planStatus ?? '-'}</span></td>
              <td>{usageOnly ? <UsageOnly value={workspace.usageByUser} /> : <CreditBar credit={workspace.credit} tone={isCurrentStatus(workspace.planStatus) ? 'active' : 'muted'} />}</td>
              <td>{workspace.seatCapacity > 0 ? workspace.seatCapacity : '-'}</td>
              <td>{workspace.memberCount}<MemberPreview members={workspace.members} /></td>
              <td>{workspace.boardCount}<BoardPreview boards={workspace.boards} /></td>
              {showRole ? <td><span className="management-badge">{workspace.role ?? '-'}</span></td> : null}
              <td><ActionStrip actions={actions(workspace)} /></td>
            </tr>
          )) : <EmptyRow colSpan={colSpan} message={emptyMessage} />}
        </tbody>
      </table>
    </div>
  )
}

export function CreditBar({
  credit,
  tone = 'active',
}: {
  credit: AdminOperatorCreditSummary
  tone?: 'active' | 'muted'
}) {
  const total = Math.max(credit.totalCredits, credit.remainingCredits, credit.spentCredits, 1)
  const usage = resolveCreditUsageMetrics(credit.remainingCredits, total)
  return (
    <div className={`admin-credit-bar-shell ${tone === 'muted' ? 'is-muted' : ''}`}>
      <span>{formatNumber(usage.used)}/{formatNumber(usage.total)}</span>
      <div className={`admin-credit-bar ${tone === 'muted' ? 'is-muted' : ''}`} aria-hidden="true"><i style={{ width: `${usage.percent}%` }} /></div>
    </div>
  )
}

export function periodText(periodStart?: null | string, periodEnd?: null | string) {
  if (!periodStart && !periodEnd) return '-'
  if (!periodStart) return periodEnd ? formatCompactDate(periodEnd) : '-'
  if (!periodEnd) return `${formatCompactDate(periodStart)}-`
  return `${formatCompactDate(periodStart)}-${formatCompactDate(periodEnd)}`
}

export function formatPlanKey(value?: null | string) {
  if (!value) return 'Free'
  return value
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

function UsageOnly({ value }: { value: number }) {
  return <strong>{formatNumber(value)}</strong>
}

function MemberPreview({ members }: { members: AdminOperatorWorkspacePlan['members'] }) {
  if (!members.length) return null
  return <MetaLine>{members.slice(0, 2).map((member) => member.email || member.displayName || member.userId).join(', ')}</MetaLine>
}

function BoardPreview({ boards }: { boards: AdminOperatorWorkspacePlan['boards'] }) {
  if (!boards.length) return null
  return <MetaLine>{boards.slice(0, 2).map((board) => board.title || board.id).join(', ')}</MetaLine>
}

function ActionStrip({ actions }: { actions: Array<{ label: string; onClick: () => void }> }) {
  if (!actions.length) return <span>-</span>
  return <div className="admin-operator-actions">{actions.map((action) => <button className="product-button product-button-secondary admin-table-button" key={action.label} onClick={action.onClick} type="button">{action.label}</button>)}</div>
}

function signed(value: number) {
  if (value === 0) return '-'
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`
}

function deltaClass(value: number) {
  if (value > 0) return 'admin-billing-delta is-positive'
  if (value < 0) return 'admin-billing-delta is-negative'
  return 'admin-billing-delta'
}

function moneyText(row: AdminOperatorBillingHistoryRow) {
  if (row.amountCents == null) return '-'
  const currency = asString(row.metadata.currency)?.toUpperCase()
  const prefix = currency && currency !== 'USD' ? `${currency} ` : '$'
  return `${prefix}${formatNumber(row.amountCents / 100)}`
}

function billingReason(row: AdminOperatorBillingHistoryRow) {
  return row.reason || humanizeToken(asString(row.metadata.reason)) || '-'
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function humanizeToken(value: string) {
  if (!value) return ''
  return value.replaceAll('_', ' ')
}

function isCurrentStatus(status?: null | string) {
  return status === 'active' || status === 'trialing' || status === 'paused'
}
