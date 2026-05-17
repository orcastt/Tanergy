'use client'

import type { ChangeEvent } from 'react'
import {
  type BoardMemberCandidateRecord,
  type BoardMemberRecord,
  type BoardMemberRole,
} from '@/features/boards/boardTypes'
import {
  getPublicUserInitials,
  getPublicUserLabel,
  getPublicUserSecondaryLabel,
} from '@/features/shared/publicUserDisplay'
import {
  formatJoinedAt,
  formatWorkspaceRole,
  getRoleLabel,
} from './boardMemberUtils'
import type { MemberDraft } from './useBoardManagementMembers'

const ownerRoleValue: BoardMemberRole[] = ['owner']

export function BoardManagementMemberRow({
  boardOwnerId,
  canManageBoard,
  draft,
  editableRoleValues,
  member,
  pendingUserId,
  readOnly,
  sessionUserId,
  onRemove,
  onSave,
  onUpdateDraft,
}: {
  boardOwnerId: string
  canManageBoard: boolean
  draft: MemberDraft
  editableRoleValues: BoardMemberRole[]
  member: BoardMemberRecord
  pendingUserId: string | null
  readOnly: boolean
  sessionUserId: string
  onRemove: (member: BoardMemberRecord) => Promise<void>
  onSave: (member: BoardMemberRecord) => Promise<void>
  onUpdateDraft: (userId: string, field: keyof MemberDraft) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void
}) {
  const memberPending = pendingUserId === member.userId
  const isOwner = member.userId === boardOwnerId
  const hasChanges = draft.displayName.trim() !== (member.displayName ?? '') || draft.role !== member.role
  const memberLabel = getPublicUserLabel({
    displayName: member.displayName,
    email: member.email,
    fallback: member.userId === sessionUserId ? 'You' : isOwner ? 'Owner' : 'Member',
    userId: member.userId,
  })
  const memberSecondary = getPublicUserSecondaryLabel({
    displayName: member.displayName,
    email: member.email,
    userId: member.userId,
  })

  return (
    <div className="board-panel-member" role="row">
      <span className="board-panel-avatar">
        {getPublicUserInitials({
          displayName: member.displayName,
          email: member.email,
          fallback: member.userId === sessionUserId ? 'You' : isOwner ? 'Owner' : 'Member',
          userId: member.userId,
        })}
      </span>
      <div className="board-panel-member-meta">
        <strong>{memberLabel}</strong>
        <span>
          {memberSecondary ?? (isOwner ? 'Workspace owner' : 'Board member')}
          {member.userId === sessionUserId ? ' | You' : ''}
        </span>
      </div>
      <small>{member.workspaceRole ? `${formatWorkspaceRole(member.workspaceRole)} | ${formatJoinedAt(member.joinedAt)}` : formatJoinedAt(member.joinedAt)}</small>
      <label className="board-panel-member-inline">
        <span className="sr-only">Role</span>
        <select
          className="board-panel-member-role"
          disabled={readOnly || memberPending || isOwner}
          onChange={onUpdateDraft(member.userId, 'role')}
          value={draft.role}
        >
          {(isOwner ? ownerRoleValue : editableRoleValues).map((role) => (
            <option key={role} value={role}>{getRoleLabel(role)}</option>
          ))}
        </select>
      </label>
      <div className="board-panel-member-actions">
        {canManageBoard ? (
          <>
            <input
              disabled={readOnly || memberPending}
              maxLength={80}
              onChange={onUpdateDraft(member.userId, 'displayName')}
              placeholder="Display name"
              value={draft.displayName}
            />
            <button disabled={readOnly || memberPending || isOwner || !hasChanges} onClick={() => void onSave(member)} type="button">
              Save
            </button>
            <button disabled={readOnly || memberPending || isOwner} onClick={() => void onRemove(member)} type="button">
              Remove
            </button>
          </>
        ) : (
          <small>{getRoleLabel(member.role)}</small>
        )}
      </div>
    </div>
  )
}

export function BoardManagementCandidateRow({
  candidate,
  pendingUserId,
  readOnly,
  onAdd,
}: {
  candidate: BoardMemberCandidateRecord
  pendingUserId: string | null
  readOnly: boolean
  onAdd: (candidate: BoardMemberCandidateRecord) => Promise<void>
}) {
  const candidateLabel = getPublicUserLabel({
    displayName: candidate.displayName,
    email: candidate.email,
    fallback: 'Member',
    userId: candidate.userId,
  })
  const candidateSecondary = getPublicUserSecondaryLabel({
    displayName: candidate.displayName,
    email: candidate.email,
    userId: candidate.userId,
  })

  return (
    <div className="board-panel-member" role="listitem">
      <span className="board-panel-avatar">
        {getPublicUserInitials({
          displayName: candidate.displayName,
          email: candidate.email,
          fallback: 'Member',
          userId: candidate.userId,
        })}
      </span>
      <div className="board-panel-member-meta">
        <strong>{candidateLabel}</strong>
        <span>{candidateSecondary ?? formatWorkspaceRole(candidate.workspaceRole)}</span>
      </div>
      <small>{formatWorkspaceRole(candidate.workspaceRole)}</small>
      <div className="board-panel-member-actions">
        {candidate.alreadyMember ? (
          <small>{candidate.boardRole ? getRoleLabel(candidate.boardRole) : 'Already added'}</small>
        ) : (
          <button disabled={readOnly || pendingUserId === candidate.userId} onClick={() => void onAdd(candidate)} type="button">
            Add
          </button>
        )}
      </div>
    </div>
  )
}
