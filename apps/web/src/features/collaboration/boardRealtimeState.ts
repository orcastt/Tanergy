'use client'

export type BoardRealtimeConnectionStatus =
  | 'connecting'
  | 'synced'
  | 'disconnected'
  | 'error'
  | 'unsupported'

export type BoardRealtimeConnectionState = {
  error: string | null
  initialSyncComplete: boolean
  lastActivityAt: string | null
  lastSyncedAt: string | null
  status: BoardRealtimeConnectionStatus
}

type BoardRealtimeStateListener = (state: BoardRealtimeConnectionState) => void

export function createBoardRealtimeStateMachine(
  initialState: BoardRealtimeConnectionState = createConnectingBoardRealtimeState(),
) {
  let state = initialState
  const listeners = new Set<BoardRealtimeStateListener>()

  const publish = () => {
    for (const listener of listeners) listener(state)
  }

  const setState = (nextState: BoardRealtimeConnectionState) => {
    if (isSameState(state, nextState)) return
    state = nextState
    publish()
  }

  return {
    getState() {
      return state
    },
    markActivity(at = createRealtimeStateTimestamp()) {
      setState({
        ...state,
        lastActivityAt: at,
      })
    },
    markConnecting() {
      setState({
        ...state,
        error: null,
        initialSyncComplete: false,
        status: 'connecting',
      })
    },
    markDisconnected(error: string | null = null) {
      setState({
        ...state,
        error,
        status: 'disconnected',
      })
    },
    markError(error: string, options: { disconnected?: boolean } = {}) {
      setState({
        ...state,
        error,
        status: options.disconnected ? 'disconnected' : 'error',
      })
    },
    markSynced(at = createRealtimeStateTimestamp()) {
      setState({
        ...state,
        error: null,
        initialSyncComplete: true,
        lastActivityAt: at,
        lastSyncedAt: at,
        status: 'synced',
      })
    },
    subscribe(listener: BoardRealtimeStateListener) {
      listeners.add(listener)
      listener(state)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function createConnectingBoardRealtimeState(): BoardRealtimeConnectionState {
  return {
    error: null,
    initialSyncComplete: false,
    lastActivityAt: null,
    lastSyncedAt: null,
    status: 'connecting',
  }
}

export function createUnsupportedBoardRealtimeState(): BoardRealtimeConnectionState {
  return {
    error: null,
    initialSyncComplete: true,
    lastActivityAt: null,
    lastSyncedAt: null,
    status: 'unsupported',
  }
}

export function createRealtimeStateTimestamp() {
  return new Date().toISOString()
}

function isSameState(left: BoardRealtimeConnectionState, right: BoardRealtimeConnectionState) {
  return left.status === right.status
    && left.error === right.error
    && left.initialSyncComplete === right.initialSyncComplete
    && left.lastActivityAt === right.lastActivityAt
    && left.lastSyncedAt === right.lastSyncedAt
}
