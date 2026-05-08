'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/app-shell/AppShell'
import { AdminAiDashboard } from '@/features/admin/AdminAiDashboard'
import { AdminFinanceDashboard } from '@/features/admin/AdminFinanceDashboard'
import {
  grantAdminRole,
  loadAdminRoles,
  revokeAdminRole,
  type AdminRoleRecord,
} from '@/features/admin/adminClient'
import { formatDate } from '@/features/admin/adminAiShared'
import { useAdminResources } from '@/features/admin/useAdminResources'
import { useAdminAccess } from '@/features/auth/useAdminAccess'

const auditActions = ['', 'admin.role.grant', 'admin.role.revoke', 'admin.roles.read', 'admin.users.list', 'admin.workspaces.list', 'admin.boards.list', 'admin.summary.read', 'admin.audit.list', 'admin.finance.summary.read', 'admin.finance.payments.list', 'admin.finance.wallets.list', 'admin.finance.subscriptions.list', 'admin.finance.credit_ledger.list', 'admin.finance.member_usage.list']
const auditLimitOptions = [10, 25, 50] as const
const roleOptions = ['owner', 'admin', 'support', 'analyst', 'finance', 'moderator'] as const
const userLimitOptions = [10, 25, 50] as const
const fieldStyle = {
  width: '100%',
  minHeight: 40,
  border: '1px solid var(--color-hairline)',
  borderRadius: '12px',
  padding: '0 12px',
  background: 'var(--color-canvas)',
}

export default function AdminPage() {
  const router = useRouter()
  const [userLimit, setUserLimit] = useState<(typeof userLimitOptions)[number]>(25)
  const [auditLimit, setAuditLimit] = useState<(typeof auditLimitOptions)[number]>(25)
  const [auditAction, setAuditAction] = useState('')
  const [auditTargetUserId, setAuditTargetUserId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [draftRole, setDraftRole] = useState<(typeof roleOptions)[number]>('admin')
  const [draftNote, setDraftNote] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<AdminRoleRecord[]>([])
  const [loadedRolesUserId, setLoadedRolesUserId] = useState<string | null>(null)
  const [rolesError, setRolesError] = useState<string | null>(null)
  const [mutationBusy, setMutationBusy] = useState(false)
  const [mutationMessage, setMutationMessage] = useState<string | null>(null)
  const { adminAccess, error, status } = useAdminAccess()
  const resourcesEnabled = status === 'ready' && adminAccess.apiMode === 'remote' && adminAccess.canAccessAdmin
  const resources = useAdminResources(resourcesEnabled, {
    auditAction: auditAction || undefined,
    auditLimit,
    auditTargetUserId: auditTargetUserId || undefined,
    boardLimit: 10,
    userLimit,
    workspaceLimit: 10,
  })

  useEffect(() => {
    if (status !== 'ready' || adminAccess.apiMode === 'local-unavailable' || adminAccess.canAccessAdmin) return
    router.replace('/workspaces?admin=denied')
  }, [adminAccess.apiMode, adminAccess.canAccessAdmin, router, status])

  const resolvedSelectedUserId =
    selectedUserId && resources.users.users.some((user) => user.id === selectedUserId)
      ? selectedUserId
      : (resources.users.users[0]?.id ?? null)

  useEffect(() => {
    if (!resourcesEnabled || !resolvedSelectedUserId) return
    let cancelled = false
    loadAdminRoles(resolvedSelectedUserId)
      .then((payload) => {
        if (cancelled) return
        setLoadedRolesUserId(resolvedSelectedUserId)
        setSelectedRoles(payload.roles)
        setRolesError(null)
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setLoadedRolesUserId(resolvedSelectedUserId)
        setSelectedRoles([])
        setRolesError(nextError instanceof Error ? nextError.message : 'Role lookup failed.')
      })
    return () => {
      cancelled = true
    }
  }, [resourcesEnabled, resolvedSelectedUserId])

  const roleNames = useMemo(() => adminAccess.roles.map((role) => role.role), [adminAccess.roles])
  const isOwner = roleNames.includes('owner')
  const selectedUser = resources.users.users.find((user) => user.id === resolvedSelectedUserId) ?? null
  const rolesStatus =
    !resolvedSelectedUserId ? 'idle' : loadedRolesUserId === resolvedSelectedUserId ? (rolesError ? 'error' : 'ready') : 'loading'
  const visibleRoles = loadedRolesUserId === resolvedSelectedUserId ? selectedRoles : []

  async function refreshRolesAndResources(message?: string) {
    if (!resolvedSelectedUserId) return
    const nextRoles = await loadAdminRoles(resolvedSelectedUserId)
    setLoadedRolesUserId(resolvedSelectedUserId)
    setSelectedRoles(nextRoles.roles)
    setRolesError(null)
    setMutationMessage(message ?? null)
    resources.reload()
  }

  async function handleGrantRole() {
    if (!resolvedSelectedUserId || mutationBusy) return
    setMutationBusy(true)
    try {
      await grantAdminRole({ note: draftNote.trim() || undefined, role: draftRole, userId: resolvedSelectedUserId })
      setDraftNote('')
      await refreshRolesAndResources(`Granted ${draftRole} to ${resolvedSelectedUserId}.`)
    } catch (nextError) {
      setMutationMessage(nextError instanceof Error ? nextError.message : 'Role grant failed.')
    } finally {
      setMutationBusy(false)
    }
  }

  async function handleRevokeRole(role: string) {
    if (!resolvedSelectedUserId || mutationBusy) return
    setMutationBusy(true)
    try {
      await revokeAdminRole(resolvedSelectedUserId, role)
      await refreshRolesAndResources(`Revoked ${role} from ${resolvedSelectedUserId}.`)
    } catch (nextError) {
      setMutationMessage(nextError instanceof Error ? nextError.message : 'Role revoke failed.')
    } finally {
      setMutationBusy(false)
    }
  }

  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Admin</p>
          <h1 className="product-page-title">Admin console</h1>
        </section>

        {status === 'loading' ? <Notice title="Checking access" body="We are confirming your admin roles." /> : null}
        {status === 'error' ? <ErrorNotice error={error ?? 'The admin contract could not be loaded right now.'} /> : null}
        {status === 'ready' && adminAccess.apiMode === 'local-unavailable' ? (
          <Notice title="Admin API unavailable" body="Set NEXT_PUBLIC_API_BASE_URL so the browser can call the protected admin routes." />
        ) : null}

        {resourcesEnabled ? (
          <>
            <section className="management-summary-grid" aria-label="Admin summary">
              <Callout label="Access" value={roleNames.join(', ') || 'Granted'} body={`Actor ${adminAccess.userId ?? 'unknown'}`} />
              <Callout label="Users" value={summaryValue(resources.summary.summary?.usersCount, resources.status)} body="Active accounts" />
              <Callout label="Boards" value={summaryValue(resources.summary.summary?.boardsCount, resources.status)} body="Saved boards" />
            </section>

            <section className="management-section-grid" aria-label="Admin resources">
              <article className="management-panel management-panel-wide">
                <div className="management-panel-heading">
                  <div><h2>System summary</h2><p>{resources.status === 'error' ? resources.error : 'Server-backed counts and role state.'}</p></div>
                  <span className={`management-status ${resources.status === 'ready' ? 'is-success' : ''}`}>{resources.status}</span>
                </div>
                <dl className="management-definition-list">
                  <div><dt>Users</dt><dd>{summaryValue(resources.summary.summary?.usersCount, resources.status)}</dd></div>
                  <div><dt>Workspaces</dt><dd>{summaryValue(resources.summary.summary?.workspacesCount, resources.status)}</dd></div>
                  <div><dt>Boards</dt><dd>{summaryValue(resources.summary.summary?.boardsCount, resources.status)}</dd></div>
                  <div><dt>Admin users</dt><dd>{summaryValue(resources.summary.summary?.adminUserCount, resources.status)}</dd></div>
                </dl>
              </article>

              <article className="management-panel">
                <div className="management-panel-heading">
                  <div><h2>Users</h2><p>Select a person to inspect roles.</p></div>
                  <div className="management-segmented">{userLimitOptions.map((option) => <button key={option} className={option === userLimit ? 'is-active' : undefined} onClick={() => setUserLimit(option)} type="button">{option}</button>)}</div>
                </div>
                <div className="management-table-wrap">
                  <table className="management-table">
                    <thead><tr><th>User</th><th>Status</th><th>Created</th></tr></thead>
                    <tbody>
                      {resources.users.users.map((user) => (
                        <tr key={user.id} onClick={() => setSelectedUserId(user.id)} style={{ background: user.id === selectedUserId ? 'var(--color-surface-soft)' : undefined, cursor: 'pointer' }}>
                          <td><div className="management-member"><div className="management-avatar small" aria-hidden="true">{initials(user.displayName || user.email)}</div><span><strong>{user.displayName || 'Unnamed user'}</strong><small>{user.email}</small><small>{user.id}</small></span></div></td>
                          <td><span className="management-badge">{user.status}</span></td>
                          <td>{formatDate(user.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="management-panel">
                <div className="management-panel-heading">
                  <div><h2>Role management</h2><p>{selectedUser ? selectedUser.email : 'Select a user first.'}</p></div>
                  <span className={`management-status ${rolesStatus === 'ready' ? 'is-success' : ''}`}>{rolesStatus}</span>
                </div>
                {rolesError ? <p>{rolesError}</p> : null}
                {mutationMessage ? <p>{mutationMessage}</p> : null}
                <div className="management-badge-row">{visibleRoles.map((role) => <span key={`${role.role}-${role.createdAt}`}>{role.role}</span>)}</div>
                <dl className="management-definition-list">
                  {visibleRoles.map((role) => (
                    <div key={`${role.role}-${role.createdAt}`}>
                      <dt>{role.role}</dt>
                      <dd>
                        Granted {formatDate(role.createdAt)}{role.grantedBy ? ` by ${role.grantedBy}` : ''}{role.note ? ` - ${role.note}` : ''}{Object.keys(role.permissions).length > 0 ? ` - ${Object.keys(role.permissions).join(', ')}` : ''}
                        {isOwner ? <button className="product-button product-button-secondary" onClick={() => handleRevokeRole(role.role)} style={{ marginLeft: 12 }} type="button">Revoke</button> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
                {isOwner ? (
                  <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
                    <select aria-label="Grant role" onChange={(event) => setDraftRole(event.target.value as (typeof roleOptions)[number])} style={fieldStyle} value={draftRole}>
                      {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <input onChange={(event) => setDraftNote(event.target.value)} placeholder="Optional note" style={fieldStyle} value={draftNote} />
                    <button className="product-button" disabled={!resolvedSelectedUserId || mutationBusy} onClick={handleGrantRole} type="button">Grant role</button>
                  </div>
                ) : <p style={{ marginTop: 20 }}>Owner role is required to grant or revoke admin access.</p>}
              </article>
            </section>

            <section className="management-section-grid" aria-label="Workspace and board inventory">
              <article className="management-panel">
                <h2>Workspaces</h2>
                <div className="management-table-wrap">
                  <table className="management-table">
                    <thead><tr><th>Name</th><th>Status</th><th>Owner</th></tr></thead>
                    <tbody>{resources.workspaces.workspaces.map((workspace) => <tr key={workspace.id}><td><strong>{workspace.name}</strong><small>{workspace.id}</small></td><td><span className="management-badge">{workspace.status}</span></td><td>{workspace.ownerId ?? 'Unknown'}</td></tr>)}</tbody>
                  </table>
                </div>
              </article>
              <article className="management-panel">
                <h2>Boards</h2>
                <div className="management-table-wrap">
                  <table className="management-table">
                    <thead><tr><th>Board</th><th>Visibility</th><th>Saved</th></tr></thead>
                    <tbody>{resources.boards.boards.map((board) => <tr key={board.id}><td><strong>{board.title}</strong><small>{board.workspaceId}</small></td><td><span className="management-badge">{board.visibility}</span></td><td>{formatDate(board.savedAt)}</td></tr>)}</tbody>
                  </table>
                </div>
              </article>
            </section>

            <AdminAiDashboard enabled={resourcesEnabled} />
            <AdminFinanceDashboard enabled={resourcesEnabled} workspaces={resources.workspaces.workspaces} />

            <section className="management-section-grid" aria-label="Audit activity">
              <article className="management-panel management-panel-wide">
                <div className="management-panel-heading">
                  <div><h2>Audit log</h2><p>Recent admin actions, filtered server-side.</p></div>
                  <div className="management-segmented">{auditLimitOptions.map((option) => <button key={option} className={option === auditLimit ? 'is-active' : undefined} onClick={() => setAuditLimit(option)} type="button">{option}</button>)}</div>
                </div>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr) auto auto', marginBottom: 20 }}>
                  <select aria-label="Audit action filter" onChange={(event) => setAuditAction(event.target.value)} style={fieldStyle} value={auditAction}>
                    <option value="">All actions</option>
                    {auditActions.filter(Boolean).map((action) => <option key={action} value={action}>{action}</option>)}
                  </select>
                  <button className="product-button product-button-secondary" onClick={() => setAuditTargetUserId(resolvedSelectedUserId ?? '')} type="button">Filter selected user</button>
                  <button className="product-button product-button-secondary" onClick={() => setAuditTargetUserId('')} type="button">Clear user filter</button>
                </div>
                <div className="management-badge-row">{auditTargetUserId ? <span>Target {auditTargetUserId}</span> : null}{auditAction ? <span>{auditAction}</span> : null}</div>
                <div className="management-table-wrap">
                  <table className="management-table">
                    <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Target</th><th>Metadata</th></tr></thead>
                    <tbody>{resources.auditLogs.logs.map((log) => <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td><span className="management-badge">{log.action}</span></td><td>{log.actorUserId ?? 'System'}</td><td>{log.targetUserId ?? log.workspaceId ?? '—'}</td><td>{metadataPreview(log.metadata)}</td></tr>)}</tbody>
                  </table>
                </div>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}

function Callout({ label, value, body }: { body: string; label: string; value: string }) {
  return <article className="management-callout"><span>{label}</span><h2>{value}</h2><p>{body}</p></article>
}

function Notice({ body, title }: { body: string; title: string }) {
  return <section className="management-notice"><div><h2>{title}</h2><p>{body}</p></div><Link className="product-button product-button-secondary" href="/workspaces">Back to workspace</Link></section>
}

function ErrorNotice({ error }: { error: string }) {
  return <Notice body={error} title="Admin access check failed" />
}

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'NA'
}

function metadataPreview(metadata: Record<string, unknown>) {
  const text = JSON.stringify(metadata)
  return text.length > 96 ? `${text.slice(0, 93)}...` : text
}

function summaryValue(value: number | undefined, status: 'error' | 'loading' | 'ready') {
  if (status === 'loading') return '...'
  if (typeof value !== 'number') return 'Unavailable'
  return value.toLocaleString('en-US')
}
