'use client'

import { formatPlanKey, periodText } from './AdminOperatorDetailTables'
import { ActionStack, BoardStack, MemberStack } from './AdminOperatorWorkspaceCellStacks'
import { MetaLine, formatNumber } from './adminAiShared'
import { buildJoinedWorkspaceActions } from './adminOperatorDetailActionBuilders'
import type { AdminOperatorAction } from './adminOperatorActions'
import type { AdminOperatorWorkspacePlan } from './adminTypes'

export function JoinedTeamTable({
  onAction,
  rows,
  userId,
}: {
  onAction: (action: AdminOperatorAction) => void
  rows: AdminOperatorWorkspacePlan[]
  userId: string
}) {
  return <JoinedWorkspaceTable kind="team" onAction={onAction} rows={rows} userId={userId} />
}

export function JoinedGroupTable({
  onAction,
  rows,
  userId,
}: {
  onAction: (action: AdminOperatorAction) => void
  rows: AdminOperatorWorkspacePlan[]
  userId: string
}) {
  return <JoinedWorkspaceTable kind="group" onAction={onAction} rows={rows} userId={userId} />
}

function JoinedWorkspaceTable({
  kind,
  onAction,
  rows,
  userId,
}: {
  kind: 'group' | 'team'
  onAction: (action: AdminOperatorAction) => void
  rows: AdminOperatorWorkspacePlan[]
  userId: string
}) {
  return (
    <div className="management-table-wrap">
      <table className={`management-table admin-joined-plan-table admin-joined-plan-table-${kind}`}>
        <colgroup>
          <col style={{ width: kind === 'team' ? '13%' : '12%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: kind === 'team' ? '14%' : '12%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>{kind === 'team' ? 'Joined Team' : 'Joined Group'}</th>
            <th>Workspace name</th>
            <th>Created by</th>
            <th>Role</th>
            <th>{kind === 'team' ? 'Team credit' : 'Credits used by me'}</th>
            <th>{kind === 'team' ? 'Team members' : 'Group members'}</th>
            <th>Joined board</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((workspace) => {
            const canManage = canManageJoinedWorkspace(workspace)
            return (
              <tr key={workspace.id}>
                <td><HeadingCell primary={formatPlanKey(workspace.planKey)} secondary={periodText(workspace.periodStart, workspace.periodEnd)} /></td>
                <td><HeadingCell primary={workspace.workspaceName} secondary="" /></td>
                <td><OwnerCell workspace={workspace} /></td>
                <td><span className="management-badge">{workspace.role ?? '-'}</span></td>
                <td>{kind === 'team' ? <TeamCreditCell workspace={workspace} /> : <strong>{formatNumber(workspace.usageByUser)}</strong>}</td>
                <td>
                  <MemberStack
                    bottomActions={canManage ? workspaceMemberActions(workspace, onAction) : []}
                    manageMembers={canManage}
                    invitations={workspace.invitations}
                    members={workspace.members}
                    onAction={canManage ? onAction : undefined}
                    ownerId={workspace.ownerId}
                    total={workspace.memberCount}
                    totalLabel={kind === 'team' ? `${workspace.memberCount}/${Math.max(workspace.seatCapacity, workspace.memberCount, 1)}` : `${workspace.memberCount}/15`}
                    workspaceId={workspace.id}
                  />
                </td>
                <td><BoardStack boards={workspace.boards} onAction={canManage ? onAction : undefined} total={workspace.boardCount} totalLabel={`${workspace.boardCount}/unlimited`} workspaceId={workspace.id} /></td>
                <td><ActionStack actions={buildJoinedWorkspaceActions(kind, onAction, userId, workspace)} /></td>
              </tr>
            )
          }) : <tr><td colSpan={8}>{kind === 'team' ? 'No joined Teams.' : 'No joined Groups.'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function TeamCreditCell({ workspace }: { workspace: AdminOperatorWorkspacePlan }) {
  return (
    <div className="admin-plan-credit-cell">
      <StackedTeamCreditBar workspace={workspace} />
      <MetaLine>Personal used: {formatNumber(workspace.usageByUser)}</MetaLine>
    </div>
  )
}

function StackedTeamCreditBar({ workspace }: { workspace: AdminOperatorWorkspacePlan }) {
  const total = Math.max(workspace.credit.totalCredits, workspace.credit.remainingCredits, workspace.credit.spentCredits, workspace.usageByUser, 1)
  const personalPercent = Math.min(100, Math.max(0, (workspace.usageByUser / total) * 100))
  const usedPercent = Math.min(100, Math.max(personalPercent, (workspace.credit.spentCredits / total) * 100))
  const remainingPercent = Math.min(100, Math.max(0, (workspace.credit.remainingCredits / total) * 100))
  return (
    <div className={`admin-stacked-credit ${isCurrentPlan(workspace.planStatus) ? '' : 'is-muted'}`}>
      <span>{formatNumber(workspace.credit.remainingCredits)}/{formatNumber(total)}</span>
      <div className="admin-stacked-credit-track" aria-hidden="true">
        <i className="admin-stacked-credit-remaining" style={{ width: `${remainingPercent}%` }} />
        <i className="admin-stacked-credit-used" style={{ width: `${usedPercent}%` }} />
        <i className="admin-stacked-credit-personal" style={{ width: `${personalPercent}%` }} />
      </div>
    </div>
  )
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

function canManageJoinedWorkspace(workspace: AdminOperatorWorkspacePlan) {
  return workspace.role === 'admin' || workspace.role === 'owner'
}

function HeadingCell({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="admin-plan-heading">
      <strong>{primary}</strong>
      {secondary ? <small className="is-active">{secondary}</small> : null}
    </div>
  )
}

function OwnerCell({ workspace }: { workspace: AdminOperatorWorkspacePlan }) {
  return (
    <div className="admin-joined-owner-cell">
      <span className="admin-member-role" data-role="owner">owner</span>
      <span>{workspace.ownerEmail ?? workspace.ownerId ?? '-'}</span>
    </div>
  )
}

function isCurrentPlan(status?: null | string) {
  return status === 'active' || status === 'trialing' || status === 'paused'
}
