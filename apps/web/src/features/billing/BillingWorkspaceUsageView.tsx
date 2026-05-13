'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import { continueBillingCheckout } from './billingCheckoutFlow'
import {
  createBillingTopupCheckout,
  createGroupWorkspace,
  createWorkspaceSeatCheckout,
  createWorkspaceTopupCheckout,
  loadBillingPayments,
  loadCreditLedger,
} from './billingClient'
import { formatCredits, formatDate } from './billingPresentation'
import { useWorkspaceCommerceOverview, type CommerceGroupSummary, type CommerceTeamCard } from './useWorkspaceCommerceOverview'

type UsageScope = 'group' | 'teams'
type UsageEntry = {
  actionLabel: string
  amountLabel: string
  happenedAt: string
  id: string
  scopeLabel: string
}

export function BillingWorkspaceUsageView() {
  const searchParams = useSearchParams()
  const initialScope = searchParams.get('scope') === 'group' ? 'group' : 'teams'
  const requestedWorkspaceId = searchParams.get('workspace')
  return (
    <BillingWorkspaceUsageScreen
      initialScope={initialScope}
      key={`${initialScope}:${requestedWorkspaceId ?? 'all'}`}
      requestedWorkspaceId={requestedWorkspaceId}
    />
  )
}

function BillingWorkspaceUsageScreen({
  initialScope,
  requestedWorkspaceId,
}: {
  initialScope: UsageScope
  requestedWorkspaceId: null | string
}) {
  const [scope, setScope] = useState<UsageScope>(initialScope)
  const [entries, setEntries] = useState<UsageEntry[]>([])
  const [isActionPending, setIsActionPending] = useState<null | string>(null)
  const [isLedgerLoading, setIsLedgerLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const { error, overview, reload, status } = useWorkspaceCommerceOverview()
  const ownedTeams = useMemo(
    () => overview?.teamCards.filter((card) => card.relationship === 'created') ?? [],
    [overview],
  )
  const joinedTeams = useMemo(
    () => overview?.teamCards.filter((card) => card.relationship === 'joined') ?? [],
    [overview],
  )
  const selectedTeam = useMemo(
    () => overview?.teamCards.find((card) => card.id === requestedWorkspaceId) ?? ownedTeams[0] ?? joinedTeams[0] ?? null,
    [joinedTeams, overview, ownedTeams, requestedWorkspaceId],
  )
  const ledgerTargets = useMemo(
    () => !overview
      ? []
      : scope === 'group'
        ? [overview.groupSummary.workspace]
        : selectedTeam
          ? [selectedTeam.workspace]
          : ownedTeams.slice(0, 12).map((card) => card.workspace),
    [overview, ownedTeams, scope, selectedTeam],
  )

  useEffect(() => {
    if (!overview) return
    let cancelled = false
    if (ledgerTargets.length === 0) return

    queueMicrotask(() => {
      if (!cancelled) setIsLedgerLoading(true)
    })
    Promise.all(ledgerTargets.map(async (workspace) => {
      const [ledger, payments] = await Promise.allSettled([
        loadCreditLedger({ limit: 12, workspaceId: workspace.id }, { workspace }),
        loadBillingPayments({ limit: 8, workspaceScoped: true }, { workspace }),
      ])
      return [
        ...(ledger.status === 'fulfilled' ? ledger.value.entries.map((entry) => ({
          actionLabel: formatLedgerAction(entry.reason),
          amountLabel: `${entry.creditsDelta >= 0 ? '+' : ''}${formatCredits(entry.creditsDelta)} credits`,
          happenedAt: entry.createdAt,
          id: entry.id,
          scopeLabel: workspace.name,
        })) : []),
        ...(payments.status === 'fulfilled' ? payments.value.payments.map((payment) => ({
          actionLabel: formatPaymentAction(payment.kind, payment.status),
          amountLabel: formatCurrency(payment.amountCents, payment.currency),
          happenedAt: payment.createdAt,
          id: payment.id,
          scopeLabel: workspace.name,
        })) : []),
      ]
    }))
      .then((loadedEntries) => {
        if (cancelled) return
        setEntries(loadedEntries.flat().sort((left, right) => new Date(right.happenedAt).getTime() - new Date(left.happenedAt).getTime()))
      })
      .catch(() => {
        if (cancelled) return
        setEntries([])
      })
      .finally(() => {
        if (!cancelled) setIsLedgerLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ledgerTargets, overview])

  if (!overview && status === 'loading') {
    return (
      <div className="product-page workspace-commerce-page">
        <section className="product-page-header workspace-commerce-header">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Billing and usage</h1>
            <p className="workspace-commerce-status">Loading live credit balances and workspace activity…</p>
          </div>
        </section>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="product-page workspace-commerce-page">
        <section className="product-page-header workspace-commerce-header">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Billing and usage</h1>
            <p className="workspace-commerce-status">{error ?? 'Workspace billing failed to load.'}</p>
          </div>
        </section>
      </div>
    )
  }

  const visibleCredits = scope === 'teams'
    ? ownedTeams.reduce((total, card) => total + card.remainingCredits, 0)
    : overview.groupSummary.remainingCredits
  const visibleCapacity = scope === 'teams'
    ? ownedTeams.reduce((total, card) => total + card.totalCredits, 0)
    : overview.groupSummary.totalCredits
  const visibleMeta = scope === 'teams'
    ? `${ownedTeams.length} owned · ${joinedTeams.length} joined`
    : `${overview.groupSummary.groupsCreated}/${overview.groupSummary.groupLimit || 0} groups`

  return (
    <div className="product-page workspace-commerce-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-row">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Billing and usage</h1>
            <p className="product-hero-copy">Credits, payments, and workspace capacity now reflect the live backend state instead of mock summaries.</p>
            {statusMessage ? <p className="workspace-commerce-status" role="status">{statusMessage}</p> : null}
            {!statusMessage && error ? <p className="workspace-commerce-status" role="status">{error}</p> : null}
          </div>
          <div className="workspace-commerce-switch" aria-label="Usage scope">
            <button className={scope === 'teams' ? 'is-active' : ''} onClick={() => setScope('teams')} type="button">Teams</button>
            <button className={scope === 'group' ? 'is-active' : ''} onClick={() => setScope('group')} type="button">Group</button>
          </div>
        </div>
      </section>

      <section className="workspace-commerce-summary-grid" aria-label="Usage summary">
        <SummaryCard label="Credits" meta={visibleMeta} value={`${formatCredits(visibleCredits)} / ${formatCredits(visibleCapacity)}`} />
        <SummaryCard label="Activity" meta={isLedgerLoading ? 'Refreshing' : 'Recent changes'} value={String(ledgerTargets.length === 0 ? 0 : entries.length)} />
        <SummaryCard
          label="Focus"
          meta={scope === 'teams' ? 'Current selection' : 'Personal workspace'}
          value={scope === 'teams' ? (selectedTeam?.name ?? 'No team selected') : overview.groupSummary.name}
        />
        <SummaryCard
          label="Top-up balance"
          meta={scope === 'teams' ? 'Owned teams only' : 'Personal collaboration'}
          value={formatCredits(scope === 'teams'
            ? ownedTeams.reduce((total, card) => total + card.topUpBalance, 0)
            : overview.groupSummary.topUpBalance)}
        />
      </section>

      <div className="workspace-commerce-usage-layout">
        <div className="workspace-commerce-stack">
          {scope === 'teams' ? (
            <>
              <UsageSection count={ownedTeams.length} title="Owned teams">
                <div className="workspace-commerce-card-list">
                  {ownedTeams.map((card) => (
                    <TeamUsageCard
                      card={card}
                      isPending={isActionPending?.startsWith(`${card.id}:`) ?? false}
                      key={card.id}
                      onBuySeat={() => void handleTeamSeat(card)}
                      onTopUp={() => void handleTeamTopUp(card)}
                    />
                  ))}
                </div>
              </UsageSection>
              {joinedTeams.length ? (
                <UsageSection count={joinedTeams.length} title="Joined teams">
                  <div className="workspace-commerce-card-list">
                    {joinedTeams.map((card) => <TeamUsageCard card={card} key={card.id} />)}
                  </div>
                </UsageSection>
              ) : null}
            </>
          ) : (
            <UsageSection count={1} title="Personal collaboration">
              <GroupUsageCard
                groupSummary={overview.groupSummary}
                isPending={isActionPending?.startsWith('group:') ?? false}
                onAddGroup={() => void handleGroupAdd()}
                onTopUp={() => void handleGroupTopUp()}
              />
            </UsageSection>
          )}

          <section className="workspace-commerce-ledger">
            <div className="workspace-commerce-section-head">
              <h2>Ledger</h2>
              <span className="workspace-commerce-note">{isLedgerLoading ? 'Refreshing' : `${ledgerTargets.length === 0 ? 0 : entries.length} rows`}</span>
            </div>
            <div className="workspace-commerce-ledger-table">
              <div className="workspace-commerce-ledger-head">
                <span>When</span>
                <span>Scope</span>
                <span>Action</span>
                <span>Change</span>
              </div>
              {(ledgerTargets.length === 0 ? [] : entries).map((entry) => (
                <div className="workspace-commerce-ledger-row" key={entry.id}>
                  <span>{formatDate(entry.happenedAt)}</span>
                  <span>{entry.scopeLabel}</span>
                  <span>{entry.actionLabel}</span>
                  <span className="workspace-commerce-ledger-amount">{entry.amountLabel}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="workspace-commerce-rail">
          <RailCard label="Status" title={scope === 'teams' ? 'Team wallets' : 'Personal credits'}>
            <span className="workspace-commerce-note">{scope === 'teams' ? `${ownedTeams.length} owned workspaces` : `${overview.groupSummary.groupsCreated} created groups`}</span>
          </RailCard>
          <RailCard label="Recent" title={selectedTeam?.name ?? overview.groupSummary.name}>
            <div className="workspace-commerce-rail-list">
              {(ledgerTargets.length === 0 ? [] : entries).slice(0, 4).map((entry) => (
                <div className="workspace-commerce-rail-row" key={entry.id}>
                  <strong>{entry.actionLabel}</strong>
                  <span>{entry.scopeLabel}</span>
                  <small>{entry.amountLabel}</small>
                </div>
              ))}
            </div>
          </RailCard>
          <RailCard label="Open" title="Jump">
            <Link className="workspace-commerce-secondary-button" href="/billing">Subscription</Link>
            <Link className="workspace-commerce-secondary-button" href="/team">Teams</Link>
            <Link className="workspace-commerce-secondary-button" href="/group">Groups</Link>
          </RailCard>
        </aside>
      </div>
    </div>
  )

  async function handleTeamTopUp(card: CommerceTeamCard) {
    const credits = card.planKey === 'team_growth' ? 1200 : 800
    await runAction(`${card.id}:topup`, async () => {
      const checkout = await createWorkspaceTopupCheckout({
        credits,
        metadata: { action: 'team_wallet_topup', workspaceId: card.id },
      }, { workspace: card.workspace })
      const result = await continueBillingCheckout(checkout, { manualCompleteWorkspace: card.workspace })
      await refreshUsage()
      return result.message
    })
  }

  async function handleTeamSeat(card: CommerceTeamCard) {
    await runAction(`${card.id}:seat`, async () => {
      const checkout = await createWorkspaceSeatCheckout({
        metadata: { action: 'team_seat_purchase', workspaceId: card.id },
        planKey: card.planKey,
        quantity: 1,
      }, { workspace: card.workspace })
      const result = await continueBillingCheckout(checkout, { manualCompleteWorkspace: card.workspace })
      await refreshUsage()
      return result.message
    })
  }

  async function handleGroupTopUp() {
    await runAction('group:topup', async () => {
      const checkout = await createBillingTopupCheckout({
        credits: 400,
        metadata: { action: 'personal_group_topup' },
      })
      const result = await continueBillingCheckout(checkout)
      await refreshUsage()
      return result.message
    })
  }

  async function handleGroupAdd() {
    await runAction('group:add', async () => {
      const name = window.prompt('Group name', 'New Group')?.trim()
      if (!name) throw new Error('Group name is required.')
      const response = await createGroupWorkspace({ name })
      await refreshUsage()
      return `${response.workspace.name} created.`
    })
  }

  async function refreshUsage() {
    requestCurrentSessionRefresh()
    reload()
    setStatusMessage('Refreshing workspace billing…')
  }

  async function runAction(actionId: string, action: () => Promise<string>) {
    setIsActionPending(actionId)
    setStatusMessage(null)
    try {
      setStatusMessage(await action())
    } catch (nextError) {
      setStatusMessage(nextError instanceof Error ? nextError.message : 'Billing action failed.')
    } finally {
      setIsActionPending(null)
    }
  }
}

function UsageSection({
  children,
  count,
  title,
}: {
  children: ReactNode
  count: number
  title: string
}) {
  return (
    <section className="workspace-commerce-section">
      <div className="workspace-commerce-section-head">
        <h2>{title}</h2>
        <span className="workspace-commerce-note">{count}</span>
      </div>
      {children}
    </section>
  )
}

function TeamUsageCard({
  card,
  isPending = false,
  onBuySeat,
  onTopUp,
}: {
  card: CommerceTeamCard
  isPending?: boolean
  onBuySeat?: () => void
  onTopUp?: () => void
}) {
  const creditPercent = percent(card.remainingCredits, card.totalCredits)
  const seatPercent = percent(card.seatsUsed, card.seatLimit)

  return (
    <article className={`workspace-commerce-usage-card${card.relationship === 'joined' ? ' is-muted' : ''}`} data-tone="team">
      <div className="workspace-commerce-card-top">
        <div>
          <span className="workspace-commerce-card-eyebrow">Team workspace</span>
          <h3>{card.name}</h3>
        </div>
        <span className="workspace-commerce-plan-badge">{formatPlanLabel(card.planKey)}</span>
      </div>
      <div className="workspace-commerce-usage-tag-row">
        <span className="workspace-commerce-usage-tag">{card.relationship === 'created' ? 'Owned' : 'Joined'}</span>
        <span className="workspace-commerce-usage-tag">{card.membershipRole}</span>
        <span className="workspace-commerce-note">{card.memberCount} members</span>
      </div>
      <div className="workspace-commerce-card-stats">
        <Stat label="Credits" value={`${formatCredits(card.remainingCredits)} / ${formatCredits(card.totalCredits)}`} />
        <Stat label="Seats" value={`${card.seatsUsed} / ${card.seatLimit}`} />
      </div>
      <div className="workspace-commerce-progress"><span style={{ width: `${creditPercent}%` }} /></div>
      <div className="workspace-commerce-progress is-light"><span style={{ width: `${seatPercent}%` }} /></div>
      <div className="workspace-commerce-card-actions">
        <Link className="workspace-commerce-secondary-button" href={`/team/${encodeURIComponent(card.id)}`}>Open</Link>
        {card.canManageBilling ? (
          <>
            <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onTopUp} type="button">Top up</button>
            <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onBuySeat} type="button">Buy seat</button>
          </>
        ) : null}
      </div>
    </article>
  )
}

function GroupUsageCard({
  groupSummary,
  isPending = false,
  onAddGroup,
  onTopUp,
}: {
  groupSummary: CommerceGroupSummary
  isPending?: boolean
  onAddGroup: () => void
  onTopUp: () => void
}) {
  const creditPercent = percent(groupSummary.remainingCredits, groupSummary.totalCredits)
  const groupPercent = percent(groupSummary.groupsCreated, groupSummary.groupLimit || 1)

  return (
    <article className="workspace-commerce-usage-card" data-tone="group">
      <div className="workspace-commerce-card-top">
        <div>
          <span className="workspace-commerce-card-eyebrow">Personal collaboration</span>
          <h3>{groupSummary.name}</h3>
        </div>
        <span className="workspace-commerce-plan-badge">{formatPlanLabel(groupSummary.planKey)}</span>
      </div>
      <div className="workspace-commerce-usage-tag-row">
        <span className="workspace-commerce-usage-tag">Created {groupSummary.groupsCreated}</span>
        <span className="workspace-commerce-note">{groupSummary.joinedGroups} joined groups</span>
      </div>
      <div className="workspace-commerce-card-stats">
        <Stat label="Credits" value={`${formatCredits(groupSummary.remainingCredits)} / ${formatCredits(groupSummary.totalCredits)}`} />
        <Stat label="Groups" value={`${groupSummary.groupsCreated} / ${groupSummary.groupLimit || 0}`} />
      </div>
      <div className="workspace-commerce-progress"><span style={{ width: `${creditPercent}%` }} /></div>
      <div className="workspace-commerce-progress is-light"><span style={{ width: `${groupPercent}%` }} /></div>
      <div className="workspace-commerce-card-actions">
        <Link className="workspace-commerce-secondary-button" href="/group">Open</Link>
        <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onTopUp} type="button">Top up</button>
        <button className="workspace-commerce-secondary-button" disabled={isPending} onClick={onAddGroup} type="button">Add group</button>
      </div>
    </article>
  )
}

function SummaryCard({
  label,
  meta,
  value,
}: {
  label: string
  meta: string
  value: string
}) {
  return (
    <article className="workspace-commerce-summary-card">
      <span className="workspace-commerce-summary-label">{label}</span>
      <strong className="workspace-commerce-summary-value">{value}</strong>
      <span className="workspace-commerce-summary-meta">{meta}</span>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-commerce-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RailCard({
  children,
  label,
  title,
}: {
  children: ReactNode
  label: string
  title: string
}) {
  return (
    <article className="workspace-commerce-rail-card">
      <span className="workspace-commerce-card-eyebrow">{label}</span>
      <strong>{title}</strong>
      {children}
    </article>
  )
}

function percent(value: number, total: number) {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

function formatLedgerAction(reason: string) {
  if (reason === 'subscription_grant') return 'Subscription grant'
  if (reason === 'topup_purchase') return 'Top-up purchase'
  if (reason === 'usage_charge') return 'Usage charge'
  if (reason === 'usage_refund') return 'Usage refund'
  return reason.replace(/_/g, ' ')
}

function formatPaymentAction(kind: string, status: string) {
  return `${kind.replace(/_/g, ' ')} · ${status}`
}

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    currency: currency.toUpperCase(),
    style: 'currency',
  }).format(amountCents / 100)
}

function formatPlanLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
