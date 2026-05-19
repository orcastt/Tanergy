'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { distanceBetweenPoints, type CanvasBounds, type CanvasPoint } from '@/features/canvas-engine'
import type { BoardCollaborationConnectionPreview, BoardCollaborationPresence, BoardCollaborationTransformKind } from '@/features/boards/boardCollaborationTypes'
import {
  normalizePresenceShapeId,
  normalizePresenceShapeIds,
} from '@/features/boards/boardCollaborationPresenceUtils'
import {
  areSamePresenceShapeIds,
  createLocalSessionPresenceSnapshot,
  isSamePresence,
} from './boardCollaborationPresenceState'
import {
  applyLocalPresenceState,
  type CollaborationState,
  createPresenceSnapshot,
} from './boardCollaborationPresenceModel'
import type { LocalBoardAwarenessState } from '@/features/collaboration/localBoardAwareness'

const cursorSyncDistance = 10
const selectionBroadcastIdleMs = 10_000

type UseBoardCollaborationLocalPresenceOptions = {
  activePageId: string | null
  connectionPreview: BoardCollaborationConnectionPreview | null
  currentSessionIdRef: MutableRefObject<string | null>
  latestPresenceRef: MutableRefObject<BoardCollaborationPresence>
  realtimeAwarenessRef: MutableRefObject<Map<string, LocalBoardAwarenessState>>
  scheduleAwarenessPresencePublish: (
    nextPresence: BoardCollaborationPresence | null,
    options?: { immediate?: boolean },
  ) => void
  schedulePresenceSync: () => void
  selectedEdgeId: string | null
  selectedIds: string[]
  selectionBox: CanvasBounds | null
  setState: Dispatch<SetStateAction<CollaborationState>>
  shouldConnect: boolean
  tool: string | null
  transformBox: CanvasBounds | null
  transformKind: BoardCollaborationTransformKind | null
}

export function useBoardCollaborationLocalPresence({
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
}: UseBoardCollaborationLocalPresenceOptions) {
  const latestCursorRef = useRef<BoardCollaborationPresence['cursor']>(null)
  const latestDraftPreviewRef = useRef<BoardCollaborationPresence['draftPreview']>(null)
  const latestEditingShapeIdsRef = useRef<string[]>([])
  const latestHoveredShapeIdRef = useRef<string | null>(null)
  const latestSessionPresenceRef = useRef<BoardCollaborationPresence | null>(null)
  const selectionBroadcastRefreshTimerRef = useRef<number | null>(null)
  const selectionBroadcastTimerRef = useRef<number | null>(null)
  const [broadcastSelectedIds, setBroadcastSelectedIds] = useState<string[]>([])

  const clearSelectionBroadcastRefreshTimer = useCallback(() => {
    if (selectionBroadcastRefreshTimerRef.current === null) return
    window.clearTimeout(selectionBroadcastRefreshTimerRef.current)
    selectionBroadcastRefreshTimerRef.current = null
  }, [])

  const clearSelectionBroadcastTimer = useCallback(() => {
    if (selectionBroadcastTimerRef.current === null) return
    window.clearTimeout(selectionBroadcastTimerRef.current)
    selectionBroadcastTimerRef.current = null
  }, [])

  const refreshSelectionBroadcast = useCallback(() => {
    clearSelectionBroadcastTimer()
    if (!shouldConnect || selectedIds.length === 0) {
      setBroadcastSelectedIds((current) => current.length === 0 ? current : [])
      return
    }
    setBroadcastSelectedIds((current) => areSamePresenceShapeIds(current, selectedIds) ? current : selectedIds)
    selectionBroadcastTimerRef.current = window.setTimeout(() => {
      selectionBroadcastTimerRef.current = null
      setBroadcastSelectedIds([])
    }, selectionBroadcastIdleMs)
  }, [clearSelectionBroadcastTimer, selectedIds, shouldConnect])

  const scheduleSelectionBroadcastRefresh = useCallback(() => {
    clearSelectionBroadcastRefreshTimer()
    selectionBroadcastRefreshTimerRef.current = window.setTimeout(() => {
      selectionBroadcastRefreshTimerRef.current = null
      refreshSelectionBroadcast()
    }, 0)
  }, [clearSelectionBroadcastRefreshTimer, refreshSelectionBroadcast])

  const scheduleSessionSyncIfStablePresenceChanged = useCallback((presence: BoardCollaborationPresence) => {
    const nextSessionPresence = createLocalSessionPresenceSnapshot(presence)
    if (latestSessionPresenceRef.current && isSamePresence(latestSessionPresenceRef.current, nextSessionPresence)) return
    latestSessionPresenceRef.current = nextSessionPresence
    schedulePresenceSync()
  }, [schedulePresenceSync])

  const applyLocalPresencePatch = useCallback((
    patch: Partial<BoardCollaborationPresence>,
    options: { refreshSelectionBroadcast?: boolean } = {},
  ) => {
    if (options.refreshSelectionBroadcast) refreshSelectionBroadcast()
    latestPresenceRef.current = {
      ...latestPresenceRef.current,
      ...patch,
    }
    const localSessionPresence = createLocalSessionPresenceSnapshot(latestPresenceRef.current)
    setState((current) => (
      applyLocalPresenceState(
        current,
        currentSessionIdRef.current,
        localSessionPresence,
        realtimeAwarenessRef,
      )
    ))
    scheduleAwarenessPresencePublish(latestPresenceRef.current)
    scheduleSessionSyncIfStablePresenceChanged(latestPresenceRef.current)
  }, [
    currentSessionIdRef,
    latestPresenceRef,
    realtimeAwarenessRef,
    refreshSelectionBroadcast,
    scheduleAwarenessPresencePublish,
    scheduleSessionSyncIfStablePresenceChanged,
    setState,
  ])

  useEffect(() => {
    scheduleSelectionBroadcastRefresh()
  }, [scheduleSelectionBroadcastRefresh])

  useEffect(() => {
    if (connectionPreview || selectionBox || transformBox) scheduleSelectionBroadcastRefresh()
  }, [connectionPreview, scheduleSelectionBroadcastRefresh, selectionBox, transformBox])

  useEffect(() => () => {
    clearSelectionBroadcastRefreshTimer()
    clearSelectionBroadcastTimer()
  }, [clearSelectionBroadcastRefreshTimer, clearSelectionBroadcastTimer])

  useEffect(() => {
    const nextPresence = createPresenceSnapshot({
      activePageId,
      connectionPreview,
      cursor: latestCursorRef.current,
      draftPreview: latestDraftPreviewRef.current,
      editingShapeIds: latestEditingShapeIdsRef.current,
      hoveredShapeId: latestHoveredShapeIdRef.current,
      selectedEdgeId,
      selectedIds: broadcastSelectedIds,
      selectionBox,
      tool,
      transformBox,
      transformKind,
    })
    latestPresenceRef.current = nextPresence
    scheduleAwarenessPresencePublish(nextPresence)
    scheduleSessionSyncIfStablePresenceChanged(nextPresence)
    const localSessionPresence = createLocalSessionPresenceSnapshot(nextPresence)
    setState((current) => (
      applyLocalPresenceState(
        current,
        currentSessionIdRef.current,
        localSessionPresence,
        realtimeAwarenessRef,
      )
    ))
  }, [
    activePageId,
    connectionPreview,
    currentSessionIdRef,
    latestPresenceRef,
    realtimeAwarenessRef,
    scheduleAwarenessPresencePublish,
    scheduleSessionSyncIfStablePresenceChanged,
    broadcastSelectedIds,
    selectedEdgeId,
    selectionBox,
    setState,
    tool,
    transformBox,
    transformKind,
  ])

  const setCursor = useCallback((point: CanvasPoint | null) => {
    if (!shouldConnect) return
    const nextCursor = point
      ? {
          x: Math.round(point.x * 1000) / 1000,
          y: Math.round(point.y * 1000) / 1000,
        }
      : null
    const currentCursor = latestCursorRef.current
    if (currentCursor && nextCursor && distanceBetweenPoints(currentCursor, nextCursor) < cursorSyncDistance) return
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
    applyLocalPresencePatch({ editingShapeIds: nextEditingShapeIds }, { refreshSelectionBroadcast: true })
  }, [applyLocalPresencePatch, shouldConnect])

  const setDraftPreview = useCallback((draftPreview: BoardCollaborationPresence['draftPreview'] | null) => {
    if (!shouldConnect) return
    if (isSameDraftPreview(latestDraftPreviewRef.current ?? null, draftPreview ?? null)) return
    latestDraftPreviewRef.current = draftPreview ?? null
    applyLocalPresencePatch({ draftPreview: draftPreview ?? null })
  }, [applyLocalPresencePatch, shouldConnect])

  return {
    setCursor,
    setDraftPreview,
    setEditingShapeIds,
    setHoveredShapeId,
  }
}

function isSameDraftPreview(
  left: BoardCollaborationPresence['draftPreview'] | null,
  right: BoardCollaborationPresence['draftPreview'] | null,
) {
  if (!left || !right) return left === right
  return JSON.stringify(left) === JSON.stringify(right)
}
