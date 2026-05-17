'use client'

import { useTangentSession } from '@/features/auth/useTangentSession'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  type BoardMemberRole,
  type BoardPersistenceSummary,
} from '@/features/boards/boardTypes'
import {
  getRoleLabel,
} from './boardMemberUtils'
import { BoardManagementCandidateRow, BoardManagementMemberRow } from './boardManagementMemberRows'
import { useBoardManagementMembers } from './useBoardManagementMembers'

type BoardManagementMembersProps = {
  board: BoardPersistenceSummary
  canManageBoard: boolean
  disabled: boolean
  workspace?: TangentWorkspace
}

export function BoardManagementMembers({ board, canManageBoard, disabled, workspace }: BoardManagementMembersProps) {
  const { session } = useTangentSession()
  const membersState = useBoardManagementMembers({ board, canManageBoard, disabled, workspace })

  return (
    <section className="board-panel-section">
      <div className="board-panel-section-heading">
        <div>
          <h3>Members</h3>
          <p>{membersState.memberCountLabel}</p>
        </div>
      </div>

      {canManageBoard ? (
        <div className="board-panel-member-add">
          <label>
            <span>Search workspace members</span>
            <input
              autoComplete="off"
              disabled={disabled || membersState.isBusy}
              id="board-members-lookup"
              maxLength={120}
              onChange={(event) => {
                const nextValue = event.target.value
                membersState.setLookupQuery(nextValue)
                if (!nextValue.trim()) {
                  membersState.setLookupCandidates([])
                }
              }}
              placeholder="Search name or email"
              value={membersState.lookupQuery}
            />
          </label>
          <label>
            <span>Role</span>
            <select
              className="board-panel-member-role"
              disabled={disabled || membersState.isBusy}
              onChange={(event) => membersState.setCreateRole(event.target.value as BoardMemberRole)}
              value={membersState.createRole}
            >
              {membersState.editableRoleValues.map((role) => (
                <option key={role} value={role}>{getRoleLabel(role)}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {membersState.error ? <p className="board-panel-error board-panel-member-status">{membersState.error}</p> : null}
      {membersState.isLoading ? <p className="board-panel-member-status">Loading members...</p> : null}

      {canManageBoard && !membersState.isLoading && membersState.lookupQuery.trim() ? (
        <div aria-label="Workspace people" className="board-panel-members" role="list">
          {membersState.lookupCandidates.map((candidate) => (
            <BoardManagementCandidateRow
              candidate={candidate}
              key={candidate.userId}
              pendingUserId={membersState.pendingUserId}
              readOnly={membersState.readOnly}
              onAdd={membersState.addCandidate}
            />
          ))}
          {!membersState.lookupCandidates.length ? (
            <p className="board-panel-member-status">
              {membersState.isSearching
                ? 'Searching people...'
                : 'No workspace member found. Invite them into the workspace first.'}
            </p>
          ) : null}
        </div>
      ) : null}

      {!membersState.isLoading ? (
        <div aria-label="Board members" className="board-panel-members" role="table">
          {membersState.members.map((member) => (
            <BoardManagementMemberRow
              boardOwnerId={board.ownerId}
              canManageBoard={canManageBoard}
              draft={membersState.drafts[member.userId] ?? { displayName: member.displayName ?? '', role: member.role }}
              key={member.userId}
              member={member}
              pendingUserId={membersState.pendingUserId}
              readOnly={membersState.readOnly}
              sessionUserId={session.user.id}
              editableRoleValues={membersState.editableRoleValues}
              onRemove={membersState.removeMember}
              onSave={membersState.saveMember}
              onUpdateDraft={membersState.updateDraft}
            />
          ))}
        </div>
      ) : null}

      {!membersState.isLoading && !membersState.members.length ? (
        <p className="board-panel-member-status">No board members yet.</p>
      ) : null}
      {canManageBoard && membersState.isBusy ? (
        <p className="board-panel-member-status">Saving member changes...</p>
      ) : null}
    </section>
  )
}
