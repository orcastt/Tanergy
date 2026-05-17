'use client'

import type {
  BillingMeResponse,
  BillingPaymentQuery,
  BillingPaymentsResponse,
  CreditLedgerQuery,
  CreditLedgerResponse,
  PlanCatalogResponse,
  WorkspaceDashboardResponse,
  WorkspaceSeatAssignmentsResponse,
  WorkspaceInvitationsResponse,
} from './billingTypes'
import { loadCachedBillingResource } from './billingResourceCache'
import {
  assertRemoteBillingApi,
  createBillingQuery,
  type BillingClientOptions,
  loadBillingJson,
} from './billingClientShared'

export async function loadBillingMe(options: BillingClientOptions = {}): Promise<BillingMeResponse> {
  assertRemoteBillingApi('Billing profile')
  const workspaceKey = options.workspace?.id ?? 'current'
  return loadCachedBillingResource(
    `me:${workspaceKey}`,
    () => loadBillingJson<BillingMeResponse>('/api/v1/billing/me', {}, options),
    { force: options.force, ttlMs: 45_000 },
  )
}

export async function loadBillingPlans(options: { force?: boolean } = {}): Promise<PlanCatalogResponse> {
  assertRemoteBillingApi('Billing plan catalog')
  return loadCachedBillingResource(
    'plans',
    () => loadBillingJson<PlanCatalogResponse>('/api/v1/billing/plans'),
    { force: options.force, ttlMs: 300_000 },
  )
}

export async function loadWorkspaceDashboard(options: BillingClientOptions = {}): Promise<WorkspaceDashboardResponse> {
  assertRemoteBillingApi('Workspace dashboard')
  const workspaceKey = options.workspace?.id ?? 'current'
  return loadCachedBillingResource(
    `dashboard:${workspaceKey}`,
    () => loadBillingJson<WorkspaceDashboardResponse>('/api/v1/workspaces/current/dashboard', {}, options),
    { force: options.force, ttlMs: 45_000 },
  )
}

export async function loadWorkspaceSeats(options: BillingClientOptions = {}): Promise<WorkspaceSeatAssignmentsResponse> {
  assertRemoteBillingApi('Workspace seats')
  return loadBillingJson<WorkspaceSeatAssignmentsResponse>('/api/v1/workspaces/current/seats', {}, options)
}

export async function listWorkspaceInvitations(options: BillingClientOptions = {}): Promise<WorkspaceInvitationsResponse> {
  assertRemoteBillingApi('Workspace invitations')
  return loadBillingJson<WorkspaceInvitationsResponse>('/api/v1/workspaces/current/invitations', {}, options)
}

export async function loadCreditLedger(
  query: CreditLedgerQuery = {},
  options: BillingClientOptions = {},
): Promise<CreditLedgerResponse> {
  assertRemoteBillingApi('Credit ledger')
  return loadBillingJson<CreditLedgerResponse>(`/api/v1/credits/ledger${createBillingQuery({
    limit: query.limit ?? 20,
    actorUserId: query.actorUserId,
    reason: query.reason,
    sourceId: query.sourceId,
    sourceType: query.sourceType,
    workspaceId: query.workspaceId,
  })}`, {}, options)
}

export async function loadBillingPayments(
  query: BillingPaymentQuery = {},
  options: BillingClientOptions = {},
): Promise<BillingPaymentsResponse> {
  assertRemoteBillingApi('Billing payments')
  return loadBillingJson<BillingPaymentsResponse>(`/api/v1/billing/payments${createBillingQuery({
    kind: query.kind,
    limit: query.limit ?? 12,
    status: query.status,
    workspaceScoped: query.workspaceScoped ? 'true' : undefined,
  })}`, {}, options)
}
