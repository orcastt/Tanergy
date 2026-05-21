'use client'

import { clearCachedBillingResources } from './billingResourceCache'
import {
  assertRemoteWorkspaceApi,
  clearWorkspaceBillingCaches,
  type BillingClientOptions,
  loadBillingJson,
} from './billingClientShared'
import type {
  WorkspaceCreateInput,
  WorkspaceCreateResponse,
  WorkspaceDashboardResponse,
  WorkspaceDeleteInput,
  WorkspaceDeleteResponse,
  WorkspaceInvitationAcceptResponse,
  WorkspaceInvitationCreateInput,
  WorkspaceInvitationCreateResponse,
  WorkspaceInvitationResponse,
  WorkspaceMemberRoleUpdateInput,
  WorkspaceOwnerTransferInput,
  WorkspaceOwnerTransferResponse,
  WorkspaceSeatAssignmentsResponse,
  WorkspaceSeatUpsertInput,
  WorkspaceUpdateInput,
  WorkspaceUpdateResponse,
} from './billingTypes'

export async function upsertWorkspaceSeat(
  input: WorkspaceSeatUpsertInput,
  options: BillingClientOptions = {},
): Promise<WorkspaceSeatAssignmentsResponse['seats'][number]> {
  assertRemoteWorkspaceApi('Seat management')
  const payload = await loadBillingJson<{ ok: boolean; seat: WorkspaceSeatAssignmentsResponse['seats'][number] }>(
    '/api/v1/workspaces/current/seats',
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
    options,
  )
  clearWorkspaceBillingCaches(options.workspace)
  return payload.seat
}

export async function revokeWorkspaceSeat(userId: string, options: BillingClientOptions = {}): Promise<void> {
  assertRemoteWorkspaceApi('Seat management')
  await loadBillingJson<{ ok: boolean; userId: string }>(
    `/api/v1/workspaces/current/seats/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    options,
  )
  clearWorkspaceBillingCaches(options.workspace)
}

export async function updateWorkspaceMemberRole(
  userId: string,
  input: WorkspaceMemberRoleUpdateInput,
  options: BillingClientOptions = {},
): Promise<WorkspaceDashboardResponse['dashboard']['members'][number]> {
  assertRemoteWorkspaceApi('Workspace member management')
  const payload = await loadBillingJson<{ member: WorkspaceDashboardResponse['dashboard']['members'][number]; ok: boolean }>(
    `/api/v1/workspaces/current/members/${encodeURIComponent(userId)}`,
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
    options,
  )
  clearWorkspaceBillingCaches(options.workspace)
  return payload.member
}

export async function removeWorkspaceMember(userId: string, options: BillingClientOptions = {}): Promise<void> {
  assertRemoteWorkspaceApi('Workspace member management')
  await loadBillingJson<{ ok: boolean; userId: string }>(
    `/api/v1/workspaces/current/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    options,
  )
  clearWorkspaceBillingCaches(options.workspace)
}

export async function transferWorkspaceOwner(
  input: WorkspaceOwnerTransferInput,
  options: BillingClientOptions = {},
): Promise<WorkspaceOwnerTransferResponse['result']> {
  assertRemoteWorkspaceApi('Workspace owner transfer')
  const payload = await loadBillingJson<WorkspaceOwnerTransferResponse>(
    '/api/v1/workspaces/current/owner/transfer',
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
    options,
  )
  clearWorkspaceBillingCaches(options.workspace)
  return payload.result
}

export async function createGroupWorkspace(input: WorkspaceCreateInput): Promise<WorkspaceCreateResponse> {
  assertRemoteWorkspaceApi('Group creation')
  const payload = await loadBillingJson<WorkspaceCreateResponse>('/api/v1/workspaces/groups', {
    body: JSON.stringify(input),
    method: 'POST',
  })
  clearCachedBillingResources()
  return payload
}

export async function updateCurrentWorkspace(
  input: WorkspaceUpdateInput,
  options: BillingClientOptions = {},
): Promise<WorkspaceUpdateResponse['workspace']> {
  assertRemoteWorkspaceApi('Workspace settings')
  const payload = await loadBillingJson<WorkspaceUpdateResponse>(
    '/api/v1/workspaces/current',
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
    options,
  )
  clearWorkspaceBillingCaches(options.workspace)
  return payload.workspace
}

export async function deleteCurrentWorkspace(
  input: WorkspaceDeleteInput,
  options: BillingClientOptions = {},
): Promise<WorkspaceDeleteResponse['result']> {
  assertRemoteWorkspaceApi('Workspace deletion')
  const payload = await loadBillingJson<WorkspaceDeleteResponse>(
    '/api/v1/workspaces/current',
    {
      body: JSON.stringify(input),
      method: 'DELETE',
    },
    options,
  )
  clearWorkspaceBillingCaches(options.workspace)
  return payload.result
}

export async function createWorkspaceInvitation(
  input: WorkspaceInvitationCreateInput,
  options: BillingClientOptions = {},
): Promise<WorkspaceInvitationCreateResponse> {
  assertRemoteWorkspaceApi('Workspace invitations')
  return loadBillingJson<WorkspaceInvitationCreateResponse>(
    '/api/v1/workspaces/current/invitations',
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
    options,
  )
}

export async function acceptWorkspaceInvitation(token: string): Promise<WorkspaceInvitationAcceptResponse> {
  assertRemoteWorkspaceApi('Workspace invitations')
  return loadBillingJson<WorkspaceInvitationAcceptResponse>(
    `/api/v1/workspaces/invitations/${encodeURIComponent(token)}/accept`,
    { method: 'POST' },
  )
}

export async function revokeWorkspaceInvitation(
  invitationId: string,
  options: BillingClientOptions = {},
): Promise<WorkspaceInvitationResponse> {
  assertRemoteWorkspaceApi('Workspace invitations')
  return loadBillingJson<WorkspaceInvitationResponse>(
    `/api/v1/workspaces/current/invitations/${encodeURIComponent(invitationId)}`,
    { method: 'DELETE' },
    options,
  )
}
