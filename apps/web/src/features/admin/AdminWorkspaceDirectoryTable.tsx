'use client'

import { formatPlanKey } from './AdminOperatorDetailTables'
import { EmptyRow, MetaLine } from './adminAiShared'
import type { AdminDirectoryWorkspacesResource } from './adminTypes'

export function AdminWorkspaceDirectoryTable({
  directoryStatus,
  kind,
  label,
  onSelectWorkspace,
  selectedWorkspaceId,
  workspaces,
}: {
  directoryStatus: 'error' | 'loading' | 'ready' | 'refreshing'
  kind: 'group' | 'team'
  label: string
  onSelectWorkspace: (workspaceId: string) => void
  selectedWorkspaceId: string
  workspaces: AdminDirectoryWorkspacesResource['workspaces']
}) {
  return (
    <div className="management-table-wrap">
      <table className="management-table admin-workspaces-table">
        <thead><tr><th>Name</th><th>Owner</th><th>Members</th><th>Boards</th><th>Plan</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {directoryStatus === 'loading' ? <EmptyRow colSpan={7} message={`Loading ${label.toLowerCase()}...`} /> : null}
          {directoryStatus !== 'loading' && workspaces.length ? workspaces.map((workspace) => (
            <tr
              key={workspace.id}
              className={workspace.id === selectedWorkspaceId ? 'is-selected' : undefined}
              onClick={() => onSelectWorkspace(workspace.id)}
            >
              <td><strong>{workspace.name}</strong><MetaLine>{workspace.id}</MetaLine></td>
              <td>
                <strong>{formatWorkspaceOwner(workspace)}</strong>
                <MetaLine>{workspace.ownerEmail || workspace.ownerId || 'Unknown owner'}</MetaLine>
              </td>
              <td>{workspace.memberCount}</td>
              <td>{workspace.boardCount}</td>
              <td>{describeWorkspacePlan(workspace, kind)}</td>
              <td><span className={`management-status ${workspace.status === 'active' ? 'is-success' : ''}`}>{workspace.status}</span></td>
              <td>
                <button
                  className="product-button product-button-secondary admin-table-button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectWorkspace(workspace.id)
                  }}
                  type="button"
                >
                  Manage
                </button>
              </td>
            </tr>
          )) : null}
          {directoryStatus !== 'loading' && !workspaces.length ? <EmptyRow colSpan={7} message={`No ${label.toLowerCase()} found.`} /> : null}
        </tbody>
      </table>
    </div>
  )
}

function describeWorkspacePlan(
  workspace: AdminDirectoryWorkspacesResource['workspaces'][number],
  kind: 'group' | 'team',
) {
  if (kind === 'group') {
    return formatPlanKey(workspace.ownerCollaboratePlanKey ?? 'free_canvas')
  }
  return workspace.planKey ? formatPlanKey(workspace.planKey) : 'Unassigned'
}

function formatWorkspaceOwner(workspace: AdminDirectoryWorkspacesResource['workspaces'][number]) {
  const displayName = workspace.ownerDisplayName?.trim()
  if (displayName) return displayName
  return workspace.ownerEmail || workspace.ownerId || 'Unknown owner'
}
