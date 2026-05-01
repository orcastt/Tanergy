'use client'

import type {
  BoardDeleteResponse,
  BoardListResponse,
  BoardLoadResponse,
  BoardRenameResponse,
  BoardSaveResponse,
  SerializedBoardSaveInput,
} from './boardTypes'
import { hasRemotePersistenceApi, persistenceApiUrl } from '@/features/api/persistenceApi'

export type LocalBoardSaveResponse = BoardSaveResponse

export type LocalBoardLoadResponse = BoardLoadResponse

export type LocalBoardListResponse = BoardListResponse

export type LocalBoardRenameResponse = BoardRenameResponse

export type LocalBoardDeleteResponse = BoardDeleteResponse

export async function saveLocalBoardDocument(input: SerializedBoardSaveInput) {
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/boards') : '/api/boards/local-save',
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
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
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}`)
      : `/api/boards/local-load?boardId=${encodeURIComponent(boardId)}`
  )
  const payload = await response.json() as LocalBoardLoadResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(payload.error || 'Local board load failed.')
  }
  return payload
}

export async function listLocalBoardDocuments() {
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/boards') : '/api/boards/local-list'
  )
  const payload = await response.json() as LocalBoardListResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Local board list failed.')
  }
  return payload
}

export async function renameLocalBoardDocument(boardId: string, title: string) {
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}`)
      : '/api/boards/local-rename',
    {
      body: JSON.stringify({ boardId, title }),
      headers: { 'Content-Type': 'application/json' },
      method: hasRemotePersistenceApi() ? 'PATCH' : 'POST',
    }
  )
  const payload = await response.json() as LocalBoardRenameResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(payload.error || 'Local board rename failed.')
  }
  return payload
}

export async function deleteLocalBoardDocument(boardId: string) {
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}`)
      : '/api/boards/local-delete',
    {
      body: hasRemotePersistenceApi() ? undefined : JSON.stringify({ boardId }),
      headers: hasRemotePersistenceApi() ? undefined : { 'Content-Type': 'application/json' },
      method: hasRemotePersistenceApi() ? 'DELETE' : 'POST',
    }
  )
  const payload = await response.json() as LocalBoardDeleteResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Local board delete failed.')
  }
  return payload
}
