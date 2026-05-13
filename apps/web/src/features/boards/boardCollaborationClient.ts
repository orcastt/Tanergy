'use client'

import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeaders,
  persistenceAuthHeadersAsync,
  persistenceJsonHeaders,
  persistenceJsonHeadersAsync,
} from '@/features/api/persistenceApi'
import type {
  BoardCollaborationSessionDeleteResponse,
  BoardCollaborationSessionsResponse,
  BoardCollaborationSessionUpsertInput,
} from './boardCollaborationTypes'
import { sanitizeBoardCollaborationPresence } from './boardCollaborationPresenceSanitizer'
import { readBoardApiPayload, resolveBoardApiError } from './localBoardApiErrors'

export async function claimBoardCollaborationSession(
  boardId: string,
  input: BoardCollaborationSessionUpsertInput,
  workspace?: TangentWorkspace,
  options: { signal?: AbortSignal } = {},
) {
  const headers = hasRemotePersistenceApi()
    ? await persistenceJsonHeadersAsync(workspace)
    : persistenceJsonHeaders(workspace)
  const body = {
    ...input,
    presence: sanitizeBoardCollaborationPresence(input.presence),
  }
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/collaboration/sessions`)
      : '/api/boards/local-collaboration',
    {
      body: JSON.stringify(hasRemotePersistenceApi() ? body : { ...body, boardId }),
      headers,
      method: 'POST',
      signal: options.signal,
    },
  )
  const payload = await readBoardApiPayload<BoardCollaborationSessionsResponse>(response) as BoardCollaborationSessionsResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardApiError(payload, 'Board presence failed to update.'))
  }
  return payload
}

export async function listBoardCollaborationSessions(boardId: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi()
    ? await persistenceAuthHeadersAsync(workspace)
    : persistenceAuthHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/collaboration`)
      : `/api/boards/local-collaboration?boardId=${encodeURIComponent(boardId)}`,
    { headers },
  )
  const payload = await readBoardApiPayload<BoardCollaborationSessionsResponse>(response) as BoardCollaborationSessionsResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardApiError(payload, 'Board presence failed to load.'))
  }
  return payload
}

export async function releaseBoardCollaborationSession(
  boardId: string,
  sessionId: string,
  workspace?: TangentWorkspace,
  options: { signal?: AbortSignal } = {},
) {
  const headers = hasRemotePersistenceApi()
    ? await persistenceAuthHeadersAsync(workspace)
    : persistenceAuthHeaders(workspace)
  const response = await fetch(
    hasRemotePersistenceApi()
      ? persistenceApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/collaboration/sessions/${encodeURIComponent(sessionId)}`)
      : `/api/boards/local-collaboration/sessions/${encodeURIComponent(sessionId)}?boardId=${encodeURIComponent(boardId)}`,
    {
      headers,
      method: 'DELETE',
      signal: options.signal,
    },
  )
  const payload = await readBoardApiPayload<BoardCollaborationSessionDeleteResponse>(response) as BoardCollaborationSessionDeleteResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardApiError(payload, 'Board presence failed to close.'))
  }
  return payload
}
