'use client'

import { getSessionRequestHeaders } from '@/features/auth/mockSession'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { hasConfiguredRemoteApiBaseUrl } from './runtimeBridgePolicy'

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')
const apiOrigin = getApiOrigin(apiBaseUrl)

export function hasRemotePersistenceApi() {
  return hasConfiguredRemoteApiBaseUrl()
}

export function persistenceApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${normalizedPath}`
}

export function persistenceWebSocketUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  if (!base) return normalizedPath
  const url = new URL(normalizedPath, base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export function persistenceAssetUrl(url: string | undefined) {
  if (!url || !apiBaseUrl || !url.startsWith('/api/v1/')) return url
  return `${apiBaseUrl}${url}`
}

export function persistenceAssetProxyUrl(
  url: null | string | undefined,
  workspace?: null | Pick<TangentWorkspace, 'id'> | string,
) {
  if (!url) return undefined
  const workspaceId = resolveWorkspaceId(workspace)
  if (url.startsWith('/api/assets/')) return appendWorkspaceIdToAssetProxyPath(url, workspaceId)
  const path = getRemoteAssetPath(url)
  if (!path?.startsWith('/api/v1/assets/files/')) return url
  return appendWorkspaceIdToAssetProxyPath(
    path.replace('/api/v1/assets/files/', '/api/assets/files/'),
    workspaceId,
  )
}

export function persistenceAuthHeaders(workspace?: TangentWorkspace): HeadersInit {
  return getLocalDevSessionHeaders(workspace)
}

export function persistenceJsonHeaders(workspace?: TangentWorkspace): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...getLocalDevSessionHeaders(workspace),
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

export async function getPersistenceAuthToken(options: PersistenceAuthOptions = {}) {
  try {
    return options.getAuthToken?.() ?? await getBrowserClerkToken()
  } catch (error) {
    if (shouldUseLocalDevHeaders()) return null
    throw error
  }
}

async function withClerkAuthorization(headers: HeadersInit, options: PersistenceAuthOptions = {}): Promise<HeadersInit> {
  const token = await getPersistenceAuthToken(options)
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
  return workspace ? getLocalDevSessionHeaders(workspace) : {}
}

function getBaseJsonHeaders(workspace?: TangentWorkspace): HeadersInit {
  return workspace
    ? {
      'Content-Type': 'application/json',
      ...getLocalDevSessionHeaders(workspace),
    }
    : { 'Content-Type': 'application/json' }
}

function getLocalDevSessionHeaders(workspace?: TangentWorkspace): Record<string, string> {
  if (process.env.NODE_ENV === 'production') return workspace ? getWorkspaceSelectionHeaders(workspace) : {}
  return getSessionRequestHeaders(workspace)
}

function getWorkspaceSelectionHeaders(workspace: TangentWorkspace): Record<string, string> {
  const headers: Record<string, string> = {
    'x-tangent-workspace-id': workspace.id,
    'x-tangent-workspace-kind': workspace.kind,
    'x-tangent-workspace-name': workspace.name,
    'x-tangent-workspace-role': workspace.role,
  }
  if (workspace.planKey) headers['x-tangent-plan-key'] = workspace.planKey
  return headers
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getApiOrigin(baseUrl: string) {
  if (!baseUrl) return ''
  try {
    return new URL(baseUrl).origin
  } catch {
    return ''
  }
}

function getRemoteAssetPath(url: string) {
  if (url.startsWith('/api/v1/')) return url
  if (!apiOrigin) return null
  try {
    const resolved = new URL(url)
    if (resolved.origin !== apiOrigin) return null
    return `${resolved.pathname}${resolved.search}`
  } catch {
    return null
  }
}

function resolveWorkspaceId(workspace?: null | Pick<TangentWorkspace, 'id'> | string) {
  if (!workspace) return null
  const candidate = typeof workspace === 'string' ? workspace : workspace.id
  const trimmed = candidate.trim()
  return trimmed || null
}

function appendWorkspaceIdToAssetProxyPath(path: string, workspaceId: null | string) {
  if (!workspaceId || !path.startsWith('/api/assets/files/')) return path
  try {
    const resolved = new URL(path, 'http://tangent.local')
    if (!resolved.searchParams.get('workspaceId')) {
      resolved.searchParams.set('workspaceId', workspaceId)
    }
    return `${resolved.pathname}${resolved.search}`
  } catch {
    return path
  }
}
