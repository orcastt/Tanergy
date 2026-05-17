'use client'

import type { SerializedKonvaBoardDocument } from '@/features/boards/konvaBoardDocument'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import {
  type BoardRealtimeDocumentState,
  type BoardRealtimeDocumentStatus,
  hasSupportedBoardRealtimeTransport,
} from '@/features/collaboration/boardRealtimeTransport'
import {
  createConnectingBoardRealtimeState,
  createUnsupportedBoardRealtimeState,
} from '@/features/collaboration/boardRealtimeState'
import type { KonvaYjsRoomRecord } from '@/features/collaboration/konvaYjsSnapshot'

export type KonvaLocalYjsSyncStatus = BoardRealtimeDocumentStatus | 'disabled'

export type KonvaLocalYjsRemoteRestoreMeta = Pick<
  KonvaYjsRoomRecord,
  'activePageId' | 'actorId' | 'changedPageIds' | 'mode' | 'publishedAt' | 'signature'
> & {
  basePages: SerializedKonvaBoardPage[] | null
}

export type KonvaLocalYjsRemoteRestorePayload = {
  activePageId?: string
  canvasSettings?: SerializedKonvaBoardDocument['canvasSettings']
  pages: SerializedKonvaBoardPage[]
}

export type KonvaLocalYjsSyncController = {
  applyPendingRemoteSnapshot: () => void
  canRedo: boolean
  canUndo: boolean
  hasPendingRemoteSnapshot: boolean
  hasUnsyncedLocalChanges: boolean
  lastPublishedAt: string | null
  lastRemoteAppliedAt: string | null
  lastRemotePublishedAt: string | null
  pendingRemoteActorId: string | null
  publishLocalSnapshot: () => void
  redoLocalChange: () => void
  status: KonvaLocalYjsSyncStatus
  transportState: BoardRealtimeDocumentState | null
  undoLocalChange: () => void
}

export function createRemoteRestorePayload(record: KonvaYjsRoomRecord): KonvaLocalYjsRemoteRestorePayload {
  return {
    activePageId: record.activePageId,
    canvasSettings: record.canvasSettings,
    pages: record.pages,
  }
}

export function createLocalYjsActorId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `actor_${crypto.randomUUID()}`
  }
  return `actor_${Date.now().toString(36)}`
}

export function createLocalYjsSyncState(
  status: KonvaLocalYjsSyncStatus,
  transportState: BoardRealtimeDocumentState | null,
): KonvaLocalYjsSyncController {
  return {
    applyPendingRemoteSnapshot() {},
    canRedo: false,
    canUndo: false,
    hasPendingRemoteSnapshot: false,
    hasUnsyncedLocalChanges: false,
    lastPublishedAt: null,
    lastRemoteAppliedAt: null,
    lastRemotePublishedAt: null,
    pendingRemoteActorId: null,
    publishLocalSnapshot() {},
    redoLocalChange() {},
    status,
    transportState,
    undoLocalChange() {},
  }
}

export function resolveLocalYjsSyncStatus(
  enabled: boolean,
  roomKey: string | null,
  boardId?: string,
): KonvaLocalYjsSyncStatus {
  if (!enabled || !roomKey) return 'disabled'
  if (!hasSupportedBoardRealtimeTransport(boardId)) return 'unsupported'
  return 'connecting'
}

export function resolveLocalYjsTransportState(
  enabled: boolean,
  roomKey: string | null,
  boardId?: string,
): BoardRealtimeDocumentState | null {
  if (!enabled || !roomKey) return null
  if (!hasSupportedBoardRealtimeTransport(boardId)) return createUnsupportedBoardRealtimeState()
  return createConnectingBoardRealtimeState()
}
