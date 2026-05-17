'use client'

import { formatPlanKey } from './AdminOperatorDetailTables'
import { AdminWorkspaceFinanceActions } from './AdminWorkspaceFinanceActions'
import { EmptyRow, MetaLine, formatDate, formatNumber } from './adminAiShared'
import type { AdminDirectoryWorkspaceDetailResource, AdminDirectoryWorkspacesResource } from './adminTypes'

export function AdminWorkspaceDetailPanel({
  detail,
  detailStatus,
  enabled,
  kind,
  onMutated,
  workspace,
}: {
  detail: AdminDirectoryWorkspaceDetailResource
  detailStatus: string
  enabled: boolean
  kind: 'group' | 'team'
  onMutated: () => void
  workspace: AdminDirectoryWorkspacesResource['workspaces'][number]
}) {
  const ownerLabel = workspace.ownerDisplayName?.trim() || workspace.ownerEmail || workspace.ownerId || 'Unknown owner'
  const summaryItems = kind === 'team'
    ? [
        { label: 'Plan', value: workspace.planKey ? formatPlanKey(workspace.planKey) : 'Unassigned' },
        { label: 'Members', value: formatNumber(workspace.memberCount) },
        { label: 'Boards', value: formatNumber(workspace.boardCount) },
        { label: 'Team wallet', value: formatNumber(workspace.walletCredits) },
        { label: 'Usage credits', value: formatNumber(workspace.usageCredits) },
        { label: 'Seat capacity', value: workspace.seatCapacity || 'Not assigned' },
      ]
    : [
        { label: 'Owner personal plan', value: formatPlanKey(workspace.ownerCollaboratePlanKey ?? 'free_canvas') },
        { label: 'Members', value: formatNumber(workspace.memberCount) },
        { label: 'Boards', value: formatNumber(workspace.boardCount) },
        {
          label: 'Personal plan period',
          value: workspace.subscriptionPeriodEnd ? formatDate(workspace.subscriptionPeriodEnd) : 'Open ended',
        },
        { label: 'Personal usage in this Group', value: formatNumber(workspace.usageCredits) },
        { label: 'Owner', value: ownerLabel },
      ]

  return (
    <>
      <div className="management-panel-heading">
        <div>
          <h2>{workspace.name}</h2>
          <p>{ownerLabel}</p>
        </div>
        <span className={`management-status ${detailStatus === 'ready' ? 'is-success' : ''}`}>{detailStatus}</span>
      </div>
      <div className="admin-workspace-summary-grid">
        {summaryItems.map((item) => (
          <div className="management-mini-stat" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="admin-workspace-detail-grid">
        <div className="admin-workspace-detail-span">
          <AdminWorkspaceFinanceActions
            enabled={enabled}
            onMutated={onMutated}
            subscriptionId={kind === 'group' ? workspace.ownerCollaborateSubscriptionId : workspace.subscriptionId}
            workspaceId={workspace.id}
            workspaceKind={kind}
          />
        </div>
        <MembersTable detail={detail} />
        <BoardsTable detail={detail} />
      </div>
    </>
  )
}

function MembersTable({ detail }: { detail: AdminDirectoryWorkspaceDetailResource }) {
  return (
    <div>
      <h3 className="management-subheading">Members</h3>
      <div className="management-table-wrap"><table className="management-table compact">
        <thead><tr><th>Member</th><th>Role</th><th>Usage</th></tr></thead>
        <tbody>{detail.members.length ? detail.members.map((member) => (
          <tr key={member.userId}><td><strong>{member.displayName}</strong><MetaLine>{member.email ?? member.userId}</MetaLine></td><td><span className="management-badge">{member.role}</span></td><td>{formatNumber(member.usageCredits)}<MetaLine>{member.chargeCount} charges</MetaLine></td></tr>
        )) : <EmptyRow colSpan={3} message="No members loaded." />}</tbody>
      </table></div>
    </div>
  )
}

function BoardsTable({ detail }: { detail: AdminDirectoryWorkspaceDetailResource }) {
  return (
    <div>
      <h3 className="management-subheading">Boards</h3>
      <div className="management-table-wrap"><table className="management-table compact">
        <thead><tr><th>Board</th><th>Visibility</th><th>Saved</th></tr></thead>
        <tbody>{detail.boards.length ? detail.boards.map((board) => (
          <tr key={board.id}><td><strong>{board.title}</strong><MetaLine>{board.id}</MetaLine></td><td>{board.visibility}</td><td>{formatDate(board.savedAt)}</td></tr>
        )) : <EmptyRow colSpan={3} message="No boards loaded." />}</tbody>
      </table></div>
    </div>
  )
}
