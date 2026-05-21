'use client'

import type { SerializedBoardSnapshotCreateInput } from './boardTypes'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  type LocalBoardSnapshotClearResponse,
  type LocalBoardSnapshotCreateResponse,
  type LocalBoardSnapshotListResponse,
  type LocalBoardSnapshotLoadResponse,
  getBoardApiUrl,
  getBoardAuthHeaders,
  getBoardJsonHeaders,
  readBoardApiPayload,
  resolveBoardClientError,
} from './localBoardClientShared'

export async function createBoardSnapshot(input: SerializedBoardSnapshotCreateInput, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(`/api/v1/boards/${encodeURIComponent(input.boardId)}/snapshots`, '/api/boards/local-snapshot'),
    {
      body: JSON.stringify(input),
      headers: await getBoardJsonHeaders(workspace),
      method: 'POST',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardSnapshotCreateResponse>(response) as LocalBoardSnapshotCreateResponse
  if (!response.ok || !payload.ok || !payload.snapshot) {
    throw new Error(resolveBoardClientError(payload, 'Board history failed.'))
  }
  return payload
}

export async function listBoardSnapshots(boardId: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/${encodeURIComponent(boardId)}/snapshots`,
      `/api/boards/local-snapshots?boardId=${encodeURIComponent(boardId)}`,
    ),
    { headers: await getBoardAuthHeaders(workspace) },
  )
  const payload = await readBoardApiPayload<LocalBoardSnapshotListResponse>(response) as LocalBoardSnapshotListResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardClientError(payload, 'Board history list failed.'))
  }
  return payload
}

export async function loadBoardSnapshot(boardId: string, snapshotId: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/${encodeURIComponent(boardId)}/snapshots/${encodeURIComponent(snapshotId)}`,
      `/api/boards/local-snapshot?boardId=${encodeURIComponent(boardId)}&snapshotId=${encodeURIComponent(snapshotId)}`,
    ),
    { headers: await getBoardAuthHeaders(workspace) },
  )
  const payload = await readBoardApiPayload<LocalBoardSnapshotLoadResponse>(response) as LocalBoardSnapshotLoadResponse
  if (!response.ok || !payload.ok || !payload.snapshot) {
    throw new Error(resolveBoardClientError(payload, 'Board history load failed.'))
  }
  return payload
}

export async function clearBoardSnapshots(boardId: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    getBoardApiUrl(
      `/api/v1/boards/${encodeURIComponent(boardId)}/snapshots`,
      `/api/boards/local-snapshots?boardId=${encodeURIComponent(boardId)}`,
    ),
    {
      headers: await getBoardAuthHeaders(workspace),
      method: 'DELETE',
    },
  )
  const payload = await readBoardApiPayload<LocalBoardSnapshotClearResponse>(response) as LocalBoardSnapshotClearResponse
  if (!response.ok || !payload.ok) {
    throw new Error(resolveBoardClientError(payload, 'Board history clear failed.'))
  }
  return payload
}
