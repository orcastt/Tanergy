'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
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
  isLikelyEmail,
  sortMembers,
  upsertMember,
} from './boardMemberUtils'

export type MemberDraft = {
  displayName: string
  role: BoardMemberRole
}

type UseBoardManagementMembersArgs = {
  board: BoardPersistenceSummary
  canManageBoard: boolean
  disabled: boolean
  workspace?: TangentWorkspace
}

const editableRoleValues = boardMemberRoleValues.filter((role) => role !== 'owner')

export function useBoardManagementMembers({
  board,
  canManageBoard,
  disabled,
  workspace,
}: UseBoardManagementMembersArgs) {
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
    [members.length],
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
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
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

  return {
    addCandidate,
    createRole,
    editableRoleValues,
    error,
    inviteByEmail,
    inviteDisplayName,
    isBusy,
    isCreating,
    isLoading,
    isSearching,
    lookupCandidates,
    lookupQuery,
    memberCountLabel,
    members,
    pendingUserId,
    readOnly,
    removeMember,
    saveMember,
    setCreateRole,
    setInviteDisplayName,
    setLookupCandidates,
    setLookupQuery,
    updateDraft,
    drafts,
  }
}
