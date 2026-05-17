'use client'

import { resolveGroupWorkspaceLimit } from '@/features/workspaces/groupPersonalPlanSupport'
import { EmptyRow, buildStableListKey, formatCompactDate, formatNumber, truncateMiddle } from './adminAiShared'
import { BillingHistoryTable, CreditBar } from './AdminOperatorDetailTables'
import { GroupPlanRow } from './adminOperatorDetailActionBuilders'
import {
  buildBillingCreditTargets,
  formatRegistrationState,
  StatusText,
  UserPlanStack,
  WorkspaceCreditStack,
  WorkspacePlanStack,
} from './adminOperatorDetailPanelSupport'
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
  const creditTargets = user ? buildBillingCreditTargets(teamPlans) : []
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
                    <small>{formatRegistrationState(user.registrationState)}</small>
                  </td>
                  <td><WorkspacePlanStack rows={teamPlans} /></td>
                  <td><WorkspaceCreditStack rows={teamPlans} /></td>
                  <td><UserPlanStack fallbackPlanKey="free_canvas" rows={groupPlans} /></td>
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
                      <button className="product-button product-button-secondary admin-table-button admin-plan-action-button" data-tone="primary" onClick={() => onAction({ targets: creditTargets, title: 'Top up credits', type: 'billing-topup', userId: user.id })} type="button">Top up</button>
                      <button className="product-button product-button-secondary admin-table-button admin-plan-action-button" data-tone="neutral" onClick={() => onAction({ targets: creditTargets, title: 'Deduct credits', type: 'billing-deduct', userId: user.id })} type="button">Deduct</button>
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
  const primaryPlanKey = primaryPlan?.planKey ?? 'free_canvas'
  const historyPlans = [...(detail?.groupPlansActive ?? []).slice(1), ...(detail?.groupPlansExpired ?? [])]
  const createdGroups = detail?.ownedGroups ?? []
  const groupLimit = resolveGroupWorkspaceLimit(primaryPlanKey)
  const groupLimitReached = createdGroups.length >= groupLimit
  const canFreezePlan = primaryPlan?.status === 'active' || primaryPlan?.status === 'trialing' || primaryPlan?.status === 'paused'
  const freezeActionMode = primaryPlan?.status === 'paused' ? 'unfreeze' : 'freeze'
  const freezeActionLabel = primaryPlan?.status === 'paused' ? 'Unfreeze' : 'Freeze'
  return (
    <section className="management-panel admin-operator-section">
      <div className="management-panel-heading compact">
        <div className="admin-group-plan-heading"><h2>Group Plan</h2></div>
        <div className="management-actions">
          <button
            className="product-button product-button-secondary"
            disabled={groupLimitReached}
            onClick={() => onAction({ type: 'create-group', userId })}
            type="button"
          >
            Create new group
          </button>
          <button
            className="product-button product-button-secondary"
            onClick={() => onAction({
              currentPlanKey: primaryPlanKey,
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
          {primaryPlan?.subscriptionId && canFreezePlan ? (
            <button
              className="product-button product-button-secondary"
              onClick={() => onAction({
                currentPlanKey: primaryPlan.planKey,
                currentStatus: primaryPlan.status,
                mode: freezeActionMode,
                periodEnd: primaryPlan.periodEnd,
                periodStart: primaryPlan.periodStart,
                subscriptionId: primaryPlan.subscriptionId,
                title: `${freezeActionLabel} ${primaryPlan.planKey}`,
                type: 'group-plan',
                userId,
              })}
              type="button"
            >
              {freezeActionLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div className="admin-group-plan-section">
        <OwnedGroupsTable groupLimit={groupLimit} onAction={onAction} plan={primaryPlan} planKeyFallback={primaryPlanKey} rows={createdGroups} />
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
