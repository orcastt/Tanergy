'use client'

import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeadersAsync,
} from '@/features/api/persistenceApi'
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
  PlanCatalogResponse,
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
import { clearCachedBillingResources, loadCachedBillingResource } from './billingResourceCache'

type BillingClientOptions = {
  force?: boolean
  workspace?: TangentWorkspace
}

export async function loadBillingMe(options: BillingClientOptions = {}): Promise<BillingMeResponse> {
  assertRemoteBillingApi('Billing profile')
  const workspaceKey = options.workspace?.id ?? 'current'
  return loadCachedBillingResource(
    `me:${workspaceKey}`,
    () => loadJson<BillingMeResponse>('/api/v1/billing/me', {}, options),
    { force: options.force, ttlMs: 45_000 },
  )
}

export async function loadBillingPlans(options: { force?: boolean } = {}): Promise<PlanCatalogResponse> {
  assertRemoteBillingApi('Billing plan catalog')
  return loadCachedBillingResource(
    'plans',
    () => loadJson<PlanCatalogResponse>('/api/v1/billing/plans'),
    { force: options.force, ttlMs: 300_000 },
  )
}

export async function loadWorkspaceDashboard(options: BillingClientOptions = {}): Promise<WorkspaceDashboardResponse> {
  assertRemoteBillingApi('Workspace dashboard')
  const workspaceKey = options.workspace?.id ?? 'current'
  return loadCachedBillingResource(
    `dashboard:${workspaceKey}`,
    () => loadJson<WorkspaceDashboardResponse>('/api/v1/workspaces/current/dashboard', {}, options),
    { force: options.force, ttlMs: 45_000 },
  )
}

export async function loadWorkspaceSeats(options: BillingClientOptions = {}): Promise<WorkspaceSeatAssignmentsResponse> {
  assertRemoteBillingApi('Workspace seats')
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
  clearWorkspaceBillingCaches(options.workspace)
  return payload.seat
}

export async function revokeWorkspaceSeat(userId: string, options: BillingClientOptions = {}): Promise<void> {
  if (!hasRemotePersistenceApi()) throw new Error('Seat management requires the remote workspace API.')
  await loadJson<{ ok: boolean; userId: string }>(`/api/v1/workspaces/current/seats/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  }, options)
  clearWorkspaceBillingCaches(options.workspace)
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
  clearWorkspaceBillingCaches(options.workspace)
  return payload.member
}

export async function removeWorkspaceMember(userId: string, options: BillingClientOptions = {}): Promise<void> {
  if (!hasRemotePersistenceApi()) throw new Error('Workspace member management requires the remote workspace API.')
  await loadJson<{ ok: boolean; userId: string }>(`/api/v1/workspaces/current/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  }, options)
  clearWorkspaceBillingCaches(options.workspace)
}

export async function createGroupWorkspace(input: WorkspaceCreateInput): Promise<WorkspaceCreateResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Group creation requires the remote workspace API.')
  const payload = await loadJson<WorkspaceCreateResponse>('/api/v1/workspaces/groups', {
    body: JSON.stringify(input),
    method: 'POST',
  })
  clearCachedBillingResources()
  return payload
}

export async function listWorkspaceInvitations(options: BillingClientOptions = {}): Promise<WorkspaceInvitationsResponse> {
  assertRemoteBillingApi('Workspace invitations')
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

export async function loadCreditLedger(query: CreditLedgerQuery = {}, options: BillingClientOptions = {}): Promise<CreditLedgerResponse> {
  assertRemoteBillingApi('Credit ledger')
  return loadJson<CreditLedgerResponse>(`/api/v1/credits/ledger${createQuery({ limit: query.limit ?? 20, actorUserId: query.actorUserId, reason: query.reason, sourceId: query.sourceId, sourceType: query.sourceType, workspaceId: query.workspaceId })}`, {}, options)
}

export async function createCreditTopup(input: CreditTopupInput): Promise<CreditLedgerMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Credit top-up requires the remote billing API.')
  return loadJson<CreditLedgerMutationResponse>('/api/v1/credits/topups', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function loadBillingPayments(
  query: BillingPaymentQuery = {},
  options: BillingClientOptions = {},
): Promise<BillingPaymentsResponse> {
  assertRemoteBillingApi('Billing payments')
  return loadJson<BillingPaymentsResponse>(`/api/v1/billing/payments${createQuery({
    kind: query.kind,
    limit: query.limit ?? 12,
    status: query.status,
    workspaceScoped: query.workspaceScoped ? 'true' : undefined,
  })}`, {}, options)
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
  const payload = await loadJson<BillingPaymentMutationResponse>(`/api/v1/billing/payments/${encodeURIComponent(paymentId)}/complete`, {
    method: 'POST',
  }, options)
  clearWorkspaceBillingCaches(options.workspace)
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

function clearWorkspaceBillingCaches(workspace?: TangentWorkspace) {
  clearCachedBillingResources('plans')
  if (!workspace?.id) {
    clearCachedBillingResources()
    return
  }
  clearCachedBillingResources(`dashboard:${workspace.id}`)
  clearCachedBillingResources(`me:${workspace.id}`)
}

function assertRemoteBillingApi(resource: string) {
  if (hasRemotePersistenceApi()) return
  throw new Error(`${resource} requires NEXT_PUBLIC_API_BASE_URL.`)
}
