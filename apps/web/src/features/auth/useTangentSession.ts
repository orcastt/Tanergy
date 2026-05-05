'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { getCurrentSessionSnapshot } from './mockSession'
import { loadCurrentSession } from './sessionClient'
import type { TangentSession } from './sessionTypes'

type TangentSessionStatus = 'error' | 'loading' | 'ready'

export function useTangentSession() {
  const { getToken, isLoaded } = useAuth()
  const [session, setSession] = useState<TangentSession>(() => getCurrentSessionSnapshot())
  const [status, setStatus] = useState<TangentSessionStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    let isCancelled = false

    loadCurrentSession({ getAuthToken: getToken })
      .then((nextSession) => {
        if (isCancelled) return
        setSession(nextSession)
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
  }, [getToken, isLoaded])

  return { error, session, status }
}
