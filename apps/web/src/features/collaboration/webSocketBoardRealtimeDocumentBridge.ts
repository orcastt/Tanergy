'use client'

import * as Y from 'yjs'
import { createCompactKonvaYjsStateUpdate } from './konvaYjsRoomRecordHelpers'
import {
  decodeRealtimeUpdatePayload,
  encodeRealtimeUpdatePayload,
} from './realtimeUpdatePayload'
import {
  RealtimeDocumentUpdateQueue,
  type RealtimeDocumentUpdateQueueSnapshot,
} from './webSocketBoardRealtimeDocumentQueue'

const maxQueuedRealtimeUpdateBytes = 4 * 1024 * 1024
const maxQueuedRealtimeUpdateCount = 64
const maxRealtimeUpdateBytes = 1024 * 1024
const remoteYjsOrigin = Symbol('tangent-websocket-yjs-remote')

type DocumentBridgeMessage = Record<string, unknown>

type RealtimeDocumentBridgeOptions = {
  canSendMessages: () => boolean
  sendMessage: (payload: DocumentBridgeMessage) => boolean
  onError: (message: string) => void
  onQueueSnapshotChange: (snapshot: RealtimeDocumentUpdateQueueSnapshot) => void
}

export class RealtimeDocumentBridge {
  private compactionRequestPending = false
  private documentVersion = 0
  private readonly docSubscriptions = new Map<Y.Doc, (update: Uint8Array, origin: unknown) => void>()
  private initialDocumentSyncComplete = false
  private pendingSeedRequest = false
  private readonly documentQueue: RealtimeDocumentUpdateQueue

  constructor(private readonly options: RealtimeDocumentBridgeOptions) {
    this.documentQueue = new RealtimeDocumentUpdateQueue({
      maxQueuedBytes: maxQueuedRealtimeUpdateBytes,
      maxQueuedCount: maxQueuedRealtimeUpdateCount,
      maxUpdateBytes: maxRealtimeUpdateBytes,
    }, options.onQueueSnapshotChange)
  }

  attachYdoc(ydoc: Y.Doc) {
    if (this.docSubscriptions.has(ydoc)) return
    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === remoteYjsOrigin) return
      if (!this.canSendDocumentUpdates()) {
        this.queueDocumentUpdate(update, ydoc)
        return
      }
      const updatePayload = this.createUpdatePayload(update, 'Realtime update')
      if (!updatePayload) return
      const didSend = this.options.sendMessage({ type: 'yjs-update', update: updatePayload })
      if (didSend) {
        this.documentVersion += 1
        return
      }
      this.queueDocumentUpdate(update, ydoc)
    }
    this.docSubscriptions.set(ydoc, handleUpdate)
    ydoc.on('update', handleUpdate)
    this.maybeSendFullState(ydoc)
    this.maybeFlushPendingDocumentUpdates(ydoc)
  }

  clear() {
    this.detachAllYdocs()
    this.clearPendingDocumentUpdates()
    this.initialDocumentSyncComplete = false
    this.pendingSeedRequest = false
    this.compactionRequestPending = false
  }

  detachYdoc(ydoc: Y.Doc) {
    const handleUpdate = this.docSubscriptions.get(ydoc)
    if (!handleUpdate) return
    ydoc.off('update', handleUpdate)
    this.docSubscriptions.delete(ydoc)
  }

  handleCompactRequest(payload: Record<string, unknown>) {
    this.documentVersion = resolveDocumentVersion(payload.documentVersion, this.documentVersion, this.documentVersion)
    this.compactionRequestPending = true
    this.initialDocumentSyncComplete = true
    this.syncTransportAfterRoomEvent()
  }

  handleSyncState(payload: Record<string, unknown>) {
    const updates = Array.isArray(payload.updates) ? payload.updates : []
    for (const update of updates) {
      this.applyRemoteUpdate(update)
    }
    this.documentVersion = resolveDocumentVersion(payload.documentVersion, updates.length, this.documentVersion)
    this.pendingSeedRequest = payload.seedRoom === true
    this.compactionRequestPending = payload.requestCompaction === true
    this.initialDocumentSyncComplete = true
    this.syncTransportAfterRoomEvent()
  }

  handleSyncStateAccepted(payload: Record<string, unknown>) {
    this.documentVersion = resolveDocumentVersion(payload.documentVersion, this.documentVersion, 0)
    this.pendingSeedRequest = false
    this.compactionRequestPending = false
    this.initialDocumentSyncComplete = true
    this.syncTransportAfterRoomEvent()
  }

  handleYjsUpdate(payload: Record<string, unknown>) {
    this.applyRemoteUpdate(payload.update)
    this.documentVersion = resolveDocumentVersion(payload.documentVersion, this.documentVersion + 1, this.documentVersion)
  }

  markDisconnected() {
    this.initialDocumentSyncComplete = false
  }

  private applyRemoteUpdate(update: unknown) {
    const payload = decodeRealtimeUpdatePayload(update, maxRealtimeUpdateBytes)
    if (!payload) return
    for (const ydoc of this.docSubscriptions.keys()) {
      Y.applyUpdate(ydoc, payload, remoteYjsOrigin)
    }
  }

  private canSendDocumentUpdates() {
    return this.options.canSendMessages() && this.initialDocumentSyncComplete
  }

  private clearPendingDocumentUpdates() {
    this.documentQueue.clear()
  }

  private createUpdatePayload(update: Uint8Array, label: string) {
    return encodeRealtimeUpdatePayload(update, {
      label,
      maxBytes: maxRealtimeUpdateBytes,
      onError: this.options.onError,
    })
  }

  private detachAllYdocs() {
    for (const [ydoc, handleUpdate] of this.docSubscriptions.entries()) {
      ydoc.off('update', handleUpdate)
    }
    this.docSubscriptions.clear()
  }

  private maybeFlushPendingDocumentUpdates(ydoc?: Y.Doc) {
    if (!this.canSendDocumentUpdates()) return false
    if (ydoc && this.documentQueue.needsFullState) {
      const didSendFullState = this.maybeSendFullState(ydoc)
      if (didSendFullState) return true
    }
    return this.documentQueue.flush((update) => {
      const updatePayload = this.createUpdatePayload(update, 'Queued realtime update')
      if (!updatePayload) return false
      const didSend = this.options.sendMessage({ type: 'yjs-update', update: updatePayload })
      if (didSend) this.documentVersion += 1
      return didSend
    })
  }

  private maybeSendFullState(ydoc: Y.Doc) {
    if (!this.pendingSeedRequest && !this.compactionRequestPending) return false
    const update = this.createUpdatePayload(
      createCompactKonvaYjsStateUpdate(ydoc) ?? Y.encodeStateAsUpdate(ydoc),
      'Realtime document state',
    )
    if (!update) return false
    const didSend = this.options.sendMessage({
      documentVersion: this.documentVersion,
      type: 'sync-state-publish',
      update,
    })
    if (!didSend) return false
    this.pendingSeedRequest = false
    this.compactionRequestPending = false
    this.clearPendingDocumentUpdates()
    return true
  }

  private queueDocumentUpdate(update: Uint8Array, ydoc?: Y.Doc) {
    const result = this.documentQueue.queue(update)
    if (!result.ok) {
      this.options.onError('Realtime update exceeded the websocket update limit.')
      return
    }
    if (!result.requiresFullState || !ydoc) return
    this.compactionRequestPending = true
    const didSendFullState = this.maybeSendFullState(ydoc)
    if (!didSendFullState) this.maybeFlushPendingDocumentUpdates(ydoc)
  }

  private syncTransportAfterRoomEvent() {
    for (const ydoc of this.docSubscriptions.keys()) {
      const didSendFullState = this.maybeSendFullState(ydoc)
      if (!didSendFullState) this.maybeFlushPendingDocumentUpdates(ydoc)
      return
    }
    this.maybeFlushPendingDocumentUpdates()
  }
}

function resolveDocumentVersion(value: unknown, defaultVersion: number, minimum: number) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return Math.max(value, minimum)
  }
  return Math.max(defaultVersion, minimum)
}
