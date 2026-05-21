'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { loadClientResource, readClientResource } from '@/features/shared/clientResourceCache'

type AdminFinanceState = 'error' | 'loading' | 'ready'

const emptySummary: AdminFinanceSummaryResource = { ok: false }
const emptyPayments: AdminFinancePaymentsResource = { ok: false, payments: [] }
const emptyWallets: AdminFinanceWalletsResource = { ok: false, wallets: [] }
const emptyLedger: AdminFinanceLedgerResource = { ok: false, ledger: [] }
const emptySubscriptions: AdminFinanceSubscriptionsResource = { ok: false, subscriptions: [] }
const emptyMemberUsage: AdminFinanceMemberUsageResource = { ok: false, memberUsage: [] }
const financeResourceMaxEntries = 16
type AdminFinanceBundle = {
  ledger: AdminFinanceLedgerResource
  memberUsage: AdminFinanceMemberUsageResource
  payments: AdminFinancePaymentsResource
  subscriptions: AdminFinanceSubscriptionsResource
  summary: AdminFinanceSummaryResource
  wallets: AdminFinanceWalletsResource
}
const financeResourceStore = new Map<string, {
  data?: AdminFinanceBundle
  error?: string | null
  promise?: Promise<AdminFinanceBundle>
  updatedAt: number
}>()

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
  const scopedQuery = useMemo(() => ({
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
  }), [
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
  ])
  const requestKey = useMemo(() => JSON.stringify(scopedQuery), [scopedQuery])
  const snapshot = readClientResource(financeResourceStore, requestKey, {
    maxEntries: financeResourceMaxEntries,
    storage: 'session',
    storageKey: financeStorageKey(requestKey),
    storagePrefix: 'tanergy.admin-finance.',
    ttlMs: 300_000,
  })
  const [summary, setSummary] = useState<AdminFinanceSummaryResource>(snapshot.data?.summary ?? emptySummary)
  const [payments, setPayments] = useState<AdminFinancePaymentsResource>(snapshot.data?.payments ?? emptyPayments)
  const [wallets, setWallets] = useState<AdminFinanceWalletsResource>(snapshot.data?.wallets ?? emptyWallets)
  const [ledger, setLedger] = useState<AdminFinanceLedgerResource>(snapshot.data?.ledger ?? emptyLedger)
  const [subscriptions, setSubscriptions] = useState<AdminFinanceSubscriptionsResource>(snapshot.data?.subscriptions ?? emptySubscriptions)
  const [memberUsage, setMemberUsage] = useState<AdminFinanceMemberUsageResource>(snapshot.data?.memberUsage ?? emptyMemberUsage)
  const [status, setStatus] = useState<AdminFinanceState>(snapshot.data ? 'ready' : snapshot.error ? 'error' : 'loading')
  const [error, setError] = useState<string | null>(snapshot.error ?? null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    loadClientResource(
      financeResourceStore,
      requestKey,
      async () => {
        const [nextSummary, nextPayments, nextWallets, nextLedger, nextSubscriptions, nextMemberUsage] = await Promise.all([
          loadAdminFinanceSummary(),
          loadAdminFinancePayments(scopedQuery),
          loadAdminFinanceWallets(scopedQuery),
          loadAdminFinanceLedger(scopedQuery),
          loadAdminFinanceSubscriptions(scopedQuery),
          workspaceId ? loadAdminFinanceMemberUsage(scopedQuery) : Promise.resolve(emptyMemberUsage),
        ])
        return {
          ledger: nextLedger,
          memberUsage: nextMemberUsage,
          payments: nextPayments,
          subscriptions: nextSubscriptions,
          summary: nextSummary,
          wallets: nextWallets,
        }
      },
      {
        force: reloadToken > 0,
        maxEntries: financeResourceMaxEntries,
        storage: 'session',
        storageKey: financeStorageKey(requestKey),
        storagePrefix: 'tanergy.admin-finance.',
        ttlMs: 300_000,
      },
    )
      .then((bundle) => {
        if (cancelled) return
        setSummary(bundle.summary)
        setPayments(bundle.payments)
        setWallets(bundle.wallets)
        setLedger(bundle.ledger)
        setSubscriptions(bundle.subscriptions)
        setMemberUsage(bundle.memberUsage)
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
    requestKey,
    scopedQuery,
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

function financeStorageKey(requestKey: string) {
  return `tanergy.admin-finance.${requestKey}`
}
