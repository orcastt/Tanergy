'use client'

import { useEffect, type MutableRefObject } from 'react'
import type { KonvaYjsSnapshotWriteMode } from '@/features/collaboration/konvaYjsSnapshot'
import { resolveKonvaYjsPublishPlan } from './konvaLocalYjsSyncHelpers'
import type { KonvaLocalYjsSyncController } from './konvaLocalYjsSyncContract'

const publishDebounceMs = 220

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
  skipNextPublishRef: MutableRefObject<boolean>
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
  skipNextPublishRef,
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
    if (skipNextPublishRef.current) {
      skipNextPublishRef.current = false
      cancelScheduledPublish()
      patchSyncState({ hasUnsyncedLocalChanges: false })
      return
    }
    cancelScheduledPublish()
    setHasUnsyncedLocalChanges(true)
    patchSyncState({ hasUnsyncedLocalChanges: true })
    publishTimerRef.current = window.setTimeout(() => {
      publishTimerRef.current = null
      publishCurrentSnapshot({ mode: publishPlan.mode })
    }, publishDebounceMs)
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
    skipNextPublishRef,
  ])
}
