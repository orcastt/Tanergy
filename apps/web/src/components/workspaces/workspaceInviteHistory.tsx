'use client'

import type { WorkspaceInvitationRecord } from '@/features/billing/billingTypes'

export type InviteView = 'accepted' | 'pending' | 'revoked'

export function InviteHistoryRow({
  canManageInvites,
  invite,
  memberNamesById,
  onRevoke,
}: {
  canManageInvites: boolean
  invite: WorkspaceInvitationRecord
  memberNamesById?: ReadonlyMap<string, string>
  onRevoke: (invitationId: string) => void
}) {
  const inviteView = resolveInviteView(invite)
  const isExpired = inviteView === 'pending' && isInvitationExpired(invite)
  const acceptedByLabel = invite.acceptedBy
    ? memberNamesById?.get(invite.acceptedBy) ?? invite.acceptedBy
    : null
  const detailParts = [
    `Created ${formatInviteDate(invite.createdAt)}`,
    inviteView === 'accepted' && invite.acceptedAt ? `Accepted ${formatInviteDate(invite.acceptedAt)}` : null,
    inviteView === 'accepted' && acceptedByLabel ? `Accepted by ${acceptedByLabel}` : null,
    inviteView === 'revoked' && invite.revokedAt ? `Revoked ${formatInviteDate(invite.revokedAt)}` : null,
    inviteView === 'pending' ? `${isExpired ? 'Expired' : 'Expires'} ${formatInviteDate(invite.expiresAt)}` : null,
    'Workspace join',
    invite.targetUserId ? `User ${invite.targetUserId}` : null,
  ].filter(Boolean)

  return (
    <div className="workspace-invite-record">
      <div className="workspace-invite-record-head">
        <div className="workspace-invite-record-copy">
          <strong>{invite.email ?? 'Anyone with this link'}</strong>
          <div className="workspace-invite-record-badges">
            <span className={`workspace-invite-record-badge is-${isExpired ? 'expired' : inviteView}`}>
              {isExpired ? 'Expired' : formatInviteViewLabel(inviteView)}
            </span>
            <span className="workspace-invite-record-badge is-neutral">{formatInviteRole(invite.role)}</span>
          </div>
        </div>
        {inviteView === 'pending' ? (
          <button className="workspace-detail-muted-button" disabled={!canManageInvites} onClick={() => onRevoke(invite.id)} type="button">
            Revoke
          </button>
        ) : null}
      </div>
      <div className="workspace-invite-record-meta">
        {detailParts.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
    </div>
  )
}

export function resolveInviteView(invite: WorkspaceInvitationRecord): InviteView {
  if (invite.acceptedAt) return 'accepted'
  if (invite.revokedAt) return 'revoked'
  return 'pending'
}

export function sortInvitations(
  invites: WorkspaceInvitationRecord[],
  selector: (invite: WorkspaceInvitationRecord) => string,
) {
  return [...invites].sort((left, right) => parseInviteTimestamp(selector(right)) - parseInviteTimestamp(selector(left)))
}

export function formatInviteRole(role: string) {
  if (role === 'admin') return 'Admin'
  if (role === 'editor') return 'Editor'
  return 'Viewer'
}

export function formatInviteViewLabel(view: InviteView) {
  if (view === 'accepted') return 'Accepted'
  if (view === 'revoked') return 'Revoked'
  return 'Pending'
}

export function emptyInviteLabel(view: InviteView) {
  if (view === 'accepted') return 'No accepted invites yet.'
  if (view === 'revoked') return 'No revoked invites yet.'
  return 'No pending invites.'
}

function parseInviteTimestamp(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatInviteDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function isInvitationExpired(invite: WorkspaceInvitationRecord) {
  const expiresAt = Date.parse(invite.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt <= Date.now()
}
