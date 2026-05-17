'use client'

import { hasRemotePersistenceApi, persistenceAuthHeadersAsync } from '@/features/api/persistenceApi'
export type {
  AdminAccess,
  AdminAuditLogRecord,
  AdminAuditLogsResource,
  AdminBoardRecord,
  AdminBoardsResource,
  AdminRoleListResource,
  AdminRoleMutationResource,
  AdminRoleRecord,
  AdminSummaryResource,
  AdminSummaryRecord,
  AdminUserRecord,
  AdminUsersResource,
  AdminWorkspaceRecord,
  AdminWorkspacesResource,
} from './adminTypes'
import type {
  AdminAccess,
  AdminAuditLogsResource,
  AdminBoardsResource,
  AdminRoleListResource,
  AdminRoleMutationResource,
  AdminRoleRecord,
  AdminSummaryResource,
  AdminUsersResource,
  AdminWorkspacesResource,
} from './adminTypes'

type AdminMeResponse = {
  canAccessAdmin: boolean
  error?: string
  ok: boolean
  roles?: AdminRoleRecord[]
  userId?: string
}

type AdminRequestOptions = {
  getAuthToken?: () => Promise<null | string>
}

type AdminRoleGrantInput = {
  note?: string
  permissions?: Record<string, unknown>
  reason: string
  role: string
  userId: string
}

type AdminAuditQuery = {
  action?: string
  actorUserId?: string
  limit?: number
  targetUserId?: string
}

export async function loadAdminJson<T>(
  path: string,
  init: RequestInit = {},
  options: AdminRequestOptions = {},
): Promise<T> {
  if (!hasRemotePersistenceApi()) {
    throw new Error('Admin API proxy requires NEXT_PUBLIC_API_BASE_URL.')
  }
  const headers = options.getAuthToken
    ? await persistenceAuthHeadersAsync(undefined, { getAuthToken: options.getAuthToken })
    : await persistenceAuthHeadersAsync()
  const response = await fetch(toAdminProxyPath(path), {
    ...init,
    headers: {
      ...headers,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const payload = await readAdminPayload<T>(response)
  if (!response.ok) {
    throw new Error(payload.error || formatAdminErrorDetail(payload.detail) || 'Admin resource lookup failed.')
  }
  return payload
}

function toAdminProxyPath(path: string) {
  const normalizedPath = path.replace(/^\/api\/v1\/admin\/?/, '').replace(/^\/+/, '')
  return `/api/admin-proxy/${normalizedPath}`
}

export function createQuery(params: Record<string, boolean | null | number | string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function loadAdminAccess(options: AdminRequestOptions = {}): Promise<AdminAccess> {
  if (!hasRemotePersistenceApi()) {
    return {
      apiMode: 'local-unavailable',
      canAccessAdmin: false,
      error: 'Admin access requires NEXT_PUBLIC_API_BASE_URL so the frontend can call the server admin contract.',
      ok: false,
      roles: [],
    }
  }
  const payload = await loadAdminJson<AdminMeResponse>('/api/v1/admin/me', {}, options)
  return { apiMode: 'remote', canAccessAdmin: payload.canAccessAdmin, error: payload.error, ok: payload.ok, roles: payload.roles ?? [], userId: payload.userId }
}

export async function loadAdminSummary(): Promise<AdminSummaryResource> {
  return loadAdminJson<AdminSummaryResource>('/api/v1/admin/summary')
}

export async function loadAdminUsers(limit: number): Promise<AdminUsersResource> {
  return loadAdminJson<AdminUsersResource>(`/api/v1/admin/users${createQuery({ limit })}`)
}

export async function loadAdminWorkspaces(limit: number): Promise<AdminWorkspacesResource> {
  return loadAdminJson<AdminWorkspacesResource>(`/api/v1/admin/workspaces${createQuery({ limit })}`)
}

export async function loadAdminBoards(limit: number): Promise<AdminBoardsResource> {
  return loadAdminJson<AdminBoardsResource>(`/api/v1/admin/boards${createQuery({ limit })}`)
}

export async function loadAdminAuditLogs(query: AdminAuditQuery): Promise<AdminAuditLogsResource> {
  return loadAdminJson<AdminAuditLogsResource>(`/api/v1/admin/audit-logs${createQuery(query)}`)
}

export async function loadAdminRoles(userId: string): Promise<AdminRoleListResource> {
  return loadAdminJson<AdminRoleListResource>(`/api/v1/admin/roles${createQuery({ userId })}`)
}

export async function grantAdminRole(input: AdminRoleGrantInput): Promise<AdminRoleMutationResource> {
  return loadAdminJson<AdminRoleMutationResource>('/api/v1/admin/roles', {
    body: JSON.stringify({ note: input.note, permissions: input.permissions ?? {}, reason: input.reason, role: input.role, userId: input.userId }),
    method: 'POST',
  })
}

export async function revokeAdminRole(userId: string, role: string, reason: string): Promise<AdminRoleMutationResource> {
  return loadAdminJson<AdminRoleMutationResource>(
    `/api/v1/admin/roles/${encodeURIComponent(userId)}/${encodeURIComponent(role)}${createQuery({ reason })}`,
    {
      method: 'DELETE',
    },
  )
}

async function readAdminPayload<T>(response: Response): Promise<T & { detail?: unknown; error?: string }> {
  const text = await response.text()
  if (!text) return {} as T & { detail?: unknown; error?: string }
  try {
    return JSON.parse(text) as T & { detail?: unknown; error?: string }
  } catch {
    return { error: text } as T & { detail?: unknown; error?: string }
  }
}

function formatAdminErrorDetail(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim()
  }
  if (!detail || typeof detail !== 'object') {
    return null
  }
  const record = detail as { blockers?: Array<{ code?: string; message?: string; workspaceName?: string }>; message?: string }
  const message = typeof record.message === 'string' && record.message.trim() ? record.message.trim() : null
  const blockerLabels = Array.isArray(record.blockers)
    ? record.blockers
      .map((blocker) => {
        if (typeof blocker?.message === 'string' && blocker.message.trim()) return blocker.message.trim()
        if (typeof blocker?.workspaceName === 'string' && blocker.workspaceName.trim()) return blocker.workspaceName.trim()
        if (typeof blocker?.code === 'string' && blocker.code.trim()) return blocker.code.trim().replaceAll('_', ' ')
        return null
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 3)
    : []
  if (!message && blockerLabels.length === 0) {
    return null
  }
  if (blockerLabels.length === 0) {
    return message
  }
  return `${message ?? 'Action is blocked.'} ${blockerLabels.join(' · ')}`
}
