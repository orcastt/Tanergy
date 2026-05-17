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
  kind?: string
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
