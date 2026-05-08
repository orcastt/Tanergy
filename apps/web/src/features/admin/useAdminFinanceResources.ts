'use client'

import { useEffect, useState } from 'react'
import {
  loadAdminFinanceLedger,
  loadAdminFinanceMemberUsage,
  loadAdminFinancePayments,
  loadAdminFinanceSubscriptions,
  loadAdminFinanceSummary,
  loadAdminFinanceWallets,
  type AdminFinanceLedgerResource,
  type AdminFinanceMemberUsageResource,
  type AdminFinancePaymentsResource,
  type AdminFinanceQuery,
  type AdminFinanceSubscriptionsResource,
  type AdminFinanceSummaryResource,
  type AdminFinanceWalletsResource,
} from './adminFinanceClient'

type AdminFinanceState = 'error' | 'loading' | 'ready'

const emptySummary: AdminFinanceSummaryResource = { ok: false }
const emptyPayments: AdminFinancePaymentsResource = { ok: false, payments: [] }
const emptyWallets: AdminFinanceWalletsResource = { ok: false, wallets: [] }
const emptyLedger: AdminFinanceLedgerResource = { ok: false, ledger: [] }
const emptySubscriptions: AdminFinanceSubscriptionsResource = { ok: false, subscriptions: [] }
const emptyMemberUsage: AdminFinanceMemberUsageResource = { ok: false, memberUsage: [] }

export function useAdminFinanceResources(enabled: boolean, query: AdminFinanceQuery) {
  const {
    accountId,
    accountKind,
    actorUserId,
    kind,
    limit,
    ownerId,
    ownerType,
    planFamily,
    provider,
    reason,
    status: queryStatus,
    userId,
    workspaceId,
  } = query
  const [summary, setSummary] = useState<AdminFinanceSummaryResource>(emptySummary)
  const [payments, setPayments] = useState<AdminFinancePaymentsResource>(emptyPayments)
  const [wallets, setWallets] = useState<AdminFinanceWalletsResource>(emptyWallets)
  const [ledger, setLedger] = useState<AdminFinanceLedgerResource>(emptyLedger)
  const [subscriptions, setSubscriptions] = useState<AdminFinanceSubscriptionsResource>(emptySubscriptions)
  const [memberUsage, setMemberUsage] = useState<AdminFinanceMemberUsageResource>(emptyMemberUsage)
  const [status, setStatus] = useState<AdminFinanceState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const scopedQuery = {
      accountId,
      accountKind,
      actorUserId,
      kind,
      limit: limit ?? 25,
      ownerId,
      ownerType,
      planFamily,
      provider,
      reason,
      status: queryStatus,
      userId,
      workspaceId,
    }
    Promise.all([
      loadAdminFinanceSummary(),
      loadAdminFinancePayments(scopedQuery),
      loadAdminFinanceWallets(scopedQuery),
      loadAdminFinanceLedger(scopedQuery),
      loadAdminFinanceSubscriptions(scopedQuery),
      workspaceId ? loadAdminFinanceMemberUsage(scopedQuery) : Promise.resolve(emptyMemberUsage),
    ])
      .then(([nextSummary, nextPayments, nextWallets, nextLedger, nextSubscriptions, nextMemberUsage]) => {
        if (cancelled) return
        setSummary(nextSummary)
        setPayments(nextPayments)
        setWallets(nextWallets)
        setLedger(nextLedger)
        setSubscriptions(nextSubscriptions)
        setMemberUsage(nextMemberUsage)
        setError(null)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setSummary(emptySummary)
        setPayments(emptyPayments)
        setWallets(emptyWallets)
        setLedger(emptyLedger)
        setSubscriptions(emptySubscriptions)
        setMemberUsage(emptyMemberUsage)
        setError(nextError instanceof Error ? nextError.message : 'Finance resources failed to load.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [
    enabled,
    accountId,
    accountKind,
    actorUserId,
    kind,
    limit,
    ownerId,
    ownerType,
    planFamily,
    provider,
    queryStatus,
    reason,
    userId,
    workspaceId,
    reloadToken,
  ])

  return {
    error: enabled ? error : null,
    ledger: enabled ? ledger : emptyLedger,
    memberUsage: enabled ? memberUsage : emptyMemberUsage,
    payments: enabled ? payments : emptyPayments,
    reload: () => setReloadToken((value) => value + 1),
    status: enabled ? status : 'ready',
    subscriptions: enabled ? subscriptions : emptySubscriptions,
    summary: enabled ? summary : emptySummary,
    wallets: enabled ? wallets : emptyWallets,
  }
}
