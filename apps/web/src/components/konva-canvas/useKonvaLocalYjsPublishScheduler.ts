'use client'

import { useEffect, type MutableRefObject } from 'react'
import type { KonvaYjsSnapshotWriteMode } from '@/features/collaboration/konvaYjsSnapshot'
import { resolveKonvaYjsPublishPlan } from './konvaLocalYjsSyncHelpers'
import type { KonvaLocalYjsSyncController } from './konvaLocalYjsSyncContract'

const contentPublishDebounceMs = 32
const fullBoardPublishDebounceMs = 80

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
      return
    }
    cancelScheduledPublish()
    setHasUnsyncedLocalChanges(true)
    patchSyncState({ hasUnsyncedLocalChanges: true })
    publishTimerRef.current = window.setTimeout(() => {
      publishTimerRef.current = null
      publishCurrentSnapshot({ mode: publishPlan.mode })
    }, resolvePublishDebounceMs(publishPlan.mode))
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
}

function resolvePublishDebounceMs(mode: KonvaYjsSnapshotWriteMode) {
  return mode === 'full-board' ? fullBoardPublishDebounceMs : contentPublishDebounceMs
}
