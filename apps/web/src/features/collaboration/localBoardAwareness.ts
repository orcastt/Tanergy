'use client'

import type { BoardCollaborationPresence } from '@/features/boards/boardCollaborationTypes'
import { sanitizeBoardCollaborationPresence } from '@/features/boards/boardCollaborationPresenceSanitizer'
import {
  createBoardRealtimeStateMachine,
  createConnectingBoardRealtimeState,
  createUnsupportedBoardRealtimeState,
  type BoardRealtimeConnectionState,
} from './boardRealtimeState'

const awarenessTtlMs = 35_000
const cleanupIntervalMs = 5_000
const initialSyncTimeoutMs = 400
const maxAwarenessStates = 64

type AwarenessMessage =
  | { from: string; type: 'awareness-request' }
  | { from: string; to?: string; type: 'awareness-state'; state: LocalBoardAwarenessState | null }
  | { clientId: string; from: string; type: 'awareness-remove' }

export type LocalBoardAwarenessState = {
  clientInstanceId: string
  expiresAt: string
  presence: BoardCollaborationPresence
  updatedAt: string
}

type AwarenessListener = (states: LocalBoardAwarenessState[]) => void
type AwarenessConnectionState = BoardRealtimeConnectionState
type AwarenessStateListener = (state: AwarenessConnectionState) => void

export function connectLocalBoardAwareness(roomKey: string, clientInstanceId: string) {
  if (typeof BroadcastChannel === 'undefined') {
    const state = createUnsupportedBoardRealtimeState()
    return {
      clientId: clientInstanceId,
      disconnect() {},
      getState() {
        return state
      },
      getStates() {
        return [] as LocalBoardAwarenessState[]
      },
      setLocalState(presence: BoardCollaborationPresence | null) {
        void presence
      },
      subscribe(listener: AwarenessListener) {
        void listener
        return () => {}
      },
      subscribeState(listener: AwarenessStateListener) {
        listener(state)
        return () => {}
      },
      transport: 'unsupported' as const,
    }
  }

  const channel = new BroadcastChannel(`tangent:awareness:${roomKey}`)
  const listeners = new Set<AwarenessListener>()
  const states = new Map<string, LocalBoardAwarenessState>()
  let localState: LocalBoardAwarenessState | null = null
  let disconnected = false
  const stateMachine = createBoardRealtimeStateMachine(createConnectingBoardRealtimeState())

  const markReady = () => {
    window.clearTimeout(initialSyncTimer)
    stateMachine.markSynced()
  }

  const notify = () => {
    const snapshot = getActiveStates(states)
    for (const listener of listeners) listener(snapshot)
  }

  const publishLocalState = (target?: string) => {
    if (disconnected) return
    try {
      channel.postMessage({
        from: clientInstanceId,
        to: target,
        type: 'awareness-state',
        state: localState,
      } satisfies AwarenessMessage)
      stateMachine.markActivity()
    } catch (error) {
      stateMachine.markError(error instanceof Error ? error.message : 'Local awareness broadcast failed.')
    }
  }

  const removeState = (nextClientId: string) => {
    if (!states.delete(nextClientId)) return
    notify()
  }

  const cleanupExpiredStates = () => {
    const now = Date.now()
    let didChange = false
    for (const [nextClientId, state] of states.entries()) {
      if (Date.parse(state.expiresAt) > now) continue
      states.delete(nextClientId)
      didChange = true
    }
    if (didChange) notify()
  }

  const handleMessage = (event: MessageEvent<AwarenessMessage>) => {
    if (disconnected) return
    const message = event.data
    if (!message || message.from === clientInstanceId) return
    stateMachine.markActivity()
    markReady()
    if (message.type === 'awareness-request') {
      if (localState) publishLocalState(message.from)
      return
    }
    if (message.type === 'awareness-remove') {
      removeState(message.clientId)
      return
    }
    if (message.type !== 'awareness-state') return
    if (message.to && message.to !== clientInstanceId) return
    if (!message.state || message.state.clientInstanceId === clientInstanceId) {
      removeState(message.from)
      return
    }
    if (Date.parse(message.state.expiresAt) <= Date.now()) {
      removeState(message.state.clientInstanceId)
      return
    }
    const normalizedState = normalizeState(message.state)
    if (!normalizedState) return
    rememberState(states, normalizedState)
    notify()
  }
  const handleMessageError = () => {
    stateMachine.markError('Local awareness message failed.', { disconnected: true })
  }

  channel.addEventListener('message', handleMessage)
  channel.addEventListener('messageerror', handleMessageError)
  try {
    channel.postMessage({ from: clientInstanceId, type: 'awareness-request' } satisfies AwarenessMessage)
    stateMachine.markActivity()
  } catch (error) {
    stateMachine.markError(error instanceof Error ? error.message : 'Local awareness request failed.')
  }
  const cleanupTimer = window.setInterval(cleanupExpiredStates, cleanupIntervalMs)
  const initialSyncTimer = window.setTimeout(() => {
    markReady()
  }, initialSyncTimeoutMs)

  return {
    clientId: clientInstanceId,
    disconnect() {
      if (disconnected) return
      disconnected = true
      window.clearTimeout(initialSyncTimer)
      window.clearInterval(cleanupTimer)
      try {
        channel.postMessage({
          clientId: clientInstanceId,
          from: clientInstanceId,
          type: 'awareness-remove',
        } satisfies AwarenessMessage)
      } catch {}
      stateMachine.markDisconnected()
      channel.removeEventListener('message', handleMessage)
      channel.removeEventListener('messageerror', handleMessageError)
      channel.close()
      listeners.clear()
      states.clear()
      localState = null
    },
    getState() {
      return stateMachine.getState()
    },
    getStates() {
      return getActiveStates(states)
    },
    setLocalState(presence: BoardCollaborationPresence | null) {
      if (disconnected) return
      const nextPresence = sanitizeBoardCollaborationPresence(presence)
      localState = nextPresence
        ? {
            clientInstanceId,
            expiresAt: new Date(Date.now() + awarenessTtlMs).toISOString(),
            presence: nextPresence,
            updatedAt: new Date().toISOString(),
          }
        : null
      publishLocalState()
    },
    subscribe(listener: AwarenessListener) {
      listeners.add(listener)
      listener(getActiveStates(states))
      return () => {
        listeners.delete(listener)
      }
    },
    subscribeState(listener: AwarenessStateListener) {
      return stateMachine.subscribe(listener)
    },
    transport: 'broadcast-channel' as const,
  }
}

function getActiveStates(states: Map<string, LocalBoardAwarenessState>) {
  const now = Date.now()
  return [...states.values()]
    .filter((state) => Date.parse(state.expiresAt) > now)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
}

function rememberState(states: Map<string, LocalBoardAwarenessState>, state: LocalBoardAwarenessState) {
  states.set(state.clientInstanceId, state)
  if (states.size <= maxAwarenessStates) return
  const staleClientIds = [...states.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(maxAwarenessStates)
    .map((item) => item.clientInstanceId)
  for (const clientId of staleClientIds) states.delete(clientId)
}

function normalizeState(state: LocalBoardAwarenessState): LocalBoardAwarenessState | null {
  const presence = sanitizeBoardCollaborationPresence(state.presence)
  if (!presence) return null
  return {
    clientInstanceId: state.clientInstanceId,
    expiresAt: state.expiresAt,
    presence,
    updatedAt: state.updatedAt,
  }
}
