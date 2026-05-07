'use client'

import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeadersAsync,
} from '@/features/api/persistenceApi'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'
import type {
  BillingMeResponse,
  BillingPaymentMutationResponse,
  BillingPaymentQuery,
  BillingPaymentsResponse,
  BillingSeatPurchaseCheckoutInput,
  BillingTopupCheckoutInput,
  CreditLedgerMutationResponse,
  CreditLedgerQuery,
  CreditLedgerResponse,
  CreditTopupInput,
  WorkspaceDashboardResponse,
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

export async function loadBillingMe(): Promise<BillingMeResponse> {
  if (!hasRemotePersistenceApi()) return createLocalBillingMe(getCurrentSessionSnapshot())
  return loadJson<BillingMeResponse>('/api/v1/billing/me')
}

export async function loadWorkspaceDashboard(): Promise<WorkspaceDashboardResponse> {
  if (!hasRemotePersistenceApi()) return { dashboard: createLocalWorkspaceDashboard(getCurrentSessionSnapshot()), ok: true }
  return loadJson<WorkspaceDashboardResponse>('/api/v1/workspaces/current/dashboard')
}

export async function loadWorkspaceSeats(): Promise<WorkspaceSeatAssignmentsResponse> {
  if (!hasRemotePersistenceApi()) return createLocalWorkspaceSeats(getCurrentSessionSnapshot())
  return loadJson<WorkspaceSeatAssignmentsResponse>('/api/v1/workspaces/current/seats')
}

export async function upsertWorkspaceSeat(input: WorkspaceSeatUpsertInput): Promise<WorkspaceSeatAssignmentsResponse['seats'][number]> {
  if (!hasRemotePersistenceApi()) throw new Error('Seat management requires the remote workspace API.')
  const payload = await loadJson<{ ok: boolean; seat: WorkspaceSeatAssignmentsResponse['seats'][number] }>('/api/v1/workspaces/current/seats', {
    body: JSON.stringify(input),
    method: 'POST',
  })
  return payload.seat
}

export async function revokeWorkspaceSeat(userId: string): Promise<void> {
  if (!hasRemotePersistenceApi()) throw new Error('Seat management requires the remote workspace API.')
  await loadJson<{ ok: boolean; userId: string }>(`/api/v1/workspaces/current/seats/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
}

export async function updateWorkspaceMemberRole(
  userId: string,
  input: WorkspaceMemberRoleUpdateInput,
): Promise<WorkspaceDashboardResponse['dashboard']['members'][number]> {
  if (!hasRemotePersistenceApi()) throw new Error('Workspace member management requires the remote workspace API.')
  const payload = await loadJson<{ member: WorkspaceDashboardResponse['dashboard']['members'][number]; ok: boolean }>(
    `/api/v1/workspaces/current/members/${encodeURIComponent(userId)}`,
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
  )
  return payload.member
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

export async function createBillingTopupCheckout(input: BillingTopupCheckoutInput): Promise<BillingPaymentMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Top-up checkout requires the remote billing API.')
  return loadJson<BillingPaymentMutationResponse>('/api/v1/billing/topups/checkout', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function createWorkspaceSeatCheckout(input: BillingSeatPurchaseCheckoutInput): Promise<BillingPaymentMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Seat checkout requires the remote billing API.')
  return loadJson<BillingPaymentMutationResponse>('/api/v1/billing/workspaces/current/seats/checkout', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function completeBillingPayment(paymentId: string): Promise<BillingPaymentMutationResponse> {
  if (!hasRemotePersistenceApi()) throw new Error('Payment completion requires the remote billing API.')
  return loadJson<BillingPaymentMutationResponse>(`/api/v1/billing/payments/${encodeURIComponent(paymentId)}/complete`, {
    method: 'POST',
  })
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

async function loadJson<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  if (!response.ok) throw new Error(payload.error || 'Billing resource lookup failed.')
  return payload
}
