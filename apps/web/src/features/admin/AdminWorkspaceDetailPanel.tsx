'use client'

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
  return (
    <>
      <div className="management-panel-heading">
        <div>
          <h2>{workspace.name}</h2>
          <p>{workspace.ownerEmail || workspace.ownerId || 'Unknown owner'}</p>
        </div>
        <span className={`management-status ${detailStatus === 'ready' ? 'is-success' : ''}`}>{detailStatus}</span>
      </div>
      <dl className="management-definition-list">
        <div><dt>Wallet credits</dt><dd>{formatNumber(workspace.walletCredits)}</dd></div>
        <div><dt>Usage credits</dt><dd>{formatNumber(workspace.usageCredits)}</dd></div>
        <div><dt>Subscription ends</dt><dd>{workspace.subscriptionPeriodEnd ? formatDate(workspace.subscriptionPeriodEnd) : 'Open ended'}</dd></div>
        <div><dt>Seat capacity</dt><dd>{workspace.seatCapacity || 'Not assigned'}</dd></div>
      </dl>
      <div className="management-section-gap">
        <AdminWorkspaceFinanceActions
          enabled={enabled}
          onMutated={onMutated}
          subscriptionId={kind === 'group' ? workspace.ownerCollaborateSubscriptionId : workspace.subscriptionId}
          workspaceId={workspace.id}
          workspaceKind={kind}
        />
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
