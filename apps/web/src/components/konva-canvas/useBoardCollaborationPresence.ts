'use client'

import { useCallback, useRef, useState } from 'react'
import type { CanvasBounds } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  type BoardRealtimeAwarenessState,
  createBoardRealtimeClientInstanceId,
} from '@/features/collaboration/boardRealtimeTransport'
import type { LocalBoardAwarenessState } from '@/features/collaboration/localBoardAwareness'
import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationSessionsResponse,
  BoardCollaborationTransformKind,
} from '@/features/boards/boardCollaborationTypes'
import {
  applyAwarenessStates,
  applySyncResolvedState,
  createEmptyPresenceSnapshot,
  type CollaborationState,
  createDisconnectedCollaborationState,
  createInitialCollaborationState,
} from './boardCollaborationPresenceModel'
import { useBoardCollaborationLocalPresence } from './useBoardCollaborationLocalPresence'
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
  const initialTransportState = resolveInitialTransportState(shouldConnect, boardId)
  const [state, setState] = useState<CollaborationState>(() => (
    createInitialCollaborationState(shouldConnect, initialTransportState)
  ))
  const latestPresenceRef = useRef(createEmptyPresenceSnapshot())
  const realtimeAwarenessRef = useRef<Map<string, LocalBoardAwarenessState>>(new Map())

  const handleAwarenessStates = useCallback((states: LocalBoardAwarenessState[]) => {
    setState((current) => applyAwarenessStates(current, states, realtimeAwarenessRef))
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
    setState(createDisconnectedCollaborationState(transportState))
  }, [boardId])

  const handleSyncError = useCallback((error: unknown) => {
    setState((current) => ({
      ...current,
      error: error instanceof Error ? error.message : 'Board presence failed to load.',
      status: current.activeSessions.length > 0 ? 'ready' : 'error',
    }))
  }, [])

  const handleSyncResolved = useCallback((response: BoardCollaborationSessionsResponse) => {
    setState((current) => applySyncResolvedState(current, response, realtimeAwarenessRef))
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

  const { setCursor, setDraftPreview, setEditingShapeIds, setHoveredShapeId } = useBoardCollaborationLocalPresence({
    activePageId,
    connectionPreview,
    currentSessionIdRef,
    latestPresenceRef,
    realtimeAwarenessRef,
    scheduleAwarenessPresencePublish,
    schedulePresenceSync,
    selectedEdgeId,
    selectedIds,
    selectionBox,
    setState,
    shouldConnect,
    tool,
    transformBox,
    transformKind,
  })

  return {
    ...state,
    activeCount: state.activeSessions.length,
    clientInstanceId,
    otherSessions: state.activeSessions.filter((session) => !session.isSelf),
    setCursor,
    setDraftPreview,
    setEditingShapeIds,
    setHoveredShapeId,
  }
}
