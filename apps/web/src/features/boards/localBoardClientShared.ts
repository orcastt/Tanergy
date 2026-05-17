'use client'

import type {
  BoardMemberCandidatesResponse,
  BoardMemberDeleteResponse,
  BoardMemberResponse,
  BoardMembersResponse,
  BoardDeleteResponse,
  BoardListResponse,
  BoardLoadResponse,
  BoardRenameResponse,
  BoardSaveResponse,
  BoardSnapshotClearResponse,
  BoardSnapshotCreateResponse,
  BoardSnapshotListResponse,
  BoardSnapshotLoadResponse,
  BoardShareLinkDeleteResponse,
  BoardShareLinkResolveResponse,
  BoardShareLinkResponse,
} from './boardTypes'
import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeaders,
  persistenceAuthHeadersAsync,
  persistenceJsonHeaders,
  persistenceJsonHeadersAsync,
} from '@/features/api/persistenceApi'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { readBoardApiPayload, resolveBoardApiError } from './localBoardApiErrors'

export type LocalBoardSaveResponse = BoardSaveResponse
export type LocalBoardLoadResponse = BoardLoadResponse
export type LocalBoardListResponse = BoardListResponse
export type LocalBoardRenameResponse = BoardRenameResponse
export type LocalBoardDeleteResponse = BoardDeleteResponse
export type LocalBoardCopyResponse = BoardRenameResponse
export type LocalBoardSnapshotCreateResponse = BoardSnapshotCreateResponse
export type LocalBoardSnapshotListResponse = BoardSnapshotListResponse
export type LocalBoardSnapshotLoadResponse = BoardSnapshotLoadResponse
export type LocalBoardSnapshotClearResponse = BoardSnapshotClearResponse
export type LocalBoardMembersResponse = BoardMembersResponse
export type LocalBoardMemberResponse = BoardMemberResponse
export type LocalBoardMemberDeleteResponse = BoardMemberDeleteResponse
export type LocalBoardMemberCandidatesResponse = BoardMemberCandidatesResponse
export type LocalBoardShareLinkResponse = BoardShareLinkResponse
export type LocalBoardShareLinkDeleteResponse = BoardShareLinkDeleteResponse
export type LocalBoardShareLinkResolveResponse = BoardShareLinkResolveResponse

export type BoardRequestOptions = {
  force?: boolean
}

export function hasRemoteBoardApiAccess() {
  return hasRemotePersistenceApi()
}

export async function getBoardAuthHeaders(workspace?: TangentWorkspace) {
  return hasRemoteBoardApiAccess()
    ? persistenceAuthHeadersAsync(workspace)
    : persistenceAuthHeaders(workspace)
}

export async function getBoardJsonHeaders(workspace?: TangentWorkspace) {
  return hasRemoteBoardApiAccess()
    ? persistenceJsonHeadersAsync(workspace)
    : persistenceJsonHeaders(workspace)
}

export function getBoardApiUrl(remotePath: string, localPath: string) {
  return hasRemoteBoardApiAccess() ? persistenceApiUrl(remotePath) : localPath
}

export function resolveBoardClientError(payload: unknown, fallback: string) {
  return resolveBoardApiError(payload, fallback)
}

export { readBoardApiPayload }
