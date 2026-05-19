'use client'

import type { LocalBoardAwarenessState } from '@/features/collaboration/localBoardAwareness'
import {
  getPublicUserInitials,
  getPublicUserLabel,
  isInternalUserId,
} from '@/features/shared/publicUserDisplay'
import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationPresence,
  BoardCollaborationSessionRecord,
} from '@/features/boards/boardCollaborationTypes'

const maxRealtimeAwarenessStates = 64

export function areSamePresenceShapeIds(left: string[], right: string[]) {
  return areSameStringArrays(left, right)
}

export function createLocalSessionPresenceSnapshot(
  presence: BoardCollaborationPresence,
): BoardCollaborationPresence {
  const editingShapeIds = [...(presence.editingShapeIds ?? [])]
  const selectionIds = [...(presence.selectionIds ?? [])]
  const selectedEdgeId = presence.selectedEdgeId ?? null
  const tool = presence.tool?.trim() ? presence.tool.trim() : null
  return {
    activePageId: presence.activePageId ?? null,
    connectionPreview: null,
    cursor: null,
    draftPreview: null,
    editingShapeIds,
    hoveredShapeId: null,
    selectedEdgeId,
    selectionBox: null,
    selectionIds,
    state: deriveLocalSessionState({ editingShapeIds, selectedEdgeId, selectionIds, tool }),
    tool,
    transformBox: null,
    transformKind: null,
  }
}

export function patchOptimisticSelfSession(
  sessions: BoardCollaborationSessionRecord[],
  sessionId: string | null,
  presence: BoardCollaborationPresence,
) {
  if (!sessionId) return sessions
  let changed = false
  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId || !session.isSelf) return session
    if (isSamePresence(session.presence, presence)) return session
    changed = true
    return {
      ...session,
      lastHeartbeatAt: new Date().toISOString(),
      presence,
    }
  })
  return changed ? nextSessions : sessions
}

export function mergeRealtimeAwareness(
  sessions: BoardCollaborationSessionRecord[],
  awarenessStates: Map<string, LocalBoardAwarenessState>,
) {
  if (awarenessStates.size === 0) return sessions
  let changed = false
  const nextSessions = sessions.map((session) => {
    const awareness = awarenessStates.get(session.clientInstanceId)
    if (!awareness || isSamePresence(session.presence, awareness.presence)) return session
    changed = true
    return {
      ...session,
      lastHeartbeatAt: isNewerIsoString(awareness.updatedAt, session.lastHeartbeatAt)
        ? awareness.updatedAt
        : session.lastHeartbeatAt,
      presence: awareness.presence,
    }
  })
  return changed ? nextSessions : sessions
}

export function createRealtimeAwarenessMap(
  states: Iterable<LocalBoardAwarenessState>,
  sessions: BoardCollaborationSessionRecord[],
) {
  const activeClientIds = new Set(sessions.map((session) => session.clientInstanceId))
  return new Map([...states]
    .filter((state) => activeClientIds.has(state.clientInstanceId))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, maxRealtimeAwarenessStates)
    .map((state) => [state.clientInstanceId, state]))
}

export function sanitizeCollaborationSessions(sessions: BoardCollaborationSessionRecord[]) {
  return sessions.map((session) => ({
    ...session,
    avatarInitials: getPublicUserInitials({
      displayName: isDerivedFallbackDisplayName(session.displayName, session.userId) ? undefined : session.displayName,
      fallback: session.isSelf ? 'You' : 'Collaborator',
      userId: session.userId,
    }),
    displayName: getPublicUserLabel({
      displayName: isDerivedFallbackDisplayName(session.displayName, session.userId) ? undefined : session.displayName,
      fallback: session.isSelf ? 'You' : 'Collaborator',
      userId: session.userId,
    }),
  }))
}

export function isSamePresence(left: BoardCollaborationPresence, right: BoardCollaborationPresence) {
  return (
    left.activePageId === right.activePageId
    && isSamePoint(left.cursor ?? null, right.cursor ?? null)
    && isSamePresenceDraft(left.draftPreview ?? null, right.draftPreview ?? null)
    && areSameStringArrays(left.editingShapeIds ?? [], right.editingShapeIds ?? [])
    && left.hoveredShapeId === right.hoveredShapeId
    && isSameConnectionPreview(left.connectionPreview ?? null, right.connectionPreview ?? null)
    && left.selectedEdgeId === right.selectedEdgeId
    && isSameBounds(left.selectionBox ?? null, right.selectionBox ?? null)
    && areSameStringArrays(left.selectionIds ?? [], right.selectionIds ?? [])
    && left.state === right.state
    && left.tool === right.tool
    && isSameBounds(left.transformBox ?? null, right.transformBox ?? null)
    && left.transformKind === right.transformKind
  )
}

function isSamePresenceDraft(
  left: BoardCollaborationPresence['draftPreview'] | null,
  right: BoardCollaborationPresence['draftPreview'] | null,
) {
  if (!left || !right) return left === right
  return JSON.stringify(left) === JSON.stringify(right)
}

function deriveLocalSessionState(input: {
  editingShapeIds: string[]
  selectedEdgeId: string | null
  selectionIds: string[]
  tool: string | null
}): BoardCollaborationPresence['state'] {
  if (input.editingShapeIds.length > 0) return 'typing'
  if (input.selectedEdgeId || input.selectionIds.length > 0) return 'selecting'
  if (input.tool === 'hand') return 'panning'
  if (input.tool === 'draw') return 'drawing'
  return 'viewing'
}

function isSameConnectionPreview(
  left: BoardCollaborationConnectionPreview | null,
  right: BoardCollaborationConnectionPreview | null,
) {
  if (!left || !right) return left === right
  return (
    left.dataType === right.dataType
    && isSamePoint(left.pointer, right.pointer)
    && isSameEndpoint(left.source, right.source)
    && areSameEndpoints(left.sources ?? [], right.sources ?? [])
    && isSameOptionalEndpoint(left.target ?? null, right.target ?? null)
  )
}

function isSameOptionalEndpoint(
  left: BoardCollaborationConnectionPreview['target'],
  right: BoardCollaborationConnectionPreview['target'],
) {
  if (!left || !right) return left === right
  return isSameEndpoint(left, right)
}

function isSameEndpoint(
  left: { portId: string; shapeId: string },
  right: { portId: string; shapeId: string },
) {
  return left.portId === right.portId && left.shapeId === right.shapeId
}

function areSameEndpoints(
  left: Array<{ portId: string; shapeId: string }>,
  right: Array<{ portId: string; shapeId: string }>,
) {
  if (left.length !== right.length) return false
  return left.every((entry, index) => isSameEndpoint(entry, right[index]))
}

function isSamePoint(
  left: { x: number; y: number } | null,
  right: { x: number; y: number } | null,
) {
  if (!left || !right) return left === right
  return left.x === right.x && left.y === right.y
}

function isSameBounds(
  left: { maxX: number; maxY: number; minX: number; minY: number } | null,
  right: { maxX: number; maxY: number; minX: number; minY: number } | null,
) {
  if (!left || !right) return left === right
  return (
    left.maxX === right.maxX
    && left.maxY === right.maxY
    && left.minX === right.minX
    && left.minY === right.minY
  )
}

function areSameStringArrays(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function isNewerIsoString(left: string, right: string) {
  const leftTime = Date.parse(left)
  const rightTime = Date.parse(right)
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return left > right
  return leftTime > rightTime
}

function isDerivedFallbackDisplayName(displayName: string, userId: string) {
  if (!isInternalUserId(userId)) return false
  return normalizeLabel(displayName) === normalizeLabel(
    userId
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' '),
  )
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
