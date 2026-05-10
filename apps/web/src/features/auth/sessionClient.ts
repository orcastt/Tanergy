'use client'

import { persistenceAuthHeaders } from '@/features/api/persistenceApi'
import type { AuthSessionResponse } from './sessionTypes'

type LoadCurrentSessionOptions = {
  getAuthToken?: () => Promise<null | string>
}

export async function loadCurrentSession(options: LoadCurrentSessionOptions = {}) {
  const token = await options.getAuthToken?.()
  const response = await fetch('/api/auth/session', {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : persistenceAuthHeaders(),
  })
  const payload = await readSessionPayload(response)
  if (!response.ok || !payload.ok || !payload.session) {
    throw new Error(payload.error || 'Session lookup failed.')
  }
  return payload.session
}

async function readSessionPayload(response: Response): Promise<AuthSessionResponse> {
  const text = await response.text()
  if (!text) return { error: 'Session lookup failed.', ok: false }
  try {
    return JSON.parse(text) as AuthSessionResponse
  } catch {
    return { error: text, ok: false }
  }
}
