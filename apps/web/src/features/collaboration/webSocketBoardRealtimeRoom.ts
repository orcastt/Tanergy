'use client'

import * as Y from 'yjs'
import type { BoardCollaborationPresence } from '@/features/boards/boardCollaborationTypes'
import type { BoardRealtimeConnectionState } from './boardRealtimeState'
import type { AwarenessListener } from './webSocketBoardRealtimeAwarenessStore'
import {
  type BoardRealtimeRoomDescriptor,
  type BoardRealtimeSocketOptions,
  getOrCreateSharedRealtimeRoom,
} from './webSocketBoardRealtimeSharedRoom'

export { hasRemoteBoardRealtimeTransport } from './webSocketBoardRealtimeSharedRoom'

export function connectWebSocketBoardRealtimeAwareness(
  room: BoardRealtimeRoomDescriptor,
  clientInstanceId: string,
  options: BoardRealtimeSocketOptions = {},
) {
  const sharedRoom = getOrCreateSharedRealtimeRoom(room, clientInstanceId, options)
  sharedRoom.retain()
  let disconnected = false
  return {
    clientId: clientInstanceId,
    disconnect() {
      if (disconnected) return
      disconnected = true
      sharedRoom.setLocalPresence(null)
      sharedRoom.release()
    },
    getState() {
      return sharedRoom.getState()
    },
    getStates() {
      return sharedRoom.getAwarenessStates()
    },
    setLocalState(presence: BoardCollaborationPresence | null) {
      sharedRoom.setLocalPresence(presence)
    },
    subscribe(listener: AwarenessListener) {
      return sharedRoom.subscribeAwareness(listener)
    },
    subscribeState(listener: (state: BoardRealtimeConnectionState) => void) {
      return sharedRoom.subscribeState(listener)
    },
    transport: 'websocket' as const,
  }
}

export function connectWebSocketBoardRealtimeYjsDocument(
  ydoc: Y.Doc,
  room: BoardRealtimeRoomDescriptor,
  clientInstanceId: string,
  options: BoardRealtimeSocketOptions = {},
) {
  const sharedRoom = getOrCreateSharedRealtimeRoom(room, clientInstanceId, options)
  sharedRoom.retain()
  sharedRoom.attachYdoc(ydoc)
  let disconnected = false
  return {
    clientId: clientInstanceId,
    disconnect() {
      if (disconnected) return
      disconnected = true
      sharedRoom.detachYdoc(ydoc)
      sharedRoom.release()
    },
    getState() {
      return sharedRoom.getState()
    },
    subscribe(listener: (state: BoardRealtimeConnectionState) => void) {
      return sharedRoom.subscribeState(listener)
    },
    transport: 'websocket' as const,
  }
}
