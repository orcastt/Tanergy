'use client'

import { hasRemotePersistenceApi, persistenceApiUrl, persistenceAuthHeadersAsync } from '@/features/api/persistenceApi'

export type AdminRoleRecord = {
  createdAt: string
  grantedBy?: null | string
  note?: null | string
  permissions: Record<string, unknown>
  role: string
}

export type AdminSummaryRecord = {
  adminUserCount: number
  boardsCount: number
  usersCount: number
  workspacesCount: number
}

export type AdminUserRecord = {
  createdAt: string
  displayName: string
  email: string
  id: string
  lastLoginAt?: null | string
  locale: string
  status: string
}

export type AdminWorkspaceRecord = {
  createdAt?: null | string
  id: string
  name: string
  ownerId?: null | string
  status: string
}

export type AdminBoardRecord = {
  id: string
  ownerId: string
  savedAt: string
  title: string
  visibility: string
  workspaceId: string
}

export type AdminAuditLogRecord = {
  action: string
  actorUserId?: null | string
  createdAt: string
  id: string
  metadata: Record<string, unknown>
  targetUserId?: null | string
  workspaceId?: null | string
}

export type AdminAccess = {
  apiMode: 'local-unavailable' | 'remote'
  canAccessAdmin: boolean
  error?: string
  ok: boolean
  roles: AdminRoleRecord[]
  userId?: string
}

export type AdminSummaryResource = { error?: string; ok: boolean; summary?: AdminSummaryRecord }
export type AdminUsersResource = { error?: string; ok: boolean; users: AdminUserRecord[] }
export type AdminWorkspacesResource = { error?: string; ok: boolean; workspaces: AdminWorkspaceRecord[] }
export type AdminBoardsResource = { boards: AdminBoardRecord[]; error?: string; ok: boolean }
export type AdminAuditLogsResource = { error?: string; logs: AdminAuditLogRecord[]; ok: boolean }
export type AdminRoleListResource = { error?: string; ok: boolean; roles: AdminRoleRecord[]; userId: string }
export type AdminRoleMutationResource = {
  auditId?: null | string
  error?: string
  ok: boolean
  role?: AdminRoleRecord
  userId: string
}

type AdminMeResponse = {
  canAccessAdmin: boolean
  error?: string
  ok: boolean
  roles?: AdminRoleRecord[]
  userId?: string
}

type AdminRoleGrantInput = {
  note?: string
  permissions?: Record<string, unknown>
  role: string
  userId: string
}

type AdminAuditQuery = {
  action?: string
  actorUserId?: string
  limit?: number
  targetUserId?: string
}

async function loadAdminJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await persistenceAuthHeadersAsync()
  const response = await fetch(persistenceApiUrl(path), {
    ...init,
    headers: {
      ...headers,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Admin resource lookup failed.')
  return payload
}

function createQuery(params: Record<string, null | number | string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function loadAdminAccess(): Promise<AdminAccess> {
  if (!hasRemotePersistenceApi()) {
    return {
      apiMode: 'local-unavailable',
      canAccessAdmin: false,
      error: 'Admin access requires NEXT_PUBLIC_API_BASE_URL so the frontend can call the server admin contract.',
      ok: false,
      roles: [],
    }
  }
  const payload = await loadAdminJson<AdminMeResponse>('/api/v1/admin/me')
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
    body: JSON.stringify({ note: input.note, permissions: input.permissions ?? {}, role: input.role, userId: input.userId }),
    method: 'POST',
  })
}

export async function revokeAdminRole(userId: string, role: string): Promise<AdminRoleMutationResource> {
  return loadAdminJson<AdminRoleMutationResource>(`/api/v1/admin/roles/${encodeURIComponent(userId)}/${encodeURIComponent(role)}`, {
    method: 'DELETE',
  })
}
