'use client'

import type {
  BoardMetadataUpdateInput,
  SerializedBoardSaveInput,
} from './boardTypes'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  loadCachedBoardListResource,
  loadCachedBoardRecordResource,
  primeBoardRecordResource,
  removeBoardFromCaches,
  upsertBoardSummaryInCaches,
} from './boardResourceCache'
import { detectBoardCanvasEngine } from './boardCanvasEngine'
import {
  type BoardRequestOptions,
  type LocalBoardCopyResponse,
  type LocalBoardDeleteResponse,
  type LocalBoardListResponse,
  type LocalBoardLoadResponse,
  type LocalBoardRenameResponse,
  type LocalBoardSaveResponse,
  getBoardApiUrl,
  getBoardAuthHeaders,
  getBoardJsonHeaders,
  hasRemoteBoardApiAccess,
  readBoardApiPayload,
  resolveBoardClientError,
} from './localBoardClientShared'

export async function saveLocalBoardDocument(input: SerializedBoardSaveInput, workspace?: TangentWorkspace) {
  const response = await fetch(getBoardApiUrl('/api/v1/boards', '/api/boards/local-save'), {
    body: JSON.stringify(input),
    headers: await getBoardJsonHeaders(workspace),
    method: 'POST',
  })
  const payload = await readBoardApiPayload<LocalBoardSaveResponse>(response) as LocalBoardSaveResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(resolveBoardClientError(payload, 'Local board save failed.'))
  }
  upsertBoardSummaryInCaches(payload.board, workspace?.id ?? payload.board.workspaceId)
  primeBoardRecordResource({
    ...payload.board,
    document: input.document,
  }, workspace?.id ?? payload.board.workspaceId)
  return payload
}

export async function loadLocalBoardDocument(
  boardId: string,
  workspace?: TangentWorkspace,
  options: BoardRequestOptions = {},
) {
  const board = await loadCachedBoardRecordResource(boardId, workspace?.id, async () => {
    const response = await fetch(
      getBoardApiUrl(
        `/api/v1/boards/${encodeURIComponent(boardId)}`,
        `/api/boards/local-load?boardId=${encodeURIComponent(boardId)}`,
      ),
      { headers: await getBoardAuthHeaders(workspace) },
    )
    const payload = await readBoardApiPayload<LocalBoardLoadResponse>(response) as LocalBoardLoadResponse
    if (!response.ok || !payload.ok || !payload.board) {
      throw new Error(resolveBoardClientError(payload, 'Local board load failed.'))
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
  }, options)
  return { board, ok: true }
}

export async function listLocalBoardDocuments(workspace?: TangentWorkspace, options: BoardRequestOptions = {}) {
  const boards = await loadCachedBoardListResource(workspace?.id, async () => {
    const response = await fetch(getBoardApiUrl('/api/v1/boards', '/api/boards/local-list'), {
      headers: await getBoardAuthHeaders(workspace),
    })
    const payload = await readBoardApiPayload<LocalBoardListResponse>(response) as LocalBoardListResponse
    if (!response.ok || !payload.ok) {
      throw new Error(resolveBoardClientError(payload, 'Local board list failed.'))
    }
    return payload.boards
  }, options)
  return { boards, ok: true }
}

export async function renameLocalBoardDocument(boardId: string, title: string, workspace?: TangentWorkspace) {
  return updateLocalBoardMetadata({ boardId, title }, workspace)
}

export async function updateLocalBoardMetadata(input: BoardMetadataUpdateInput, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(`/api/v1/boards/${encodeURIComponent(input.boardId)}`, '/api/boards/local-update'),
    {
      body: JSON.stringify(input),
      headers: await getBoardJsonHeaders(workspace),
      method: hasRemoteBoardApiAccess() ? 'PATCH' : 'POST',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardRenameResponse>(response) as LocalBoardRenameResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(resolveBoardClientError(payload, 'Local board update failed.'))
  }
  upsertBoardSummaryInCaches(payload.board, workspace?.id ?? payload.board.workspaceId)
  return payload
}

export async function deleteLocalBoardDocument(boardId: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}`, '/api/boards/local-delete'),
    {
      body: hasRemoteBoardApiAccess() ? undefined : JSON.stringify({ boardId }),
      headers: hasRemoteBoardApiAccess() ? await getBoardAuthHeaders(workspace) : await getBoardJsonHeaders(workspace),
      method: hasRemoteBoardApiAccess() ? 'DELETE' : 'POST',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardDeleteResponse>(response) as LocalBoardDeleteResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardClientError(payload, 'Local board delete failed.'))
  }
  removeBoardFromCaches(boardId, workspace?.id)
  return payload
}

export async function copyLocalBoardDocument(boardId: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/copy`, '/api/boards/local-copy'),
    {
      body: hasRemoteBoardApiAccess() ? undefined : JSON.stringify({ boardId }),
      headers: hasRemoteBoardApiAccess() ? await getBoardAuthHeaders(workspace) : await getBoardJsonHeaders(workspace),
      method: 'POST',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardCopyResponse>(response) as LocalBoardCopyResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(resolveBoardClientError(payload, 'Local board copy failed.'))
  }
  upsertBoardSummaryInCaches(payload.board, workspace?.id ?? payload.board.workspaceId)
  return payload
}
