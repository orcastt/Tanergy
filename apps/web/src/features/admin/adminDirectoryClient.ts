'use client'

import { createQuery, loadAdminJson } from './adminClient'
export type {
  AdminDirectoryBoardRecord,
  AdminDirectoryUserRecord,
  AdminDirectoryUserResource,
  AdminDirectoryUsersResource,
  AdminDirectoryWorkspaceDetailResource,
  AdminDirectoryWorkspaceMemberRecord,
  AdminDirectoryWorkspaceRecord,
  AdminDirectoryWorkspacesResource,
} from './adminTypes'
import type {
  AdminDirectoryUserResource,
  AdminDirectoryUsersResource,
  AdminDirectoryWorkspaceDetailResource,
  AdminDirectoryWorkspacesResource,
} from './adminTypes'

export function loadAdminDirectoryUsers(query: { limit: number; offset?: number; search?: string }) {
  return loadAdminJson<AdminDirectoryUsersResource>(`/api/v1/admin/directory/users${createQuery(query)}`)
}

export function loadAdminDirectoryUser(userId: string) {
  return loadAdminJson<AdminDirectoryUserResource>(`/api/v1/admin/directory/users/${encodeURIComponent(userId)}`)
}

export function loadAdminDirectoryWorkspaces(query: { kind?: string; limit?: number; offset?: number; ownerId?: string; search?: string }) {
  return loadAdminJson<AdminDirectoryWorkspacesResource>(`/api/v1/admin/directory/workspaces${createQuery(query)}`)
}

export function loadAdminDirectoryWorkspaceDetail(workspaceId: string, limit = 50) {
  return loadAdminJson<AdminDirectoryWorkspaceDetailResource>(
    `/api/v1/admin/directory/workspaces/${encodeURIComponent(workspaceId)}${createQuery({ limit })}`,
  )
}
