'use client'

import { EmptyRow, buildStableListKey, formatCompactDate, formatNumber, truncateMiddle } from './adminAiShared'
import { BillingHistoryTable, CreditBar, formatPlanKey, periodText } from './AdminOperatorDetailTables'
import { GroupPlanRow } from './adminOperatorDetailActionBuilders'
import { JoinedGroupTable, JoinedTeamTable } from './AdminOperatorJoinedPlanTables'
import { OwnedGroupsTable, OwnedTeamPlansTable } from './AdminOperatorOwnedPlanTables'
import type { AdminOperatorAction } from './adminOperatorActions'
import type {
  AdminOperatorUserDetail,
  AdminOperatorWorkspacePlan,
} from './adminTypes'

export function AdminOperatorBillingPanel({
  detail,
  onAction,
  status,
}: {
  detail: AdminOperatorUserDetail | null
  onAction: (action: AdminOperatorAction) => void
  status: string
}) {
  const user = detail?.user ?? null
  const teamPlans = detail?.ownedTeams ?? []
  const groupPlans = [...(detail?.groupPlansActive ?? []), ...(detail?.groupPlansExpired ?? [])]
  return (
    <section className="management-stack">
      <article className="management-panel admin-operator-profile">
        <div className="management-panel-heading compact">
          <h2>Account profile</h2>
          {status !== 'ready' ? <div className="management-actions"><span className="admin-users-range-label">{status}</span></div> : null}
        </div>
        <div className="management-table-wrap">
          <table className="management-table admin-users-table admin-operator-profile-row-table">
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>IP</th>
                <th>Register date</th>
                <th>Team plan</th>
                <th>Team credit</th>
                <th>Group plan</th>
                <th>Person credit</th>
                <th>Total spent</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {user ? (
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
                  <td><WorkspacePlanStack rows={teamPlans} /></td>
                  <td><WorkspaceCreditStack rows={teamPlans} /></td>
                  <td><UserPlanStack rows={groupPlans} /></td>
                  <td><CreditBar credit={user.personalCredit} /></td>
                  <td className="admin-users-cell-spent">
                    <strong>{formatNumber(user.totalCreditsSpent)}</strong>
                  </td>
                  <td><StatusText status={user.status} /></td>
                  <td>
                    <div className="admin-operator-profile-actions">
                      <button className="product-button product-button-secondary admin-table-button admin-plan-action-button" data-tone="danger" onClick={() => onAction({ title: 'Delete user', type: 'user-delete', userId: user.id })} type="button">Delete</button>
                      <button
                        className="product-button product-button-secondary admin-table-button admin-plan-action-button"
                        data-tone="neutral"
                        onClick={() => onAction({
                          nextStatus: user.status === 'active' ? 'suspended' : 'active',
                          title: user.status === 'active' ? 'Block user' : 'Unblock user',
                          type: 'user-status',
                          userId: user.id,
                        })}
                        type="button"
                      >
                        {user.status === 'active' ? 'Block' : 'Unblock'}
                      </button>
                      <button className="product-button product-button-secondary admin-table-button admin-plan-action-button" data-tone="primary" onClick={() => onAction({ title: 'Top up personal credits', type: 'user-topup', userId: user.id })} type="button">Top up</button>
                      <button className="product-button product-button-secondary admin-table-button admin-plan-action-button" data-tone="neutral" onClick={() => onAction({ title: 'Deduct personal credits', type: 'user-deduct', userId: user.id })} type="button">Deduct</button>
                    </div>
                  </td>
                </tr>
              ) : <EmptyRow colSpan={11} message="No user record." />}
            </tbody>
          </table>
        </div>
      </article>

      <BillingHistoryTable rows={detail?.billingHistory ?? []} />
    </section>
  )
}

export function AdminOperatorTeamPlanPanel({
  onAction,
  teams,
  userId,
}: {
  onAction: (action: AdminOperatorAction) => void
  teams: AdminOperatorWorkspacePlan[]
  userId: string
}) {
  return (
    <section className="management-panel admin-operator-section">
      <div className="management-panel-heading compact">
        <h2>Team Plan</h2>
        <button className="product-button product-button-secondary" onClick={() => onAction({ type: 'create-team', userId })} type="button">Add new plan</button>
      </div>
      <OwnedTeamPlansTable onAction={onAction} rows={teams} />
    </section>
  )
}

export function AdminOperatorJoinedWorkspacePanel({
  excludedWorkspaceIds = [],
  kind,
  onAction,
  rows,
  title,
  userId,
}: {
  excludedWorkspaceIds?: string[]
  kind: 'group' | 'team'
  onAction: (action: AdminOperatorAction) => void
  rows: AdminOperatorWorkspacePlan[]
  title: string
  userId: string
}) {
  return (
    <section className="management-panel admin-operator-section">
      <div className="management-panel-heading compact">
        <h2>{title}</h2>
        <button
          className="product-button product-button-secondary"
          onClick={() => onAction(kind === 'team'
            ? { excludedWorkspaceIds, type: 'user-join-team', userId }
            : { excludedWorkspaceIds, type: 'user-join-group', userId })}
          type="button"
        >
          {kind === 'team' ? 'Join Team' : 'Join Group'}
        </button>
      </div>
      {kind === 'team'
        ? <JoinedTeamTable onAction={onAction} rows={rows} userId={userId} />
        : <JoinedGroupTable onAction={onAction} rows={rows} userId={userId} />}
    </section>
  )
}

export function AdminOperatorGroupPlanPanel({
  detail,
  onAction,
  userId,
}: {
  detail: AdminOperatorUserDetail | null
  onAction: (action: AdminOperatorAction) => void
  userId: string
}) {
  const primaryPlan = detail?.groupPlansActive[0] ?? detail?.groupPlansExpired[0] ?? null
  const historyPlans = [...(detail?.groupPlansActive ?? []).slice(1), ...(detail?.groupPlansExpired ?? [])]
  const createdGroups = detail?.ownedGroups ?? []
  const groupLimit = primaryPlan?.planKey === 'collaborate_plus' ? 20 : 10
  return (
    <section className="management-panel admin-operator-section">
      <div className="management-panel-heading compact">
        <div className="admin-group-plan-heading"><h2>Group Plan</h2></div>
        <div className="management-actions">
          <button className="product-button product-button-secondary" onClick={() => onAction({ type: 'create-group', userId })} type="button">Create new group</button>
          <button
            className="product-button product-button-secondary"
            onClick={() => onAction({
              currentPlanKey: primaryPlan?.planKey,
              currentStatus: primaryPlan?.status,
              periodEnd: primaryPlan?.periodEnd,
              periodStart: primaryPlan?.periodStart,
              subscriptionId: primaryPlan?.subscriptionId,
              title: 'Change plan',
              type: 'group-plan',
              userId,
            })}
            type="button"
          >
            Change plan
          </button>
        </div>
      </div>
      <div className="admin-group-plan-section">
        <OwnedGroupsTable groupLimit={groupLimit} onAction={onAction} plan={primaryPlan} rows={createdGroups} />
        {historyPlans.length ? (
          <div className="management-table-wrap admin-group-plan-history">
            <table className="management-table compact admin-group-plan-history-table">
              <thead><tr><th>Past plan</th><th>Period</th><th>Status</th><th>Manage</th></tr></thead>
              <tbody>
                {historyPlans.map((plan, index) => (
                  <GroupPlanRow
                    key={buildStableListKey([plan.subscriptionId, plan.planKey, plan.periodStart, plan.periodEnd], index)}
                    onAction={onAction}
                    plan={plan}
                    userId={userId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function WorkspacePlanStack({ rows }: { rows: AdminOperatorWorkspacePlan[] }) {
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

function WorkspaceCreditStack({ rows }: { rows: AdminOperatorWorkspacePlan[] }) {
  if (!rows.length) return <span>-</span>
  return (
    <div className="admin-credit-stack">
      {rows.map((row) => (
        <CreditBar key={row.id} credit={row.credit} tone={isCurrentPlan(row.planStatus ?? '') ? 'active' : 'muted'} />
      ))}
    </div>
  )
}

function UserPlanStack({
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

function isCurrentPlan(status: string) {
  return status === 'active' || status === 'trialing' || status === 'paused'
}

function StatusText({ status }: { status: string }) {
  const isActive = status === 'active'
  const label = isActive ? 'Active' : status.replaceAll('_', ' ')
  return <span className={`admin-user-status-text ${isActive ? 'is-active' : 'is-inactive'}`}>{label}</span>
}
