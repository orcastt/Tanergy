'use client'

import { useEffect, useState } from 'react'
import { loadAdminAccess, type AdminAccess } from '@/features/admin/adminClient'

type AdminAccessStatus = 'error' | 'loading' | 'ready'

const initialState: AdminAccess = {
  apiMode: 'local-unavailable',
  canAccessAdmin: false,
  ok: false,
  roles: [],
}

export function useAdminAccess() {
  const [adminAccess, setAdminAccess] = useState<AdminAccess>(initialState)
  const [status, setStatus] = useState<AdminAccessStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    loadAdminAccess()
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
  }, [])

  return { adminAccess, error, status }
}
