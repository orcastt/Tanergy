'use client'

import {
  assertRemoteBillingApi,
  clearWorkspaceBillingCaches,
  type BillingClientOptions,
  loadBillingJson,
} from './billingClientShared'
import type {
  BillingCollaborateSubscriptionCheckoutInput,
  BillingPaymentMutationResponse,
  BillingTopupCheckoutInput,
  BillingSeatPurchaseCheckoutInput,
  BillingTeamSubscriptionCheckoutInput,
  CreditLedgerMutationResponse,
  CreditTopupInput,
} from './billingTypes'

export async function createCreditTopup(input: CreditTopupInput): Promise<CreditLedgerMutationResponse> {
  assertRemoteBillingApi('Credit top-up')
  return loadBillingJson<CreditLedgerMutationResponse>('/api/v1/credits/topups', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function createBillingTopupCheckout(
  input: BillingTopupCheckoutInput,
  options: BillingClientOptions = {},
): Promise<BillingPaymentMutationResponse> {
  assertRemoteBillingApi('Top-up checkout')
  return loadBillingJson<BillingPaymentMutationResponse>(
    '/api/v1/billing/topups/checkout',
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
    options,
  )
}

export async function createCollaborateSubscriptionCheckout(
  input: BillingCollaborateSubscriptionCheckoutInput,
): Promise<BillingPaymentMutationResponse> {
  assertRemoteBillingApi('Collaborate checkout')
  return loadBillingJson<BillingPaymentMutationResponse>('/api/v1/billing/collaborate/checkout', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function createTeamSubscriptionCheckout(
  input: BillingTeamSubscriptionCheckoutInput,
): Promise<BillingPaymentMutationResponse> {
  assertRemoteBillingApi('Team checkout')
  return loadBillingJson<BillingPaymentMutationResponse>('/api/v1/billing/teams/checkout', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export async function createWorkspaceSeatCheckout(
  input: BillingSeatPurchaseCheckoutInput,
  options: BillingClientOptions = {},
): Promise<BillingPaymentMutationResponse> {
  assertRemoteBillingApi('Seat checkout')
  return loadBillingJson<BillingPaymentMutationResponse>(
    '/api/v1/billing/workspaces/current/seats/checkout',
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
    options,
  )
}

export async function createWorkspaceTopupCheckout(
  input: BillingTopupCheckoutInput,
  options: BillingClientOptions = {},
): Promise<BillingPaymentMutationResponse> {
  assertRemoteBillingApi('Workspace top-up checkout')
  return loadBillingJson<BillingPaymentMutationResponse>(
    '/api/v1/billing/workspaces/current/topups/checkout',
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
    options,
  )
}

export async function completeBillingPayment(
  paymentId: string,
  options: BillingClientOptions = {},
): Promise<BillingPaymentMutationResponse> {
  assertRemoteBillingApi('Payment completion')
  const payload = await loadBillingJson<BillingPaymentMutationResponse>(
    `/api/v1/billing/payments/${encodeURIComponent(paymentId)}/complete`,
    { method: 'POST' },
    options,
  )
  clearWorkspaceBillingCaches(options.workspace)
  return payload
}
