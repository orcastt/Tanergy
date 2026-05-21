'use client'

import type { TangentWorkspace } from './sessionTypes'
import { persistenceAuthHeaders } from '@/features/api/persistenceApi'
import { clearCachedBillingResources } from '@/features/billing/billingResourceCache'
import { clearCachedBoardResources } from '@/features/boards/boardResourceCache'
import type { AuthSessionResponse } from './sessionTypes'

type LoadCurrentSessionOptions = {
  getAuthToken?: () => Promise<null | string>
  requestedWorkspace?: null | Pick<TangentWorkspace, 'id'> & Partial<TangentWorkspace>
}

export const SESSION_REFRESH_EVENT = 'tanergy:session-refresh'
export const SESSION_REFRESH_MARKER_KEY = 'tanergy.session.refresh'

export async function loadCurrentSession(options: LoadCurrentSessionOptions = {}) {
  const token = await options.getAuthToken?.()
  const headers = buildSessionRequestHeaders(options.requestedWorkspace, token)
  const response = await fetch('/api/auth/session', {
    cache: 'no-store',
    headers,
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

export function requestCurrentSessionRefresh() {
  clearSessionScopedClientState()
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_REFRESH_MARKER_KEY, String(Date.now()))
  window.dispatchEvent(new Event(SESSION_REFRESH_EVENT))
}

export function clearSessionScopedClientState() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem('tanergy.session.current')
  window.localStorage.removeItem(SESSION_REFRESH_MARKER_KEY)
  clearCachedBillingResources()
  clearCachedBoardResources()
}

export function readPendingSessionRefreshMarker() {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(SESSION_REFRESH_MARKER_KEY)
  return value?.trim() ? value : null
}

export function clearPendingSessionRefreshMarker() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_REFRESH_MARKER_KEY)
}

function buildWorkspaceSelectionHeaders(
  workspace?: null | Pick<TangentWorkspace, 'id'> & Partial<TangentWorkspace>,
): Record<string, string> {
  if (!workspace?.id?.trim()) return {}
  return { 'x-tangent-workspace-id': workspace.id.trim() }
}

function buildSessionRequestHeaders(
  workspace: LoadCurrentSessionOptions['requestedWorkspace'],
  token: null | string | undefined,
): Record<string, string> {
  const headers = buildWorkspaceSelectionHeaders(workspace)
  if (token) return { ...headers, Authorization: `Bearer ${token}` }
  return mergeHeaders(headers, persistenceAuthHeaders())
}

function mergeHeaders(target: Record<string, string>, source: HeadersInit): Record<string, string> {
  if (source instanceof Headers) {
    source.forEach((value, key) => {
      target[key] = value
    })
    return target
  }
  if (Array.isArray(source)) {
    for (const [key, value] of source) {
      target[key] = value
    }
    return target
  }
  return { ...target, ...source }
}
