'use client'

import * as Y from 'yjs'
import {
  getPersistenceAuthToken,
  hasRemotePersistenceApi,
  persistenceWebSocketUrl,
} from '@/features/api/persistenceApi'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardCollaborationPresence } from '@/features/boards/boardCollaborationTypes'
import {
  createBoardRealtimeStateMachine,
  createConnectingBoardRealtimeState,
  type BoardRealtimeConnectionState,
} from './boardRealtimeState'
import {
  type AwarenessListener,
  RealtimeAwarenessStore,
} from './webSocketBoardRealtimeAwarenessStore'
import { RealtimeDocumentBridge } from './webSocketBoardRealtimeDocumentBridge'

const websocketRoomRegistry = new Map<string, SharedRealtimeRoom>()
const maxRealtimeInboundMessageChars = 12 * 1024 * 1024
const maxRealtimeSocketBufferedBytes = 1 * 1024 * 1024
const reconnectBaseDelayMs = 600
const reconnectMaxDelayMs = 5_000

export type BoardRealtimeRoomDescriptor = {
  boardId?: string | null
  roomKey: string
}

export type BoardRealtimeSocketOptions = {
  getAuthToken?: () => Promise<null | string>
  workspace?: TangentWorkspace
}

export function hasRemoteBoardRealtimeTransport() {
  return hasRemotePersistenceApi() && typeof WebSocket !== 'undefined'
}

export function getOrCreateSharedRealtimeRoom(
  room: BoardRealtimeRoomDescriptor,
  clientInstanceId: string,
  options: BoardRealtimeSocketOptions,
) {
  const key = `${room.roomKey}::${clientInstanceId}`
  const existing = websocketRoomRegistry.get(key)
  if (existing) return existing
  const created = new SharedRealtimeRoom(room, clientInstanceId, options)
  websocketRoomRegistry.set(key, created)
  return created
}

class SharedRealtimeRoom {
  private readonly awarenessStore: RealtimeAwarenessStore
  private readonly documentBridge: RealtimeDocumentBridge
  private disposed = false
  private reconnectAttempt = 0
  private reconnectTimer: number | null = null
  private refCount = 0
  private socket: WebSocket | null = null
  private socketAttempt = 0
  private readonly stateMachine = createBoardRealtimeStateMachine(createConnectingBoardRealtimeState())

  constructor(
    private readonly room: BoardRealtimeRoomDescriptor,
    private readonly clientInstanceId: string,
    private readonly options: BoardRealtimeSocketOptions,
  ) {
    this.awarenessStore = new RealtimeAwarenessStore(clientInstanceId)
    this.documentBridge = new RealtimeDocumentBridge({
      canSendMessages: () => Boolean(this.socket && this.socket.readyState === WebSocket.OPEN),
      onError: (message) => { this.stateMachine.markError(message) },
      onQueueSnapshotChange: (queue) => { this.stateMachine.markOutboundQueue(queue) },
      sendMessage: (payload) => this.sendMessage(payload),
    })
    void this.openSocket()
  }

  attachYdoc(ydoc: Y.Doc) {
    this.documentBridge.attachYdoc(ydoc)
  }

  detachYdoc(ydoc: Y.Doc) {
    this.documentBridge.detachYdoc(ydoc)
  }

  getAwarenessStates() {
    return this.awarenessStore.getStates()
  }

  getState() {
    return this.stateMachine.getState()
  }

  release() {
    this.refCount = Math.max(0, this.refCount - 1)
    if (this.refCount > 0) return
    this.disposed = true
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.documentBridge.clear()
    this.awarenessStore.clear()
    websocketRoomRegistry.delete(`${this.room.roomKey}::${this.clientInstanceId}`)
  }

  retain() {
    this.disposed = false
    this.refCount += 1
    this.awarenessStore.retain()
  }

  setLocalPresence(presence: BoardCollaborationPresence | null) {
    this.sendMessage(this.awarenessStore.createLocalPresenceMessage(presence))
  }

  subscribeAwareness(listener: AwarenessListener) {
    return this.awarenessStore.subscribe(listener)
  }

  subscribeState(listener: (state: BoardRealtimeConnectionState) => void) {
    return this.stateMachine.subscribe(listener)
  }

  private async openSocket() {
    if (!hasRemoteBoardRealtimeTransport()) {
      this.stateMachine.markError('Realtime websocket transport is unavailable.')
      return
    }
    const attemptId = ++this.socketAttempt
    this.stateMachine.markConnecting()
    try {
      const socketUrl = await createRoomSocketUrl(this.room, this.clientInstanceId, this.options)
      if (this.disposed || this.refCount === 0 || attemptId !== this.socketAttempt) return
      const socket = new WebSocket(socketUrl)
      this.socket = socket
      this.documentBridge.markDisconnected()
      socket.addEventListener('open', () => {
        if (this.socket !== socket || this.disposed) return
        this.reconnectAttempt = 0
        this.stateMachine.markActivity()
        const localPresence = this.awarenessStore.getLocalPresence()
        if (localPresence) this.setLocalPresence(localPresence)
      })
      socket.addEventListener('close', (event) => {
        if (this.socket !== socket) return
        this.socket = null
        this.documentBridge.markDisconnected()
        if (shouldRetryRealtimeClose(event)) {
          this.stateMachine.markDisconnected(event.reason || 'Realtime websocket closed.')
          this.scheduleReconnect()
          return
        }
        this.stateMachine.markError(event.reason || 'Realtime websocket closed.', { disconnected: false })
      })
      socket.addEventListener('error', () => {
        if (this.socket !== socket) return
        this.stateMachine.markError('Realtime websocket error.', { disconnected: true })
      })
      socket.addEventListener('message', (event) => {
        if (this.socket !== socket || this.disposed) return
        this.handleSocketMessage(event.data)
      })
    } catch (error) {
      this.stateMachine.markError(error instanceof Error ? error.message : 'Failed to open realtime websocket.')
      this.scheduleReconnect()
    }
  }

  private handleSocketMessage(raw: unknown) {
    if (typeof raw !== 'string') return
    if (raw.length > maxRealtimeInboundMessageChars) {
      this.stateMachine.markError('Realtime websocket message exceeded the client size limit.', { disconnected: true })
      this.socket?.close(4000, 'Realtime message too large.')
      return
    }
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(raw) as Record<string, unknown>
    } catch {
      this.stateMachine.markError('Realtime websocket message was invalid JSON.')
      return
    }
    this.stateMachine.markActivity()
    if (payload.type === 'sync-state') {
      this.documentBridge.handleSyncState(payload)
      this.stateMachine.markSynced()
      return
    }
    if (payload.type === 'yjs-update') {
      this.documentBridge.handleYjsUpdate(payload)
      this.stateMachine.markSynced()
      return
    }
    if (payload.type === 'sync-state-accepted') {
      this.documentBridge.handleSyncStateAccepted(payload)
      this.stateMachine.markSynced()
      return
    }
    if (payload.type === 'document-compact-request') {
      this.documentBridge.handleCompactRequest(payload)
      return
    }
    if (payload.type === 'awareness-batch') {
      this.awarenessStore.handleBatch(Array.isArray(payload.states) ? payload.states : [])
      this.stateMachine.markSynced()
      return
    }
    if (payload.type === 'awareness-state') {
      if (!this.awarenessStore.handleState(payload.state)) return
      this.stateMachine.markSynced()
      return
    }
    if (payload.type === 'awareness-remove') {
      if (!this.awarenessStore.handleRemove(payload.clientInstanceId)) return
      this.stateMachine.markSynced()
      return
    }
    if (payload.type === 'error' && typeof payload.message === 'string') {
      this.stateMachine.markError(payload.message)
    }
  }

  private scheduleReconnect() {
    if (this.refCount === 0 || this.reconnectTimer !== null) return
    this.documentBridge.markDisconnected()
    const delay = Math.min(reconnectMaxDelayMs, reconnectBaseDelayMs * (2 ** this.reconnectAttempt))
    this.reconnectAttempt += 1
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      void this.openSocket()
    }, delay)
  }

  private sendMessage(payload: Record<string, unknown>) {
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    if (socket.bufferedAmount > maxRealtimeSocketBufferedBytes) {
      this.stateMachine.markError('Realtime websocket backpressure exceeded the send limit.', { disconnected: true })
      socket.close(4000, 'Realtime backpressure.')
      return false
    }
    try {
      socket.send(JSON.stringify(payload))
      this.stateMachine.markActivity()
      return true
    } catch (error) {
      this.stateMachine.markError(error instanceof Error ? error.message : 'Realtime websocket send failed.')
      return false
    }
  }
}

async function createRoomSocketUrl(
  room: BoardRealtimeRoomDescriptor,
  clientInstanceId: string,
  options: BoardRealtimeSocketOptions,
) {
  const boardId = typeof room.boardId === 'string' && room.boardId.trim() ? room.boardId.trim() : null
  if (!boardId) throw new Error('Realtime websocket transport requires a board id.')
  const url = new URL(persistenceWebSocketUrl(`/api/v1/boards/${encodeURIComponent(boardId)}/realtime`))
  url.searchParams.set('clientInstanceId', clientInstanceId)
  url.searchParams.set('roomKey', room.roomKey)
  if (options.workspace) {
    url.searchParams.set('workspaceId', options.workspace.id)
    url.searchParams.set('workspaceKind', options.workspace.kind)
    url.searchParams.set('workspaceName', options.workspace.name)
    url.searchParams.set('workspaceRole', options.workspace.role)
    if (options.workspace.planKey) url.searchParams.set('planKey', options.workspace.planKey)
  }
  const token = await getPersistenceAuthToken({ getAuthToken: options.getAuthToken })
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

function shouldRetryRealtimeClose(event: CloseEvent) {
  if (event.code >= 4400 && event.code < 4500) return false
  return true
}
