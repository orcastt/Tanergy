'use client'

import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeadersAsync,
} from '@/features/api/persistenceApi'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type {
  BillingCollaborateSubscriptionCheckoutInput,
  BillingMeResponse,
  BillingPaymentMutationResponse,
  BillingPaymentQuery,
  BillingPaymentsResponse,
  BillingSeatPurchaseCheckoutInput,
  BillingTeamSubscriptionCheckoutInput,
  BillingTopupCheckoutInput,
  CreditLedgerMutationResponse,
  CreditLedgerQuery,
  CreditLedgerResponse,
  CreditTopupInput,
  WorkspaceCreateInput,
  WorkspaceCreateResponse,
  WorkspaceDashboardResponse,
  WorkspaceInvitationAcceptResponse,
  WorkspaceInvitationCreateInput,
  WorkspaceInvitationCreateResponse,
  WorkspaceInvitationResponse,
  WorkspaceInvitationsResponse,
  WorkspaceMemberRoleUpdateInput,
  WorkspaceSeatAssignmentsResponse,
  WorkspaceSeatUpsertInput,
} from './billingTypes'
import {
  createLocalBillingMe,
  createLocalCreditLedger,
  createLocalWorkspaceDashboard,
  createLocalWorkspaceSeats,
} from './billingContracts'

type BillingClientOptions = {
  workspace?: TangentWorkspace
}

export async function loadBillingMe(options: BillingClientOptions = {}): Promise<BillingMeResponse> {
  if (!hasRemotePersistenceApi()) return createLocalBillingMe(getCurrentSessionSnapshot())
  return loadJson<BillingMeResponse>('/api/v1/billing/me', {}, options)
}

export async function loadWorkspaceDashboard(options: BillingClientOptions = {}): Promise<WorkspaceDashboardResponse> {
  if (!hasRemotePersistenceApi()) return { dashboard: createLocalWorkspaceDashboard(getCurrentSessionSnapshot()), ok: true }
  return loadJson<WorkspaceDashboardResponse>('/api/v1/workspaces/current/dashboard', {}, options)
}

export async function loadWorkspaceSeats(options: BillingClientOptions = {}): Promise<WorkspaceSeatAssignmentsResponse> {
  if (!hasRemotePersistenceApi()) return createLocalWorkspaceSeats(getCurrentSessionSnapshot())
  return loadJson<WorkspaceSeatAssignmentsResponse>('/api/v1/workspaces/current/seats', {}, options)
}

export async function upsertWorkspaceSeat(
  input: WorkspaceSeatUpsertInput,
  options: BillingClientOptions = {},
): Promise<WorkspaceSeatAssignmentsResponse['seats'][number]> {
  if (!hasRemotePersistenceApi()) throw new Error('Seat management requires the remote workspace API.')
  const payload = await loadJson<{ ok: boolean; seat: WorkspaceSeatAssignmentsResponse['seats'][number] }>('/api/v1/workspaces/current/seats', {
    body: JSON.stringify(input),
    method: 'POST',
  }, options)
  return payload.seat
}

export async function revokeWorkspaceSeat(userId: string, options: BillingClientOptions = {}): Promise<void> {
  if (!hasRemotePersistenceApi()) throw new Error('Seat management requires the remote workspace API.')
  await loadJson<{ ok: boolean; userId: string }>(`/api/v1/workspaces/current/seats/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  }, options)
}

export async function updateWorkspaceMemberRole(
  userId: string,
  input: WorkspaceMemberRoleUpdateInput,
  options: BillingClientOptions = {},
): Promise<WorkspaceDashboardResponse['dashboard']['members'][number]> {
  if (!hasRemotePersistenceApi()) throw new Error('Workspace member management requires the remote workspace API.')
  const payload = await loadJson<{ member: WorkspaceDashboardResponse['dashboard']['members'][number]; ok: boolean }>(
    `/api/v1/workspaces/current/members/${encodeURIComponent(userId)}`,
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
    options,
  )
  return payload.member
}

export async function removeWorkspaceMember(userId: string, options: BillingClientOptions = {}): Promise<void> {
  if (!hasRemotePersistenceApi()) throw new Error('Workspace member management requires the remote workspace API.')
  await loadJson<{ ok: boolean; userId: string }>(`/api/v1/workspaces/current/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  }, options)
}

export async function createGroupWorkspace(input: WorkspaceCreateInput): Promise<WorkspaceCreateResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Group creation requires the remote workspace API.')
  return loadJson<WorkspaceCreateResponse>('/api/v1/workspaces/groups', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function listWorkspaceInvitations(options: BillingClientOptions = {}): Promise<WorkspaceInvitationsResponse> {
  if (!hasRemotePersistenceApi()) return { invitations: [], ok: true }
  return loadJson<WorkspaceInvitationsResponse>('/api/v1/workspaces/current/invitations', {}, options)
}

export async function createWorkspaceInvitation(
  input: WorkspaceInvitationCreateInput,
  options: BillingClientOptions = {},
): Promise<WorkspaceInvitationCreateResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Workspace invitations require the remote workspace API.')
  return loadJson<WorkspaceInvitationCreateResponse>('/api/v1/workspaces/current/invitations', {
    body: JSON.stringify(input),
    method: 'POST',
  }, options)
}

export async function acceptWorkspaceInvitation(token: string): Promise<WorkspaceInvitationAcceptResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Workspace invitations require the remote workspace API.')
  return loadJson<WorkspaceInvitationAcceptResponse>(`/api/v1/workspaces/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
  })
}

export async function revokeWorkspaceInvitation(
  invitationId: string,
  options: BillingClientOptions = {},
): Promise<WorkspaceInvitationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Workspace invitations require the remote workspace API.')
  return loadJson<WorkspaceInvitationResponse>(`/api/v1/workspaces/current/invitations/${encodeURIComponent(invitationId)}`, {
    method: 'DELETE',
  }, options)
}

export async function loadCreditLedger(query: CreditLedgerQuery = {}): Promise<CreditLedgerResponse> {
  if (!hasRemotePersistenceApi()) return createLocalCreditLedger(getCurrentSessionSnapshot())
  return loadJson<CreditLedgerResponse>(`/api/v1/credits/ledger${createQuery({ limit: query.limit ?? 20, actorUserId: query.actorUserId, reason: query.reason, sourceId: query.sourceId, sourceType: query.sourceType, workspaceId: query.workspaceId })}`)
}

export async function createCreditTopup(input: CreditTopupInput): Promise<CreditLedgerMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Credit top-up requires the remote billing API.')
  return loadJson<CreditLedgerMutationResponse>('/api/v1/credits/topups', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function loadBillingPayments(query: BillingPaymentQuery = {}): Promise<BillingPaymentsResponse> {
  if (!hasRemotePersistenceApi()) return { ok: true, payments: [] }
  return loadJson<BillingPaymentsResponse>(`/api/v1/billing/payments${createQuery({
    kind: query.kind,
    limit: query.limit ?? 12,
    status: query.status,
    workspaceScoped: query.workspaceScoped ? 'true' : undefined,
  })}`)
}

export async function createBillingTopupCheckout(
  input: BillingTopupCheckoutInput,
  options: BillingClientOptions = {},
): Promise<BillingPaymentMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Top-up checkout requires the remote billing API.')
  return loadJson<BillingPaymentMutationResponse>('/api/v1/billing/topups/checkout', {
    body: JSON.stringify(input),
    method: 'POST',
  }, options)
}

export async function createCollaborateSubscriptionCheckout(
  input: BillingCollaborateSubscriptionCheckoutInput,
): Promise<BillingPaymentMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Collaborate checkout requires the remote billing API.')
  return loadJson<BillingPaymentMutationResponse>('/api/v1/billing/collaborate/checkout', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function createTeamSubscriptionCheckout(
  input: BillingTeamSubscriptionCheckoutInput,
): Promise<BillingPaymentMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Team checkout requires the remote billing API.')
  return loadJson<BillingPaymentMutationResponse>('/api/v1/billing/teams/checkout', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function createWorkspaceSeatCheckout(
  input: BillingSeatPurchaseCheckoutInput,
  options: BillingClientOptions = {},
): Promise<BillingPaymentMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Seat checkout requires the remote billing API.')
  return loadJson<BillingPaymentMutationResponse>('/api/v1/billing/workspaces/current/seats/checkout', {
    body: JSON.stringify(input),
    method: 'POST',
  }, options)
}

export async function createWorkspaceTopupCheckout(
  input: BillingTopupCheckoutInput,
  options: BillingClientOptions = {},
): Promise<BillingPaymentMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Workspace top-up checkout requires the remote billing API.')
  return loadJson<BillingPaymentMutationResponse>('/api/v1/billing/workspaces/current/topups/checkout', {
    body: JSON.stringify(input),
    method: 'POST',
  }, options)
}

export async function completeBillingPayment(
  paymentId: string,
  options: BillingClientOptions = {},
): Promise<BillingPaymentMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Payment completion requires the remote billing API.')
  return loadJson<BillingPaymentMutationResponse>(`/api/v1/billing/payments/${encodeURIComponent(paymentId)}/complete`, {
    method: 'POST',
  }, options)
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

async function loadJson<T>(
  path: string,
  init: RequestInit = {},
  options: BillingClientOptions = {},
): Promise<T> {
  const headers = await persistenceAuthHeadersAsync(options.workspace)
  const response = await fetch(persistenceApiUrl(path), {
    ...init,
    headers: {
      ...headers,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Billing resource lookup failed.')
  return payload
}
