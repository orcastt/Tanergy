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

export async function persistenceAuthHeadersAsync(workspace?: TangentWorkspace): Promise<HeadersInit> {
  return withClerkAuthorization(getSessionRequestHeaders(workspace))
}

export async function persistenceJsonHeadersAsync(workspace?: TangentWorkspace): Promise<HeadersInit> {
  return withClerkAuthorization(persistenceJsonHeaders(workspace))
}

async function withClerkAuthorization(headers: HeadersInit): Promise<HeadersInit> {
  const token = await getBrowserClerkToken()
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers
}

async function getBrowserClerkToken() {
  if (typeof window === 'undefined') return null
  const clerk = (window as Window & {
    Clerk?: {
      session?: {
        getToken?: () => Promise<null | string>
      }
    }
  }).Clerk
  return clerk?.session?.getToken?.() ?? null
}
