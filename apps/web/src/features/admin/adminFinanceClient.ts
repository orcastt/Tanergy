'use client'

import { createQuery, loadAdminJson } from './adminClient'

export type AdminFinanceCountRecord = { amountCents: number; count: number; key: string }
export type AdminFinanceAccountCountRecord = { accountKind: string; count: number; ownerType: string; status: string }
export type AdminFinanceSubscriptionCountRecord = { count: number; planFamily: string; seatCapacity: number; status: string }
export type AdminFinanceLedgerTotals = { balanceCredits: number; grantedCredits: number; spentCredits: number }

export type AdminFinanceSummaryRecord = {
  accountCounts: AdminFinanceAccountCountRecord[]
  ledgerTotals: AdminFinanceLedgerTotals
  paymentKindCounts: AdminFinanceCountRecord[]
  paymentProviderCounts: AdminFinanceCountRecord[]
  paymentStatusCounts: AdminFinanceCountRecord[]
  subscriptionCounts: AdminFinanceSubscriptionCountRecord[]
}

export type AdminFinancePaymentRecord = {
  accountId?: null | string
  accountKind?: null | string
  amountCents: number
  checkoutSessionId?: null | string
  createdAt: string
  currency: string
  id: string
  kind: string
  metadata: Record<string, unknown>
  ownerId?: null | string
  ownerType?: null | string
  provider: string
  providerPaymentId?: null | string
  status: string
}

export type AdminFinanceWalletRecord = {
  accountId: string
  accountKind: string
  balanceCredits: number
  createdAt: string
  ownerId: string
  ownerType: string
  status: string
  updatedAt: string
}

export type AdminFinanceLedgerRecord = {
  accountId: string
  accountKind?: null | string
  actorUserId?: null | string
  createdAt: string
  creditsDelta: number
  id: string
  metadata: Record<string, unknown>
  ownerId?: null | string
  ownerType?: null | string
  reason: string
  sourceId?: null | string
  sourceType: string
  workspaceId?: null | string
}

export type AdminFinanceSubscriptionRecord = {
  accountId: string
  createdAt: string
  currentPeriodEnd?: null | string
  currentPeriodStart?: null | string
  id: string
  ownerId: string
  ownerType: string
  planFamily: string
  planKey: string
  provider: string
  providerCustomerId?: null | string
  providerSubscriptionId?: null | string
  seatCapacity: number
  status: string
  updatedAt: string
  workspaceId?: null | string
}

export type AdminFinanceMemberUsageRecord = {
  chargeCount: number
  displayName: string
  email?: null | string
  lastUsageAt?: null | string
  role: string
  usageCredits: number
  userId: string
  workspaceId: string
}

export type AdminFinanceSummaryResource = { error?: string; ok: boolean; summary?: AdminFinanceSummaryRecord }
export type AdminFinancePaymentsResource = { error?: string; ok: boolean; payments: AdminFinancePaymentRecord[] }
export type AdminFinanceWalletsResource = { error?: string; ok: boolean; wallets: AdminFinanceWalletRecord[] }
export type AdminFinanceLedgerResource = { error?: string; ledger: AdminFinanceLedgerRecord[]; ok: boolean }
export type AdminFinanceSubscriptionsResource = { error?: string; ok: boolean; subscriptions: AdminFinanceSubscriptionRecord[] }
export type AdminFinanceMemberUsageResource = { error?: string; memberUsage: AdminFinanceMemberUsageRecord[]; ok: boolean }

export type AdminFinanceQuery = {
  accountId?: string
  accountKind?: string
  actorUserId?: string
  kind?: string
  limit?: number
  ownerId?: string
  ownerType?: string
  planFamily?: string
  provider?: string
  reason?: string
  status?: string
  userId?: string
  workspaceId?: string
}

export function loadAdminFinanceSummary() {
  return loadAdminJson<AdminFinanceSummaryResource>('/api/v1/admin/finance/summary')
}

export function loadAdminFinancePayments(query: AdminFinanceQuery) {
  return loadAdminJson<AdminFinancePaymentsResource>(`/api/v1/admin/finance/payments${createQuery(query)}`)
}

export function loadAdminFinanceWallets(query: AdminFinanceQuery) {
  return loadAdminJson<AdminFinanceWalletsResource>(`/api/v1/admin/finance/wallets${createQuery(query)}`)
}

export function loadAdminFinanceLedger(query: AdminFinanceQuery) {
  return loadAdminJson<AdminFinanceLedgerResource>(`/api/v1/admin/finance/credit-ledger${createQuery(query)}`)
}

export function loadAdminFinanceSubscriptions(query: AdminFinanceQuery) {
  return loadAdminJson<AdminFinanceSubscriptionsResource>(`/api/v1/admin/finance/subscriptions${createQuery(query)}`)
}

export function loadAdminFinanceMemberUsage(query: AdminFinanceQuery) {
  return loadAdminJson<AdminFinanceMemberUsageResource>(`/api/v1/admin/finance/member-usage${createQuery(query)}`)
}
