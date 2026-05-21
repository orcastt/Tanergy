'use client'

import { createQuery, loadAdminJson } from './adminClient'
import type {
  AdminOperatorBoardMutationResource,
  AdminOperatorSubscriptionMutationResource,
  AdminOperatorUserDetailResource,
  AdminOperatorUserMutationResource,
  AdminOperatorWorkspaceInvitationCreateResource,
  AdminOperatorWorkspaceInvitationResource,
  AdminOperatorWorkspaceInvitationsResource,
  AdminOperatorWorkspaceMemberMutationResource,
  AdminOperatorUsersResource,
} from './adminTypes'

export function loadAdminOperatorUsers(query: { limit: number; offset?: number; search?: string }) {
  return loadAdminJson<AdminOperatorUsersResource>(`/api/v1/admin/operator/users${createQuery(query)}`)
}

export function loadAdminOperatorUserDetail(userId: string) {
  return loadAdminJson<AdminOperatorUserDetailResource>(`/api/v1/admin/operator/users/${encodeURIComponent(userId)}`)
}

export function adminOperatorSetUserStatus(input: { reason: string; status: 'active' | 'suspended'; userId: string }) {
  return loadAdminJson<AdminOperatorUserMutationResource>(
    `/api/v1/admin/operator/users/${encodeURIComponent(input.userId)}/status`,
    {
      body: JSON.stringify({ reason: input.reason, status: input.status }),
      method: 'POST',
    },
  )
}

export function adminOperatorDeleteUser(input: { reason: string; userId: string }) {
  return loadAdminJson<AdminOperatorUserMutationResource>(
    `/api/v1/admin/operator/users/${encodeURIComponent(input.userId)}/delete`,
    {
      body: JSON.stringify({ reason: input.reason }),
      method: 'POST',
    },
  )
}

export function adminOperatorFreezeSubscription(input: { reason: string; subscriptionId: string }) {
  return loadAdminJson<AdminOperatorSubscriptionMutationResource>(
    `/api/v1/admin/operator/subscriptions/${encodeURIComponent(input.subscriptionId)}/freeze`,
    {
      body: JSON.stringify({ reason: input.reason }),
      method: 'POST',
    },
  )
}

export function adminOperatorUnfreezeSubscription(input: { reason: string; subscriptionId: string }) {
  return loadAdminJson<AdminOperatorSubscriptionMutationResource>(
    `/api/v1/admin/operator/subscriptions/${encodeURIComponent(input.subscriptionId)}/unfreeze`,
    {
      body: JSON.stringify({ reason: input.reason }),
      method: 'POST',
    },
  )
}

export function adminOperatorUpdateWorkspaceMemberRole(input: { reason: string; role: 'admin' | 'editor' | 'viewer'; userId: string; workspaceId: string }) {
  return loadAdminJson<AdminOperatorWorkspaceMemberMutationResource>(
    `/api/v1/admin/operator/workspaces/${encodeURIComponent(input.workspaceId)}/members/${encodeURIComponent(input.userId)}`,
    {
      body: JSON.stringify({ reason: input.reason, role: input.role }),
      method: 'PATCH',
    },
  )
}

export function adminOperatorRemoveWorkspaceMember(input: { reason: string; userId: string; workspaceId: string }) {
  return loadAdminJson<AdminOperatorWorkspaceMemberMutationResource>(
    `/api/v1/admin/operator/workspaces/${encodeURIComponent(input.workspaceId)}/members/${encodeURIComponent(input.userId)}`,
    {
      body: JSON.stringify({ reason: input.reason }),
      method: 'DELETE',
    },
  )
}

export function adminOperatorAddWorkspaceMember(input: { reason: string; role: 'admin' | 'editor' | 'viewer'; userId: string; workspaceId: string }) {
  return loadAdminJson<AdminOperatorWorkspaceMemberMutationResource>(
    `/api/v1/admin/operator/workspaces/${encodeURIComponent(input.workspaceId)}/members`,
    {
      body: JSON.stringify({ reason: input.reason, role: input.role, userId: input.userId }),
      method: 'POST',
    },
  )
}

export function adminOperatorListWorkspaceInvitations(workspaceId: string) {
  return loadAdminJson<AdminOperatorWorkspaceInvitationsResource>(
    `/api/v1/admin/operator/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
  )
}

export function adminOperatorCreateWorkspaceInvitation(input: {
  email?: string
  expiresInDays: number
  reason: string
  role: 'admin' | 'editor' | 'viewer'
  targetUserId?: string
  workspaceId: string
}) {
  return loadAdminJson<AdminOperatorWorkspaceInvitationCreateResource>(
    `/api/v1/admin/operator/workspaces/${encodeURIComponent(input.workspaceId)}/invitations`,
    {
      body: JSON.stringify({
        email: input.email?.trim() || undefined,
        expiresInDays: input.expiresInDays,
        reason: input.reason,
        role: input.role,
        targetUserId: input.targetUserId?.trim() || undefined,
      }),
      method: 'POST',
    },
  )
}

export function adminOperatorRevokeWorkspaceInvitation(input: { invitationId: string; reason: string; workspaceId: string }) {
  return loadAdminJson<AdminOperatorWorkspaceInvitationResource>(
    `/api/v1/admin/operator/workspaces/${encodeURIComponent(input.workspaceId)}/invitations/${encodeURIComponent(input.invitationId)}`,
    {
      body: JSON.stringify({ reason: input.reason }),
      method: 'DELETE',
    },
  )
}

export function adminOperatorCopyBoard(input: { boardId: string; reason: string; workspaceId: string }) {
  return loadAdminJson<AdminOperatorBoardMutationResource>(
    `/api/v1/admin/operator/workspaces/${encodeURIComponent(input.workspaceId)}/boards/${encodeURIComponent(input.boardId)}/copy`,
    {
      body: JSON.stringify({ reason: input.reason }),
      method: 'POST',
    },
  )
}

export function adminOperatorDeleteBoard(input: { boardId: string; reason: string; workspaceId: string }) {
  return loadAdminJson<AdminOperatorBoardMutationResource>(
    `/api/v1/admin/operator/workspaces/${encodeURIComponent(input.workspaceId)}/boards/${encodeURIComponent(input.boardId)}`,
    {
      body: JSON.stringify({ reason: input.reason }),
      method: 'DELETE',
    },
  )
}
