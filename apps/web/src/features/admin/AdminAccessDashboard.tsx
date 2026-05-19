'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  grantAdminRole,
  loadAdminAuditLogs,
  loadAdminRoles,
  revokeAdminRole,
  type AdminAccess,
  type AdminAuditLogRecord,
  type AdminRoleRecord,
} from './adminClient'
import { loadAdminUsersDirectoryResource, primeAdminUsersDirectoryResource, readAdminUsersDirectoryResource } from './adminDirectoryCache'
import type { AdminDirectoryUserRecord, AdminDirectoryUsersResource } from './adminTypes'
import { EmptyRow, FilterSelect, FilterTextInput, MetaLine, formatCompactDate, selectStyle, truncateMiddle } from './adminAiShared'

const auditActions = [
  { label: 'Grant role', value: 'admin.role.grant' },
  { label: 'Revoke role', value: 'admin.role.revoke' },
  { label: 'Top up personal credits', value: 'admin.finance.manual.user_topup' },
  { label: 'Adjust personal credits', value: 'admin.finance.manual.user_credit_adjust' },
  { label: 'Top up team/group credits', value: 'admin.finance.manual.workspace_topup' },
  { label: 'Adjust team/group credits', value: 'admin.finance.manual.workspace_credit_adjust' },
  { label: 'Create group', value: 'admin.finance.manual.group_workspace_create' },
  { label: 'Create team', value: 'admin.finance.manual.team_workspace_create' },
  { label: 'Delete workspace', value: 'admin.finance.manual.workspace_delete' },
  { label: 'Set group plan', value: 'admin.finance.manual.collaborate_plan' },
  { label: 'Set team plan', value: 'admin.finance.manual.team_plan' },
  { label: 'Delete plan', value: 'admin.finance.manual.subscription_cancel' },
  { label: 'Plan operation', value: 'admin.finance.manual.team_plan_operation' },
  { label: 'Group plan operation', value: 'admin.finance.manual.collaborate_plan_operation' },
  { label: 'Finance catalog update', value: 'admin.finance.plan_catalog.update' },
  { label: 'Freeze subscription', value: 'admin.operator.subscription.freeze' },
  { label: 'Resume subscription', value: 'admin.operator.subscription.unfreeze' },
  { label: 'Delete board', value: 'admin.operator.board.delete' },
  { label: 'Copy board', value: 'admin.operator.board.copy' },
  { label: 'Member add', value: 'admin.operator.workspace_member.add' },
  { label: 'Member role', value: 'admin.operator.workspace_member.role' },
  { label: 'Member remove', value: 'admin.operator.workspace_member.remove' },
  { label: 'Create invite', value: 'admin.operator.workspace_invitation.create' },
  { label: 'Revoke invite', value: 'admin.operator.workspace_invitation.revoke' },
  { label: 'User status', value: 'admin.operator.user.status' },
  { label: 'Delete user', value: 'admin.operator.user.delete' },
  { label: 'List audit', value: 'admin.audit.list' },
  { label: 'List users', value: 'admin.users.list' },
  { label: 'List workspaces', value: 'admin.workspaces.list' },
  { label: 'List boards', value: 'admin.boards.list' },
  { label: 'Read summary', value: 'admin.summary.read' },
  { label: 'Read roles', value: 'admin.roles.read' },
]
const roleOptions = ['admin', 'finance'] as const
const baseUsersQuery = { limit: 100 }
const emptyUsers: AdminDirectoryUsersResource = { limit: 100, offset: 0, ok: false, totalCount: 0, users: [] }
const defaultRoleMutationReason = 'Admin access update'

export function AdminAccessDashboard({
  adminAccess,
  enabled,
  usersSeed,
}: {
  adminAccess: AdminAccess
  enabled: boolean
  usersSeed: AdminDirectoryUsersResource
}) {
  const usersSnapshot = readAdminUsersDirectoryResource(baseUsersQuery)
  const [usersResource, setUsersResource] = useState<AdminDirectoryUsersResource>(usersSeed.ok ? usersSeed : usersSnapshot.data ?? emptyUsers)
  const [usersError, setUsersError] = useState<string | null>(usersSeed.error ?? usersSnapshot.error ?? null)
  const [auditAction, setAuditAction] = useState('')
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([])
  const [auditStatus, setAuditStatus] = useState<'error' | 'loading' | 'ready'>('loading')
  const [draftNote, setDraftNote] = useState('')
  const [draftReason, setDraftReason] = useState('')
  const [draftRole, setDraftRole] = useState<(typeof roleOptions)[number]>('admin')
  const [loadedRolesUserId, setLoadedRolesUserId] = useState('')
  const [mutationMessage, setMutationMessage] = useState('')
  const [roles, setRoles] = useState<AdminRoleRecord[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const roleNames = useMemo(() => adminAccess.roles.map((role) => role.role), [adminAccess.roles])
  const displayRoleNames = useMemo(() => formatAdminRoleLabels(roleNames), [roleNames])
  const canManageRoles = roleNames.includes('owner') || roleNames.includes('admin')
  const users = usersResource.users
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0] ?? null
  const userLabelById = useMemo(() => buildUserLabelById(users, roles), [roles, users])
  const userSearchKey = userSearch.trim()

  useEffect(() => {
    if (usersSeed.ok) primeAdminUsersDirectoryResource(baseUsersQuery, usersSeed)
  }, [usersSeed])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const query = { limit: userSearchKey ? 25 : 100, search: userSearchKey || undefined }
    loadAdminUsersDirectoryResource(query)
      .then((resource) => {
        if (cancelled) return
        setUsersResource(resource)
        setUsersError(resource.error ?? null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setUsersError(error instanceof Error ? error.message : 'Access users failed to load.')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, userSearchKey])

  useEffect(() => {
    if (!enabled || !selectedUser?.id) return
    let cancelled = false
    loadAdminRoles(selectedUser.id)
      .then((payload) => {
        if (cancelled) return
        setLoadedRolesUserId(selectedUser.id)
        setRoles(payload.roles)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadedRolesUserId(selectedUser.id)
        setRoles([])
        setMutationMessage(error instanceof Error ? error.message : 'Role lookup failed.')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken, selectedUser?.id])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadAdminAuditLogs({ action: auditAction || undefined, limit: 50 })
      .then((payload) => {
        if (cancelled) return
        setAuditLogs(payload.logs)
        setAuditStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setAuditLogs([])
        setAuditStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [auditAction, enabled, reloadToken])

  async function grantRole() {
    const reason = draftReason.trim() || defaultRoleMutationReason
    if (!selectedUser || !canManageRoles) return
    try {
      await grantAdminRole({ note: draftNote || undefined, reason, role: draftRole, userId: selectedUser.id })
      setDraftNote('')
      setDraftReason('')
      setMutationMessage(`Granted ${draftRole}.`)
      setReloadToken((value) => value + 1)
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : 'Role grant failed.')
    }
  }

  async function revokeRole(role: string) {
    const reason = draftReason.trim() || defaultRoleMutationReason
    if (!selectedUser || !canManageRoles) return
    try {
      await revokeAdminRole(selectedUser.id, role, reason)
      setDraftReason('')
      setMutationMessage(`Revoked ${role}.`)
      setReloadToken((value) => value + 1)
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : 'Role revoke failed.')
    }
  }

  return (
    <section className="management-main-grid" aria-label="Admin access">
      <article className="management-panel">
        <div className="management-panel-heading">
          <div><h2>Admin roles</h2></div>
          <span className="management-badge">{displayRoleNames.join(', ') || 'none'}</span>
        </div>
        <FilterTextInput
          leadingIcon="search"
          label="Search user email"
          onChange={setUserSearch}
          placeholder="Search by email, name, or user id"
          value={userSearch}
        />
        <FilterSelect
          label="User"
          onChange={setSelectedUserId}
          options={users.map((user) => ({ label: formatDirectoryUserOption(user), value: user.id }))}
          value={selectedUser?.id ?? ''}
        />
        {usersError ? <p>{usersError}</p> : null}
        {mutationMessage ? <p>{mutationMessage}</p> : null}
        <dl className="management-definition-list">
          {(loadedRolesUserId === selectedUser?.id ? roles : []).map((role) => (
            <div key={`${role.role}-${role.createdAt}`}>
              <dt>{formatAdminRoleLabel(role.role)}</dt>
              <dd>
                Granted {formatCompactDate(role.createdAt)}
                {role.grantedBy ? <MetaLine>by {userLabelById.get(role.grantedBy) ?? truncateMiddle(role.grantedBy, 10, 6)}</MetaLine> : null}
                {canManageRoles ? <button className="product-button product-button-secondary compact" onClick={() => revokeRole(role.role)} type="button">Revoke</button> : null}
              </dd>
            </div>
          ))}
        </dl>
        {canManageRoles ? (
          <div className="management-section-gap">
            <select onChange={(event) => setDraftRole(event.target.value as (typeof roleOptions)[number])} style={selectStyle} value={draftRole}>
              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <input onChange={(event) => setDraftReason(event.target.value)} placeholder="Operation reason (optional)" style={selectStyle} value={draftReason} />
            <input onChange={(event) => setDraftNote(event.target.value)} placeholder="Optional note" style={selectStyle} value={draftNote} />
            <button className="product-button" disabled={!selectedUser} onClick={grantRole} type="button">Grant role</button>
          </div>
        ) : <p>Admin role is required to grant or revoke admin access.</p>}
      </article>

      <article className="management-panel">
        <div className="management-panel-heading">
          <div><h2>Audit log</h2></div>
          <span className={`management-status ${auditStatus === 'ready' ? 'is-success' : ''}`}>{auditStatus}</span>
        </div>
        <FilterSelect label="Action" onChange={setAuditAction} options={auditActions} value={auditAction} />
        <div className="management-table-wrap">
          <table className="management-table compact">
            <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Target</th></tr></thead>
            <tbody>{auditLogs.length ? auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{formatCompactDate(log.createdAt)}</td>
                <td>{formatAuditActionLabel(log.action)}</td>
                <td>{formatAuditUser(log, 'actor', userLabelById)}</td>
                <td>{formatAuditUser(log, 'target', userLabelById)}</td>
              </tr>
            )) : <EmptyRow colSpan={4} message="No audit rows match this filter." />}</tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

function formatAdminRoleLabel(role: string) {
  if (role === 'owner' || role === 'admin') return 'Admin'
  if (role === 'finance') return 'Finance'
  return `Legacy ${role}`
}

function formatAdminRoleLabels(roles: string[]) {
  return Array.from(new Set(roles.map(formatAdminRoleLabel)))
}

function formatDirectoryUserOption(user: AdminDirectoryUserRecord) {
  const label = user.displayName?.trim() || user.email || user.id
  return user.email && label !== user.email ? `${label} (${user.email})` : `${label} (${truncateMiddle(user.id, 10, 6)})`
}

function buildUserLabelById(users: AdminDirectoryUserRecord[], roles: AdminRoleRecord[]) {
  const labels = new Map<string, string>()
  users.forEach((user) => labels.set(user.id, formatDirectoryUserLabel(user)))
  roles.forEach((role) => {
    if (role.grantedBy && !labels.has(role.grantedBy)) labels.set(role.grantedBy, truncateMiddle(role.grantedBy, 10, 6))
  })
  return labels
}

function formatDirectoryUserLabel(user: AdminDirectoryUserRecord) {
  if (user.displayName?.trim() && user.email) return `${user.displayName.trim()} (${user.email})`
  return user.email || user.displayName || truncateMiddle(user.id, 10, 6)
}

function formatAuditActionLabel(action: string) {
  return auditActions.find((option) => option.value === action)?.label ?? action
}

function formatAuditUser(log: AdminAuditLogRecord, field: 'actor' | 'target', labels: Map<string, string>) {
  const id = field === 'actor' ? log.actorUserId : log.targetUserId
  const displayName = field === 'actor' ? log.actorDisplayName : log.targetDisplayName
  const email = field === 'actor' ? log.actorEmail : log.targetEmail
  if (!id) return field === 'actor' ? 'System' : (log.workspaceId ? `Workspace ${truncateMiddle(log.workspaceId, 10, 6)}` : '-')
  if (displayName?.trim() && email) return `${displayName.trim()} (${email})`
  return email || displayName || labels.get(id) || truncateMiddle(id, 10, 6)
}
