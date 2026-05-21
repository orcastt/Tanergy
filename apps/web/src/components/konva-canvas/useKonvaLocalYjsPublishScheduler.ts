'use client'

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { KonvaYjsSnapshotWriteMode } from '@/features/collaboration/konvaYjsSnapshot'
import { resolveKonvaYjsPublishPlan } from './konvaLocalYjsSyncHelpers'
import type { KonvaLocalYjsSyncController } from './konvaLocalYjsSyncContract'

const contentPublishDebounceMs = 120
const fullBoardPublishDebounceMs = 220
const maxPendingPublishLatencyMs = 900

type UseKonvaLocalYjsPublishSchedulerOptions = {
  activePageId?: string
  cancelScheduledPublish: () => void
  latestCanWriteRef: MutableRefObject<boolean>
  nextChangedPageIdsRef: MutableRefObject<string[]>
  nextPublishModeRef: MutableRefObject<KonvaYjsSnapshotWriteMode>
  lastObservedActivePageIdRef: MutableRefObject<string | undefined>
  lastObservedPageRevisionRef: MutableRefObject<number>
  patchSyncState: (patch: Partial<KonvaLocalYjsSyncController>) => void
  pageChangedPageIds?: string[]
  pageRevision: number
  publishCurrentSnapshot: (options?: { force?: boolean; mode?: KonvaYjsSnapshotWriteMode }) => void
  publishTimerRef: MutableRefObject<number | null>
  requiresFullBoardSync: boolean
  resolvedRoomKey: string | null
  setHasUnsyncedLocalChanges: (value: boolean) => void
}

export function useKonvaLocalYjsPublishScheduler({
  activePageId,
  cancelScheduledPublish,
  latestCanWriteRef,
  nextChangedPageIdsRef,
  nextPublishModeRef,
  lastObservedActivePageIdRef,
  lastObservedPageRevisionRef,
  patchSyncState,
  pageChangedPageIds = [],
  pageRevision,
  publishCurrentSnapshot,
  publishTimerRef,
  requiresFullBoardSync,
  resolvedRoomKey,
  setHasUnsyncedLocalChanges,
}: UseKonvaLocalYjsPublishSchedulerOptions) {
  const firstPendingPublishAtRef = useRef<number | null>(null)

  const flushPendingPublish = useCallback(() => {
    if (publishTimerRef.current === null) return
    cancelScheduledPublish()
    firstPendingPublishAtRef.current = null
    publishCurrentSnapshot({ mode: nextPublishModeRef.current })
  }, [cancelScheduledPublish, nextPublishModeRef, publishCurrentSnapshot, publishTimerRef])

  useEffect(() => {
    if (!resolvedRoomKey || !latestCanWriteRef.current) return
    const publishPlan = resolveKonvaYjsPublishPlan({
      activePageId,
      pageChangedPageIds,
      pageRevision,
      previousActivePageId: lastObservedActivePageIdRef.current,
      previousPageRevision: lastObservedPageRevisionRef.current,
      requiresFullBoardSync,
    })
    lastObservedActivePageIdRef.current = activePageId
    lastObservedPageRevisionRef.current = pageRevision
    nextPublishModeRef.current = publishPlan.mode
    nextChangedPageIdsRef.current = publishPlan.changedPageIds
    if (publishPlan.didSwitchPage && !publishPlan.didRevisionChange) {
      cancelScheduledPublish()
      firstPendingPublishAtRef.current = null
      return
    }
    cancelScheduledPublish()
    const firstPendingAt = firstPendingPublishAtRef.current ?? Date.now()
    firstPendingPublishAtRef.current = firstPendingAt
    setHasUnsyncedLocalChanges(true)
    patchSyncState({ hasUnsyncedLocalChanges: true })
    publishTimerRef.current = window.setTimeout(() => {
      publishTimerRef.current = null
      firstPendingPublishAtRef.current = null
      publishCurrentSnapshot({ mode: publishPlan.mode })
    }, resolvePublishDelayMs(publishPlan.mode, firstPendingAt))
    return () => {
      cancelScheduledPublish()
    }
  }, [
    activePageId,
    cancelScheduledPublish,
    lastObservedActivePageIdRef,
    lastObservedPageRevisionRef,
    latestCanWriteRef,
    nextChangedPageIdsRef,
    nextPublishModeRef,
    pageChangedPageIds,
    pageRevision,
    patchSyncState,
    publishCurrentSnapshot,
    publishTimerRef,
    requiresFullBoardSync,
    resolvedRoomKey,
    setHasUnsyncedLocalChanges,
  ])

  useEffect(() => {
    if (!resolvedRoomKey || !latestCanWriteRef.current) return
    const handlePointerUp = () => {
      flushPendingPublish()
    }
    const handlePageHide = () => {
      flushPendingPublish()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingPublish()
    }
    window.addEventListener('pointerup', handlePointerUp, true)
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pointerup', handlePointerUp, true)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [flushPendingPublish, latestCanWriteRef, resolvedRoomKey])
}

function resolvePublishDelayMs(mode: KonvaYjsSnapshotWriteMode, firstPendingAt: number) {
  const elapsedMs = Date.now() - firstPendingAt
  const debounceMs = mode === 'full-board' ? fullBoardPublishDebounceMs : contentPublishDebounceMs
  return Math.max(0, Math.min(debounceMs, maxPendingPublishLatencyMs - elapsedMs))
}
