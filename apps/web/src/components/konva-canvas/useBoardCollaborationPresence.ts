'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { distanceBetweenPoints, type CanvasBounds, type CanvasPoint } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { getPublicUserInitials, getPublicUserLabel, isInternalUserId } from '@/features/shared/publicUserDisplay'
import {
  type BoardRealtimeAwarenessConnection,
  type BoardRealtimeAwarenessState,
  type BoardRealtimeAwarenessStatus,
  connectBoardRealtimeAwareness,
  createBoardRealtimeClientInstanceId,
  createBoardRealtimeRoomDescriptor,
  hasSupportedBoardRealtimeTransport,
} from '@/features/collaboration/boardRealtimeTransport'
import type { LocalBoardAwarenessState } from '@/features/collaboration/localBoardAwareness'
import {
  createConnectingBoardRealtimeState,
  createUnsupportedBoardRealtimeState,
} from '@/features/collaboration/boardRealtimeState'
import {
  claimBoardCollaborationSession,
  releaseBoardCollaborationSession,
} from '@/features/boards/boardCollaborationClient'
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

const heartbeatIntervalMs = 20_000
const presenceDebounceMs = 600
const awarenessPublishIntervalMs = 80
const cursorSyncDistance = 10
const maxRealtimeAwarenessStates = 64

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
  const currentSessionIdRef = useRef<string | null>(null)
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
  const awarenessConnectionRef = useRef<BoardRealtimeAwarenessConnection | null>(null)
  const realtimeAwarenessRef = useRef<Map<string, LocalBoardAwarenessState>>(new Map())
  const awarenessPublishTimerRef = useRef<number | null>(null)
  const pendingAwarenessPresenceRef = useRef<BoardCollaborationPresence | null>(null)
  const lastAwarenessPublishAtRef = useRef(0)
  const debounceTimerRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)
  const claimControllerRef = useRef<AbortController | null>(null)
  const releaseKeyRef = useRef<string | null>(null)
  const releasedSessionKeyRef = useRef<string | null>(null)
  const presence = useMemo<BoardCollaborationPresence>(() => ({
    activePageId,
    connectionPreview,
    cursor: latestCursorRef.current,
    editingShapeIds: latestEditingShapeIdsRef.current,
    hoveredShapeId: latestHoveredShapeIdRef.current,
    selectedEdgeId,
    selectionBox,
    selectionIds: selectedIds.slice(0, 12),
    state: derivePresenceState(
      tool,
      selectedIds,
      latestEditingShapeIdsRef.current,
      selectionBox,
      selectedEdgeId,
      connectionPreview,
    ),
    tool: tool?.trim() ? tool.trim() : null,
    transformBox,
    transformKind,
  }), [activePageId, connectionPreview, selectedEdgeId, selectedIds, selectionBox, tool, transformBox, transformKind])

  const clearAwarenessPublishTimer = useCallback(() => {
    if (awarenessPublishTimerRef.current === null) return
    window.clearTimeout(awarenessPublishTimerRef.current)
    awarenessPublishTimerRef.current = null
  }, [])

  const flushAwarenessPresence = useCallback(() => {
    clearAwarenessPublishTimer()
    if (!awarenessConnectionRef.current) return
    lastAwarenessPublishAtRef.current = Date.now()
    awarenessConnectionRef.current.setLocalState(pendingAwarenessPresenceRef.current)
    pendingAwarenessPresenceRef.current = null
  }, [clearAwarenessPublishTimer])

  const scheduleAwarenessPresencePublish = useCallback((
    nextPresence: BoardCollaborationPresence | null,
    options: { immediate?: boolean } = {},
  ) => {
    pendingAwarenessPresenceRef.current = nextPresence
    if (options.immediate) {
      flushAwarenessPresence()
      return
    }
    const elapsedMs = Date.now() - lastAwarenessPublishAtRef.current
    const waitMs = Math.max(0, awarenessPublishIntervalMs - elapsedMs)
    if (waitMs === 0) {
      flushAwarenessPresence()
      return
    }
    if (awarenessPublishTimerRef.current !== null) return
    awarenessPublishTimerRef.current = window.setTimeout(() => {
      flushAwarenessPresence()
    }, waitMs)
  }, [flushAwarenessPresence])

  useEffect(() => {
    latestPresenceRef.current = presence
    scheduleAwarenessPresencePublish(presence)
    setState((current) => {
      const activeSessions = mergeRealtimeAwareness(
        patchOptimisticSelfSession(current.activeSessions, currentSessionIdRef.current, presence),
        realtimeAwarenessRef.current,
      )
      return {
        ...current,
        activeSessions,
        shapeOccupancy: deriveBoardShapeOccupancy(activeSessions, realtimeAwarenessRef.current),
      }
    })
  }, [presence, scheduleAwarenessPresencePublish])

  const releaseSession = useCallback((
    nextBoardId: string,
    nextWorkspace: TangentWorkspace,
    releaseKey: string,
    options: { keepalive?: boolean } = {},
  ) => {
    const sessionId = currentSessionIdRef.current
    if (!sessionId) return
    const releaseSessionKey = `${releaseKey}:${sessionId}`
    if (releasedSessionKeyRef.current === releaseSessionKey) return
    releasedSessionKeyRef.current = releaseSessionKey
    currentSessionIdRef.current = null
    void releaseBoardCollaborationSession(nextBoardId, sessionId, nextWorkspace, {
      keepalive: options.keepalive,
    }).catch(() => {})
  }, [])

  const syncPresence = useCallback(async (markLoading = false) => {
    if (!shouldConnect || !boardId || !workspace) return
    const requestId = ++requestIdRef.current
    claimControllerRef.current?.abort()
    const controller = new AbortController()
    claimControllerRef.current = controller
    if (markLoading) {
      setState((current) => ({
        ...current,
        error: null,
        status: current.activeSessions.length > 0 ? 'ready' : 'loading',
      }))
    }
    try {
      const response = await claimBoardCollaborationSession(
        boardId,
        {
          clientInstanceId,
          presence: latestPresenceRef.current,
          ttlSeconds: 45,
        },
        workspace,
        { signal: controller.signal },
      )
      if (claimControllerRef.current === controller) claimControllerRef.current = null
      if (requestId !== requestIdRef.current) return
      currentSessionIdRef.current = response.selfSession?.id ?? currentSessionIdRef.current
      if (response.selfSession?.id) {
        releasedSessionKeyRef.current = null
      }
      setState((current) => {
        const publicSessions = sanitizeCollaborationSessions(response.activeSessions)
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
    } catch (error) {
      if (claimControllerRef.current === controller) claimControllerRef.current = null
      if (controller.signal.aborted) return
      if (requestId !== requestIdRef.current) return
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Board presence failed to load.',
        status: current.activeSessions.length > 0 ? 'ready' : 'error',
      }))
    }
  }, [boardId, clientInstanceId, shouldConnect, workspace])

  useEffect(() => {
    if (!shouldConnect || !boardId || !workspace) {
      releaseKeyRef.current = null
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
      return
    }
    const releaseKey = `${workspace.id}:${boardId}:${clientInstanceId}`
    releaseKeyRef.current = releaseKey
    void syncPresence(true)
    const intervalId = window.setInterval(() => {
      void syncPresence(false)
    }, heartbeatIntervalMs)
    const handlePageHide = () => {
      if (releaseKeyRef.current !== releaseKey) return
      claimControllerRef.current?.abort()
      claimControllerRef.current = null
      releaseSession(boardId, workspace, releaseKey, { keepalive: true })
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('pagehide', handlePageHide)
      requestIdRef.current += 1
      claimControllerRef.current?.abort()
      claimControllerRef.current = null
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      clearAwarenessPublishTimer()
      pendingAwarenessPresenceRef.current = null
      if (releaseKeyRef.current === releaseKey) {
        releaseSession(boardId, workspace, releaseKey)
      }
    }
  }, [boardId, clearAwarenessPublishTimer, clientInstanceId, releaseSession, shouldConnect, syncPresence, workspace])

  useEffect(() => {
    if (!shouldConnect || !state.roomKey) {
      awarenessConnectionRef.current?.disconnect()
      awarenessConnectionRef.current = null
      realtimeAwarenessRef.current.clear()
      setState((current) => {
        const transportState = resolveInitialTransportState(shouldConnect, boardId)
        return {
          ...current,
          shapeOccupancy: [],
          transportState,
          transportStatus: transportState.status,
        }
      })
      return
    }
    const connection = connectBoardRealtimeAwareness(
      createBoardRealtimeRoomDescriptor(state.roomKey, { boardId }),
      clientInstanceId,
      { workspace },
    )
    awarenessConnectionRef.current = connection
    setState((current) => ({
      ...current,
      transportState: connection.getState(),
      transportStatus: connection.getState().status,
    }))
    scheduleAwarenessPresencePublish(latestPresenceRef.current, { immediate: true })
    const unsubscribe = connection.subscribe((states) => {
      setState((current) => {
        realtimeAwarenessRef.current = createRealtimeAwarenessMap(states, current.activeSessions)
        const activeSessions = mergeRealtimeAwareness(current.activeSessions, realtimeAwarenessRef.current)
        return {
          ...current,
          activeSessions,
          shapeOccupancy: deriveBoardShapeOccupancy(activeSessions, realtimeAwarenessRef.current),
        }
      })
    })
    const unsubscribeState = connection.subscribeState((nextState) => {
      setState((current) => ({
        ...current,
        transportState: nextState,
        transportStatus: nextState.status,
      }))
    })
    return () => {
      unsubscribe()
      unsubscribeState()
      if (awarenessConnectionRef.current === connection) awarenessConnectionRef.current = null
      clearAwarenessPublishTimer()
      pendingAwarenessPresenceRef.current = null
      connection.disconnect()
      realtimeAwarenessRef.current.clear()
    }
  }, [boardId, clearAwarenessPublishTimer, clientInstanceId, scheduleAwarenessPresencePublish, shouldConnect, state.roomKey, workspace])

  useEffect(() => {
    if (!shouldConnect) return
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      void syncPresence(false)
    }, presenceDebounceMs)
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [presence, shouldConnect, syncPresence])

  const applyLocalPresencePatch = useCallback((patch: Partial<BoardCollaborationPresence>) => {
    latestPresenceRef.current = {
      ...latestPresenceRef.current,
      ...patch,
    }
    setState((current) => {
      const activeSessions = mergeRealtimeAwareness(
        patchOptimisticSelfSession(
          current.activeSessions,
          currentSessionIdRef.current,
          latestPresenceRef.current,
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
  }, [scheduleAwarenessPresencePublish])

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
    if (JSON.stringify(latestEditingShapeIdsRef.current) === JSON.stringify(nextEditingShapeIds)) return
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

function patchOptimisticSelfSession(
  sessions: BoardCollaborationSessionRecord[],
  sessionId: string | null,
  presence: BoardCollaborationPresence,
) {
  if (!sessionId) return sessions
  let changed = false
  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId || !session.isSelf) return session
    changed = true
    return {
      ...session,
      lastHeartbeatAt: new Date().toISOString(),
      presence,
    }
  })
  return changed ? nextSessions : sessions
}

function mergeRealtimeAwareness(
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

function createRealtimeAwarenessMap(
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

function isNewerIsoString(left: string, right: string) {
  const leftTime = Date.parse(left)
  const rightTime = Date.parse(right)
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return left > right
  return leftTime > rightTime
}

function isSamePresence(left: BoardCollaborationPresence, right: BoardCollaborationPresence) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function resolveInitialTransportState(
  shouldConnect: boolean,
  boardId?: string,
): BoardRealtimeAwarenessState {
  if (!shouldConnect) return createUnsupportedBoardRealtimeState()
  if (!hasSupportedBoardRealtimeTransport(boardId)) return createUnsupportedBoardRealtimeState()
  return createConnectingBoardRealtimeState()
}

function sanitizeCollaborationSessions(sessions: BoardCollaborationSessionRecord[]) {
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
