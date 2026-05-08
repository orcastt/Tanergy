'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from '@/features/billing/billingClient'
import type { WorkspaceInvitationRecord } from '@/features/billing/billingTypes'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'

type WorkspaceInvitePanelProps = {
  seatLabel?: string
  workspace: TangentWorkspace
}

type InviteRole = 'admin' | 'editor' | 'viewer'

export function WorkspaceInvitePanel({ seatLabel, workspace }: WorkspaceInvitePanelProps) {
  const [email, setEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [invitations, setInvitations] = useState<WorkspaceInvitationRecord[]>([])
  const [role, setRole] = useState<InviteRole>('editor')
  const [status, setStatus] = useState<null | string>(null)
  const [isPending, setIsPending] = useState(false)

  const activeInvites = useMemo(
    () => invitations.filter((invite) => !invite.acceptedAt && !invite.revokedAt),
    [invitations],
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
      <div className="workspace-detail-panel-head"><h2>Invite</h2></div>
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
          <button className="workspace-detail-danger-button" disabled={isPending} onClick={createInvite} type="button">
            Invite
          </button>
        </div>
      </label>
      <label className="workspace-detail-field">
        <span>Role</span>
        <select onChange={(event) => setRole(event.target.value as InviteRole)} value={role}>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      {inviteLink ? (
        <label className="workspace-detail-field">
          <span>Latest link</span>
          <input readOnly value={inviteLink} />
        </label>
      ) : null}
      {status ? <small className="workspace-detail-status" role="status">{status}</small> : null}
      {activeInvites.length ? (
        <div className="workspace-detail-invite-list">
          {activeInvites.slice(0, 4).map((invite) => (
            <div className="workspace-detail-summary-row" key={invite.id}>
              <span>{invite.email ?? invite.role}</span>
              <button className="workspace-detail-muted-button" onClick={() => revokeInvite(invite.id)} type="button">Revoke</button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )

  async function createInvite() {
    setIsPending(true)
    setStatus(null)
    try {
      const response = await createWorkspaceInvitation({
        email: email.trim() || null,
        expiresInDays: 7,
        role,
      }, { workspace })
      const origin = typeof window === 'undefined' ? '' : window.location.origin
      const nextLink = `${origin}${response.result.acceptPath}`
      setInviteLink(nextLink)
      setInvitations((current) => [response.result.invitation, ...current])
      setStatus('Invite created.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Invite failed.')
    } finally {
      setIsPending(false)
    }
  }

  async function revokeInvite(invitationId: string) {
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
}
