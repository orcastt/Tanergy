'use client'

import { useMemo, useState } from 'react'
import type { AdminWorkspaceRecord } from './adminClient'
import { AdminFinanceManualControls } from './AdminFinanceManualControls'
import { useAdminFinanceResources } from './useAdminFinanceResources'
import {
  AiCallout,
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

export function AdminFinanceDashboard({ enabled, workspaces }: { enabled: boolean; workspaces: AdminWorkspaceRecord[] }) {
  const [limit, setLimit] = useState<(typeof limitOptions)[number]>(25)
  const [workspaceId, setWorkspaceId] = useState('')
  const [userId, setUserId] = useState('')
  const [paymentKind, setPaymentKind] = useState('')
  const [provider, setProvider] = useState('')
  const [ledgerReason, setLedgerReason] = useState('')
  const [ownerType, setOwnerType] = useState('')
  const [planFamily, setPlanFamily] = useState('')
  const workspaceOptions = useMemo(() => workspaces.map((workspace) => ({ label: `${workspace.name} (${workspace.kind ?? 'workspace'})`, value: workspace.id })), [workspaces])
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

  const summary = finance.summary.summary
  const succeededPayments = summary?.paymentStatusCounts.find((item) => item.key === 'succeeded')
  const activeSubscriptions = summary?.subscriptionCounts.filter((item) => item.status === 'active').reduce((total, item) => total + item.count, 0) ?? 0
  const teamSeats = summary?.subscriptionCounts.filter((item) => item.planFamily === 'team').reduce((total, item) => total + item.seatCapacity, 0) ?? 0

  return (
    <>
      <section className="management-summary-grid" aria-label="Finance admin summary">
        <AiCallout body="Net credits across all accounts" label="Ledger balance" value={formatNumber(summary?.ledgerTotals.balanceCredits ?? 0)} />
        <AiCallout body="Credits consumed by usage charges" label="Usage spend" value={formatNumber(summary?.ledgerTotals.spentCredits ?? 0)} />
        <AiCallout body="Succeeded payment amount in current result set" label="Payments" value={formatMoney(succeededPayments?.amountCents ?? 0)} />
        <AiCallout body="Active subscriptions represented in billing tables" label="Subscriptions" value={activeSubscriptions.toLocaleString('en-US')} />
        <AiCallout body="Seat capacity attached to Team plans" label="Team seats" value={teamSeats.toLocaleString('en-US')} />
      </section>

      <section className="management-panel management-panel-wide" aria-label="Finance reconciliation controls">
        <div className="management-panel-heading">
          <div><h2>Finance reconciliation</h2><p>Payment, wallet, subscription, credit ledger and member usage facts from server-side billing tables.</p></div>
          <div className="management-actions">
            <div className="management-segmented">{limitOptions.map((option) => <button key={option} className={option === limit ? 'is-active' : undefined} onClick={() => setLimit(option)} type="button">{option}</button>)}</div>
            <button className="product-button product-button-secondary" onClick={finance.reload} type="button">Reload</button>
            <span className={`management-status ${finance.status === 'ready' ? 'is-success' : ''}`}>{finance.status}</span>
          </div>
        </div>
        {finance.error ? <p>{finance.error}</p> : null}
        <div style={filterGridStyle(4)}>
          <FilterSelect label="Workspace" onChange={setWorkspaceId} options={workspaceOptions} value={selectedWorkspaceId} />
          <FilterTextInput label="User" onChange={setUserId} placeholder="user_id" value={userId} />
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

      <section className="management-section-grid" aria-label="Finance payments and wallets">
        <PaymentsPanel payments={finance.payments.payments} />
        <WalletsPanel wallets={finance.wallets.wallets} />
      </section>
      <section className="management-section-grid" aria-label="Finance subscriptions and ledger">
        <SubscriptionsPanel subscriptions={finance.subscriptions.subscriptions} />
        <LedgerPanel ledger={finance.ledger.ledger} />
      </section>
      <section className="management-section-grid" aria-label="Finance member usage">
        <MemberUsagePanel rows={finance.memberUsage.memberUsage} workspaceId={selectedWorkspaceId} />
      </section>
    </>
  )
}

function PaymentsPanel({ payments }: { payments: ReturnType<typeof useAdminFinanceResources>['payments']['payments'] }) {
  return (
    <article className="management-panel">
      <h2>Payments</h2>
      <div className="management-table-wrap"><table className="management-table">
        <thead><tr><th>Payment</th><th>Amount</th><th>Status</th><th>Owner</th></tr></thead>
        <tbody>{payments.length ? payments.map((payment) => (
          <tr key={payment.id}><td><strong>{payment.kind}</strong><MetaLine>{payment.id}</MetaLine><MetaLine>{payment.provider} · {schemaPreview(payment.metadata)}</MetaLine></td><td>{formatMoney(payment.amountCents)} {payment.currency.toUpperCase()}</td><td><span className="management-badge">{payment.status}</span></td><td>{payment.ownerType ?? 'unknown'}<MetaLine>{payment.ownerId ?? payment.accountId}</MetaLine></td></tr>
        )) : <EmptyRow colSpan={4} message="No payments match these filters." />}</tbody>
      </table></div>
    </article>
  )
}

function WalletsPanel({ wallets }: { wallets: ReturnType<typeof useAdminFinanceResources>['wallets']['wallets'] }) {
  return (
    <article className="management-panel">
      <h2>Wallets</h2>
      <div className="management-table-wrap"><table className="management-table">
        <thead><tr><th>Account</th><th>Owner</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>{wallets.length ? wallets.map((wallet) => (
          <tr key={wallet.accountId}><td><strong>{wallet.accountKind}</strong><MetaLine>{wallet.accountId}</MetaLine></td><td>{wallet.ownerType}<MetaLine>{wallet.ownerId}</MetaLine></td><td>{formatNumber(wallet.balanceCredits)}</td><td><span className="management-badge">{wallet.status}</span><MetaLine>{formatDate(wallet.updatedAt)}</MetaLine></td></tr>
        )) : <EmptyRow colSpan={4} message="No wallets match these filters." />}</tbody>
      </table></div>
    </article>
  )
}

function SubscriptionsPanel({ subscriptions }: { subscriptions: ReturnType<typeof useAdminFinanceResources>['subscriptions']['subscriptions'] }) {
  return (
    <article className="management-panel">
      <h2>Subscriptions</h2>
      <div className="management-table-wrap"><table className="management-table">
        <thead><tr><th>Plan</th><th>Owner</th><th>Seats</th><th>Period</th></tr></thead>
        <tbody>{subscriptions.length ? subscriptions.map((subscription) => (
          <tr key={subscription.id}><td><strong>{subscription.planKey}</strong><MetaLine>{subscription.planFamily} · {subscription.status}</MetaLine></td><td>{subscription.ownerType}<MetaLine>{subscription.ownerId}</MetaLine></td><td>{subscription.seatCapacity}</td><td>{subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'Open ended'}<MetaLine>{subscription.provider}</MetaLine></td></tr>
        )) : <EmptyRow colSpan={4} message="No subscriptions match these filters." />}</tbody>
      </table></div>
    </article>
  )
}

function LedgerPanel({ ledger }: { ledger: ReturnType<typeof useAdminFinanceResources>['ledger']['ledger'] }) {
  return (
    <article className="management-panel">
      <h2>Credit ledger</h2>
      <div className="management-table-wrap"><table className="management-table">
        <thead><tr><th>Reason</th><th>Delta</th><th>Actor</th><th>Account</th></tr></thead>
        <tbody>{ledger.length ? ledger.map((entry) => (
          <tr key={entry.id}><td><strong>{entry.reason}</strong><MetaLine>{formatDate(entry.createdAt)}</MetaLine></td><td>{formatNumber(entry.creditsDelta)}</td><td>{entry.actorUserId ?? 'System'}<MetaLine>{entry.workspaceId}</MetaLine></td><td>{entry.accountKind ?? 'wallet'}<MetaLine>{entry.accountId}</MetaLine></td></tr>
        )) : <EmptyRow colSpan={4} message="No ledger rows match these filters." />}</tbody>
      </table></div>
    </article>
  )
}

function MemberUsagePanel({ rows, workspaceId }: { rows: ReturnType<typeof useAdminFinanceResources>['memberUsage']['memberUsage']; workspaceId: string }) {
  return (
    <article className="management-panel management-panel-wide">
      <div className="management-panel-heading"><div><h2>Member usage</h2><p>{workspaceId ? `Workspace ${workspaceId}` : 'Select a workspace to load member usage.'}</p></div></div>
      <div className="management-table-wrap"><table className="management-table">
        <thead><tr><th>Member</th><th>Role</th><th>Usage</th><th>Last charge</th></tr></thead>
        <tbody>{rows.length ? rows.map((row) => (
          <tr key={`${row.workspaceId}-${row.userId}`}><td><strong>{row.displayName}</strong><MetaLine>{row.email ?? row.userId}</MetaLine></td><td><span className="management-badge">{row.role}</span></td><td>{formatNumber(row.usageCredits)}<MetaLine>{row.chargeCount} charges</MetaLine></td><td>{row.lastUsageAt ? formatDate(row.lastUsageAt) : 'No usage yet'}</td></tr>
        )) : <EmptyRow colSpan={4} message="No member usage rows for this workspace." />}</tbody>
      </table></div>
    </article>
  )
}

function formatMoney(amountCents: number) {
  return `$${(amountCents / 100).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}
