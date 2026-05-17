'use client'

import { buildStableListKey } from './adminAiShared'
import { CreditBar, formatPlanKey, periodText } from './AdminOperatorDetailTables'
import type { AdminOperatorCreditTarget } from './adminOperatorActions'
import type { AdminOperatorWorkspacePlan } from './adminTypes'

export function WorkspacePlanStack({ rows }: { rows: AdminOperatorWorkspacePlan[] }) {
  if (!rows.length) return <span>-</span>
  return (
    <div className="admin-plan-stack">
      {rows.map((row) => (
        <span className={`admin-plan-line ${isCurrentPlan(row.planStatus ?? '') ? '' : 'is-muted'}`} key={row.id}>
          <strong>{formatPlanKey(row.planKey)}</strong>
          <small className={isCurrentPlan(row.planStatus ?? '') ? 'is-active' : 'is-muted'}>{periodText(row.periodStart, row.periodEnd)}</small>
        </span>
      ))}
    </div>
  )
}

export function WorkspaceCreditStack({ rows }: { rows: AdminOperatorWorkspacePlan[] }) {
  if (!rows.length) return <span>-</span>
  return (
    <div className="admin-credit-stack">
      {rows.map((row) => (
        <CreditBar key={row.id} credit={row.credit} tone={isCurrentPlan(row.planStatus ?? '') ? 'active' : 'muted'} />
      ))}
    </div>
  )
}

export function UserPlanStack({
  rows,
}: {
  rows: Array<{ periodEnd?: null | string; periodStart?: null | string; planKey: string; status: string; subscriptionId: string }>
}) {
  if (!rows.length) return <span>-</span>
  return (
    <div className="admin-plan-stack">
      {rows.map((row, index) => (
        <span
          className={`admin-plan-line ${isCurrentPlan(row.status) ? '' : 'is-muted'}`}
          key={buildStableListKey([row.subscriptionId, row.planKey, row.periodStart, row.periodEnd], index)}
        >
          <strong>{formatPlanKey(row.planKey)}</strong>
          <small className={isCurrentPlan(row.status) ? 'is-active' : 'is-muted'}>{periodText(row.periodStart, row.periodEnd)}</small>
        </span>
      ))}
    </div>
  )
}

export function isCurrentPlan(status: string) {
  return status === 'active' || status === 'trialing' || status === 'paused'
}

export function isActivePlan(status: string) {
  return status === 'active' || status === 'trialing'
}

export function StatusText({ status }: { status: string }) {
  const isActive = status === 'active'
  const label = isActive ? 'Active' : status.replaceAll('_', ' ')
  return <span className={`admin-user-status-text ${isActive ? 'is-active' : 'is-inactive'}`}>{label}</span>
}

export function buildBillingCreditTargets(teams: AdminOperatorWorkspacePlan[]): AdminOperatorCreditTarget[] {
  return [
    { id: 'personal', kind: 'personal', label: 'Personal credits' },
    ...teams.map((team) => ({
      id: `team:${team.id}`,
      kind: 'team_wallet' as const,
      label: `${team.workspaceName || formatPlanKey(team.planKey)} Team wallet`,
      workspaceId: team.id,
    })),
  ]
}

export function formatRegistrationState(value: string) {
  return value ? value.replaceAll('_', ' ') : 'unknown'
}
