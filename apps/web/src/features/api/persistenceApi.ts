'use client'

import { getSessionRequestHeaders } from '@/features/auth/mockSession'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')

export function hasRemotePersistenceApi() {
  return apiBaseUrl.length > 0
}

export function persistenceApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${normalizedPath}`
}

export function persistenceAssetUrl(url: string | undefined) {
  if (!url || !apiBaseUrl || !url.startsWith('/api/v1/')) return url
  return `${apiBaseUrl}${url}`
}

export function persistenceAuthHeaders(workspace?: TangentWorkspace): HeadersInit {
  return getSessionRequestHeaders(workspace)
}

export function persistenceJsonHeaders(workspace?: TangentWorkspace): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...getSessionRequestHeaders(workspace),
  }
}

type PersistenceAuthOptions = {
  getAuthToken?: () => Promise<null | string>
}

export async function persistenceAuthHeadersAsync(
  workspace?: TangentWorkspace,
  options: PersistenceAuthOptions = {},
): Promise<HeadersInit> {
  return withClerkAuthorization(getBaseRequestHeaders(workspace), options)
}

export async function persistenceJsonHeadersAsync(
  workspace?: TangentWorkspace,
  options: PersistenceAuthOptions = {},
): Promise<HeadersInit> {
  return withClerkAuthorization(getBaseJsonHeaders(workspace), options)
}

async function withClerkAuthorization(headers: HeadersInit, options: PersistenceAuthOptions = {}): Promise<HeadersInit> {
  const token = await options.getAuthToken?.() ?? await getBrowserClerkToken()
  if (token) return { ...headers, Authorization: `Bearer ${token}` }
  if (shouldUseLocalDevHeaders()) return headers
  return headers
}

function shouldUseLocalDevHeaders() {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.NEXT_PUBLIC_USE_CLERK_API_AUTH === '1') return false
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  const apiHost = apiBaseUrl ? new URL(apiBaseUrl).hostname : ''
  return ['localhost', '127.0.0.1'].includes(host) && ['localhost', '127.0.0.1'].includes(apiHost)
}

async function getBrowserClerkToken() {
  if (typeof window === 'undefined') return null
  const win = window as Window & {
    Clerk?: {
      loaded?: boolean
      session?: {
        getToken?: () => Promise<null | string>
      }
    }
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const clerk = win.Clerk
    if (clerk?.session?.getToken) {
      return clerk.session.getToken()
    }
    if (clerk?.loaded) break
    await sleep(50)
  }
  return null
}

function getBaseRequestHeaders(workspace?: TangentWorkspace): HeadersInit {
  return workspace ? getSessionRequestHeaders(workspace) : {}
}

function getBaseJsonHeaders(workspace?: TangentWorkspace): HeadersInit {
  return workspace
    ? {
      'Content-Type': 'application/json',
      ...getSessionRequestHeaders(workspace),
    }
    : { 'Content-Type': 'application/json' }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
