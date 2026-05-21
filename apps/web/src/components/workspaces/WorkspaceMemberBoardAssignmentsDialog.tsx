'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  createLocalBoardMember,
  deleteLocalBoardMember,
  listLocalBoardMembers,
} from '@/features/boards/localBoardClient'
import type { BoardMemberRole } from '@/features/boards/boardTypes'
import { getPublicUserLabel } from '@/features/shared/publicUserDisplay'
import type {
  WorkspaceDashboardBoard,
  WorkspaceDashboardMember,
} from '@/features/workspaces/workspaceDashboardTypes'

type WorkspaceMemberBoardAssignmentsDialogProps = {
  boards: WorkspaceDashboardBoard[]
  member: WorkspaceDashboardMember
  onClose: () => void
  onSaved: () => void
  workspace: TangentWorkspace
}

export function WorkspaceMemberBoardAssignmentsDialog({
  boards,
  member,
  onClose,
  onSaved,
  workspace,
}: WorkspaceMemberBoardAssignmentsDialogProps) {
  const [currentBoardIds, setCurrentBoardIds] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(() => new Set())
  const orderedBoards = useMemo(
    () => [...boards].sort((left, right) => left.title.localeCompare(right.title)),
    [boards],
  )
  const memberLabel = getPublicUserLabel({
    displayName: member.displayName,
    email: member.email,
    fallback: 'Member',
    userId: member.id,
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

  useEffect(() => {
    let cancelled = false

    Promise.allSettled(orderedBoards.map(async (board) => {
      const response = await listLocalBoardMembers(board.id, workspace)
      const hasMember = response.members.some((item) => item.userId === member.id)
      return hasMember ? board.id : null
    }))
      .then((results) => {
        if (cancelled) return
        const nextBoardIds = new Set(
          results
            .filter((result): result is PromiseFulfilledResult<string | null> => result.status === 'fulfilled')
            .map((result) => result.value)
            .filter((value): value is string => Boolean(value)),
        )
        setCurrentBoardIds(nextBoardIds)
        setSelectedBoardIds(new Set(nextBoardIds))
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Board assignments failed to load.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [member.id, orderedBoards, workspace])

  return (
    <div className="auth-profile-modal-backdrop" onMouseDown={isSaving ? undefined : onClose} role="presentation">
      <section
        aria-labelledby="workspace-board-assignment-title"
        aria-modal="true"
        className="auth-profile-modal auth-profile-modal-compact workspace-board-assignment-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="auth-profile-modal-copy">
          <h2 id="workspace-board-assignment-title">Assign boards</h2>
          <p>{memberLabel} can join one or more boards inside {workspace.name}.</p>
        </div>

        <div className="workspace-board-assignment-list" role="list">
          {orderedBoards.map((board) => {
            const lockedToOwner = board.ownerId === member.id
            const isChecked = selectedBoardIds.has(board.id) || lockedToOwner
            return (
              <label className="workspace-board-assignment-row" key={board.id}>
                <input
                  checked={isChecked}
                  disabled={isLoading || isSaving || lockedToOwner}
                  onChange={() => toggleBoard(board.id)}
                  type="checkbox"
                />
                <div>
                  <strong>{board.title}</strong>
                  <small>
                    {lockedToOwner ? 'Board owner keeps access.' : 'Assign this workspace member to the board.'}
                  </small>
                </div>
              </label>
            )
          })}
          {!orderedBoards.length ? (
            <p className="workspace-detail-status">No boards yet. Create a board first.</p>
          ) : null}
        </div>

        {error ? <p className="workspace-detail-status" role="alert">{error}</p> : null}

        <div className="workspace-settings-dialog-actions">
          <button className="workspace-detail-muted-button" disabled={isSaving} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="workspace-detail-danger-button workspace-board-assignment-save" disabled={isLoading || isSaving} onClick={() => void saveAssignments()} type="button">
            {isSaving ? 'Saving boards...' : 'Save boards'}
          </button>
        </div>
      </section>
    </div>
  )

  function toggleBoard(boardId: string) {
    setSelectedBoardIds((current) => {
      const next = new Set(current)
      if (next.has(boardId)) next.delete(boardId)
      else next.add(boardId)
      return next
    })
  }

  async function saveAssignments() {
    setIsSaving(true)
    setError(null)
    try {
      await Promise.all(orderedBoards.map(async (board) => {
        const isOwnerBoard = board.ownerId === member.id
        const wasAssigned = currentBoardIds.has(board.id) || isOwnerBoard
        const shouldBeAssigned = selectedBoardIds.has(board.id) || isOwnerBoard
        if (wasAssigned === shouldBeAssigned) return
        if (shouldBeAssigned) {
          await createLocalBoardMember({
            boardId: board.id,
            displayName: member.displayName,
            role: resolveBoardRole(member.role),
            userId: member.id,
          }, workspace)
          return
        }
        await deleteLocalBoardMember(board.id, member.id, workspace)
      }))
      onSaved()
      onClose()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board assignment update failed.')
    } finally {
      setIsSaving(false)
    }
  }
}

function resolveBoardRole(role: WorkspaceDashboardMember['role']): BoardMemberRole {
  if (role === 'viewer') return 'viewer'
  return 'editor'
}
