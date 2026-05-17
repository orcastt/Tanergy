'use client'

import type {
  BoardMemberCreateInput,
  BoardMemberInviteByEmailInput,
  BoardMemberUpdateInput,
} from './boardTypes'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  type LocalBoardMemberCandidatesResponse,
  type LocalBoardMemberDeleteResponse,
  type LocalBoardMemberResponse,
  type LocalBoardMembersResponse,
  getBoardApiUrl,
  getBoardAuthHeaders,
  getBoardJsonHeaders,
  hasRemoteBoardApiAccess,
  readBoardApiPayload,
  resolveBoardClientError,
} from './localBoardClientShared'

export async function listLocalBoardMembers(boardId: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/${encodeURIComponent(boardId)}/members`,
      `/api/boards/local-members?boardId=${encodeURIComponent(boardId)}`,
    ),
    { headers: await getBoardAuthHeaders(workspace) },
  )
  const payload = await readBoardApiPayload<LocalBoardMembersResponse>(response) as LocalBoardMembersResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardClientError(payload, 'Board member list failed.'))
  }
  return payload
}

export async function createLocalBoardMember(input: BoardMemberCreateInput, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(`/api/v1/boards/${encodeURIComponent(input.boardId)}/members`, '/api/boards/local-members'),
    {
      body: JSON.stringify(input),
      headers: await getBoardJsonHeaders(workspace),
      method: 'POST',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardMemberResponse>(response) as LocalBoardMemberResponse
  if (!response.ok || !payload.ok || !payload.member) {
    throw new Error(resolveBoardClientError(payload, 'Board member create failed.'))
  }
  return payload
}

export async function searchLocalBoardMemberCandidates(boardId: string, query: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/${encodeURIComponent(boardId)}/member-candidates?query=${encodeURIComponent(query)}`,
      `/api/boards/local-members?boardId=${encodeURIComponent(boardId)}&query=${encodeURIComponent(query)}`,
    ),
    { headers: await getBoardAuthHeaders(workspace) },
  )
  const payload = await readBoardApiPayload<LocalBoardMemberCandidatesResponse>(response) as LocalBoardMemberCandidatesResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardClientError(payload, 'Board member lookup failed.'))
  }
  return payload
}

export async function inviteLocalBoardMemberByEmail(input: BoardMemberInviteByEmailInput, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/${encodeURIComponent(input.boardId)}/members/invite-by-email`,
      '/api/boards/local-members',
    ),
    {
      body: JSON.stringify(input),
      headers: await getBoardJsonHeaders(workspace),
      method: 'POST',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardMemberResponse>(response) as LocalBoardMemberResponse
  if (!response.ok || !payload.ok || !payload.member) {
    throw new Error(resolveBoardClientError(payload, 'Board email invite failed.'))
  }
  return payload
}

export async function updateLocalBoardMember(input: BoardMemberUpdateInput, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/${encodeURIComponent(input.boardId)}/members/${encodeURIComponent(input.userId)}`,
      '/api/boards/local-members',
    ),
    {
      body: JSON.stringify(input),
      headers: await getBoardJsonHeaders(workspace),
      method: 'PATCH',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardMemberResponse>(response) as LocalBoardMemberResponse
  if (!response.ok || !payload.ok || !payload.member) {
    throw new Error(resolveBoardClientError(payload, 'Board member update failed.'))
  }
  return payload
}

export async function deleteLocalBoardMember(boardId: string, userId: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/${encodeURIComponent(boardId)}/members/${encodeURIComponent(userId)}`,
      '/api/boards/local-members',
    ),
    {
      body: hasRemoteBoardApiAccess() ? undefined : JSON.stringify({ boardId, userId }),
      headers: hasRemoteBoardApiAccess() ? await getBoardAuthHeaders(workspace) : await getBoardJsonHeaders(workspace),
      method: 'DELETE',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardMemberDeleteResponse>(response) as LocalBoardMemberDeleteResponse
  if (!response.ok || !payload.ok || !payload.userId) {
    throw new Error(resolveBoardClientError(payload, 'Board member remove failed.'))
  }
  return payload
}
