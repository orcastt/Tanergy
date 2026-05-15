import * as Y from 'yjs'
import type { BoardRealtimeOutboundQueueState } from './boardRealtimeState'

type RealtimeDocumentUpdateQueueLimits = {
  maxQueuedBytes: number
  maxQueuedCount: number
  maxUpdateBytes: number
}

type RealtimeDocumentUpdateQueueSnapshot = {
  bytes: number
  count: number
  state: BoardRealtimeOutboundQueueState
}

export type QueueRealtimeDocumentUpdateResult =
  | { ok: false; reason: 'update-too-large' }
  | { ok: true; requiresFullState: boolean }

export class RealtimeDocumentUpdateQueue {
  private pendingBytes = 0
  private pendingUpdates: Uint8Array[] = []
  private requiresFullState = false

  constructor(
    private readonly limits: RealtimeDocumentUpdateQueueLimits,
    private readonly onSnapshotChange: (snapshot: RealtimeDocumentUpdateQueueSnapshot) => void,
  ) {
    this.syncSnapshot('idle')
  }

  get needsFullState() {
    return this.requiresFullState
  }

  clear() {
    this.pendingBytes = 0
    this.pendingUpdates = []
    this.requiresFullState = false
    this.syncSnapshot('idle')
  }

  queue(update: Uint8Array): QueueRealtimeDocumentUpdateResult {
    if (update.byteLength > this.limits.maxUpdateBytes) {
      return { ok: false, reason: 'update-too-large' }
    }
    this.pendingUpdates.push(update)
    this.pendingBytes += update.byteLength
    this.compactSendableUpdates()
    if (
      this.pendingUpdates.length > this.limits.maxQueuedCount
      || this.pendingBytes > this.limits.maxQueuedBytes
    ) {
      this.requiresFullState = true
      this.compactForMemory()
    }
    this.syncSnapshot('queued')
    return { ok: true, requiresFullState: this.requiresFullState }
  }

  flush(sendUpdate: (update: Uint8Array) => boolean) {
    if (this.pendingUpdates.length === 0) return false
    this.compactSendableUpdates()
    this.syncSnapshot('flushing')
    const pending = [...this.pendingUpdates]
    let sentCount = 0
    let sentBytes = 0
    for (const update of pending) {
      if (update.byteLength > this.limits.maxUpdateBytes) break
      if (!sendUpdate(update)) break
      sentCount += 1
      sentBytes += update.byteLength
    }
    if (sentCount === 0) {
      this.syncSnapshot('queued')
      return false
    }
    this.pendingUpdates = this.pendingUpdates.slice(sentCount)
    this.pendingBytes = Math.max(0, this.pendingBytes - sentBytes)
    if (this.pendingUpdates.length === 0) {
      this.pendingBytes = 0
      this.requiresFullState = false
    }
    this.syncSnapshot(this.pendingUpdates.length > 0 ? 'queued' : 'idle')
    return true
  }

  private compactForMemory() {
    if (this.pendingUpdates.length < 2) return
    const merged = Y.mergeUpdates(this.pendingUpdates)
    this.pendingUpdates = [merged]
    this.pendingBytes = merged.byteLength
  }

  private compactSendableUpdates() {
    if (this.pendingUpdates.length < 2) return
    const merged = Y.mergeUpdates(this.pendingUpdates)
    if (merged.byteLength > this.limits.maxUpdateBytes) return
    this.pendingUpdates = [merged]
    this.pendingBytes = merged.byteLength
  }

  private syncSnapshot(state: BoardRealtimeOutboundQueueState) {
    const isIdle = this.pendingUpdates.length === 0
    this.onSnapshotChange({
      bytes: this.pendingBytes,
      count: this.pendingUpdates.length,
      state: isIdle ? 'idle' : state,
    })
  }
}
