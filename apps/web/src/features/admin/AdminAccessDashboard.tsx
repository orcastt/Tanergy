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
import type { AdminDirectoryUsersResource } from './adminTypes'
import { EmptyRow, FilterSelect, MetaLine, formatDate, selectStyle } from './adminAiShared'

const auditActions = ['', 'admin.role.grant', 'admin.role.revoke', 'admin.directory.users.list', 'admin.directory.workspaces.list', 'admin.ai.route_metrics.list']
const roleOptions = ['admin', 'finance'] as const
const baseUsersQuery = { limit: 100 }
const emptyUsers: AdminDirectoryUsersResource = { limit: 100, offset: 0, ok: false, totalCount: 0, users: [] }

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
  const [usersLoaded, setUsersLoaded] = useState(Boolean(usersSeed.ok || usersSnapshot.data))
  const [auditAction, setAuditAction] = useState('')
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([])
  const [auditStatus, setAuditStatus] = useState<'error' | 'loading' | 'ready'>('loading')
  const [draftNote, setDraftNote] = useState('')
  const [draftReason, setDraftReason] = useState('')
  const [draftRole, setDraftRole] = useState<(typeof roleOptions)[number]>('admin')
  const [loadedRolesUserId, setLoadedRolesUserId] = useState('')
  const [mutationMessage, setMutationMessage] = useState('')
  const [roles, setRoles] = useState<AdminRoleRecord[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const roleNames = useMemo(() => adminAccess.roles.map((role) => role.role), [adminAccess.roles])
  const displayRoleNames = useMemo(() => formatAdminRoleLabels(roleNames), [roleNames])
  const canManageRoles = roleNames.includes('owner') || roleNames.includes('admin')
  const users = usersResource.users
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0] ?? null

  useEffect(() => {
    if (usersSeed.ok) primeAdminUsersDirectoryResource(baseUsersQuery, usersSeed)
  }, [usersSeed])

  useEffect(() => {
    if (!enabled || usersLoaded) return
    let cancelled = false
    loadAdminUsersDirectoryResource(baseUsersQuery)
      .then((resource) => {
        if (cancelled) return
        setUsersResource(resource)
        setUsersError(resource.error ?? null)
        setUsersLoaded(true)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setUsersError(error instanceof Error ? error.message : 'Access users failed to load.')
        setUsersLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, usersLoaded])

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
    loadAdminAuditLogs({ action: auditAction || undefined, limit: 50, targetUserId: selectedUser?.id })
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
  }, [auditAction, enabled, reloadToken, selectedUser?.id])

  async function grantRole() {
    const reason = draftReason.trim()
    if (!selectedUser || !canManageRoles || !reason) return
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
    const reason = draftReason.trim()
    if (!selectedUser || !canManageRoles || !reason) return
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
        <FilterSelect
          label="User"
          onChange={setSelectedUserId}
          options={users.map((user) => ({ label: `${user.email} (${user.id})`, value: user.id }))}
          value={selectedUser?.id ?? ''}
        />
        {usersError ? <p>{usersError}</p> : null}
        {mutationMessage ? <p>{mutationMessage}</p> : null}
        <dl className="management-definition-list">
          {(loadedRolesUserId === selectedUser?.id ? roles : []).map((role) => (
            <div key={`${role.role}-${role.createdAt}`}>
              <dt>{formatAdminRoleLabel(role.role)}</dt>
              <dd>
                Granted {formatDate(role.createdAt)}
                {role.grantedBy ? <MetaLine>by {role.grantedBy}</MetaLine> : null}
                {canManageRoles ? <button className="product-button product-button-secondary compact" disabled={!draftReason.trim()} onClick={() => revokeRole(role.role)} type="button">Revoke</button> : null}
              </dd>
            </div>
          ))}
        </dl>
        {canManageRoles ? (
          <div className="management-section-gap">
            <select onChange={(event) => setDraftRole(event.target.value as (typeof roleOptions)[number])} style={selectStyle} value={draftRole}>
              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <input onChange={(event) => setDraftReason(event.target.value)} placeholder="Operation reason" style={selectStyle} value={draftReason} />
            <input onChange={(event) => setDraftNote(event.target.value)} placeholder="Optional note" style={selectStyle} value={draftNote} />
            <button className="product-button" disabled={!selectedUser || !draftReason.trim()} onClick={grantRole} type="button">Grant role</button>
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
              <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td>{log.action}</td><td>{log.actorUserId ?? 'System'}</td><td>{log.targetUserId ?? log.workspaceId ?? '-'}</td></tr>
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
