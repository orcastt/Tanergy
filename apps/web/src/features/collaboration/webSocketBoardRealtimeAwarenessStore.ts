'use client'

import type { BoardCollaborationPresence } from '@/features/boards/boardCollaborationTypes'
import { sanitizeBoardCollaborationPresence } from '@/features/boards/boardCollaborationPresenceSanitizer'

const awarenessCleanupIntervalMs = 5_000
const maxAwarenessStates = 64

export type AwarenessListener = (states: LocalAwarenessState[]) => void

export type LocalAwarenessState = {
  clientInstanceId: string
  expiresAt: string
  presence: BoardCollaborationPresence
  updatedAt: string
}

export class RealtimeAwarenessStore {
  private cleanupTimer: number | null = null
  private listeners = new Set<AwarenessListener>()
  private localPresence: BoardCollaborationPresence | null = null
  private states = new Map<string, LocalAwarenessState>()

  constructor(private readonly clientInstanceId: string) {}

  clear() {
    this.localPresence = null
    this.listeners.clear()
    this.states.clear()
    this.stopCleanup()
  }

  createLocalPresenceMessage(presence: BoardCollaborationPresence | null) {
    const nextPresence = sanitizeBoardCollaborationPresence(presence)
    this.localPresence = nextPresence
    return {
      state: nextPresence
        ? {
            clientInstanceId: this.clientInstanceId,
            expiresAt: new Date(Date.now() + 35_000).toISOString(),
            presence: nextPresence,
            updatedAt: new Date().toISOString(),
          }
        : null,
      type: 'awareness-state',
    }
  }

  getLocalPresence() {
    return this.localPresence
  }

  getStates() {
    this.pruneExpired(false)
    return [...this.states.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  }

  handleBatch(states: unknown[]) {
    this.states = createAwarenessStateMap(states.filter(isLocalAwarenessState).filter((state) => !isExpiredAwarenessState(state)))
    this.notify()
    return true
  }

  handleRemove(clientInstanceId: unknown) {
    if (typeof clientInstanceId !== 'string') return false
    this.states.delete(clientInstanceId)
    this.notify()
    return true
  }

  handleState(state: unknown) {
    if (!isLocalAwarenessState(state)) return false
    if (isExpiredAwarenessState(state)) {
      this.states.delete(state.clientInstanceId)
    } else {
      rememberAwarenessState(this.states, state)
    }
    this.notify()
    return true
  }

  release() {
    this.stopCleanup()
  }

  retain() {
    if (this.cleanupTimer !== null) return
    this.cleanupTimer = window.setInterval(() => {
      this.pruneExpired()
    }, awarenessCleanupIntervalMs)
  }

  subscribe(listener: AwarenessListener) {
    this.listeners.add(listener)
    listener(this.getStates())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    const snapshot = this.getStates()
    for (const listener of this.listeners) listener(snapshot)
  }

  private pruneExpired(notify = true) {
    const now = Date.now()
    let didChange = false
    for (const [clientInstanceId, state] of this.states.entries()) {
      if (Date.parse(state.expiresAt) > now) continue
      this.states.delete(clientInstanceId)
      didChange = true
    }
    if (didChange && notify) this.notify()
  }

  private stopCleanup() {
    if (this.cleanupTimer === null) return
    window.clearInterval(this.cleanupTimer)
    this.cleanupTimer = null
  }
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
  return new Map(
    states
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, maxAwarenessStates)
      .map((state) => [state.clientInstanceId, state]),
  )
}

function rememberAwarenessState(states: Map<string, LocalAwarenessState>, state: LocalAwarenessState) {
  states.set(state.clientInstanceId, state)
  if (states.size <= maxAwarenessStates) return
  const staleClientIds = [...states.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(maxAwarenessStates)
    .map((item) => item.clientInstanceId)
  for (const clientId of staleClientIds) states.delete(clientId)
}
