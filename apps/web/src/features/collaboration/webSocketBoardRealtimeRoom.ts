'use client'

import * as Y from 'yjs'
import {
  getPersistenceAuthToken,
  hasRemotePersistenceApi,
  persistenceWebSocketUrl,
} from '@/features/api/persistenceApi'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardCollaborationPresence } from '@/features/boards/boardCollaborationTypes'
import { sanitizeBoardCollaborationPresence } from '@/features/boards/boardCollaborationPresenceSanitizer'
import {
  createBoardRealtimeStateMachine,
  createConnectingBoardRealtimeState,
  type BoardRealtimeOutboundQueueState,
  type BoardRealtimeConnectionState,
} from './boardRealtimeState'

const websocketRoomRegistry = new Map<string, SharedRealtimeRoom>()
const remoteYjsOrigin = Symbol('tangent-websocket-yjs-remote')
const awarenessCleanupIntervalMs = 5_000
const maxAwarenessStates = 64
const maxRealtimeUpdateBytes = 256 * 1024
const maxRealtimeInboundMessageChars = 12 * 1024 * 1024
const maxRealtimeSocketBufferedBytes = 1 * 1024 * 1024
const maxQueuedRealtimeUpdateBytes = 2 * 1024 * 1024
const maxQueuedRealtimeUpdateCount = 64
const reconnectBaseDelayMs = 600
const reconnectMaxDelayMs = 5_000

type BoardRealtimeRoomDescriptor = {
  boardId?: string | null
  roomKey: string
}

type BoardRealtimeSocketOptions = {
  getAuthToken?: () => Promise<null | string>
  workspace?: TangentWorkspace
}

type AwarenessListener = (states: LocalAwarenessState[]) => void
type LocalAwarenessState = {
  clientInstanceId: string
  expiresAt: string
  presence: BoardCollaborationPresence
  updatedAt: string
}

export function hasRemoteBoardRealtimeTransport() {
  return hasRemotePersistenceApi() && typeof WebSocket !== 'undefined'
}

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

class SharedRealtimeRoom {
  private awarenessCleanupTimer: number | null = null
  private awarenessListeners = new Set<AwarenessListener>()
  private awarenessStates = new Map<string, LocalAwarenessState>()
  private compactionRequestPending = false
  private disposed = false
  private documentVersion = 0
  private docSubscriptions = new Map<Y.Doc, (update: Uint8Array, origin: unknown) => void>()
  private initialDocumentSyncComplete = false
  private pendingSeedRequest = false
  private pendingDocumentUpdateBytes = 0
  private pendingDocumentUpdates: Uint8Array[] = []
  private localPresence: BoardCollaborationPresence | null = null
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
    void this.openSocket()
  }

  attachYdoc(ydoc: Y.Doc) {
    if (this.docSubscriptions.has(ydoc)) return
    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === remoteYjsOrigin) return
      if (!this.canSendDocumentUpdates()) {
        this.queueDocumentUpdate(update)
        return
      }
      const updatePayload = this.createUpdatePayload(update, 'Realtime update')
      if (!updatePayload) return
      const didSend = this.sendMessage({
        type: 'yjs-update',
        update: updatePayload,
      })
      if (didSend) {
        this.documentVersion += 1
        return
      }
      this.queueDocumentUpdate(update)
    }
    this.docSubscriptions.set(ydoc, handleUpdate)
    ydoc.on('update', handleUpdate)
    this.maybeSendFullState(ydoc)
    this.maybeFlushPendingDocumentUpdates()
  }

  detachYdoc(ydoc: Y.Doc) {
    const handleUpdate = this.docSubscriptions.get(ydoc)
    if (!handleUpdate) return
    ydoc.off('update', handleUpdate)
    this.docSubscriptions.delete(ydoc)
  }

  getAwarenessStates() {
    this.pruneExpiredAwareness(false)
    return [...this.awarenessStates.values()]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  }

  getState() {
    return this.stateMachine.getState()
  }

  release() {
    this.refCount = Math.max(0, this.refCount - 1)
    if (this.refCount > 0) return
    this.disposed = true
    if (this.awarenessCleanupTimer !== null) {
      window.clearInterval(this.awarenessCleanupTimer)
      this.awarenessCleanupTimer = null
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.detachAllYdocs()
    const registryKey = getSharedRoomKey(this.room, this.clientInstanceId)
    websocketRoomRegistry.delete(registryKey)
    this.awarenessStates.clear()
    this.awarenessListeners.clear()
    this.clearPendingDocumentUpdates()
    this.localPresence = null
  }

  retain() {
    this.disposed = false
    this.refCount += 1
    if (this.awarenessCleanupTimer === null) {
      this.awarenessCleanupTimer = window.setInterval(() => {
        this.pruneExpiredAwareness()
      }, awarenessCleanupIntervalMs)
    }
  }

  setLocalPresence(presence: BoardCollaborationPresence | null) {
    const nextPresence = sanitizeBoardCollaborationPresence(presence)
    this.localPresence = nextPresence
    this.sendMessage({
      state: nextPresence
        ? {
            clientInstanceId: this.clientInstanceId,
            expiresAt: new Date(Date.now() + 35_000).toISOString(),
            presence: nextPresence,
            updatedAt: new Date().toISOString(),
          }
        : null,
      type: 'awareness-state',
    })
  }

  subscribeAwareness(listener: AwarenessListener) {
    this.awarenessListeners.add(listener)
    listener(this.getAwarenessStates())
    return () => {
      this.awarenessListeners.delete(listener)
    }
  }

  subscribeState(listener: (state: BoardRealtimeConnectionState) => void) {
    return this.stateMachine.subscribe(listener)
  }

  private applyRemoteUpdate(update: number[]) {
    const payload = Uint8Array.from(update)
    for (const ydoc of this.docSubscriptions.keys()) {
      Y.applyUpdate(ydoc, payload, remoteYjsOrigin)
    }
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
      this.initialDocumentSyncComplete = false
      socket.addEventListener('open', () => {
        if (this.socket !== socket || this.disposed) return
        this.reconnectAttempt = 0
        this.stateMachine.markActivity()
        if (this.localPresence) this.setLocalPresence(this.localPresence)
      })
      socket.addEventListener('close', (event) => {
        if (this.socket !== socket) return
        this.socket = null
        if (shouldRetryRealtimeClose(event)) {
          this.stateMachine.markDisconnected(event.reason || 'Realtime websocket closed.')
          this.scheduleReconnect()
          return
        }
        this.stateMachine.markError(event.reason || 'Realtime websocket closed.', {
          disconnected: false,
        })
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
    const type = payload.type
    if (type === 'sync-state') {
      const updates = Array.isArray(payload.updates) ? payload.updates : []
      for (const update of updates) {
        if (Array.isArray(update) && update.every((item) => typeof item === 'number')) {
          this.applyRemoteUpdate(update as number[])
        }
      }
      this.documentVersion = resolveDocumentVersion(payload.documentVersion, updates.length, this.documentVersion)
      const seedRoom = payload.seedRoom === true
      const requestCompaction = payload.requestCompaction === true
      if (seedRoom) {
        this.pendingSeedRequest = true
      } else {
        this.pendingSeedRequest = false
      }
      this.compactionRequestPending = requestCompaction
      this.initialDocumentSyncComplete = true
      for (const ydoc of this.docSubscriptions.keys()) {
        const didSendFullState = this.maybeSendFullState(ydoc)
        if (!didSendFullState) {
          this.maybeFlushPendingDocumentUpdates()
        }
        break
      }
      this.stateMachine.markSynced()
      return
    }
    if (type === 'yjs-update') {
      const update = payload.update
      if (Array.isArray(update) && update.every((item) => typeof item === 'number')) {
        this.applyRemoteUpdate(update as number[])
        this.documentVersion = resolveDocumentVersion(payload.documentVersion, this.documentVersion + 1, this.documentVersion)
        this.stateMachine.markSynced()
      }
      return
    }
    if (type === 'sync-state-accepted') {
      this.documentVersion = resolveDocumentVersion(payload.documentVersion, this.documentVersion, 0)
      this.pendingSeedRequest = false
      this.compactionRequestPending = false
      this.initialDocumentSyncComplete = true
      this.maybeFlushPendingDocumentUpdates()
      this.stateMachine.markSynced()
      return
    }
    if (type === 'document-compact-request') {
      this.documentVersion = resolveDocumentVersion(payload.documentVersion, this.documentVersion, this.documentVersion)
      this.compactionRequestPending = true
      this.initialDocumentSyncComplete = true
      for (const ydoc of this.docSubscriptions.keys()) {
        const didSendFullState = this.maybeSendFullState(ydoc)
        if (!didSendFullState) {
          this.maybeFlushPendingDocumentUpdates()
        }
        break
      }
      return
    }
    if (type === 'awareness-batch') {
      const states = Array.isArray(payload.states) ? payload.states : []
      this.awarenessStates = createAwarenessStateMap(states
        .filter(isLocalAwarenessState)
        .filter((state) => !isExpiredAwarenessState(state)))
      this.notifyAwareness()
      this.stateMachine.markSynced()
      return
    }
    if (type === 'awareness-state') {
      const state = payload.state
      if (!isLocalAwarenessState(state)) return
      if (isExpiredAwarenessState(state)) {
        this.awarenessStates.delete(state.clientInstanceId)
      } else {
        rememberAwarenessState(this.awarenessStates, state)
      }
      this.notifyAwareness()
      this.stateMachine.markSynced()
      return
    }
    if (type === 'awareness-remove') {
      const clientInstanceId = payload.clientInstanceId
      if (typeof clientInstanceId !== 'string') return
      this.awarenessStates.delete(clientInstanceId)
      this.notifyAwareness()
      this.stateMachine.markSynced()
      return
    }
    if (type === 'error' && typeof payload.message === 'string') {
      this.stateMachine.markError(payload.message)
    }
  }

  private notifyAwareness() {
    const snapshot = this.getAwarenessStates()
    for (const listener of this.awarenessListeners) listener(snapshot)
  }

  private pruneExpiredAwareness(notify = true) {
    const now = Date.now()
    let didChange = false
    for (const [clientInstanceId, state] of this.awarenessStates.entries()) {
      if (Date.parse(state.expiresAt) > now) continue
      this.awarenessStates.delete(clientInstanceId)
      didChange = true
    }
    if (didChange && notify) this.notifyAwareness()
  }

  private detachAllYdocs() {
    for (const [ydoc, handleUpdate] of this.docSubscriptions.entries()) {
      ydoc.off('update', handleUpdate)
    }
    this.docSubscriptions.clear()
  }

  private scheduleReconnect() {
    if (this.refCount === 0 || this.reconnectTimer !== null) return
    this.initialDocumentSyncComplete = false
    const delay = Math.min(reconnectMaxDelayMs, reconnectBaseDelayMs * (2 ** this.reconnectAttempt))
    this.reconnectAttempt += 1
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      void this.openSocket()
    }, delay)
  }

  private sendFullState(ydoc: Y.Doc) {
    const update = this.createUpdatePayload(Y.encodeStateAsUpdate(ydoc), 'Realtime document state')
    if (!update) return false
    return this.sendMessage({
      documentVersion: this.documentVersion,
      type: 'sync-state-publish',
      update,
    })
  }

  private maybeSendFullState(ydoc: Y.Doc) {
    if (!this.pendingSeedRequest && !this.compactionRequestPending) return
    const didSend = this.sendFullState(ydoc)
    if (!didSend) return
    this.pendingSeedRequest = false
    this.compactionRequestPending = false
    this.clearPendingDocumentUpdates()
    return true
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

  private createUpdatePayload(update: Uint8Array, label: string) {
    if (update.byteLength > maxRealtimeUpdateBytes) {
      this.stateMachine.markError(`${label} exceeded the websocket update limit.`)
      return null
    }
    return Array.from(update)
  }

  private canSendDocumentUpdates() {
    const socket = this.socket
    return Boolean(socket && socket.readyState === WebSocket.OPEN && this.initialDocumentSyncComplete)
  }

  private syncPendingDocumentQueueState(state: BoardRealtimeOutboundQueueState = 'queued') {
    const isIdle = this.pendingDocumentUpdates.length === 0
    this.stateMachine.markOutboundQueue({
      bytes: this.pendingDocumentUpdateBytes,
      count: this.pendingDocumentUpdates.length,
      state: isIdle ? 'idle' : state,
    })
  }

  private clearPendingDocumentUpdates() {
    this.pendingDocumentUpdates = []
    this.pendingDocumentUpdateBytes = 0
    this.syncPendingDocumentQueueState('idle')
  }

  private queueDocumentUpdate(update: Uint8Array) {
    if (update.byteLength > maxRealtimeUpdateBytes) {
      this.stateMachine.markError('Realtime update exceeded the websocket update limit.')
      return
    }
    this.pendingDocumentUpdates.push(update)
    this.pendingDocumentUpdateBytes += update.byteLength
    this.compactPendingDocumentUpdates()
    if (
      this.pendingDocumentUpdates.length > maxQueuedRealtimeUpdateCount
      || this.pendingDocumentUpdateBytes > maxQueuedRealtimeUpdateBytes
    ) {
      this.compactionRequestPending = true
      this.compactPendingDocumentUpdates(true)
    }
    this.syncPendingDocumentQueueState('queued')
  }

  private compactPendingDocumentUpdates(force = false) {
    if (this.pendingDocumentUpdates.length < 2) return
    const merged = Y.mergeUpdates(this.pendingDocumentUpdates)
    if (!force && merged.byteLength > maxRealtimeUpdateBytes) return
    this.pendingDocumentUpdates = [merged]
    this.pendingDocumentUpdateBytes = merged.byteLength
  }

  private maybeFlushPendingDocumentUpdates() {
    if (!this.canSendDocumentUpdates() || this.pendingDocumentUpdates.length === 0) return false
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) return false

    this.compactPendingDocumentUpdates()
    this.syncPendingDocumentQueueState('flushing')
    const pending = [...this.pendingDocumentUpdates]
    let sentCount = 0
    let sentBytes = 0
    for (const update of pending) {
      const updatePayload = this.createUpdatePayload(update, 'Queued realtime update')
      if (!updatePayload) break
      const didSend = this.sendMessage({
        type: 'yjs-update',
        update: updatePayload,
      })
      if (!didSend) break
      sentCount += 1
      sentBytes += update.byteLength
      this.documentVersion += 1
    }

    if (sentCount === 0) {
      this.syncPendingDocumentQueueState('queued')
      return false
    }
    this.pendingDocumentUpdates = this.pendingDocumentUpdates.slice(sentCount)
    this.pendingDocumentUpdateBytes = Math.max(0, this.pendingDocumentUpdateBytes - sentBytes)
    if (this.pendingDocumentUpdates.length === 0) this.pendingDocumentUpdateBytes = 0
    this.syncPendingDocumentQueueState(this.pendingDocumentUpdates.length > 0 ? 'queued' : 'idle')
    return true
  }
}

async function createRoomSocketUrl(
  room: BoardRealtimeRoomDescriptor,
  clientInstanceId: string,
  options: BoardRealtimeSocketOptions,
) {
  const boardId = typeof room.boardId === 'string' && room.boardId.trim()
    ? room.boardId.trim()
    : null
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

function getOrCreateSharedRealtimeRoom(
  room: BoardRealtimeRoomDescriptor,
  clientInstanceId: string,
  options: BoardRealtimeSocketOptions,
) {
  const key = getSharedRoomKey(room, clientInstanceId)
  const existing = websocketRoomRegistry.get(key)
  if (existing) return existing
  const created = new SharedRealtimeRoom(room, clientInstanceId, options)
  websocketRoomRegistry.set(key, created)
  return created
}

function getSharedRoomKey(room: BoardRealtimeRoomDescriptor, clientInstanceId: string) {
  return `${room.roomKey}::${clientInstanceId}`
}

function isLocalAwarenessState(value: unknown): value is LocalAwarenessState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as LocalAwarenessState
  return typeof candidate.clientInstanceId === 'string'
    && typeof candidate.expiresAt === 'string'
    && typeof candidate.updatedAt === 'string'
    && Boolean(candidate.presence)
}

function isExpiredAwarenessState(state: LocalAwarenessState) {
  return Date.parse(state.expiresAt) <= Date.now()
}

function createAwarenessStateMap(states: LocalAwarenessState[]) {
  return new Map(states
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, maxAwarenessStates)
    .map((state) => [state.clientInstanceId, state]))
}

function rememberAwarenessState(
  states: Map<string, LocalAwarenessState>,
  state: LocalAwarenessState,
) {
  states.set(state.clientInstanceId, state)
  if (states.size <= maxAwarenessStates) return
  const staleClientIds = [...states.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(maxAwarenessStates)
    .map((item) => item.clientInstanceId)
  for (const clientId of staleClientIds) states.delete(clientId)
}

function resolveDocumentVersion(value: unknown, defaultVersion: number, minimum: number) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return Math.max(value, minimum)
  }
  return Math.max(defaultVersion, minimum)
}

function shouldRetryRealtimeClose(event: CloseEvent) {
  if (event.code >= 4400 && event.code < 4500) return false
  return true
}
