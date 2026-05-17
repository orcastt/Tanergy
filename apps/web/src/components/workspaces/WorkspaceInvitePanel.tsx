'use client'

import { useMemo, useState } from 'react'
import {
  createWorkspaceInvitation,
  revokeWorkspaceInvitation,
} from '@/features/billing/billingClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { WorkspaceDashboardMember } from '@/features/workspaces/workspaceDashboardTypes'
import { buildWorkspaceInvitationLink } from '@/features/workspaces/workspaceInvitationLinks'
import {
  emptyInviteLabel,
  formatInviteRole,
  formatInviteViewLabel,
  InviteHistoryRow,
  type InviteView,
} from './workspaceInviteHistory'
import { useWorkspaceInvitations } from './useWorkspaceInvitations'

type WorkspaceInvitePanelProps = {
  members?: WorkspaceDashboardMember[]
  onWorkspaceRefresh?: () => void
  seatLabel?: string
  seatPlanMax?: null | number
  workspace: TangentWorkspace
}

type InviteRole = 'admin' | 'editor' | 'viewer'
const inviteViews: InviteView[] = ['pending', 'accepted', 'revoked']
const managerRoles = new Set(['owner', 'admin'])

export function WorkspaceInvitePanel({
  members = [],
  onWorkspaceRefresh,
  seatLabel,
  seatPlanMax = null,
  workspace,
}: WorkspaceInvitePanelProps) {
  const [email, setEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [role, setRole] = useState<InviteRole>('editor')
  const [status, setStatus] = useState<null | string>(null)
  const [isPending, setIsPending] = useState(false)

  const canManageInvites = managerRoles.has(workspace.role)
  const inviteRoles = workspace.role === 'owner'
    ? ['admin', 'editor', 'viewer'] as InviteRole[]
    : ['editor', 'viewer'] as InviteRole[]
  const memberNamesById = useMemo(
    () => new Map(members.map((member) => [member.id, member.displayName?.trim() || member.email || member.id])),
    [members],
  )
  const {
    collapseInviteView,
    currentInvites,
    hasExpandableView,
    hiddenInviteCount,
    inviteGroups,
    inviteLoadError,
    inviteView,
    isExpanded,
    isLoadingInvitations,
    isRefreshingInvitations,
    prependInvitation,
    refreshInvitations,
    replaceInvitation,
    setInviteView,
    toggleExpandedView,
    totalInviteCount,
    visibleInvites,
  } = useWorkspaceInvitations({ workspace })
  const inviteStats = [
    { label: 'Pending', value: String(inviteGroups.pending.length) },
    { label: 'Accepted', value: String(inviteGroups.accepted.length) },
    { label: 'Revoked', value: String(inviteGroups.revoked.length) },
    seatLabel ? { label: 'Seats', value: seatLabel } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>
  const inviteRule = workspace.kind === 'team_workspace'
    ? `Accepted Team invites join the same Team wallet workspace. A seat is consumed only after acceptance.${seatPlanMax ? ` Current purchased seats are shown above; the plan can expand to ${seatPlanMax}.` : ''}`
    : 'Accepted Group invites join the same Group structure, but AI still charges each member’s own personal credits.'

  return (
    <section className="workspace-detail-panel workspace-detail-side-panel">
      <div className="workspace-detail-panel-head">
        <div>
          <h2>Invite</h2>
          <small>Create manual invite links. Optional email only restricts who can accept; nothing is emailed automatically yet.</small>
        </div>
      </div>
      <div className="workspace-invite-stats">
        {inviteStats.map((stat) => (
          <div className="workspace-invite-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className="workspace-detail-settings-note workspace-invite-note">
        <strong>Invite rules</strong>
        <p>{inviteRule}</p>
      </div>
      <label className="workspace-detail-field">
        <span>Restrict to email</span>
        <div className="workspace-detail-field-row">
          <input onChange={(event) => setEmail(event.target.value)} placeholder="Optional: name@example.com" value={email} />
          <button className="workspace-detail-danger-button" disabled={isPending || !canManageInvites} onClick={createInvite} type="button">
            Invite
          </button>
        </div>
      </label>
      <label className="workspace-detail-field">
        <span>Role</span>
        <select disabled={!canManageInvites} onChange={(event) => setRole(event.target.value as InviteRole)} value={inviteRoles.includes(role) ? role : 'editor'}>
          {inviteRoles.map((inviteRole) => <option key={inviteRole} value={inviteRole}>{formatInviteRole(inviteRole)}</option>)}
        </select>
      </label>
      {inviteLink ? (
        <label className="workspace-detail-field">
          <span>Latest link</span>
          <div className="workspace-detail-field-row">
            <input readOnly value={inviteLink} />
            <button className="workspace-detail-muted-button" onClick={copyInviteLink} type="button">
              Copy
            </button>
          </div>
          <small className="workspace-detail-status">This link adds the person into the workspace. Board access is assigned separately inside member management.</small>
        </label>
      ) : null}
      {status ? <small className="workspace-detail-status" role="status">{status}</small> : null}

      <div className="workspace-invite-history-head">
        <strong>Invite history</strong>
        <div className="workspace-invite-history-actions">
          <span>{totalInviteCount} total</span>
          <button className="workspace-detail-muted-button" disabled={isRefreshingInvitations} onClick={refreshWorkspaceActivity} type="button">
            {isRefreshingInvitations ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      <div className="workspace-view-toggle workspace-invite-toggle" aria-label="Invite status filter">
        {inviteViews.map((view) => (
          <button
            className={inviteView === view ? 'is-active' : ''}
            key={view}
            onClick={() => setInviteView(view)}
            type="button"
          >
            {formatInviteViewLabel(view)} {inviteGroups[view].length}
          </button>
        ))}
      </div>

      {isLoadingInvitations ? (
        <div className="workspace-detail-status">Loading invite history...</div>
      ) : inviteLoadError ? (
        <div className="workspace-detail-status">{inviteLoadError}</div>
      ) : currentInvites.length === 0 ? (
        <div className="workspace-invite-empty">{emptyInviteLabel(inviteView)}</div>
      ) : (
        <>
          <div className="workspace-detail-invite-list">
            {visibleInvites.map((invite) => (
              <InviteHistoryRow
                canManageInvites={canManageInvites}
                invite={invite}
                key={invite.id}
                memberNamesById={memberNamesById}
                onRevoke={revokeInvite}
              />
            ))}
          </div>
          {hasExpandableView ? (
            <button
              className="workspace-detail-muted-button workspace-invite-more-button"
              onClick={() => toggleExpandedView(inviteView)}
              type="button"
            >
              {isExpanded ? 'Show less' : `Show all ${currentInvites.length}`}
            </button>
          ) : null}
          {!isExpanded && hiddenInviteCount > 0 ? (
            <small className="workspace-detail-status">{hiddenInviteCount} more in this state.</small>
          ) : null}
        </>
      )}
    </section>
  )

  async function createInvite() {
    if (!canManageInvites) return setStatus('Your workspace role cannot create invites.')
    setIsPending(true)
    setStatus(null)
    try {
      const response = await createWorkspaceInvitation({
        email: email.trim() || null,
        expiresInDays: 7,
        role: inviteRoles.includes(role) ? role : 'editor',
      }, { workspace })
      const nextLink = buildWorkspaceInvitationLink(response.result.token, {
        role: response.result.invitation.role,
        workspaceKind: workspace.kind,
        workspaceName: workspace.name,
      })
      setInviteLink(nextLink)
      setInviteView('pending')
      collapseInviteView('pending')
      prependInvitation(response.result.invitation)
      const copied = await writeInviteLink(nextLink)
      setStatus(copied ? 'Invite link copied. Share it manually.' : 'Invite ready. Copy and share it.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Invite failed.')
    } finally {
      setIsPending(false)
    }
  }

  async function revokeInvite(invitationId: string) {
    if (!canManageInvites) return setStatus('Your workspace role cannot revoke invites.')
    setStatus(null)
    try {
      const response = await revokeWorkspaceInvitation(invitationId, { workspace })
      setInviteView('revoked')
      collapseInviteView('revoked')
      replaceInvitation(response.invitation)
      setStatus('Invite revoked.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Revoke failed.')
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return
    const copied = await writeInviteLink(inviteLink)
    setStatus(copied ? 'Invite link copied. Share it manually.' : 'Copy failed.')
  }

  async function refreshWorkspaceActivity() {
    setStatus(null)
    onWorkspaceRefresh?.()
    try {
      await refreshInvitations()
      setStatus('Invite history refreshed.')
    } catch {
      setStatus('Invite history is unavailable right now.')
    }
  }
}

async function writeInviteLink(value: string) {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
