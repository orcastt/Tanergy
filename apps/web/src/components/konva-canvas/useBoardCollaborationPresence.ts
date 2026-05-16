'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { distanceBetweenPoints, type CanvasBounds, type CanvasPoint } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  type BoardRealtimeAwarenessState,
  type BoardRealtimeAwarenessStatus,
  createBoardRealtimeClientInstanceId,
} from '@/features/collaboration/boardRealtimeTransport'
import type { LocalBoardAwarenessState } from '@/features/collaboration/localBoardAwareness'
import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationPresence,
  BoardCollaborationSessionRecord,
  BoardCollaborationSessionsResponse,
  BoardCollaborationShapeOccupancy,
  BoardCollaborationTransformKind,
} from '@/features/boards/boardCollaborationTypes'
import {
  deriveBoardShapeOccupancy,
  normalizePresenceShapeId,
  normalizePresenceShapeIds,
} from '@/features/boards/boardCollaborationPresenceUtils'
import {
  areSamePresenceShapeIds,
  createLocalSessionPresenceSnapshot,
  createRealtimeAwarenessMap,
  mergeRealtimeAwareness,
  patchOptimisticSelfSession,
  sanitizeCollaborationSessions,
} from './boardCollaborationPresenceState'
import { useBoardCollaborationSessionSync } from './useBoardCollaborationSessionSync'
import { resolveInitialTransportState, useBoardRealtimeAwareness } from './useBoardRealtimeAwareness'

type UseBoardCollaborationPresenceOptions = {
  activePageId?: string | null
  boardId?: string
  connectionPreview?: BoardCollaborationConnectionPreview | null
  enabled?: boolean
  selectedEdgeId?: string | null
  selectionBox?: CanvasBounds | null
  selectedIds?: string[]
  tool?: string | null
  transformBox?: CanvasBounds | null
  transformKind?: BoardCollaborationTransformKind | null
  workspace?: TangentWorkspace
}

type CollaborationStatus = 'error' | 'idle' | 'loading' | 'ready'

type CollaborationState = {
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

const cursorSyncDistance = 10

export function useBoardCollaborationPresence({
  activePageId = null,
  boardId,
  connectionPreview = null,
  enabled = true,
  selectedEdgeId = null,
  selectionBox = null,
  selectedIds = [],
  tool = null,
  transformBox = null,
  transformKind = null,
  workspace,
}: UseBoardCollaborationPresenceOptions) {
  const [clientInstanceId] = useState(createBoardRealtimeClientInstanceId)
  const shouldConnect = enabled && Boolean(boardId && workspace?.id)
  const [state, setState] = useState<CollaborationState>({
    activeSessions: [],
    boardSavedAt: null,
    canEdit: true,
    error: null,
    permission: null,
    roomKey: null,
    shapeOccupancy: [],
    status: enabled && boardId && workspace ? 'loading' : 'idle',
    transportState: resolveInitialTransportState(shouldConnect, boardId),
    transportStatus: resolveInitialTransportState(shouldConnect, boardId).status,
  })
  const latestCursorRef = useRef<BoardCollaborationPresence['cursor']>(null)
  const latestEditingShapeIdsRef = useRef<string[]>([])
  const latestHoveredShapeIdRef = useRef<string | null>(null)
  const latestPresenceRef = useRef<BoardCollaborationPresence>({
    activePageId: null,
    connectionPreview: null,
    cursor: null,
    editingShapeIds: [],
    hoveredShapeId: null,
    selectedEdgeId: null,
    selectionBox: null,
    selectionIds: [],
    state: 'idle',
    tool: null,
    transformBox: null,
    transformKind: null,
  })
  const realtimeAwarenessRef = useRef<Map<string, LocalBoardAwarenessState>>(new Map())

  const handleAwarenessStates = useCallback((states: LocalBoardAwarenessState[]) => {
    setState((current) => {
      realtimeAwarenessRef.current = createRealtimeAwarenessMap(states, current.activeSessions)
      const activeSessions = mergeRealtimeAwareness(current.activeSessions, realtimeAwarenessRef.current)
      return {
        ...current,
        activeSessions,
        shapeOccupancy: deriveBoardShapeOccupancy(activeSessions, realtimeAwarenessRef.current),
      }
    })
  }, [])

  const handleTransportState = useCallback((nextState: BoardRealtimeAwarenessState) => {
    setState((current) => ({
      ...current,
      transportState: nextState,
      transportStatus: nextState.status,
    }))
  }, [])

  const { clearAwarenessPublishTimer, scheduleAwarenessPresencePublish } = useBoardRealtimeAwareness({
    boardId,
    clientInstanceId,
    initialPresenceRef: latestPresenceRef,
    onAwarenessStates: handleAwarenessStates,
    onTransportState: handleTransportState,
    roomKey: state.roomKey,
    shouldConnect,
    workspace,
  })

  const handleDisconnected = useCallback(() => {
    realtimeAwarenessRef.current.clear()
    const transportState = resolveInitialTransportState(false, boardId)
    setState({
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
    })
  }, [boardId])

  const handleSyncError = useCallback((error: unknown) => {
    setState((current) => ({
      ...current,
      error: error instanceof Error ? error.message : 'Board presence failed to load.',
      status: current.activeSessions.length > 0 ? 'ready' : 'error',
    }))
  }, [])

  const handleSyncResolved = useCallback((response: BoardCollaborationSessionsResponse) => {
    setState((current) => {
      const publicSessions = sanitizeCollaborationSessions(response.activeSessions).map((session) => (
        session.isSelf
          ? { ...session, presence: createLocalSessionPresenceSnapshot(session.presence) }
          : session
      ))
      realtimeAwarenessRef.current = createRealtimeAwarenessMap(
        [...realtimeAwarenessRef.current.values()],
        publicSessions,
      )
      const activeSessions = mergeRealtimeAwareness(publicSessions, realtimeAwarenessRef.current)
      return {
        ...current,
        activeSessions,
        boardSavedAt: response.boardSavedAt,
        canEdit: response.canEdit,
        error: null,
        permission: response.permission,
        roomKey: response.roomKey,
        shapeOccupancy: deriveBoardShapeOccupancy(activeSessions, realtimeAwarenessRef.current),
        status: 'ready',
      }
    })
  }, [])

  const handleSyncStarted = useCallback((markLoading: boolean) => {
    if (!markLoading) return
    setState((current) => ({
      ...current,
      error: null,
      status: current.activeSessions.length > 0 ? 'ready' : 'loading',
    }))
  }, [])

  const { currentSessionIdRef, schedulePresenceSync } = useBoardCollaborationSessionSync({
    boardId,
    clearAwarenessPublishTimer,
    clientInstanceId,
    latestPresenceRef,
    onDisconnected: handleDisconnected,
    onSyncError: handleSyncError,
    onSyncResolved: handleSyncResolved,
    onSyncStarted: handleSyncStarted,
    shouldConnect,
    workspace,
  })

  useEffect(() => {
    const nextPresence = createPresenceSnapshot({
      activePageId,
      connectionPreview,
      cursor: latestCursorRef.current,
      editingShapeIds: latestEditingShapeIdsRef.current,
      hoveredShapeId: latestHoveredShapeIdRef.current,
      selectedEdgeId,
      selectedIds,
      selectionBox,
      tool,
      transformBox,
      transformKind,
    })
    latestPresenceRef.current = nextPresence
    scheduleAwarenessPresencePublish(nextPresence)
    schedulePresenceSync()
    const localSessionPresence = createLocalSessionPresenceSnapshot(nextPresence)
    setState((current) => {
      const activeSessions = mergeRealtimeAwareness(
        patchOptimisticSelfSession(current.activeSessions, currentSessionIdRef.current, localSessionPresence),
        realtimeAwarenessRef.current,
      )
      return {
        ...current,
        activeSessions,
        shapeOccupancy: deriveBoardShapeOccupancy(activeSessions, realtimeAwarenessRef.current),
      }
    })
  }, [
    activePageId,
    connectionPreview,
    currentSessionIdRef,
    scheduleAwarenessPresencePublish,
    schedulePresenceSync,
    selectedEdgeId,
    selectedIds,
    selectionBox,
    tool,
    transformBox,
    transformKind,
  ])

  const applyLocalPresencePatch = useCallback((patch: Partial<BoardCollaborationPresence>) => {
    latestPresenceRef.current = {
      ...latestPresenceRef.current,
      ...patch,
    }
    const localSessionPresence = createLocalSessionPresenceSnapshot(latestPresenceRef.current)
    setState((current) => {
      const activeSessions = mergeRealtimeAwareness(
        patchOptimisticSelfSession(
          current.activeSessions,
          currentSessionIdRef.current,
          localSessionPresence,
        ),
        realtimeAwarenessRef.current,
      )
      return {
        ...current,
        activeSessions,
        shapeOccupancy: deriveBoardShapeOccupancy(activeSessions, realtimeAwarenessRef.current),
      }
    })
    scheduleAwarenessPresencePublish(latestPresenceRef.current)
    schedulePresenceSync()
  }, [currentSessionIdRef, scheduleAwarenessPresencePublish, schedulePresenceSync])

  const setCursor = useCallback((point: CanvasPoint | null) => {
    if (!shouldConnect) return
    const nextCursor = point
      ? {
          x: Math.round(point.x * 1000) / 1000,
          y: Math.round(point.y * 1000) / 1000,
        }
      : null
    const currentCursor = latestCursorRef.current
    if (
      currentCursor
      && nextCursor
      && distanceBetweenPoints(currentCursor, nextCursor) < cursorSyncDistance
    ) {
      return
    }
    if (!currentCursor && !nextCursor) return
    latestCursorRef.current = nextCursor
    applyLocalPresencePatch({ cursor: nextCursor })
  }, [applyLocalPresencePatch, shouldConnect])

  const setHoveredShapeId = useCallback((shapeId: string | null) => {
    if (!shouldConnect) return
    const nextHoveredShapeId = normalizePresenceShapeId(shapeId)
    if (latestHoveredShapeIdRef.current === nextHoveredShapeId) return
    latestHoveredShapeIdRef.current = nextHoveredShapeId
    applyLocalPresencePatch({ hoveredShapeId: nextHoveredShapeId })
  }, [applyLocalPresencePatch, shouldConnect])

  const setEditingShapeIds = useCallback((shapeIds: string[]) => {
    if (!shouldConnect) return
    const nextEditingShapeIds = normalizePresenceShapeIds(shapeIds)
    if (areSamePresenceShapeIds(latestEditingShapeIdsRef.current, nextEditingShapeIds)) return
    latestEditingShapeIdsRef.current = nextEditingShapeIds
    applyLocalPresencePatch({ editingShapeIds: nextEditingShapeIds })
  }, [applyLocalPresencePatch, shouldConnect])

  return {
    ...state,
    activeCount: state.activeSessions.length,
    clientInstanceId,
    otherSessions: state.activeSessions.filter((session) => !session.isSelf),
    setCursor,
    setEditingShapeIds,
    setHoveredShapeId,
  }
}

function derivePresenceState(
  tool: string | null,
  selectedIds: string[],
  editingShapeIds: string[],
  selectionBox: CanvasBounds | null,
  selectedEdgeId: string | null,
  connectionPreview: BoardCollaborationConnectionPreview | null,
) {
  if (editingShapeIds.length > 0) return 'typing' as const
  if (connectionPreview) return 'selecting' as const
  if (selectionBox) return 'selecting' as const
  if (tool === 'draw') return 'drawing' as const
  if (tool === 'hand') return 'panning' as const
  if (selectedEdgeId) return 'selecting' as const
  if (selectedIds.length > 0) return 'selecting' as const
  return 'viewing' as const
}

function createPresenceSnapshot(input: {
  activePageId: string | null
  connectionPreview: BoardCollaborationConnectionPreview | null
  cursor: BoardCollaborationPresence['cursor']
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
    editingShapeIds: input.editingShapeIds,
    hoveredShapeId: input.hoveredShapeId,
    selectedEdgeId: input.selectedEdgeId,
    selectionBox: input.selectionBox,
    selectionIds: input.selectedIds.slice(0, 12),
    state: derivePresenceState(
      input.tool,
      input.selectedIds,
      input.editingShapeIds,
      input.selectionBox,
      input.selectedEdgeId,
      input.connectionPreview,
    ),
    tool: input.tool?.trim() ? input.tool.trim() : null,
    transformBox: input.transformBox,
    transformKind: input.transformKind,
  }
}
