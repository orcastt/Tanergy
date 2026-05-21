'use client'

import * as Y from 'yjs'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardCollaborationPresence } from '@/features/boards/boardCollaborationTypes'
import type {
  BoardRealtimeConnectionState,
  BoardRealtimeConnectionStatus,
} from './boardRealtimeState'
import {
  connectLocalBoardAwareness,
  type LocalBoardAwarenessState,
} from './localBoardAwareness'
import { connectLocalYjsRoom } from './localYjsRoom'
import {
  connectWebSocketBoardRealtimeAwareness,
  connectWebSocketBoardRealtimeYjsDocument,
  hasRemoteBoardRealtimeTransport,
} from './webSocketBoardRealtimeRoom'

export type BoardRealtimeTransportKind = 'broadcast-channel' | 'websocket' | 'unsupported'
export type BoardRealtimeDocumentStatus = BoardRealtimeConnectionStatus
export type BoardRealtimeAwarenessStatus = BoardRealtimeConnectionStatus

export type BoardRealtimeRoomDescriptor = {
  boardId?: string | null
  roomKey: string
}

export type BoardRealtimeConnectionOptions = {
  getAuthToken?: () => Promise<null | string>
  workspace?: TangentWorkspace
}

export type BoardRealtimeDocumentState = BoardRealtimeConnectionState

export type BoardRealtimeAwarenessConnection = {
  clientId: string
  disconnect: () => void
  getState: () => BoardRealtimeAwarenessState
  getStates: () => LocalBoardAwarenessState[]
  setLocalState: (presence: BoardCollaborationPresence | null) => void
  subscribe: (listener: (states: LocalBoardAwarenessState[]) => void) => () => void
  subscribeState: (listener: (state: BoardRealtimeAwarenessState) => void) => () => void
  transport: BoardRealtimeTransportKind
}

export type BoardRealtimeAwarenessState = BoardRealtimeConnectionState

export type BoardRealtimeDocumentConnection = {
  clientId: string
  disconnect: () => void
  getState: () => BoardRealtimeDocumentState
  subscribe: (listener: (state: BoardRealtimeDocumentState) => void) => () => void
  transport: BoardRealtimeTransportKind
}

export function createBoardRealtimeRoomDescriptor(
  roomKey: string,
  options: { boardId?: string | null } = {},
): BoardRealtimeRoomDescriptor {
  const normalizedBoardId = typeof options.boardId === 'string' && options.boardId.trim()
    ? options.boardId.trim()
    : null
  return {
    boardId: normalizedBoardId,
    roomKey,
  }
}

export function createBoardRealtimeClientInstanceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tab_${crypto.randomUUID()}`
  }
  return `tab_${Date.now().toString(36)}`
}

export function connectBoardRealtimeAwareness(
  room: BoardRealtimeRoomDescriptor,
  clientInstanceId: string,
  options: BoardRealtimeConnectionOptions = {},
): BoardRealtimeAwarenessConnection {
  if (canUseRemoteRealtimeTransport(room)) {
    return connectWebSocketBoardRealtimeAwareness(room, clientInstanceId, options)
  }
  return connectLocalBoardAwareness(room.roomKey, clientInstanceId)
}

export function connectBoardRealtimeYjsDocument(
  ydoc: Y.Doc,
  room: BoardRealtimeRoomDescriptor,
  clientInstanceId: string,
  options: BoardRealtimeConnectionOptions = {},
): BoardRealtimeDocumentConnection {
  if (canUseRemoteRealtimeTransport(room)) {
    return connectWebSocketBoardRealtimeYjsDocument(ydoc, room, clientInstanceId, options)
  }
  return connectLocalYjsRoom(ydoc, room.roomKey, clientInstanceId)
}

export function hasSupportedBoardRealtimeTransport(boardId?: string | null) {
  if (typeof boardId === 'string' && boardId.trim() && hasRemoteBoardRealtimeTransport()) {
    return true
  }
  return typeof BroadcastChannel !== 'undefined'
}

function canUseRemoteRealtimeTransport(room: BoardRealtimeRoomDescriptor) {
  return Boolean(room.boardId && room.boardId.trim()) && hasRemoteBoardRealtimeTransport()
}
