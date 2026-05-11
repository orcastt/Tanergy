'use client'

import type { AdminOperatorAction } from './adminOperatorActions'
import type { AdminOperatorWorkspacePlan } from './adminTypes'
import type { WorkspaceInvitationRecord } from '@/features/billing/billingTypes'

type StackAction = { disabled?: boolean; label: string; onClick: () => void; title?: string }

export function MemberStack({
  bottomActions = [],
  manageMembers = false,
  invitations = [],
  members,
  onAction,
  ownerId,
  total,
  totalLabel,
  workspaceId,
}: {
  bottomActions?: StackAction[]
  manageMembers?: boolean
  invitations?: WorkspaceInvitationRecord[]
  members: AdminOperatorWorkspacePlan['members']
  onAction?: (action: AdminOperatorAction) => void
  ownerId?: null | string
  total: number
  totalLabel?: string
  workspaceId?: string
}) {
  return (
    <div className="admin-cell-stack-list">
      <div className="admin-cell-count admin-cell-count-pill">{totalLabel ?? total}</div>
      {members.length ? members.slice(0, 6).map((member) => {
        const currentRole = normalizeMemberRole(member.role)
        const canManage = Boolean(manageMembers && workspaceId && onAction && currentRole && member.userId !== ownerId)
        return (
          <div className="admin-member-line" key={member.userId}>
            <div className="admin-member-line-main">
              <span className="admin-member-role" data-role={member.role}>{member.role}</span>
              <span className="admin-member-email">{member.email || member.displayName || member.userId}</span>
            </div>
            {canManage && workspaceId && onAction && currentRole ? (
              <div className="admin-member-actions">
                <button
                  className="admin-inline-action"
                  data-tone="danger"
                  onClick={() => onAction({
                    title: `Remove ${member.email || member.displayName || member.userId}`,
                    type: 'workspace-member-remove',
                    userId: member.userId,
                    workspaceId,
                  })}
                  type="button"
                >
                  Delete
                </button>
                <button
                  className="admin-inline-action"
                  onClick={() => onAction({
                    currentRole,
                    title: `Change ${member.email || member.displayName || member.userId}`,
                    type: 'workspace-member-role',
                    userId: member.userId,
                    workspaceId,
                  })}
                  type="button"
                >
                  Change
                </button>
              </div>
            ) : null}
          </div>
        )
      }) : <span className="admin-member-empty">No members</span>}
      {pendingInvitations(invitations).slice(0, 4).map((invitation) => (
        <div className="admin-invite-line" key={invitation.id}>
          <div className="admin-member-line-main">
            <span className="admin-member-role" data-role={invitation.role}>{invitation.role}</span>
            <span className="admin-member-email">{invitation.email || invitation.targetUserId || invitation.id}</span>
            <span className="admin-invite-status">Pending</span>
          </div>
          {workspaceId && onAction ? (
            <div className="admin-member-actions">
              <button
                className="admin-inline-action"
                data-tone="danger"
                onClick={() => onAction({
                  invitationId: invitation.id,
                  title: `Revoke ${invitation.email || invitation.targetUserId || invitation.id}`,
                  type: 'workspace-invite-revoke',
                  workspaceId,
                })}
                type="button"
              >
                Revoke
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {bottomActions.length ? (
        <div className="admin-member-stack-actions">
          {bottomActions.map((action) => (
            <button
              className="admin-inline-action"
              disabled={action.disabled}
              key={action.label}
              onClick={action.onClick}
              title={action.title}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function BoardStack({
  boards,
  onAction,
  total,
  totalLabel,
  workspaceId,
}: {
  boards: AdminOperatorWorkspacePlan['boards']
  onAction?: (action: AdminOperatorAction) => void
  total: number
  totalLabel?: string
  workspaceId?: string
}) {
  return (
    <div className="admin-cell-stack-list">
      <div className="admin-cell-count admin-cell-count-pill">{totalLabel ?? total}</div>
      {boards.length ? boards.slice(0, 6).map((board) => (
        <div className="admin-board-line" key={board.id}>
          <span>{board.title || board.id}</span>
          {workspaceId && onAction ? (
            <div className="admin-member-actions">
              <button
                className="admin-inline-action"
                data-tone="danger"
                onClick={() => onAction({
                  boardId: board.id,
                  title: `Delete ${board.title || board.id}`,
                  type: 'board-delete',
                  workspaceId,
                })}
                type="button"
              >
                Delete
              </button>
              <button
                className="admin-inline-action"
                onClick={() => onAction({
                  boardId: board.id,
                  title: `Copy ${board.title || board.id}`,
                  type: 'board-copy',
                  workspaceId,
                })}
                type="button"
              >
                Copy
              </button>
            </div>
          ) : null}
        </div>
      )) : <span className="admin-member-empty">No boards</span>}
    </div>
  )
}

export function ActionStack({
  actions,
}: {
  actions: StackAction[]
}) {
  if (!actions.length) return <span>-</span>
  return (
    <div className="admin-plan-action-stack">
      {actions.map((action) => (
        <button
          className="product-button product-button-secondary admin-table-button admin-plan-action-button"
          data-tone={buttonTone(action.label)}
          disabled={action.disabled}
          key={action.label}
          onClick={action.onClick}
          title={action.title}
          type="button"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

function buttonTone(label: string) {
  if (label === 'Delete' || label === 'Delete history' || label === 'Deduct') return 'danger'
  if (label === 'Upgrade' || label === 'Buy seat' || label === 'Top up' || label === 'Add member') return 'primary'
  if (label === 'Invite' || label === 'Leave' || label === 'Renew' || label === 'Unfreeze') return 'positive'
  return 'neutral'
}

function normalizeMemberRole(role: string) {
  return role === 'admin' || role === 'editor' || role === 'viewer'
    ? role
    : null
}

function pendingInvitations(invitations: WorkspaceInvitationRecord[]) {
  return invitations.filter((invitation) => !invitation.acceptedAt && !invitation.revokedAt)
}
