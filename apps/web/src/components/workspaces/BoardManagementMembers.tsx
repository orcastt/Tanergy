'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import {
  boardMemberRoleValues,
  type BoardMemberCandidateRecord,
  type BoardMemberRecord,
  type BoardMemberRole,
  type BoardPersistenceSummary,
} from '@/features/boards/boardTypes'
import {
  createLocalBoardMember,
  deleteLocalBoardMember,
  inviteLocalBoardMemberByEmail,
  listLocalBoardMembers,
  searchLocalBoardMemberCandidates,
  updateLocalBoardMember,
} from '@/features/boards/localBoardClient'
import {
  buildDraftMap,
  formatJoinedAt,
  formatWorkspaceRole,
  getInitials,
  getRoleLabel,
  isLikelyEmail,
  sortMembers,
  upsertMember,
} from './boardMemberUtils'

type BoardManagementMembersProps = {
  board: BoardPersistenceSummary
  canManageBoard: boolean
  disabled: boolean
  workspace?: TangentWorkspace
}

type MemberDraft = {
  displayName: string
  role: BoardMemberRole
}

const editableRoleValues = boardMemberRoleValues.filter((role) => role !== 'owner')
const ownerRoleValue: BoardMemberRole[] = ['owner']

export function BoardManagementMembers({ board, canManageBoard, disabled, workspace }: BoardManagementMembersProps) {
  const { session } = useTangentSession()
  const [createRole, setCreateRole] = useState<BoardMemberRole>('viewer')
  const [inviteDisplayName, setInviteDisplayName] = useState('')
  const [lookupCandidates, setLookupCandidates] = useState<BoardMemberCandidateRecord[]>([])
  const [lookupQuery, setLookupQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, MemberDraft>>({})
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [members, setMembers] = useState<BoardMemberRecord[]>([])
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadMembers = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await listLocalBoardMembers(board.id, workspace)
        if (cancelled) return
        const nextMembers = sortMembers(response.members, board.ownerId)
        setMembers(nextMembers)
        setDrafts(buildDraftMap(nextMembers))
      } catch (nextError) {
        if (cancelled) return
        setMembers([])
        setDrafts({})
        setError(nextError instanceof Error ? nextError.message : 'Board member list failed.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadMembers()
    return () => {
      cancelled = true
    }
  }, [board.id, board.ownerId, workspace])

  useEffect(() => {
    if (!canManageBoard) return
    const normalizedQuery = lookupQuery.trim()
    if (!normalizedQuery) return

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setIsSearching(true)
      void searchLocalBoardMemberCandidates(board.id, normalizedQuery, workspace)
        .then((response) => {
          if (cancelled) return
          setLookupCandidates(response.candidates)
        })
        .catch((nextError) => {
          if (cancelled) return
          setLookupCandidates([])
          setError(nextError instanceof Error ? nextError.message : 'Board member lookup failed.')
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false)
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [board.id, canManageBoard, lookupQuery, workspace])

  const readOnly = disabled || !canManageBoard
  const isBusy = isLoading || isCreating || pendingUserId !== null
  const memberCountLabel = useMemo(
    () => `${members.length} ${members.length === 1 ? 'member' : 'members'}`,
    [members.length]
  )

  const inviteByEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly) return
    const normalizedEmail = lookupQuery.trim()
    if (!isLikelyEmail(normalizedEmail)) {
      setError('Enter a valid email to invite.')
      return
    }

    setIsCreating(true)
    setError(null)
    try {
      const response = await inviteLocalBoardMemberByEmail({
        boardId: board.id,
        displayName: inviteDisplayName.trim() || undefined,
        email: normalizedEmail,
        role: createRole,
      }, workspace)
      if (!response.member) throw new Error('Board member create failed.')
      const nextMembers = upsertMember(members, response.member, board.ownerId)
      setMembers(nextMembers)
      setDrafts(buildDraftMap(nextMembers))
      setCreateRole('viewer')
      setInviteDisplayName('')
      setLookupQuery('')
      setLookupCandidates([])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board member create failed.')
    } finally {
      setIsCreating(false)
    }
  }

  const addCandidate = async (candidate: BoardMemberCandidateRecord) => {
    if (readOnly || candidate.alreadyMember) return
    setPendingUserId(candidate.userId)
    setError(null)
    try {
      const response = await createLocalBoardMember({
        boardId: board.id,
        displayName: candidate.displayName ?? undefined,
        role: createRole,
        userId: candidate.userId,
      }, workspace)
      if (!response.member) throw new Error('Board member create failed.')
      const nextMembers = upsertMember(members, response.member, board.ownerId)
      setMembers(nextMembers)
      setDrafts(buildDraftMap(nextMembers))
      setLookupCandidates((current) => current.map((item) => item.userId === candidate.userId
        ? { ...item, alreadyMember: true, boardRole: response.member!.role }
        : item))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board member create failed.')
    } finally {
      setPendingUserId(null)
    }
  }

  const saveMember = async (member: BoardMemberRecord) => {
    const draft = drafts[member.userId]
    if (!draft || readOnly || member.userId === board.ownerId) return

    setPendingUserId(member.userId)
    setError(null)
    try {
      const response = await updateLocalBoardMember({
        boardId: board.id,
        displayName: draft.displayName.trim() || undefined,
        role: draft.role,
        userId: member.userId,
      }, workspace)
      if (!response.member) throw new Error('Board member update failed.')
      const nextMembers = upsertMember(members, response.member, board.ownerId)
      setMembers(nextMembers)
      setDrafts(buildDraftMap(nextMembers))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board member update failed.')
    } finally {
      setPendingUserId(null)
    }
  }

  const removeMember = async (member: BoardMemberRecord) => {
    if (readOnly || member.userId === board.ownerId) return
    setPendingUserId(member.userId)
    setError(null)
    try {
      const response = await deleteLocalBoardMember(board.id, member.userId, workspace)
      setMembers((current) => current.filter((entry) => entry.userId !== response.userId))
      setDrafts((current) => {
        const next = { ...current }
        delete next[member.userId]
        return next
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board member remove failed.')
    } finally {
      setPendingUserId(null)
    }
  }

  const updateDraft = (userId: string, field: keyof MemberDraft) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value
    setDrafts((current) => ({
      ...current,
      [userId]: {
        displayName: field === 'displayName' ? value : current[userId]?.displayName ?? '',
        role: field === 'role' ? value as BoardMemberRole : current[userId]?.role ?? 'viewer',
      },
    }))
  }

  return (
    <section className="board-panel-section">
      <div className="board-panel-section-heading">
        <div>
          <h3>Members</h3>
          <p>{memberCountLabel}</p>
        </div>
      </div>

      {canManageBoard ? (
        <form className="board-panel-member-add" onSubmit={inviteByEmail}>
          <label>
            <span>Search people</span>
            <input
              autoComplete="off"
              disabled={disabled || isCreating}
              id="board-members-lookup"
              maxLength={120}
              onChange={(event) => {
                const nextValue = event.target.value
                setLookupQuery(nextValue)
                if (!nextValue.trim()) {
                  setLookupCandidates([])
                  setIsSearching(false)
                }
              }}
              placeholder="Search name or email"
              value={lookupQuery}
            />
          </label>
          <label>
            <span>Display name</span>
            <input
              disabled={disabled || isCreating}
              maxLength={80}
              onChange={(event) => setInviteDisplayName(event.target.value)}
              placeholder="Optional"
              value={inviteDisplayName}
            />
          </label>
          <label>
            <span>Role</span>
            <select
              className="board-panel-member-role"
              disabled={disabled || isCreating}
              onChange={(event) => setCreateRole(event.target.value as BoardMemberRole)}
              value={createRole}
            >
              {editableRoleValues.map((role) => (
                <option key={role} value={role}>{getRoleLabel(role)}</option>
              ))}
            </select>
          </label>
          <button className="product-button product-button-secondary" disabled={disabled || isCreating || !isLikelyEmail(lookupQuery)} type="submit">
            Invite
          </button>
        </form>
      ) : null}

      {error ? <p className="board-panel-error board-panel-member-status">{error}</p> : null}
      {isLoading ? <p className="board-panel-member-status">Loading members...</p> : null}

      {canManageBoard && !isLoading && lookupQuery.trim() ? (
        <div className="board-panel-members" role="list" aria-label="Workspace people">
          {lookupCandidates.map((candidate) => (
            <div className="board-panel-member" key={candidate.userId} role="listitem">
              <span className="board-panel-avatar">{getInitials(candidate.displayName || candidate.email)}</span>
              <div className="board-panel-member-meta">
                <strong>{candidate.displayName || candidate.email}</strong>
                <span>{candidate.email}</span>
              </div>
              <small>{formatWorkspaceRole(candidate.workspaceRole)}</small>
              <div className="board-panel-member-actions">
                {candidate.alreadyMember ? (
                  <small>{candidate.boardRole ? getRoleLabel(candidate.boardRole) : 'Already added'}</small>
                ) : (
                  <button disabled={readOnly || pendingUserId === candidate.userId} onClick={() => void addCandidate(candidate)} type="button">
                    Add
                  </button>
                )}
              </div>
            </div>
          ))}
          {!lookupCandidates.length ? (
            <p className="board-panel-member-status">
              {isSearching ? 'Searching people...' : isLikelyEmail(lookupQuery) ? 'No workspace match found. You can still invite this email.' : 'No people found.'}
            </p>
          ) : null}
        </div>
      ) : null}

      {!isLoading ? (
        <div className="board-panel-members" role="table" aria-label="Board members">
          {members.map((member) => {
            const draft = drafts[member.userId] ?? { displayName: member.displayName ?? '', role: member.role }
            const memberPending = pendingUserId === member.userId
            const isOwner = member.userId === board.ownerId
            const hasChanges = draft.displayName.trim() !== (member.displayName ?? '') || draft.role !== member.role

            return (
              <div className="board-panel-member" key={member.userId} role="row">
                <span className="board-panel-avatar">{getInitials(member.displayName || member.userId)}</span>
                <div className="board-panel-member-meta">
                  <strong>{member.displayName || member.userId}</strong>
                  <span>
                    {member.email || member.userId}
                    {member.userId === session.user.id ? ' | You' : ''}
                  </span>
                </div>
                <small>{member.workspaceRole ? `${formatWorkspaceRole(member.workspaceRole)} | ${formatJoinedAt(member.joinedAt)}` : formatJoinedAt(member.joinedAt)}</small>
                <label className="board-panel-member-inline">
                  <span className="sr-only">Role</span>
                  <select
                    className="board-panel-member-role"
                    disabled={readOnly || memberPending || isOwner}
                    onChange={updateDraft(member.userId, 'role')}
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
                        onChange={updateDraft(member.userId, 'displayName')}
                        placeholder="Display name"
                        value={draft.displayName}
                      />
                      <button disabled={readOnly || memberPending || isOwner || !hasChanges} onClick={() => void saveMember(member)} type="button">
                        Save
                      </button>
                      <button disabled={readOnly || memberPending || isOwner} onClick={() => void removeMember(member)} type="button">
                        Remove
                      </button>
                    </>
                  ) : (
                    <small>{getRoleLabel(member.role)}</small>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {!isLoading && !members.length ? <p className="board-panel-member-status">No board members yet.</p> : null}
      {canManageBoard && isBusy ? <p className="board-panel-member-status">Saving member changes...</p> : null}
    </section>
  )
}
