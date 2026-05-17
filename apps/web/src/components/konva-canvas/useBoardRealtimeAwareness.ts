'use client'

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  type BoardRealtimeAwarenessConnection,
  type BoardRealtimeAwarenessState,
  connectBoardRealtimeAwareness,
  createBoardRealtimeRoomDescriptor,
  hasSupportedBoardRealtimeTransport,
} from '@/features/collaboration/boardRealtimeTransport'
import type { LocalBoardAwarenessState } from '@/features/collaboration/localBoardAwareness'
import {
  createConnectingBoardRealtimeState,
  createUnsupportedBoardRealtimeState,
} from '@/features/collaboration/boardRealtimeState'
import type { BoardCollaborationPresence } from '@/features/boards/boardCollaborationTypes'

const awarenessPublishIntervalMs = 120

type UseBoardRealtimeAwarenessOptions = {
  boardId?: string
  clientInstanceId: string
  initialPresenceRef: MutableRefObject<BoardCollaborationPresence>
  onAwarenessStates: (states: LocalBoardAwarenessState[]) => void
  onTransportState: (state: BoardRealtimeAwarenessState) => void
  roomKey: string | null
  shouldConnect: boolean
  workspace?: TangentWorkspace
}

export function useBoardRealtimeAwareness({
  boardId,
  clientInstanceId,
  initialPresenceRef,
  onAwarenessStates,
  onTransportState,
  roomKey,
  shouldConnect,
  workspace,
}: UseBoardRealtimeAwarenessOptions) {
  const awarenessConnectionRef = useRef<BoardRealtimeAwarenessConnection | null>(null)
  const awarenessPublishTimerRef = useRef<number | null>(null)
  const lastAwarenessPublishAtRef = useRef(0)
  const pendingAwarenessPresenceRef = useRef<BoardCollaborationPresence | null>(null)

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
    if (!shouldConnect || !roomKey) {
      awarenessConnectionRef.current?.disconnect()
      awarenessConnectionRef.current = null
      onTransportState(resolveInitialTransportState(shouldConnect, boardId))
      return
    }

    const connection = connectBoardRealtimeAwareness(
      createBoardRealtimeRoomDescriptor(roomKey, { boardId }),
      clientInstanceId,
      { workspace },
    )
    awarenessConnectionRef.current = connection
    onTransportState(connection.getState())
    scheduleAwarenessPresencePublish(initialPresenceRef.current, { immediate: true })
    const unsubscribe = connection.subscribe(onAwarenessStates)
    const unsubscribeState = connection.subscribeState(onTransportState)
    return () => {
      unsubscribe()
      unsubscribeState()
      if (awarenessConnectionRef.current === connection) awarenessConnectionRef.current = null
      clearAwarenessPublishTimer()
      pendingAwarenessPresenceRef.current = null
      connection.disconnect()
    }
  }, [
    boardId,
    clearAwarenessPublishTimer,
    clientInstanceId,
    initialPresenceRef,
    onAwarenessStates,
    onTransportState,
    roomKey,
    scheduleAwarenessPresencePublish,
    shouldConnect,
    workspace,
  ])

  return {
    clearAwarenessPublishTimer,
    scheduleAwarenessPresencePublish,
  }
}

export function resolveInitialTransportState(
  shouldConnect: boolean,
  boardId?: string,
): BoardRealtimeAwarenessState {
  if (!shouldConnect) return createUnsupportedBoardRealtimeState()
  if (!hasSupportedBoardRealtimeTransport(boardId)) return createUnsupportedBoardRealtimeState()
  return createConnectingBoardRealtimeState()
}
