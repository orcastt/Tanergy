'use client'

import { CreditBar, formatPlanKey, periodText } from './AdminOperatorDetailTables'
import { ActionStack, BoardStack, MemberStack } from './AdminOperatorWorkspaceCellStacks'
import { buildTeamPlanActions } from './adminOperatorDetailActionBuilders'
import type { AdminOperatorAction } from './adminOperatorActions'
import type { AdminOperatorUserPlan, AdminOperatorWorkspacePlan } from './adminTypes'

export function OwnedTeamPlansTable({
  onAction,
  rows,
}: {
  onAction: (action: AdminOperatorAction) => void
  rows: AdminOperatorWorkspacePlan[]
}) {
  return (
    <div className="management-table-wrap">
      <table className="management-table admin-owned-plan-table">
        <colgroup>
          <col style={{ width: '15%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Team plan</th>
            <th>Workspace name</th>
            <th>Team credit</th>
            <th>Team members</th>
            <th>Boards</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((workspace) => (
            <tr key={workspace.id}>
              <td><PlanCell workspace={workspace} /></td>
              <td><WorkspaceCell workspace={workspace} /></td>
              <td>
                <div className="admin-plan-credit-cell">
                  <CreditBar credit={workspace.credit} tone={isCurrentPlan(workspace.planStatus) ? 'active' : 'muted'} />
                </div>
              </td>
              <td>
                <MemberStack
                  bottomActions={workspaceMemberActions(workspace, onAction)}
                  manageMembers
                  invitations={workspace.invitations}
                  members={workspace.members}
                  onAction={onAction}
                  ownerId={workspace.ownerId}
                  total={workspace.memberCount}
                  totalLabel={`${workspace.memberCount}/${Math.max(workspace.seatCapacity, workspace.memberCount, 1)}`}
                  workspaceId={workspace.id}
                />
              </td>
              <td>
                <BoardStack boards={workspace.boards} onAction={onAction} total={workspace.boardCount} totalLabel={`${workspace.boardCount}/unlimited`} workspaceId={workspace.id} />
              </td>
              <td>
                <ActionStack actions={buildOwnedWorkspaceActions(workspace, onAction, true)} />
              </td>
            </tr>
          )) : <tr><td colSpan={6}>No Team plans.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export function OwnedGroupsTable({
  groupLimit = 10,
  onAction,
  plan = null,
  rows,
}: {
  groupLimit?: number
  onAction: (action: AdminOperatorAction) => void
  plan?: AdminOperatorUserPlan | null
  rows: AdminOperatorWorkspacePlan[]
}) {
  return (
    <div className="management-table-wrap">
      <table className="management-table admin-owned-plan-table admin-owned-group-table">
        <colgroup>
          <col style={{ width: '15%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '33%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Group plan</th>
            <th>Created Group <span className="admin-cell-count admin-cell-count-pill">{rows.length}/{groupLimit}</span></th>
            <th>Group members</th>
            <th>Boards</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((workspace, index) => (
            <tr key={workspace.id}>
              {index === 0 ? <td rowSpan={rows.length}><GroupPlanCell plan={plan} /></td> : null}
              <td><WorkspaceCell workspace={workspace} /></td>
              <td>
                <MemberStack
                  bottomActions={workspaceMemberActions(workspace, onAction)}
                  manageMembers
                  invitations={workspace.invitations}
                  members={workspace.members}
                  onAction={onAction}
                  ownerId={workspace.ownerId}
                  total={workspace.memberCount}
                  totalLabel={`${workspace.memberCount}/15`}
                  workspaceId={workspace.id}
                />
              </td>
              <td>
                <BoardStack boards={workspace.boards} onAction={onAction} total={workspace.boardCount} totalLabel={`${workspace.boardCount}/unlimited`} workspaceId={workspace.id} />
              </td>
              <td>
                <ActionStack actions={buildOwnedWorkspaceActions(workspace, onAction, false)} />
              </td>
            </tr>
          )) : plan ? (
            <tr>
              <td><GroupPlanCell plan={plan} /></td>
              <td colSpan={4}>No created Groups.</td>
            </tr>
          ) : <tr><td colSpan={5}>No Group plan.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function PlanCell({ workspace }: { workspace: AdminOperatorWorkspacePlan }) {
  return (
    <div className="admin-plan-heading">
      <strong>{formatPlanKey(workspace.planKey)}</strong>
      <small className={workspace.planStatus === 'canceled' ? 'is-muted' : 'is-active'}>{periodText(workspace.periodStart, workspace.periodEnd)}</small>
    </div>
  )
}

function WorkspaceCell({ workspace }: { workspace: AdminOperatorWorkspacePlan }) {
  return (
    <div className="admin-plan-heading">
      <strong>{workspace.workspaceName}</strong>
    </div>
  )
}

function buildOwnedWorkspaceActions(
  workspace: AdminOperatorWorkspacePlan,
  onAction: (action: AdminOperatorAction) => void,
  isTeam: boolean,
) {
  const actions = isTeam ? buildTeamPlanActions(workspace, onAction) : []
  if (!isTeam) {
    actions.push({
      label: 'Delete',
      onClick: () => onAction({ title: `Delete ${workspace.workspaceName}`, type: 'delete-workspace', workspaceId: workspace.id }),
    })
  }
  return actions
}

function workspaceMemberActions(
  workspace: AdminOperatorWorkspacePlan,
  onAction: (action: AdminOperatorAction) => void,
) {
  const isGroupFull = workspace.kind === 'group_workspace' && workspace.memberCount >= 15
  const isTeamFull = workspace.kind === 'team_workspace' && workspace.seatCapacity > 0 && workspace.memberCount >= workspace.seatCapacity
  const disabled = isGroupFull || isTeamFull
  const title = isGroupFull ? 'Group member cap is 15.' : isTeamFull ? 'No Team seats remain.' : undefined
  return [
    {
      disabled,
      label: 'Add member',
      onClick: () => onAction({ title: `Add member to ${workspace.workspaceName}`, type: 'workspace-member-add', workspaceId: workspace.id }),
      title,
    },
    {
      disabled,
      label: 'Invite',
      onClick: () => onAction({ title: `Invite to ${workspace.workspaceName}`, type: 'workspace-invite-create', workspaceId: workspace.id }),
      title,
    },
  ]
}

function GroupPlanCell({ plan }: { plan?: AdminOperatorUserPlan | null }) {
  if (!plan) return <span>-</span>
  return (
    <div className="admin-plan-heading">
      <strong>{formatPlanKey(plan.planKey)}</strong>
      <small className={isCurrentPlan(plan.status) ? 'is-active' : 'is-muted'}>{periodText(plan.periodStart, plan.periodEnd)}</small>
    </div>
  )
}

function isCurrentPlan(status?: null | string) {
  return status === 'active' || status === 'trialing' || status === 'paused'
}
