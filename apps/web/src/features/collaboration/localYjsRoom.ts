'use client'

import * as Y from 'yjs'
import {
  createBoardRealtimeStateMachine,
  createConnectingBoardRealtimeState,
  createUnsupportedBoardRealtimeState,
  type BoardRealtimeConnectionState,
} from './boardRealtimeState'

const initialSyncTimeoutMs = 400
const maxLocalYjsMessageBytes = 512 * 1024

type LocalYjsSyncMessage =
  | { from: string; type: 'sync-request' }
  | { from: string; to: string; type: 'sync-state'; update: number[] }
  | { from: string; type: 'update'; update: number[] }

const remoteYjsOrigin = Symbol('tangent-local-yjs-remote')

export function connectLocalYjsRoom(ydoc: Y.Doc, roomKey: string, clientId = createLocalYjsClientId()) {
  if (typeof BroadcastChannel === 'undefined') {
    const state = createUnsupportedBoardRealtimeState()
    return {
      clientId,
      getState() {
        return state
      },
      subscribe(listener: (state: BoardRealtimeConnectionState) => void) {
        listener(state)
        return () => {}
      },
      transport: 'unsupported' as const,
      disconnect() {},
    }
  }

  const channel = new BroadcastChannel(`tangent:yjs:${roomKey}`)
  const stateMachine = createBoardRealtimeStateMachine(createConnectingBoardRealtimeState())
  let disconnected = false

  const handleDocumentUpdate = (update: Uint8Array, origin: unknown) => {
    if (disconnected) return
    if (origin === remoteYjsOrigin) return
    const updatePayload = createUpdatePayload(update, 'Local Yjs update', stateMachine)
    if (!updatePayload) return
    try {
      channel.postMessage({
        from: clientId,
        type: 'update',
        update: updatePayload,
      } satisfies LocalYjsSyncMessage)
      stateMachine.markActivity()
    } catch (error) {
      stateMachine.markError(error instanceof Error ? error.message : 'Local Yjs broadcast failed.')
    }
  }
  const handleMessage = (event: MessageEvent<LocalYjsSyncMessage>) => {
    if (disconnected) return
    const message = event.data
    if (!message || message.from === clientId) return
    stateMachine.markActivity()
    if (message.type === 'sync-request') {
      const updatePayload = createUpdatePayload(Y.encodeStateAsUpdate(ydoc), 'Local Yjs sync state', stateMachine)
      if (!updatePayload) return
      try {
        channel.postMessage({
          from: clientId,
          to: message.from,
          type: 'sync-state',
          update: updatePayload,
        } satisfies LocalYjsSyncMessage)
        stateMachine.markSynced()
      } catch (error) {
        stateMachine.markError(error instanceof Error ? error.message : 'Local Yjs sync broadcast failed.')
      }
      return
    }
    if (message.type === 'sync-state' && message.to !== clientId) return
    if (message.type !== 'update' && message.type !== 'sync-state') return
    if (!isValidUpdatePayload(message.update)) return
    Y.applyUpdate(ydoc, Uint8Array.from(message.update), remoteYjsOrigin)
    stateMachine.markSynced()
  }
  const handleMessageError = () => {
    stateMachine.markError('Local Yjs broadcast message failed.', { disconnected: true })
  }

  ydoc.on('update', handleDocumentUpdate)
  channel.addEventListener('message', handleMessage)
  channel.addEventListener('messageerror', handleMessageError)
  try {
    channel.postMessage({ from: clientId, type: 'sync-request' } satisfies LocalYjsSyncMessage)
    stateMachine.markActivity()
  } catch (error) {
    stateMachine.markError(error instanceof Error ? error.message : 'Local Yjs sync request failed.')
  }
  const initialSyncTimer = window.setTimeout(() => {
    stateMachine.markSynced()
  }, initialSyncTimeoutMs)

  return {
    clientId,
    getState() {
      return stateMachine.getState()
    },
    subscribe(listener: (state: BoardRealtimeConnectionState) => void) {
      return stateMachine.subscribe(listener)
    },
    transport: 'broadcast-channel' as const,
    disconnect() {
      if (disconnected) return
      disconnected = true
      window.clearTimeout(initialSyncTimer)
      ydoc.off('update', handleDocumentUpdate)
      stateMachine.markDisconnected()
      channel.removeEventListener('message', handleMessage)
      channel.removeEventListener('messageerror', handleMessageError)
      channel.close()
    },
  }
}

export function createLocalYjsClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `yjs_${crypto.randomUUID()}`
  }
  return `yjs_${Date.now().toString(36)}`
}

function createUpdatePayload(
  update: Uint8Array,
  label: string,
  stateMachine: ReturnType<typeof createBoardRealtimeStateMachine>,
) {
  if (update.byteLength > maxLocalYjsMessageBytes) {
    stateMachine.markError(`${label} exceeded the local broadcast limit.`)
    return null
  }
  return Array.from(update)
}

function isValidUpdatePayload(value: unknown) {
  return Array.isArray(value)
    && value.length <= maxLocalYjsMessageBytes
    && value.every((item) => typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 255)
}
