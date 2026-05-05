'use client'

import type {
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

export type LocalBoardSaveResponse = BoardSaveResponse

export type LocalBoardLoadResponse = BoardLoadResponse

export type LocalBoardListResponse = BoardListResponse

export type LocalBoardRenameResponse = BoardRenameResponse

export type LocalBoardDeleteResponse = BoardDeleteResponse
export type LocalBoardSnapshotCreateResponse = BoardSnapshotCreateResponse
export type LocalBoardSnapshotListResponse = BoardSnapshotListResponse
export type LocalBoardSnapshotLoadResponse = BoardSnapshotLoadResponse
export type LocalBoardSnapshotClearResponse = BoardSnapshotClearResponse

export async function saveLocalBoardDocument(input: SerializedBoardSaveInput) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync() : persistenceJsonHeaders()
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/boards') : '/api/boards/local-save',
    {
      body: JSON.stringify(input),
      headers,
      method: 'POST',
    }
  )
  const payload = await response.json() as LocalBoardSaveResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(payload.error || payload.audit?.issues[0]?.message || 'Local board save failed.')
  }
  return payload
}

export async function loadLocalBoardDocument(boardId: string) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync() : persistenceAuthHeaders()
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}`)
      : `/api/boards/local-load?boardId=${encodeURIComponent(boardId)}`,
    { headers }
  )
  const payload = await response.json() as LocalBoardLoadResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(payload.error || 'Local board load failed.')
  }
  return payload
}

export async function listLocalBoardDocuments() {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync() : persistenceAuthHeaders()
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/boards') : '/api/boards/local-list',
    { headers }
  )
  const payload = await response.json() as LocalBoardListResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Local board list failed.')
  }
  return payload
}

export async function renameLocalBoardDocument(boardId: string, title: string) {
  return updateLocalBoardMetadata({ boardId, title })
}

export async function updateLocalBoardMetadata(input: BoardMetadataUpdateInput) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync() : persistenceJsonHeaders()
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
  const payload = await response.json() as LocalBoardRenameResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(payload.error || 'Local board update failed.')
  }
  return payload
}

export async function deleteLocalBoardDocument(boardId: string) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync() : persistenceJsonHeaders()
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
  const payload = await response.json() as LocalBoardDeleteResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Local board delete failed.')
  }
  return payload
}

export async function createBoardSnapshot(input: SerializedBoardSnapshotCreateInput) {
  const headers = hasRemotePersistenceApi() ? await persistenceJsonHeadersAsync() : persistenceJsonHeaders()
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
  const payload = await response.json() as LocalBoardSnapshotCreateResponse
  if (!response.ok || !payload.ok || !payload.snapshot) {
    throw new Error(payload.error || 'Board history failed.')
  }
  return payload
}

export async function listBoardSnapshots(boardId: string) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync() : persistenceAuthHeaders()
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/snapshots`)
      : `/api/boards/local-snapshots?boardId=${encodeURIComponent(boardId)}`,
    { headers }
  )
  const payload = await response.json() as LocalBoardSnapshotListResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Board history list failed.')
  }
  return payload
}

export async function loadBoardSnapshot(boardId: string, snapshotId: string) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync() : persistenceAuthHeaders()
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/snapshots/${encodeURIComponent(snapshotId)}`)
      : `/api/boards/local-snapshot?boardId=${encodeURIComponent(boardId)}&snapshotId=${encodeURIComponent(snapshotId)}`,
    { headers }
  )
  const payload = await response.json() as LocalBoardSnapshotLoadResponse
  if (!response.ok || !payload.ok || !payload.snapshot) {
    throw new Error(payload.error || 'Board history load failed.')
  }
  return payload
}

export async function clearBoardSnapshots(boardId: string) {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync() : persistenceAuthHeaders()
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/snapshots`)
      : `/api/boards/local-snapshots?boardId=${encodeURIComponent(boardId)}`,
    {
      headers,
      method: 'DELETE',
    }
  )
  const payload = await response.json() as LocalBoardSnapshotClearResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Board history clear failed.')
  }
  return payload
}
