'use client'

import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeadersAsync,
} from '@/features/api/persistenceApi'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { clearCachedBillingResources } from './billingResourceCache'

export type BillingClientOptions = {
  force?: boolean
  workspace?: TangentWorkspace
}

export function createBillingQuery(params: Record<string, null | number | string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function loadBillingJson<T>(
  path: string,
  init: RequestInit = {},
  options: BillingClientOptions = {},
): Promise<T> {
  const headers = await persistenceAuthHeadersAsync(options.workspace)
  const response = await fetch(billingApiUrl(path), {
    ...init,
    headers: {
      ...headers,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const payload = await response.json() as T & { detail?: string; error?: string }
  if (!response.ok) throw new Error(payload.error || payload.detail || 'Billing resource lookup failed.')
  return payload
}

function billingApiUrl(path: string) {
  if (path.startsWith('/api/v1/workspaces/')) {
    return `/api/workspace-proxy/${path.replace(/^\/api\/v1\/workspaces\/?/, '')}`
  }
  return persistenceApiUrl(path)
}

export function clearWorkspaceBillingCaches(workspace?: TangentWorkspace) {
  clearCachedBillingResources('plans')
  if (!workspace?.id) {
    clearCachedBillingResources()
    return
  }
  clearCachedBillingResources(`dashboard:${workspace.id}`)
  clearCachedBillingResources(`me:${workspace.id}`)
}

export function assertRemoteBillingApi(resource: string) {
  if (hasRemotePersistenceApi()) return
  throw new Error(`${resource} requires NEXT_PUBLIC_API_BASE_URL.`)
}

export function assertRemoteWorkspaceApi(resource: string) {
  if (hasRemotePersistenceApi()) return
  throw new Error(`${resource} requires the remote workspace API.`)
}
