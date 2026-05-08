'use client'

import { useMemo, useState } from 'react'
import { AiCallout, EmptyRow, MetaLine, formatDate, formatNumber } from './adminAiShared'
import type { AdminDirectoryUserRecord, AdminDirectoryWorkspaceRecord } from './adminDirectoryClient'
import { AdminUserFinanceActions } from './AdminUserFinanceActions'

export function AdminUsersDashboard({
  enabled,
  groups,
  onMutated,
  status,
  teams,
  users,
}: {
  enabled: boolean
  groups: AdminDirectoryWorkspaceRecord[]
  onMutated: () => void
  status: string
  teams: AdminDirectoryWorkspaceRecord[]
  users: AdminDirectoryUserRecord[]
}) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0] ?? null
  const ownedTeams = useMemo(() => teams.filter((team) => team.ownerId === selectedUser?.id), [selectedUser?.id, teams])
  const ownedGroups = useMemo(() => groups.filter((group) => group.ownerId === selectedUser?.id), [groups, selectedUser?.id])

  return (
    <>
      <section className="management-summary-grid" aria-label="User admin summary">
        <AiCallout body="Registered accounts visible to admin" label="Users" value={users.length.toLocaleString('en-US')} />
        <AiCallout body="Owned Team workspaces" label="Teams" value={teams.length.toLocaleString('en-US')} />
        <AiCallout body="Owned Group workspaces" label="Groups" value={groups.length.toLocaleString('en-US')} />
      </section>

      <section className="management-main-grid" aria-label="User management">
        <article className="management-panel">
          <div className="management-panel-heading">
            <div><h2>User directory</h2><p>Email, profile state, plan and wallet overview.</p></div>
            <span className={`management-status ${status === 'ready' ? 'is-success' : ''}`}>{status}</span>
          </div>
          <div className="management-table-wrap">
            <table className="management-table compact">
              <thead><tr><th>User</th><th>Plan</th><th>Credits</th><th>Workspaces</th></tr></thead>
              <tbody>
                {users.length ? users.map((user) => (
                  <tr
                    key={user.id}
                    className={user.id === selectedUser?.id ? 'is-selected' : undefined}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td><UserCell user={user} /></td>
                    <td><strong>{user.collaboratePlanKey ?? 'free'}</strong><MetaLine>{user.collaboratePlanStatus ?? 'no subscription'}</MetaLine></td>
                    <td>{formatNumber(user.personalWalletCredits)}</td>
                    <td>{user.teamCount} Team / {user.groupCount} Group</td>
                  </tr>
                )) : <EmptyRow colSpan={4} message="No users found." />}
              </tbody>
            </table>
          </div>
        </article>

        <article className="management-panel">
          {selectedUser ? (
            <>
              <div className="management-panel-heading">
                <div><h2>{selectedUser.displayName || selectedUser.email}</h2><p>{selectedUser.email}</p></div>
                <span className="management-badge">{selectedUser.status}</span>
              </div>
              <dl className="management-definition-list">
                <div><dt>User ID</dt><dd>{selectedUser.id}</dd></div>
                <div><dt>Registered</dt><dd>{formatDate(selectedUser.createdAt)}</dd></div>
                <div><dt>Personal credits</dt><dd>{formatNumber(selectedUser.personalWalletCredits)}</dd></div>
                <div><dt>Plan expires</dt><dd>{selectedUser.collaboratePeriodEnd ? formatDate(selectedUser.collaboratePeriodEnd) : 'Open ended'}</dd></div>
              </dl>
              <div className="management-section-gap">
                <AdminUserFinanceActions enabled={enabled} onMutated={onMutated} userId={selectedUser.id} />
                <WorkspaceMiniList label="Owned Teams" workspaces={ownedTeams} />
                <WorkspaceMiniList label="Owned Groups" workspaces={ownedGroups} />
              </div>
            </>
          ) : <p>Select a user to inspect billing and workspaces.</p>}
        </article>
      </section>
    </>
  )
}

function UserCell({ user }: { user: AdminDirectoryUserRecord }) {
  return (
    <div className="management-member">
      <div className="management-avatar small" aria-hidden="true">{initials(user.displayName || user.email)}</div>
      <span><strong>{user.displayName || 'Unnamed user'}</strong><small>{user.email}</small><small>{user.id}</small></span>
    </div>
  )
}

function WorkspaceMiniList({ label, workspaces }: { label: string; workspaces: AdminDirectoryWorkspaceRecord[] }) {
  return (
    <div>
      <h3 className="management-subheading">{label}</h3>
      <div className="management-table-wrap">
        <table className="management-table compact">
          <thead><tr><th>Name</th><th>Members</th><th>Plan</th></tr></thead>
          <tbody>
            {workspaces.length ? workspaces.map((workspace) => (
              <tr key={workspace.id}>
                <td><strong>{workspace.name}</strong><MetaLine>{workspace.id}</MetaLine></td>
                <td>{workspace.memberCount}</td>
                <td>{workspace.planKey ?? workspace.ownerCollaboratePlanKey ?? 'free'}</td>
              </tr>
            )) : <EmptyRow colSpan={3} message={`No ${label.toLowerCase()} for this user.`} />}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'NA'
}
