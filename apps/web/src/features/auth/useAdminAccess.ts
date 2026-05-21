'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { loadAdminAccess, type AdminAccess } from '@/features/admin/adminClient'
import { loadClientResource, readClientResource } from '@/features/shared/clientResourceCache'

type AdminAccessStatus = 'error' | 'loading' | 'ready'

const initialState: AdminAccess = {
  apiMode: 'local-unavailable',
  canAccessAdmin: false,
  ok: false,
  roles: [],
}
const adminAccessStore = new Map<string, { data?: AdminAccess; error?: string | null; promise?: Promise<AdminAccess>; updatedAt: number }>()

export function useAdminAccess() {
  const { getToken, isLoaded, userId } = useAuth()
  const storageKey = 'tanergy.admin-access.current'
  const cacheKey = 'self'
  const snapshot = readClientResource(adminAccessStore, cacheKey, {
    storage: 'local',
    storageKey,
    ttlMs: 300_000,
  })
  const resolvedSnapshot = userId && snapshot.data?.userId && snapshot.data.userId !== userId
    ? { status: 'empty' as const }
    : snapshot
  const [adminAccess, setAdminAccess] = useState<AdminAccess>(resolvedSnapshot.data ?? initialState)
  const [status, setStatus] = useState<AdminAccessStatus>(resolvedSnapshot.status === 'ready' ? 'ready' : resolvedSnapshot.status === 'error' ? 'error' : 'loading')
  const [error, setError] = useState<string | null>(resolvedSnapshot.error ?? null)

  useEffect(() => {
    if (!isLoaded) return
    let isCancelled = false

    loadClientResource(adminAccessStore, cacheKey, () => loadAdminAccess({ getAuthToken: getToken }), {
      canReuse: (data) => !userId || !data.userId || data.userId === userId,
      storage: 'local',
      storageKey,
      ttlMs: 300_000,
    })
      .then((nextAccess) => {
        if (isCancelled) return
        setAdminAccess(nextAccess)
        setError(nextAccess.ok ? null : nextAccess.error ?? null)
        setStatus(nextAccess.ok || nextAccess.apiMode === 'local-unavailable' ? 'ready' : 'error')
      })
      .catch((nextError: unknown) => {
        if (isCancelled) return
        setError(nextError instanceof Error ? nextError.message : 'Admin access lookup failed.')
        setStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [cacheKey, getToken, isLoaded, storageKey, userId])

  return { adminAccess, error, status }
}
