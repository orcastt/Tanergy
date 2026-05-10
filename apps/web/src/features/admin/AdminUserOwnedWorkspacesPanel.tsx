'use client'

import { useMemo } from 'react'
import { AdminWorkspaceFinanceActions } from './AdminWorkspaceFinanceActions'
import { EmptyRow, MetaLine, formatDate, formatNumber } from './adminAiShared'
import type { AdminDirectoryWorkspaceRecord } from './adminTypes'

export function AdminUserOwnedWorkspacesPanel({
  enabled,
  kind,
  label,
  onMutated,
  onSelectWorkspaceId,
  selectedWorkspaceId,
  workspaces,
}: {
  enabled: boolean
  kind: 'group' | 'team'
  label: string
  onMutated: () => void
  onSelectWorkspaceId: (workspaceId: string) => void
  selectedWorkspaceId: string
  workspaces: AdminDirectoryWorkspaceRecord[]
}) {
  const resolvedWorkspaceId = useMemo(
    () => workspaces.some((workspace) => workspace.id === selectedWorkspaceId) ? selectedWorkspaceId : (workspaces[0]?.id ?? ''),
    [selectedWorkspaceId, workspaces],
  )
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === resolvedWorkspaceId) ?? null

  return (
    <section className="management-main-grid" aria-label={`${label} detail`}>
      <article className="management-panel">
        <div className="management-panel-heading">
          <div><h2>{label}</h2></div>
          <span className={`management-status ${workspaces.length ? 'is-success' : ''}`}>{workspaces.length.toLocaleString('en-US')}</span>
        </div>
        <div className="management-table-wrap">
          <table className="management-table compact">
            <thead><tr><th>Name</th><th>Plan</th><th>Members</th><th>Credits</th><th>Usage</th></tr></thead>
            <tbody>
              {workspaces.length ? workspaces.map((workspace) => (
                <tr
                  key={workspace.id}
                  className={workspace.id === resolvedWorkspaceId ? 'is-selected' : undefined}
                  onClick={() => onSelectWorkspaceId(workspace.id)}
                >
                  <td>
                    <strong>{workspace.name}</strong>
                    <MetaLine>{workspace.id}</MetaLine>
                  </td>
                  <td>
                    <strong>{workspace.planKey ?? workspace.ownerCollaboratePlanKey ?? 'free'}</strong>
                    <MetaLine>{workspace.planStatus ?? workspace.status}</MetaLine>
                  </td>
                  <td>
                    <strong>{workspace.memberCount}</strong>
                    <MetaLine>{workspace.boardCount} boards</MetaLine>
                  </td>
                  <td>
                    <strong>{formatNumber(workspace.walletCredits)}</strong>
                    <MetaLine>{workspace.subscriptionPeriodEnd ? formatDate(workspace.subscriptionPeriodEnd) : 'Open ended'}</MetaLine>
                  </td>
                  <td>{formatNumber(workspace.usageCredits)}</td>
                </tr>
              )) : <EmptyRow colSpan={5} message={`No ${label.toLowerCase()} found.`} />}
            </tbody>
          </table>
        </div>
      </article>

      <article className="management-panel">
        {selectedWorkspace ? (
          <>
            <div className="management-panel-heading">
              <div><h2>{selectedWorkspace.name}</h2></div>
              <span className={`management-status ${selectedWorkspace.status === 'active' ? 'is-success' : ''}`}>{selectedWorkspace.status}</span>
            </div>
            <dl className="management-definition-list">
              <div><dt>Owner</dt><dd>{selectedWorkspace.ownerEmail || selectedWorkspace.ownerDisplayName || selectedWorkspace.ownerId || 'Unknown'}</dd></div>
              <div><dt>Members</dt><dd>{selectedWorkspace.memberCount}</dd></div>
              <div><dt>Boards</dt><dd>{selectedWorkspace.boardCount}</dd></div>
              <div><dt>Wallet credits</dt><dd>{formatNumber(selectedWorkspace.walletCredits)}</dd></div>
              <div><dt>Usage credits</dt><dd>{formatNumber(selectedWorkspace.usageCredits)}</dd></div>
              <div><dt>Plan</dt><dd>{selectedWorkspace.planKey ?? selectedWorkspace.ownerCollaboratePlanKey ?? 'free'}</dd></div>
              <div><dt>Seats</dt><dd>{selectedWorkspace.seatCapacity || 'Not assigned'}</dd></div>
              <div><dt>Expires</dt><dd>{selectedWorkspace.subscriptionPeriodEnd ? formatDate(selectedWorkspace.subscriptionPeriodEnd) : 'Open ended'}</dd></div>
            </dl>
            <div className="management-section-gap">
              <AdminWorkspaceFinanceActions
                enabled={enabled}
                onMutated={onMutated}
                subscriptionId={kind === 'group' ? selectedWorkspace.ownerCollaborateSubscriptionId : selectedWorkspace.subscriptionId}
                workspaceKind={kind}
                workspaceId={selectedWorkspace.id}
              />
            </div>
          </>
        ) : <p>No workspace selected.</p>}
      </article>
    </section>
  )
}
