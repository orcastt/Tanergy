'use client'

import type { BoardLoadResponse, BoardSaveResponse, SerializedBoardSaveInput } from './boardTypes'
import { hasRemotePersistenceApi, persistenceApiUrl } from '@/features/api/persistenceApi'

export type LocalBoardSaveResponse = BoardSaveResponse

export type LocalBoardLoadResponse = BoardLoadResponse

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
