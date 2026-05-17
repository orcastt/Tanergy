'use client'

import { createQuery, loadAdminJson } from './adminClient'
import type {
  AdminFinanceLedgerResource,
  AdminFinanceMemberUsageResource,
  AdminFinancePaymentsResource,
  AdminFinanceQuery,
  AdminFinanceSubscriptionsResource,
  AdminFinanceSummaryResource,
  AdminFinanceWalletsResource,
} from './adminFinanceTypes'

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
