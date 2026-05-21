import type { MutableRefObject } from 'react'
import type { CanvasBounds } from '@/features/canvas-engine'
import type { BoardRealtimeAwarenessState, BoardRealtimeAwarenessStatus } from '@/features/collaboration/boardRealtimeTransport'
import type { LocalBoardAwarenessState } from '@/features/collaboration/localBoardAwareness'
import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationPresence,
  BoardCollaborationSessionRecord,
  BoardCollaborationSessionsResponse,
  BoardCollaborationShapeOccupancy,
  BoardCollaborationTransformKind,
} from '@/features/boards/boardCollaborationTypes'
import { deriveBoardShapeOccupancy } from '@/features/boards/boardCollaborationPresenceUtils'
import {
  createLocalSessionPresenceSnapshot,
  createRealtimeAwarenessMap,
  mergeRealtimeAwareness,
  patchOptimisticSelfSession,
  sanitizeCollaborationSessions,
} from './boardCollaborationPresenceState'

export type CollaborationStatus = 'error' | 'idle' | 'loading' | 'ready'

export type CollaborationState = {
  activeSessions: BoardCollaborationSessionRecord[]
  boardSavedAt: string | null
  canEdit: boolean
  error: string | null
  permission: BoardCollaborationSessionsResponse['permission'] | null
  roomKey: string | null
  shapeOccupancy: BoardCollaborationShapeOccupancy[]
  status: CollaborationStatus
  transportState: BoardRealtimeAwarenessState
  transportStatus: BoardRealtimeAwarenessStatus
}

const emptyPresenceSnapshot: BoardCollaborationPresence = {
  activePageId: null,
  connectionPreview: null,
  cursor: null,
  draftPreview: null,
  editingShapeIds: [],
  hoveredShapeId: null,
  selectedEdgeId: null,
  selectionBox: null,
  selectionIds: [],
  state: 'idle',
  tool: null,
  transformBox: null,
  transformKind: null,
}

const maxPresenceShapeIds = 50

export function createEmptyPresenceSnapshot(): BoardCollaborationPresence {
  return {
    ...emptyPresenceSnapshot,
    draftPreview: null,
    editingShapeIds: [],
    selectionIds: [],
  }
}

export function createInitialCollaborationState(
  shouldConnect: boolean,
  transportState: BoardRealtimeAwarenessState,
): CollaborationState {
  return {
    activeSessions: [],
    boardSavedAt: null,
    canEdit: true,
    error: null,
    permission: null,
    roomKey: null,
    shapeOccupancy: [],
    status: shouldConnect ? 'loading' : 'idle',
    transportState,
    transportStatus: transportState.status,
  }
}

export function createDisconnectedCollaborationState(
  transportState: BoardRealtimeAwarenessState,
): CollaborationState {
  return {
    activeSessions: [],
    boardSavedAt: null,
    canEdit: true,
    error: null,
    permission: null,
    roomKey: null,
    shapeOccupancy: [],
    status: 'idle',
    transportState,
    transportStatus: transportState.status,
  }
}

export function applyAwarenessStates(
  current: CollaborationState,
  states: LocalBoardAwarenessState[],
  awarenessRef: MutableRefObject<Map<string, LocalBoardAwarenessState>>,
): CollaborationState {
  awarenessRef.current = createRealtimeAwarenessMap(states, current.activeSessions)
  const activeSessions = mergeRealtimeAwareness(current.activeSessions, awarenessRef.current)
  return {
    ...current,
    activeSessions,
    shapeOccupancy: deriveBoardShapeOccupancy(activeSessions, awarenessRef.current),
  }
}

export function applySyncResolvedState(
  current: CollaborationState,
  response: BoardCollaborationSessionsResponse,
  awarenessRef: MutableRefObject<Map<string, LocalBoardAwarenessState>>,
): CollaborationState {
  const publicSessions = sanitizeCollaborationSessions(response.activeSessions).map((session) => (
    session.isSelf
      ? { ...session, presence: createLocalSessionPresenceSnapshot(session.presence) }
      : session
  ))
  awarenessRef.current = createRealtimeAwarenessMap(
    [...awarenessRef.current.values()],
    publicSessions,
  )
  const activeSessions = mergeRealtimeAwareness(publicSessions, awarenessRef.current)
  return {
    ...current,
    activeSessions,
    boardSavedAt: response.boardSavedAt,
    canEdit: response.canEdit,
    error: null,
    permission: response.permission,
    roomKey: response.roomKey,
    shapeOccupancy: deriveBoardShapeOccupancy(activeSessions, awarenessRef.current),
    status: 'ready',
  }
}

export function applyLocalPresenceState(
  current: CollaborationState,
  sessionId: string | null,
  localSessionPresence: BoardCollaborationPresence,
  awarenessRef: MutableRefObject<Map<string, LocalBoardAwarenessState>>,
): CollaborationState {
  const activeSessions = mergeRealtimeAwareness(
    patchOptimisticSelfSession(current.activeSessions, sessionId, localSessionPresence),
    awarenessRef.current,
  )
  if (activeSessions === current.activeSessions) return current
  return {
    ...current,
    activeSessions,
    shapeOccupancy: deriveBoardShapeOccupancy(activeSessions, awarenessRef.current),
  }
}

export function createPresenceSnapshot(input: {
  activePageId: string | null
  connectionPreview: BoardCollaborationConnectionPreview | null
  cursor: BoardCollaborationPresence['cursor']
  draftPreview: BoardCollaborationPresence['draftPreview']
  editingShapeIds: string[]
  hoveredShapeId: string | null
  selectedEdgeId: string | null
  selectedIds: string[]
  selectionBox: CanvasBounds | null
  tool: string | null
  transformBox: CanvasBounds | null
  transformKind: BoardCollaborationTransformKind | null
}): BoardCollaborationPresence {
  return {
    activePageId: input.activePageId,
    connectionPreview: input.connectionPreview,
    cursor: input.cursor,
    draftPreview: input.draftPreview ?? null,
    editingShapeIds: input.editingShapeIds,
    hoveredShapeId: input.hoveredShapeId,
    selectedEdgeId: input.selectedEdgeId,
    selectionBox: input.selectionBox,
    selectionIds: input.selectedIds.slice(0, maxPresenceShapeIds),
    state: derivePresenceState(
      input.tool,
      input.selectedIds,
      input.editingShapeIds,
      input.selectionBox,
      input.selectedEdgeId,
      input.connectionPreview,
      input.draftPreview,
    ),
    tool: input.tool?.trim() ? input.tool.trim() : null,
    transformBox: input.transformBox,
    transformKind: input.transformKind,
  }
}

function derivePresenceState(
  tool: string | null,
  selectedIds: string[],
  editingShapeIds: string[],
  selectionBox: CanvasBounds | null,
  selectedEdgeId: string | null,
  connectionPreview: BoardCollaborationConnectionPreview | null,
  draftPreview: BoardCollaborationPresence['draftPreview'],
) {
  if (editingShapeIds.length > 0) return 'typing' as const
  if (draftPreview) return 'drawing' as const
  if (connectionPreview) return 'selecting' as const
  if (selectionBox) return 'selecting' as const
  if (tool === 'draw') return 'drawing' as const
  if (tool === 'hand') return 'panning' as const
  if (selectedEdgeId) return 'selecting' as const
  if (selectedIds.length > 0) return 'selecting' as const
  return 'viewing' as const
}
