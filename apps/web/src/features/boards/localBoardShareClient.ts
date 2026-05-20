'use client'

import type { BoardShareAccessRole } from './boardTypes'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  type LocalBoardLoadResponse,
  type LocalBoardShareLinkDeleteResponse,
  type LocalBoardShareLinkResolveResponse,
  type LocalBoardShareLinkResponse,
  getBoardApiUrl,
  getBoardAuthHeaders,
  getBoardJsonHeaders,
  hasRemoteBoardApiAccess,
  readBoardApiPayload,
  resolveBoardClientError,
} from './localBoardClientShared'

export type BoardShareLinkCreateOptions = {
  clearPassword?: boolean
  expiresAt?: string | null
  password?: string | null
  regenerate?: boolean
}

export async function loadSharedBoardDocument(shareId: string, password?: string) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/share-links/${encodeURIComponent(shareId)}/board`,
      `/api/boards/local-share-board?shareId=${encodeURIComponent(shareId)}`,
    ),
    { headers: getSharePasswordHeaders(password) },
  )
  const payload = await readBoardApiPayload<LocalBoardLoadResponse>(response) as LocalBoardLoadResponse
  if (!response.ok || !payload.ok || !payload.board) {
    throw new Error(resolveBoardClientError(payload, 'Shared board load failed.'))
  }
  return payload
}

export async function ensureLocalBoardShareLink(
  boardId: string,
  accessRole: BoardShareAccessRole = 'viewer',
  expiresAtOrOptions?: string | null | BoardShareLinkCreateOptions,
  workspace?: TangentWorkspace,
  options?: BoardShareLinkCreateOptions,
) {
  const shareOptions = getBoardShareLinkCreateOptions(expiresAtOrOptions, options)
  const response = await fetch(
    getBoardApiUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/share-link`, '/api/boards/local-share-link'),
    {
      body: JSON.stringify({ accessRole, boardId, ...shareOptions }),
      headers: await getBoardJsonHeaders(workspace),
      method: 'POST',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardShareLinkResponse>(response) as LocalBoardShareLinkResponse
  if (!response.ok || !payload.ok || !payload.shareLink) {
    throw new Error(resolveBoardClientError(payload, 'Board share link failed.'))
  }
  return payload
}

export async function revokeLocalBoardShareLink(boardId: string, shareId: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/${encodeURIComponent(boardId)}/share-link/${encodeURIComponent(shareId)}`,
      '/api/boards/local-share-link',
    ),
    {
      body: hasRemoteBoardApiAccess() ? undefined : JSON.stringify({ boardId, shareId }),
      headers: hasRemoteBoardApiAccess() ? await getBoardAuthHeaders(workspace) : await getBoardJsonHeaders(workspace),
      method: 'DELETE',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardShareLinkDeleteResponse>(response) as LocalBoardShareLinkDeleteResponse
  if (!response.ok || !payload.ok || !payload.shareId) {
    throw new Error(resolveBoardClientError(payload, 'Board share link revoke failed.'))
  }
  return payload
}

export async function resolveLocalBoardShareLink(shareId: string, password?: string) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/share-links/${encodeURIComponent(shareId)}`,
      `/api/boards/local-share-link?shareId=${encodeURIComponent(shareId)}`,
    ),
    { headers: getSharePasswordHeaders(password) },
  )
  const payload = await readBoardApiPayload<LocalBoardShareLinkResolveResponse>(response) as LocalBoardShareLinkResolveResponse
  if (!response.ok || !payload.ok || !payload.shareLink) {
    throw new Error(resolveBoardClientError(payload, 'Board share link resolve failed.'))
  }
  return payload
}

function getSharePasswordHeaders(password?: string): HeadersInit | undefined {
  const trimmed = password?.trim()
  return trimmed ? { 'x-tangent-share-password': trimmed } : undefined
}

function getBoardShareLinkCreateOptions(
  expiresAtOrOptions?: string | null | BoardShareLinkCreateOptions,
  options?: BoardShareLinkCreateOptions,
): BoardShareLinkCreateOptions {
  if (typeof expiresAtOrOptions === 'object' && expiresAtOrOptions !== null) {
    return { ...expiresAtOrOptions, ...options }
  }
  return { ...options, expiresAt: expiresAtOrOptions }
}
