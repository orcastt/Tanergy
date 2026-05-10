'use client'

import Link from 'next/link'
import { buildStableListKey, formatCompactDate, formatNumber, truncateMiddle } from './adminAiShared'
import type {
  AdminOperatorCreditSummary,
  AdminOperatorUserPlan,
  AdminOperatorUserRecord,
  AdminOperatorWorkspacePlan,
} from './adminTypes'

export function AdminOperatorUserInventoryRow({
  onWarmDetail,
  user,
}: {
  onWarmDetail: (user: AdminOperatorUserRecord) => void
  user: AdminOperatorUserRecord
}) {
  const detailHref = `/admin/users/${encodeURIComponent(user.id)}`
  const teamPlanRows = summarizeWorkspacePlanRows(user.teamPlansActive, user.teamPlansExpired, 3)
  const groupPlanRows = summarizeUserPlanRows(user.groupPlansActive, user.groupPlansExpired, 2)

  return (
    <tr>
      <td className="admin-users-cell-id">
        <strong title={user.id}>{truncateMiddle(user.id, 16, 8)}</strong>
      </td>
      <td className="admin-users-cell-email">
        <strong title={user.email}>{user.email}</strong>
      </td>
      <td className="admin-users-cell-ip">
        <strong>{user.ipAddress ?? '-'}</strong>
      </td>
      <td className="admin-users-cell-register">
        <strong>{formatCompactDate(user.createdAt)}</strong>
      </td>
      <td><TeamPlanStack rows={teamPlanRows} /></td>
      <td><TeamCreditStack rows={teamPlanRows} /></td>
      <td><GroupPlanStack rows={groupPlanRows} /></td>
      <td><CreditBar credit={user.personalCredit} /></td>
      <td className="admin-users-cell-spent">
        <strong>{formatNumber(user.totalCreditsSpent)}</strong>
      </td>
      <td><StatusText status={user.status} /></td>
      <td>
        <Link
          className="admin-detail-button"
          href={detailHref}
          onClick={() => onWarmDetail(user)}
          onFocus={() => onWarmDetail(user)}
          onMouseEnter={() => onWarmDetail(user)}
          prefetch={false}
        >
          Detail
        </Link>
      </td>
    </tr>
  )
}

function TeamPlanStack({ rows }: { rows: WorkspacePlanRow[] }) {
  if (!rows.length) return <span>-</span>
  return (
    <div className="admin-plan-stack">
      {rows.map((row) => <WorkspacePlanLine key={row.key} plan={row.plan} tone={row.tone} />)}
    </div>
  )
}

function TeamCreditStack({ rows }: { rows: WorkspacePlanRow[] }) {
  if (!rows.length) return <span>-</span>
  return (
    <div className="admin-credit-stack">
      {rows.map((row) => (
        <CreditBar
          key={row.key}
          credit={row.plan.credit}
          tone={row.tone}
        />
      ))}
    </div>
  )
}

function GroupPlanStack({ rows }: { rows: UserPlanRow[] }) {
  if (!rows.length) return <span>-</span>
  return (
    <div className="admin-plan-stack">
      {rows.map((row) => <UserPlanLine key={row.key} plan={row.plan} tone={row.tone} />)}
    </div>
  )
}

function WorkspacePlanLine({ plan, tone }: { plan: AdminOperatorWorkspacePlan; tone: 'active' | 'muted' }) {
  return (
    <span className={`admin-plan-line is-${tone}`}>
      <strong>{planLabel(plan.planKey ?? 'free')}</strong>
      <small title={periodText(plan.periodStart, plan.periodEnd)}>{periodText(plan.periodStart, plan.periodEnd)}</small>
    </span>
  )
}

function UserPlanLine({ plan, tone }: { plan: AdminOperatorUserPlan; tone: 'active' | 'muted' }) {
  return (
    <span className={`admin-plan-line is-${tone}`}>
      <strong>{planLabel(plan.planKey)}</strong>
      <small title={periodText(plan.periodStart, plan.periodEnd)}>{periodText(plan.periodStart, plan.periodEnd)}</small>
    </span>
  )
}

function CreditBar({
  credit,
  tone = 'active',
}: {
  credit: AdminOperatorCreditSummary
  tone?: 'active' | 'muted'
}) {
  const total = Math.max(credit.totalCredits, credit.remainingCredits, credit.spentCredits, 1)
  const remainingPercent = Math.min(100, Math.max(0, (credit.remainingCredits / total) * 100))

  return (
    <div className={`admin-credit-bar-shell ${tone === 'muted' ? 'is-muted' : ''}`}>
      <span>{formatNumber(credit.remainingCredits)}/{formatNumber(total)}</span>
      <div className={`admin-credit-bar ${tone === 'muted' ? 'is-muted' : ''}`} aria-hidden="true">
        <i style={{ width: `${remainingPercent}%` }} />
      </div>
    </div>
  )
}

function StatusText({ status }: { status: string }) {
  const isActive = status === 'active'
  const label = isActive ? 'Active' : status.replaceAll('_', ' ')
  return <span className={`admin-user-status-text ${isActive ? 'is-active' : 'is-inactive'}`}>{label}</span>
}

function periodText(periodStart?: null | string, periodEnd?: null | string) {
  if (!periodStart && !periodEnd) return '-'
  if (!periodStart) return periodEnd ? formatCompactDate(periodEnd) : '-'
  if (!periodEnd) return `${formatCompactDate(periodStart)}-`
  return `${formatCompactDate(periodStart)}-${formatCompactDate(periodEnd)}`
}

function planLabel(value: string) {
  return value
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

type WorkspacePlanRow = { key: string; plan: AdminOperatorWorkspacePlan; tone: 'active' | 'muted' }
type UserPlanRow = { key: string; plan: AdminOperatorUserPlan; tone: 'active' | 'muted' }

function summarizeWorkspacePlanRows(
  activePlans: AdminOperatorWorkspacePlan[],
  expiredPlans: AdminOperatorWorkspacePlan[],
  limit: number,
) {
  return [
    ...activePlans.map((plan, index) => ({
      key: buildStableListKey([plan.id, plan.subscriptionId, plan.planKey, plan.workspaceName], index),
      plan,
      tone: 'active' as const,
    })),
    ...expiredPlans.map((plan, index) => ({
      key: buildStableListKey([plan.id, plan.subscriptionId, plan.planKey, plan.workspaceName], activePlans.length + index),
      plan,
      tone: 'muted' as const,
    })),
  ].slice(0, limit)
}

function summarizeUserPlanRows(
  activePlans: AdminOperatorUserPlan[],
  expiredPlans: AdminOperatorUserPlan[],
  limit: number,
) {
  return [
    ...activePlans.map((plan, index) => ({
      key: buildStableListKey([plan.subscriptionId, plan.planKey, plan.periodStart, plan.periodEnd], index),
      plan,
      tone: 'active' as const,
    })),
    ...expiredPlans.map((plan, index) => ({
      key: buildStableListKey([plan.subscriptionId, plan.planKey, plan.periodStart, plan.periodEnd], activePlans.length + index),
      plan,
      tone: 'muted' as const,
    })),
  ].slice(0, limit)
}
