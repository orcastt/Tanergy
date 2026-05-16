'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from '@/features/billing/billingClient'
import type { WorkspaceInvitationRecord } from '@/features/billing/billingTypes'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { WorkspaceDashboardBoard } from '@/features/workspaces/workspaceDashboardTypes'
import { buildWorkspaceInvitationLink } from '@/features/workspaces/workspaceInvitationLinks'

type WorkspaceInvitePanelProps = {
  boards?: WorkspaceDashboardBoard[]
  seatLabel?: string
  workspace: TangentWorkspace
}

type InviteRole = 'admin' | 'editor' | 'viewer'
const managerRoles = new Set(['owner', 'admin'])

export function WorkspaceInvitePanel({ boards = [], seatLabel, workspace }: WorkspaceInvitePanelProps) {
  const [email, setEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [invitations, setInvitations] = useState<WorkspaceInvitationRecord[]>([])
  const [role, setRole] = useState<InviteRole>('editor')
  const [targetBoardId, setTargetBoardId] = useState('')
  const [status, setStatus] = useState<null | string>(null)
  const [isPending, setIsPending] = useState(false)

  const activeInvites = useMemo(
    () => invitations.filter((invite) => !invite.acceptedAt && !invite.revokedAt),
    [invitations],
  )
  const canManageInvites = managerRoles.has(workspace.role)
  const inviteRoles = workspace.role === 'owner' ? ['admin', 'editor', 'viewer'] as InviteRole[] : ['editor', 'viewer'] as InviteRole[]
  const inviteBoards = useMemo(
    () => [...boards].sort((left, right) => left.title.localeCompare(right.title)),
    [boards],
  )
  const selectedBoard = useMemo(
    () => inviteBoards.find((board) => board.id === targetBoardId) ?? null,
    [inviteBoards, targetBoardId],
  )

  useEffect(() => {
    let isMounted = true
    listWorkspaceInvitations({ workspace })
      .then((response) => {
        if (isMounted) setInvitations(response.invitations)
      })
      .catch(() => {
        if (isMounted) setInvitations([])
      })
    return () => {
      isMounted = false
    }
  }, [workspace])

  return (
    <section className="workspace-detail-panel workspace-detail-side-panel">
      <div className="workspace-detail-panel-head">
        <div>
          <h2>Invite</h2>
          <small>{canManageInvites ? 'Create role-scoped invite links.' : 'Only owners and admins can invite.'}</small>
        </div>
      </div>
      {seatLabel ? (
        <div className="workspace-detail-dark-card">
          <div className="workspace-detail-dark-row"><strong>{seatLabel}</strong></div>
          <small>seats</small>
        </div>
      ) : null}
      <label className="workspace-detail-field">
        <span>Invite link</span>
        <div className="workspace-detail-field-row">
          <input onChange={(event) => setEmail(event.target.value)} placeholder="Optional email" value={email} />
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
      {inviteBoards.length ? (
        <label className="workspace-detail-field">
          <span>Open after join</span>
          <select
            disabled={!canManageInvites}
            onChange={(event) => setTargetBoardId(event.target.value)}
            value={targetBoardId}
          >
            <option value="">Workspace home</option>
            {inviteBoards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {inviteLink ? (
        <label className="workspace-detail-field">
          <span>Latest link</span>
          <div className="workspace-detail-field-row">
            <input readOnly value={inviteLink} />
            <button className="workspace-detail-muted-button" onClick={copyInviteLink} type="button">
              Copy
            </button>
          </div>
        </label>
      ) : null}
      {status ? <small className="workspace-detail-status" role="status">{status}</small> : null}
      {activeInvites.length ? (
        <div className="workspace-detail-invite-list">
          {activeInvites.slice(0, 4).map((invite) => (
            <div className="workspace-detail-summary-row" key={invite.id}>
              <span>{invite.email ?? invite.role}</span>
              <button className="workspace-detail-muted-button" disabled={!canManageInvites} onClick={() => revokeInvite(invite.id)} type="button">Revoke</button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )

  async function createInvite() {
    if (!canManageInvites) return setStatus('Your workspace role cannot create invites.')
    setIsPending(true)
    setStatus(null)
    try {
      const metadata = selectedBoard
        ? { boardId: selectedBoard.id, boardTitle: selectedBoard.title }
        : undefined
      const response = await createWorkspaceInvitation({
        email: email.trim() || null,
        expiresInDays: 7,
        metadata,
        role: inviteRoles.includes(role) ? role : 'editor',
      }, { workspace })
      const nextLink = buildWorkspaceInvitationLink(response.result.token, {
        boardId: selectedBoard?.id,
        boardTitle: selectedBoard?.title,
        role: response.result.invitation.role,
        workspaceKind: workspace.kind,
        workspaceName: workspace.name,
      })
      setInviteLink(nextLink)
      setInvitations((current) => [response.result.invitation, ...current])
      const copied = await writeInviteLink(nextLink)
      setStatus(copied ? 'Invite link copied.' : 'Invite created.')
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
      setInvitations((current) => current.map((invite) => (
        invite.id === response.invitation.id ? response.invitation : invite
      )))
      setStatus('Invite revoked.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Revoke failed.')
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return
    const copied = await writeInviteLink(inviteLink)
    setStatus(copied ? 'Invite link copied.' : 'Copy failed.')
  }
}

function formatInviteRole(role: InviteRole) {
  if (role === 'admin') return 'Admin'
  if (role === 'editor') return 'Editor'
  return 'Viewer'
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
