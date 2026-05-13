'use client'

import type {
  BoardMemberCandidatesResponse,
  BoardMemberCreateInput,
  BoardMemberDeleteResponse,
  BoardMemberInviteByEmailInput,
  BoardMemberResponse,
  BoardMembersResponse,
  BoardMemberUpdateInput,
  BoardDeleteResponse,
  BoardListResponse,
  BoardLoadResponse,
  BoardMetadataUpdateInput,
  BoardRenameResponse,
  BoardSaveResponse,
  BoardSnapshotClearResponse,
  BoardSnapshotCreateResponse,
  BoardSnapshotListResponse,
  BoardSnapshotLoadResponse,
  BoardShareLinkDeleteResponse,
  BoardShareLinkResolveResponse,
  BoardShareLinkResponse,
  BoardShareAccessRole,
  SerializedBoardSnapshotCreateInput,
  SerializedBoardSaveInput,
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
import {
  loadCachedBoardListResource,
  loadCachedBoardRecordResource,
  primeBoardRecordResource,
  removeBoardFromCaches,
  upsertBoardSummaryInCaches,
} from './boardResourceCache'
import { detectBoardCanvasEngine } from './boardCanvasEngine'
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

type BoardRequestOptions = {
  force?: boolean
}

export async function saveLocalBoardDocument(input: SerializedBoardSaveInput, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/boards') : '/api/boards/local-save',
    {
      body: JSON.stringify(input),
      headers,
      method: 'POST',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardSaveResponse>(response) as LocalBoardSaveResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(resolveBoardApiError(payload, 'Local board save failed.'))
  }
  upsertBoardSummaryInCaches(payload.board, workspace?.id ?? payload.board.workspaceId)
  primeBoardRecordResource({
    ...payload.board,
    document: input.document,
  }, workspace?.id ?? payload.board.workspaceId)
  return payload
}

export async function loadLocalBoardDocument(boardId: string, workspace?: TangentWorkspace, options: BoardRequestOptions = {}) {
  const board = await loadCachedBoardRecordResource(
    boardId,
    workspace?.id,
    async () => {
      const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceAuthHeaders(workspace)
      const response = await fetch(
        hasRemotePersistenceApi()
          ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}`)
          : `/api/boards/local-load?boardId=${encodeURIComponent(boardId)}`,
        { headers }
      )
      const payload = await readBoardApiPayload<LocalBoardLoadResponse>(response) as LocalBoardLoadResponse
      if (!response.ok || !payload.ok || !payload.board) {
        throw new Error(resolveBoardApiError(payload, 'Local board load failed.'))
      }
      upsertBoardSummaryInCaches({
        assetCount: payload.board.assetCount,
        byteSize: payload.board.byteSize,
        canvasEngine: detectBoardCanvasEngine(payload.board.document),
        cardColor: payload.board.cardColor,
        createdAt: payload.board.createdAt,
        description: payload.board.description,
        id: payload.board.id,
        isPinned: payload.board.isPinned,
        isStarred: payload.board.isStarred,
        lastOpenedAt: payload.board.lastOpenedAt,
        ownerId: payload.board.ownerId,
        savedAt: payload.board.savedAt,
        shapeCount: payload.board.shapeCount,
        shareId: payload.board.shareId,
        thumbnailUrl: payload.board.thumbnailUrl,
        title: payload.board.title,
        visibility: payload.board.visibility,
        workspaceId: payload.board.workspaceId,
      }, workspace?.id ?? payload.board.workspaceId)
      return payload.board
    },
    options,
  )
  return { board, ok: true }
}

export async function loadSharedBoardDocument(shareId: string) {
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/share-links/${encodeURIComponent(shareId)}/board`)
      : `/api/boards/local-share-board?shareId=${encodeURIComponent(shareId)}`
  )
  const payload = await readBoardApiPayload<LocalBoardLoadResponse>(response) as LocalBoardLoadResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(resolveBoardApiError(payload, 'Shared board load failed.'))
  }
  return payload
}

export async function listLocalBoardDocuments(workspace?: TangentWorkspace, options: BoardRequestOptions = {}) {
  const boards = await loadCachedBoardListResource(
    workspace?.id,
    async () => {
      const headers = hasRemotePersistenceApi()
        ? await persistenceAuthHeadersAsync(workspace)
        : persistenceAuthHeaders(workspace)
      const response = await fetch(
        hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/boards') : '/api/boards/local-list',
        { headers }
      )
      const payload = await readBoardApiPayload<LocalBoardListResponse>(response) as LocalBoardListResponse
      if (!response.ok || !payload.ok) {
        throw new Error(resolveBoardApiError(payload, 'Local board list failed.'))
      }
      return payload.boards
    },
    options,
  )
  return { boards, ok: true }
}

export async function renameLocalBoardDocument(boardId: string, title: string, workspace?: TangentWorkspace) {
  return updateLocalBoardMetadata({ boardId, title }, workspace)
}

export async function updateLocalBoardMetadata(input: BoardMetadataUpdateInput, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(input.boardId)}`)
      : '/api/boards/local-update',
    {
      body: JSON.stringify(input),
      headers,
      method: hasRemotePersistenceApi() ? 'PATCH' : 'POST',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardRenameResponse>(response) as LocalBoardRenameResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(resolveBoardApiError(payload, 'Local board update failed.'))
  }
  upsertBoardSummaryInCaches(payload.board, workspace?.id ?? payload.board.workspaceId)
  return payload
}

export async function deleteLocalBoardDocument(boardId: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}`)
      : '/api/boards/local-delete',
    {
      body: hasRemotePersistenceApi() ? undefined : JSON.stringify({ boardId }),
      headers,
      method: hasRemotePersistenceApi() ? 'DELETE' : 'POST',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardDeleteResponse>(response) as LocalBoardDeleteResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardApiError(payload, 'Local board delete failed.'))
  }
  removeBoardFromCaches(boardId, workspace?.id)
  return payload
}

export async function copyLocalBoardDocument(boardId: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/copy`)
      : '/api/boards/local-copy',
    {
      body: hasRemotePersistenceApi() ? undefined : JSON.stringify({ boardId }),
      headers,
      method: 'POST',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardCopyResponse>(response) as LocalBoardCopyResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(resolveBoardApiError(payload, 'Local board copy failed.'))
  }
  upsertBoardSummaryInCaches(payload.board, workspace?.id ?? payload.board.workspaceId)
  return payload
}

export async function listLocalBoardMembers(boardId: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceAuthHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/members`)
      : `/api/boards/local-members?boardId=${encodeURIComponent(boardId)}`,
    { headers }
  )
  const payload = await readBoardApiPayload<LocalBoardMembersResponse>(response) as LocalBoardMembersResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardApiError(payload, 'Board member list failed.'))
  }
  return payload
}

export async function createLocalBoardMember(input: BoardMemberCreateInput, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(input.boardId)}/members`)
      : '/api/boards/local-members',
    {
      body: JSON.stringify(input),
      headers,
      method: 'POST',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardMemberResponse>(response) as LocalBoardMemberResponse
  if (!response.ok || !payload.ok || !payload.member) {
    throw new Error(resolveBoardApiError(payload, 'Board member create failed.'))
  }
  return payload
}

export async function searchLocalBoardMemberCandidates(boardId: string, query: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceAuthHeaders(workspace)
  const url = hasRemotePersistenceApi()
    ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/member-candidates?query=${encodeURIComponent(query)}`)
    : `/api/boards/local-members?boardId=${encodeURIComponent(boardId)}&query=${encodeURIComponent(query)}`
  const response = await fetch(url, { headers })
  const payload = await readBoardApiPayload<LocalBoardMemberCandidatesResponse>(response) as LocalBoardMemberCandidatesResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardApiError(payload, 'Board member lookup failed.'))
  }
  return payload
}

export async function inviteLocalBoardMemberByEmail(input: BoardMemberInviteByEmailInput, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(input.boardId)}/members/invite-by-email`)
      : '/api/boards/local-members',
    {
      body: JSON.stringify(input),
      headers,
      method: 'POST',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardMemberResponse>(response) as LocalBoardMemberResponse
  if (!response.ok || !payload.ok || !payload.member) {
    throw new Error(resolveBoardApiError(payload, 'Board email invite failed.'))
  }
  return payload
}

export async function updateLocalBoardMember(input: BoardMemberUpdateInput, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(input.boardId)}/members/${encodeURIComponent(input.userId)}`)
      : '/api/boards/local-members',
    {
      body: JSON.stringify(input),
      headers,
      method: hasRemotePersistenceApi() ? 'PATCH' : 'PATCH',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardMemberResponse>(response) as LocalBoardMemberResponse
  if (!response.ok || !payload.ok || !payload.member) {
    throw new Error(resolveBoardApiError(payload, 'Board member update failed.'))
  }
  return payload
}

export async function deleteLocalBoardMember(boardId: string, userId: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/members/${encodeURIComponent(userId)}`)
      : '/api/boards/local-members',
    {
      body: hasRemotePersistenceApi() ? undefined : JSON.stringify({ boardId, userId }),
      headers,
      method: 'DELETE',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardMemberDeleteResponse>(response) as LocalBoardMemberDeleteResponse
  if (!response.ok || !payload.ok || !payload.userId) {
    throw new Error(resolveBoardApiError(payload, 'Board member remove failed.'))
  }
  return payload
}

export async function ensureLocalBoardShareLink(
  boardId: string,
  accessRole: BoardShareAccessRole = 'viewer',
  expiresAt?: string | null,
  workspace?: TangentWorkspace
) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/share-link`)
      : '/api/boards/local-share-link',
    {
      body: JSON.stringify({ accessRole, boardId, expiresAt }),
      headers,
      method: 'POST',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardShareLinkResponse>(response) as LocalBoardShareLinkResponse
  if (!response.ok || !payload.ok || !payload.shareLink) {
    throw new Error(resolveBoardApiError(payload, 'Board share link failed.'))
  }
  return payload
}

export async function revokeLocalBoardShareLink(boardId: string, shareId: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/share-link/${encodeURIComponent(shareId)}`)
      : '/api/boards/local-share-link',
    {
      body: hasRemotePersistenceApi() ? undefined : JSON.stringify({ boardId, shareId }),
      headers,
      method: 'DELETE',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardShareLinkDeleteResponse>(response) as LocalBoardShareLinkDeleteResponse
  if (!response.ok || !payload.ok || !payload.shareId) {
    throw new Error(resolveBoardApiError(payload, 'Board share link revoke failed.'))
  }
  return payload
}

export async function resolveLocalBoardShareLink(shareId: string) {
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/share-links/${encodeURIComponent(shareId)}`)
      : `/api/boards/local-share-link?shareId=${encodeURIComponent(shareId)}`
  )
  const payload = await readBoardApiPayload<LocalBoardShareLinkResolveResponse>(response) as LocalBoardShareLinkResolveResponse
  if (!response.ok || !payload.ok || !payload.shareLink) {
    throw new Error(resolveBoardApiError(payload, 'Board share link resolve failed.'))
  }
  return payload
}

export async function createBoardSnapshot(input: SerializedBoardSnapshotCreateInput, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync(workspace) : persistenceJsonHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(input.boardId)}/snapshots`)
      : '/api/boards/local-snapshot',
    {
      body: JSON.stringify(input),
      headers,
      method: 'POST',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardSnapshotCreateResponse>(response) as LocalBoardSnapshotCreateResponse
  if (!response.ok || !payload.ok || !payload.snapshot) {
    throw new Error(resolveBoardApiError(payload, 'Board history failed.'))
  }
  return payload
}

export async function listBoardSnapshots(boardId: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceAuthHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/snapshots`)
      : `/api/boards/local-snapshots?boardId=${encodeURIComponent(boardId)}`,
    { headers }
  )
  const payload = await readBoardApiPayload<LocalBoardSnapshotListResponse>(response) as LocalBoardSnapshotListResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardApiError(payload, 'Board history list failed.'))
  }
  return payload
}

export async function loadBoardSnapshot(boardId: string, snapshotId: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceAuthHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/snapshots/${encodeURIComponent(snapshotId)}`)
      : `/api/boards/local-snapshot?boardId=${encodeURIComponent(boardId)}&snapshotId=${encodeURIComponent(snapshotId)}`,
    { headers }
  )
  const payload = await readBoardApiPayload<LocalBoardSnapshotLoadResponse>(response) as LocalBoardSnapshotLoadResponse
  if (!response.ok || !payload.ok || !payload.snapshot) {
    throw new Error(resolveBoardApiError(payload, 'Board history load failed.'))
  }
  return payload
}

export async function clearBoardSnapshots(boardId: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync(workspace) : persistenceAuthHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/snapshots`)
      : `/api/boards/local-snapshots?boardId=${encodeURIComponent(boardId)}`,
    {
      headers,
      method: 'DELETE',
    }
  )
  const payload = await readBoardApiPayload<LocalBoardSnapshotClearResponse>(response) as LocalBoardSnapshotClearResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardApiError(payload, 'Board history clear failed.'))
  }
  return payload
}
