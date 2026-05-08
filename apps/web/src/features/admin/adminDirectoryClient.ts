'use client'

import { createQuery, loadAdminJson } from './adminClient'

export type AdminDirectoryUserRecord = {
  collaboratePeriodEnd?: null | string
  collaboratePlanKey?: null | string
  collaboratePlanStatus?: null | string
  createdAt: string
  displayName: string
  email: string
  groupCount: number
  id: string
  lastLoginAt?: null | string
  locale: string
  ownedBoardCount: number
  personalWalletCredits: number
  status: string
  teamCount: number
}

export type AdminDirectoryWorkspaceRecord = {
  boardCount: number
  createdAt: string
  id: string
  kind: string
  memberCount: number
  name: string
  ownerCollaboratePlanKey?: null | string
  ownerDisplayName: string
  ownerEmail: string
  ownerId?: null | string
  planKey?: null | string
  planStatus?: null | string
  seatCapacity: number
  status: string
  subscriptionPeriodEnd?: null | string
  usageCredits: number
  walletCredits: number
}

export type AdminDirectoryWorkspaceMemberRecord = {
  chargeCount: number
  displayName: string
  email?: null | string
  joinedAt?: null | string
  lastUsageAt?: null | string
  role: string
  usageCredits: number
  userId: string
}

export type AdminDirectoryBoardRecord = {
  id: string
  ownerId: string
  savedAt: string
  title: string
  visibility: string
}

export type AdminDirectoryUsersResource = { error?: string; ok: boolean; users: AdminDirectoryUserRecord[] }
export type AdminDirectoryWorkspacesResource = { error?: string; ok: boolean; workspaces: AdminDirectoryWorkspaceRecord[] }
export type AdminDirectoryWorkspaceDetailResource = {
  boards: AdminDirectoryBoardRecord[]
  error?: string
  members: AdminDirectoryWorkspaceMemberRecord[]
  ok: boolean
  workspace?: AdminDirectoryWorkspaceRecord
}

export function loadAdminDirectoryUsers(limit: number) {
  return loadAdminJson<AdminDirectoryUsersResource>(`/api/v1/admin/directory/users${createQuery({ limit })}`)
}

export function loadAdminDirectoryWorkspaces(query: { kind?: string; limit?: number; ownerId?: string }) {
  return loadAdminJson<AdminDirectoryWorkspacesResource>(`/api/v1/admin/directory/workspaces${createQuery(query)}`)
}

export function loadAdminDirectoryWorkspaceDetail(workspaceId: string, limit = 50) {
  return loadAdminJson<AdminDirectoryWorkspaceDetailResource>(
    `/api/v1/admin/directory/workspaces/${encodeURIComponent(workspaceId)}${createQuery({ limit })}`,
  )
}
