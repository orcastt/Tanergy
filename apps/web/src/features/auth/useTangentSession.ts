'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect, useRef, useState } from 'react'
import { createLoadingSessionSnapshot, getCurrentSessionSnapshot } from './mockSession'
import { clearSessionScopedClientState, loadCurrentSession, SESSION_REFRESH_EVENT } from './sessionClient'
import type { TangentSession } from './sessionTypes'
import { loadClientResource, readClientResource } from '@/features/shared/clientResourceCache'
import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'

type TangentSessionStatus = 'error' | 'loading' | 'ready'
const tangentSessionStore = new Map<string, { data?: TangentSession; error?: string | null; promise?: Promise<TangentSession>; updatedAt: number }>()

export function useTangentSession() {
  const { getToken, isLoaded, userId } = useAuth()
  const storageKey = 'tanergy.session.current'
  const cacheKey = 'current'
  const previousUserIdRef = useRef<null | string | undefined>(undefined)
  const snapshot = readClientResource(tangentSessionStore, cacheKey, {
    storage: 'local',
    storageKey,
    ttlMs: 300_000,
  })
  const shouldIgnoreDevFallbackSnapshot = !canUseLocalSessionFallback() && snapshot.data?.isDevFallback === true
  const resolvedSnapshot = shouldIgnoreDevFallbackSnapshot
    ? { status: 'empty' as const }
    : userId && snapshot.data?.user.id && snapshot.data.user.id !== userId
    ? { status: 'empty' as const }
    : snapshot
  const [session, setSession] = useState<TangentSession>(() => resolvedSnapshot.data ?? (
    !canUseLocalSessionFallback()
      ? createLoadingSessionSnapshot()
      : getCurrentSessionSnapshot()
  ))
  const [status, setStatus] = useState<TangentSessionStatus>(
    resolvedSnapshot.status === 'error'
      ? 'error'
      : resolvedSnapshot.status === 'ready'
        ? 'ready'
        : 'loading'
  )
  const [error, setError] = useState<string | null>(resolvedSnapshot.status === 'error' ? (resolvedSnapshot.error ?? 'Session lookup failed.') : null)

  useEffect(() => {
    if (!isLoaded) return
    const currentUserId = userId ?? null
    if (previousUserIdRef.current === undefined) {
      previousUserIdRef.current = currentUserId
      return
    }
    if (previousUserIdRef.current === currentUserId) return
    previousUserIdRef.current = currentUserId
    tangentSessionStore.clear()
    clearSessionScopedClientState()
    setError(null)
    setStatus('loading')
    setSession(
      !canUseLocalSessionFallback()
        ? createLoadingSessionSnapshot()
        : getCurrentSessionSnapshot()
    )
  }, [isLoaded, userId])

  useEffect(() => {
    if (!isLoaded) return
    let isCancelled = false
    const hydrateSession = (force = false) => loadClientResource(
      tangentSessionStore,
      cacheKey,
      () => loadCurrentSession({ getAuthToken: getToken }),
      {
        canReuse: (data) => (
          (!hasRemotePersistenceApi() || data.isDevFallback !== true)
          && (!userId || data.user.id === userId)
        ),
        force,
        storage: 'local',
        storageKey,
        ttlMs: 300_000,
      },
    )

    hydrateSession()
      .then((nextSession) => {
        if (isCancelled) return
        setSession(nextSession)
        setError(null)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (isCancelled) return
        setError(nextError instanceof Error ? nextError.message : 'Session lookup failed.')
        setStatus('error')
      })

    const handleRefresh = () => {
      void hydrateSession(true)
        .then((nextSession) => {
          if (isCancelled) return
          setSession(nextSession)
          setError(null)
          setStatus('ready')
        })
        .catch((nextError: unknown) => {
          if (isCancelled) return
          setError(nextError instanceof Error ? nextError.message : 'Session lookup failed.')
          setStatus('error')
        })
    }

    window.addEventListener(SESSION_REFRESH_EVENT, handleRefresh)
    return () => {
      isCancelled = true
      window.removeEventListener(SESSION_REFRESH_EVENT, handleRefresh)
    }
  }, [cacheKey, getToken, isLoaded, storageKey, userId])

  return { error, session, status }
}

function canUseLocalSessionFallback() {
  return process.env.NODE_ENV !== 'production' && !hasRemotePersistenceApi()
}
