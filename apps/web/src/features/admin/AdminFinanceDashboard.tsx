'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminFinanceManualControls } from './AdminFinanceManualControls'
import { useAdminFinanceResources } from './useAdminFinanceResources'
import {
  groupWorkspaceDirectoryKind,
  loadAdminWorkspaceDirectoryResource,
  primeAdminWorkspaceDirectoryResource,
  readAdminWorkspaceDirectoryResource,
  teamWorkspaceDirectoryKind,
} from './adminDirectoryCache'
import type { AdminDirectoryWorkspacesResource } from './adminTypes'
import {
  EmptyRow,
  FilterSelect,
  FilterTextInput,
  MetaLine,
  filterGridStyle,
  formatDate,
  formatNumber,
  limitOptions,
  schemaPreview,
} from './adminAiShared'

const paymentKinds = ['topup', 'workspace_topup', 'seat_purchase', 'team_subscription', 'collaborate_subscription']
const ledgerReasons = ['topup_purchase', 'subscription_grant', 'usage_charge', 'usage_refund', 'seat_change_adjustment', 'admin_adjustment']
const planFamilies = ['collaborate', 'team', 'enterprise', 'free']
const ownerTypes = ['user', 'workspace']
const emptyWorkspaces: AdminDirectoryWorkspacesResource = { limit: 100, offset: 0, ok: false, totalCount: 0, workspaces: [] }
const financeTableTabs = [
  { id: 'payments', label: 'Payments' },
  { id: 'wallets', label: 'Wallets' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'ledger', label: 'Credit ledger' },
  { id: 'memberUsage', label: 'Member usage' },
] as const
type FinanceTableTab = (typeof financeTableTabs)[number]['id']

export function AdminFinanceDashboard({
  enabled,
  groupsSeed,
  teamsSeed,
}: {
  enabled: boolean
  groupsSeed: AdminDirectoryWorkspacesResource
  teamsSeed: AdminDirectoryWorkspacesResource
}) {
  const teamsQuery = useMemo(() => ({ kind: teamWorkspaceDirectoryKind, limit: 100 }), [])
  const groupsQuery = useMemo(() => ({ kind: groupWorkspaceDirectoryKind, limit: 100 }), [])
  const teamsSnapshot = readAdminWorkspaceDirectoryResource(teamsQuery)
  const groupsSnapshot = readAdminWorkspaceDirectoryResource(groupsQuery)
  const [teamsDirectory, setTeamsDirectory] = useState<AdminDirectoryWorkspacesResource>(teamsSeed.ok ? teamsSeed : teamsSnapshot.data ?? emptyWorkspaces)
  const [groupsDirectory, setGroupsDirectory] = useState<AdminDirectoryWorkspacesResource>(groupsSeed.ok ? groupsSeed : groupsSnapshot.data ?? emptyWorkspaces)
  const [limit, setLimit] = useState<(typeof limitOptions)[number]>(25)
  const [workspaceId, setWorkspaceId] = useState('')
  const [userId, setUserId] = useState('')
  const [paymentKind, setPaymentKind] = useState('')
  const [provider, setProvider] = useState('')
  const [ledgerReason, setLedgerReason] = useState('')
  const [ownerType, setOwnerType] = useState('')
  const [planFamily, setPlanFamily] = useState('')
  const [activeTable, setActiveTable] = useState<FinanceTableTab>('payments')

  useEffect(() => {
    if (teamsSeed.ok) primeAdminWorkspaceDirectoryResource(teamsQuery, teamsSeed)
    if (groupsSeed.ok) primeAdminWorkspaceDirectoryResource(groupsQuery, groupsSeed)
  }, [groupsQuery, groupsSeed, teamsQuery, teamsSeed])

  useEffect(() => {
    if (!enabled) return
    if (teamsDirectory.ok && groupsDirectory.ok) return

    let cancelled = false
    Promise.allSettled([
      loadAdminWorkspaceDirectoryResource(teamsQuery),
      loadAdminWorkspaceDirectoryResource(groupsQuery),
    ]).then((results) => {
      if (cancelled) return
      if (results[0].status === 'fulfilled') setTeamsDirectory(results[0].value)
      if (results[1].status === 'fulfilled') setGroupsDirectory(results[1].value)
    })

    return () => {
      cancelled = true
    }
  }, [enabled, groupsDirectory.ok, groupsQuery, teamsDirectory.ok, teamsQuery])

  const workspaces = useMemo(
    () => [...teamsDirectory.workspaces, ...groupsDirectory.workspaces],
    [groupsDirectory.workspaces, teamsDirectory.workspaces],
  )
  const workspaceOptions = useMemo(
    () => workspaces.map((workspace) => ({ label: `${workspace.name} (${workspace.kind})`, value: workspace.id })),
    [workspaces],
  )
  const defaultWorkspaceId = workspaceOptions[0]?.value ?? ''
  const selectedWorkspaceId = workspaceId || defaultWorkspaceId
  const finance = useAdminFinanceResources(enabled, {
    kind: paymentKind || undefined,
    limit,
    ownerType: ownerType || undefined,
    planFamily: planFamily || undefined,
    provider: provider || undefined,
    reason: ledgerReason || undefined,
    userId: userId || undefined,
    workspaceId: selectedWorkspaceId || undefined,
  })
  const activeTableLabel = financeTableTabs.find((tab) => tab.id === activeTable)?.label ?? 'Payments'

  return (
    <>
      <section className="management-panel management-panel-wide" aria-label="Finance reconciliation controls">
        <div className="management-panel-heading">
          <div><h2>Finance reconciliation</h2></div>
          <div className="management-actions">
            <div className="management-segmented">{limitOptions.map((option) => <button key={option} className={option === limit ? 'is-active' : undefined} onClick={() => setLimit(option)} type="button">{option}</button>)}</div>
            <button className="product-button product-button-secondary" onClick={finance.reload} type="button">Reload</button>
            <span className={`management-status ${finance.status === 'ready' ? 'is-success' : ''}`}>{finance.status}</span>
          </div>
        </div>
        {finance.error ? <p>{finance.error}</p> : null}
        <div style={filterGridStyle(4)}>
          <FilterSelect label="Workspace" onChange={setWorkspaceId} options={workspaceOptions} value={selectedWorkspaceId} />
          <FilterTextInput label="User" leadingIcon="search" onChange={setUserId} placeholder="user_id" value={userId} />
          <FilterSelect label="Payment kind" onChange={setPaymentKind} options={paymentKinds} value={paymentKind} />
          <FilterTextInput label="Provider" onChange={setProvider} placeholder="manual_test, stripe" value={provider} />
          <FilterSelect label="Ledger reason" onChange={setLedgerReason} options={ledgerReasons} value={ledgerReason} />
          <FilterSelect label="Plan family" onChange={setPlanFamily} options={planFamilies} value={planFamily} />
          <FilterSelect label="Owner type" onChange={setOwnerType} options={ownerTypes} value={ownerType} />
          <button className="product-button product-button-secondary" onClick={() => {
            setLedgerReason('')
            setOwnerType('')
            setPaymentKind('')
            setPlanFamily('')
            setProvider('')
            setUserId('')
          }} type="button">Clear filters</button>
        </div>
      </section>

      <AdminFinanceManualControls
        enabled={enabled}
        onMutated={finance.reload}
        selectedWorkspaceId={selectedWorkspaceId}
        workspaces={workspaceOptions}
      />

      <section className="management-panel management-panel-wide" aria-label="Finance records">
        <div className="management-panel-heading">
          <div><h2>{activeTableLabel}</h2></div>
          <div className="management-segmented management-console-tabs">
            {financeTableTabs.map((tab) => (
              <button key={tab.id} className={tab.id === activeTable ? 'is-active' : undefined} onClick={() => setActiveTable(tab.id)} type="button">
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <FinanceRecordsTable activeTable={activeTable} finance={finance} />
      </section>
    </>
  )
}

function FinanceRecordsTable({
  activeTable,
  finance,
}: {
  activeTable: FinanceTableTab
  finance: ReturnType<typeof useAdminFinanceResources>
}) {
  if (activeTable === 'wallets') return <WalletsPanel wallets={finance.wallets.wallets} />
  if (activeTable === 'subscriptions') return <SubscriptionsPanel subscriptions={finance.subscriptions.subscriptions} />
  if (activeTable === 'ledger') return <LedgerPanel ledger={finance.ledger.ledger} />
  if (activeTable === 'memberUsage') return <MemberUsagePanel rows={finance.memberUsage.memberUsage} />
  return <PaymentsPanel payments={finance.payments.payments} />
}

function PaymentsPanel({ payments }: { payments: ReturnType<typeof useAdminFinanceResources>['payments']['payments'] }) {
  return (
    <div className="management-table-wrap"><table className="management-table">
      <thead><tr><th>Payment</th><th>Amount</th><th>Status</th><th>Owner</th></tr></thead>
      <tbody>{payments.length ? payments.map((payment) => (
        <tr key={payment.id}><td><strong>{payment.kind}</strong><MetaLine>{payment.id}</MetaLine><MetaLine>{payment.provider} · {schemaPreview(payment.metadata)}</MetaLine></td><td>{formatMoney(payment.amountCents)} {payment.currency.toUpperCase()}</td><td><span className="management-badge">{payment.status}</span></td><td>{payment.ownerType ?? 'unknown'}<MetaLine>{payment.ownerId ?? payment.accountId}</MetaLine></td></tr>
      )) : <EmptyRow colSpan={4} message="No payments match these filters." />}</tbody>
    </table></div>
  )
}

function WalletsPanel({ wallets }: { wallets: ReturnType<typeof useAdminFinanceResources>['wallets']['wallets'] }) {
  return (
    <div className="management-table-wrap"><table className="management-table">
      <thead><tr><th>Account</th><th>Owner</th><th>Balance</th><th>Status</th></tr></thead>
      <tbody>{wallets.length ? wallets.map((wallet) => (
        <tr key={wallet.accountId}><td><strong>{wallet.accountKind}</strong><MetaLine>{wallet.accountId}</MetaLine></td><td>{wallet.ownerType}<MetaLine>{wallet.ownerId}</MetaLine></td><td>{formatNumber(wallet.balanceCredits)}</td><td><span className="management-badge">{wallet.status}</span><MetaLine>{formatDate(wallet.updatedAt)}</MetaLine></td></tr>
      )) : <EmptyRow colSpan={4} message="No wallets match these filters." />}</tbody>
    </table></div>
  )
}

function SubscriptionsPanel({ subscriptions }: { subscriptions: ReturnType<typeof useAdminFinanceResources>['subscriptions']['subscriptions'] }) {
  return (
    <div className="management-table-wrap"><table className="management-table">
      <thead><tr><th>Plan</th><th>Owner</th><th>Seats</th><th>Period</th></tr></thead>
      <tbody>{subscriptions.length ? subscriptions.map((subscription) => (
        <tr key={subscription.id}><td><strong>{subscription.planKey}</strong><MetaLine>{subscription.planFamily} · {subscription.status}</MetaLine></td><td>{subscription.ownerType}<MetaLine>{subscription.ownerId}</MetaLine></td><td>{subscription.seatCapacity}</td><td>{subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'Open ended'}<MetaLine>{subscription.provider}</MetaLine></td></tr>
      )) : <EmptyRow colSpan={4} message="No subscriptions match these filters." />}</tbody>
    </table></div>
  )
}

function LedgerPanel({ ledger }: { ledger: ReturnType<typeof useAdminFinanceResources>['ledger']['ledger'] }) {
  return (
    <div className="management-table-wrap"><table className="management-table">
      <thead><tr><th>Reason</th><th>Delta</th><th>Actor</th><th>Account</th></tr></thead>
      <tbody>{ledger.length ? ledger.map((entry) => (
        <tr key={entry.id}><td><strong>{entry.reason}</strong><MetaLine>{formatDate(entry.createdAt)}</MetaLine></td><td>{formatNumber(entry.creditsDelta)}</td><td>{entry.actorUserId ?? 'System'}<MetaLine>{entry.workspaceId}</MetaLine></td><td>{entry.accountKind ?? 'wallet'}<MetaLine>{entry.accountId}</MetaLine></td></tr>
      )) : <EmptyRow colSpan={4} message="No ledger rows match these filters." />}</tbody>
    </table></div>
  )
}

function MemberUsagePanel({ rows }: { rows: ReturnType<typeof useAdminFinanceResources>['memberUsage']['memberUsage'] }) {
  return (
    <div className="management-table-wrap"><table className="management-table">
      <thead><tr><th>Member</th><th>Role</th><th>Usage</th><th>Last charge</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => (
        <tr key={`${row.workspaceId}-${row.userId}`}><td><strong>{row.displayName}</strong><MetaLine>{row.email ?? row.userId}</MetaLine></td><td><span className="management-badge">{row.role}</span></td><td>{formatNumber(row.usageCredits)}<MetaLine>{row.chargeCount} charges</MetaLine></td><td>{row.lastUsageAt ? formatDate(row.lastUsageAt) : 'No usage yet'}</td></tr>
      )) : <EmptyRow colSpan={4} message="No member usage rows for this workspace." />}</tbody>
    </table></div>
  )
}

function formatMoney(amountCents: number) {
  return `$${(amountCents / 100).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}
