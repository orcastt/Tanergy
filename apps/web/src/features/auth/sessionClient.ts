'use client'

import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeaders,
} from '@/features/api/persistenceApi'
import type { AuthSessionResponse } from './sessionTypes'

type LoadCurrentSessionOptions = {
  getAuthToken?: () => Promise<null | string>
}

export async function loadCurrentSession(options: LoadCurrentSessionOptions = {}) {
  const token = await options.getAuthToken?.()
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/auth/session') : '/api/auth/session',
    { headers: token ? { Authorization: `Bearer ${token}` } : persistenceAuthHeaders() }
  )
  const payload = await response.json() as AuthSessionResponse
  if (!response.ok || !payload.ok || !payload.session) {
    throw new Error(payload.error || 'Session lookup failed.')
  }
  return payload.session
}
