'use client'

import type { BoardDocumentGuardResult } from './boardDocumentGuard'
import type { SerializedBoardDocument } from './boardDocumentSerializer'

export type LocalBoardSaveResponse = {
  audit?: BoardDocumentGuardResult
  board?: {
    byteSize: number
    id: string
    savedAt: string
    title: string
  }
  error?: string
  ok: boolean
}

export type LocalBoardLoadResponse = {
  board?: {
    byteSize: number
    document: unknown
    id: string
    savedAt: string
    title: string
  }
  error?: string
  ok: boolean
}

export async function saveLocalBoardDocument(input: {
  boardId?: string
  document: SerializedBoardDocument
  title?: string
}) {
  const response = await fetch('/api/boards/local-save', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const payload = await response.json() as LocalBoardSaveResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(payload.error || payload.audit?.issues[0]?.message || 'Local board save failed.')
  }
  return payload
}

export async function loadLocalBoardDocument(boardId: string) {
  const response = await fetch(`/api/boards/local-load?boardId=${encodeURIComponent(boardId)}`)
  const payload = await response.json() as LocalBoardLoadResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(payload.error || 'Local board load failed.')
  }
  return payload
}
