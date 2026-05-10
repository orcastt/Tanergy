'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { getCurrentSessionSnapshot } from './mockSession'
import { loadCurrentSession } from './sessionClient'
import type { TangentSession } from './sessionTypes'
import { loadClientResource, readClientResource } from '@/features/shared/clientResourceCache'

type TangentSessionStatus = 'error' | 'loading' | 'ready'
const tangentSessionStore = new Map<string, { data?: TangentSession; error?: string | null; promise?: Promise<TangentSession>; updatedAt: number }>()

export function useTangentSession() {
  const { getToken, isLoaded, userId } = useAuth()
  const storageKey = 'tanergy.session.current'
  const cacheKey = 'current'
  const snapshot = readClientResource(tangentSessionStore, cacheKey, {
    storage: 'local',
    storageKey,
    ttlMs: 300_000,
  })
  const resolvedSnapshot = userId && snapshot.data?.user.id && snapshot.data.user.id !== userId
    ? { status: 'empty' as const }
    : snapshot
  const [session, setSession] = useState<TangentSession>(() => resolvedSnapshot.data ?? getCurrentSessionSnapshot())
  const [status, setStatus] = useState<TangentSessionStatus>(resolvedSnapshot.status === 'ready' ? 'ready' : 'loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    let isCancelled = false

    loadClientResource(tangentSessionStore, cacheKey, () => loadCurrentSession({ getAuthToken: getToken }), {
      canReuse: (data) => !userId || data.user.id === userId,
      storage: 'local',
      storageKey,
      ttlMs: 300_000,
    })
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

    return () => {
      isCancelled = true
    }
  }, [cacheKey, getToken, isLoaded, storageKey, userId])

  return { error, session, status }
}
