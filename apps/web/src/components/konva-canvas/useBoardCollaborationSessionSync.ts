'use client'

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  claimBoardCollaborationSession,
  releaseBoardCollaborationSession,
} from '@/features/boards/boardCollaborationClient'
import type {
  BoardCollaborationPresence,
  BoardCollaborationSessionsResponse,
} from '@/features/boards/boardCollaborationTypes'
import { createLocalSessionPresenceSnapshot } from './boardCollaborationPresenceState'

const heartbeatIntervalMs = 20_000
const presenceDebounceMs = 900

type UseBoardCollaborationSessionSyncOptions = {
  boardId?: string
  clearAwarenessPublishTimer: () => void
  clientInstanceId: string
  latestPresenceRef: MutableRefObject<BoardCollaborationPresence>
  onDisconnected: () => void
  onSyncError: (error: unknown) => void
  onSyncResolved: (response: BoardCollaborationSessionsResponse) => void
  onSyncStarted: (markLoading: boolean) => void
  shouldConnect: boolean
  workspace?: TangentWorkspace
}

export function useBoardCollaborationSessionSync({
  boardId,
  clearAwarenessPublishTimer,
  clientInstanceId,
  latestPresenceRef,
  onDisconnected,
  onSyncError,
  onSyncResolved,
  onSyncStarted,
  shouldConnect,
  workspace,
}: UseBoardCollaborationSessionSyncOptions) {
  const currentSessionIdRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)
  const claimControllerRef = useRef<AbortController | null>(null)
  const releaseKeyRef = useRef<string | null>(null)
  const releasedSessionKeyRef = useRef<string | null>(null)
  const presenceDebounceTimerRef = useRef<number | null>(null)

  const clearPresenceDebounceTimer = useCallback(() => {
    if (presenceDebounceTimerRef.current === null) return
    window.clearTimeout(presenceDebounceTimerRef.current)
    presenceDebounceTimerRef.current = null
  }, [])

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
    onSyncStarted(markLoading)
    try {
      const response = await claimBoardCollaborationSession(
        boardId,
        {
          clientInstanceId,
          presence: createLocalSessionPresenceSnapshot(latestPresenceRef.current),
          ttlSeconds: 45,
        },
        workspace,
        { signal: controller.signal },
      )
      if (claimControllerRef.current === controller) claimControllerRef.current = null
      if (requestId !== requestIdRef.current) return
      currentSessionIdRef.current = response.selfSession?.id ?? currentSessionIdRef.current
      if (response.selfSession?.id) releasedSessionKeyRef.current = null
      onSyncResolved(response)
    } catch (error) {
      if (claimControllerRef.current === controller) claimControllerRef.current = null
      if (controller.signal.aborted) return
      if (requestId !== requestIdRef.current) return
      onSyncError(error)
    }
  }, [boardId, clientInstanceId, latestPresenceRef, onSyncError, onSyncResolved, onSyncStarted, shouldConnect, workspace])

  useEffect(() => {
    if (!shouldConnect || !boardId || !workspace) {
      requestIdRef.current += 1
      claimControllerRef.current?.abort()
      claimControllerRef.current = null
      currentSessionIdRef.current = null
      releaseKeyRef.current = null
      clearPresenceDebounceTimer()
      clearAwarenessPublishTimer()
      onDisconnected()
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
      clearPresenceDebounceTimer()
      clearAwarenessPublishTimer()
      if (releaseKeyRef.current === releaseKey) {
        releaseSession(boardId, workspace, releaseKey)
      }
    }
  }, [
    boardId,
    clearAwarenessPublishTimer,
    clearPresenceDebounceTimer,
    clientInstanceId,
    onDisconnected,
    releaseSession,
    shouldConnect,
    syncPresence,
    workspace,
  ])

  const schedulePresenceSync = useCallback(() => {
    if (!shouldConnect) return
    clearPresenceDebounceTimer()
    presenceDebounceTimerRef.current = window.setTimeout(() => {
      presenceDebounceTimerRef.current = null
      void syncPresence(false)
    }, presenceDebounceMs)
  }, [clearPresenceDebounceTimer, shouldConnect, syncPresence])

  return {
    currentSessionIdRef,
    schedulePresenceSync,
  }
}
