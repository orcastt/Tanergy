'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatCredits, formatDate } from './billingPresentation'
import { useBillingUsageActions } from './useBillingUsageActions'
import {
  prioritizeTeamCards,
  SummaryCard,
  UsageCard,
  UsageGroupCard,
  UsageSection,
} from './BillingUsagePanels'
import {
  formatPlanBadge,
  getBillingActivitySeed,
  getGroupBillingSummary,
  getTeamBillingCards,
  type GroupBillingSummary,
  type WorkspaceCommerceActivity,
} from './workspaceCommerceMock'

type UsageScope = 'group' | 'teams'

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
  const [activity, setActivity] = useState(() => getBillingActivitySeed())
  const [groupSummary, setGroupSummary] = useState(() => getGroupBillingSummary())
  const [scope, setScope] = useState<UsageScope>(initialScope)
  const [teamCards, setTeamCards] = useState(() => getTeamBillingCards({ includeJoined: true }))
  const {
    handleGroupAdd,
    handleGroupTopUp,
    handleTeamSeat,
    handleTeamTopUp,
    isPending,
    status,
  } = useBillingUsageActions({
    groupSummary,
    setActivity,
    setGroupSummary,
    setTeamCards,
  })

  const ownedTeams = useMemo(() => teamCards.filter((card) => card.relationship === 'created'), [teamCards])
  const joinedTeams = useMemo(() => teamCards.filter((card) => card.relationship === 'joined'), [teamCards])
  const orderedOwnedTeams = useMemo(
    () => prioritizeTeamCards(ownedTeams, requestedWorkspaceId),
    [ownedTeams, requestedWorkspaceId],
  )
  const orderedJoinedTeams = useMemo(
    () => prioritizeTeamCards(joinedTeams, requestedWorkspaceId),
    [joinedTeams, requestedWorkspaceId],
  )
  const visibleActivities = useMemo(
    () => activity.filter((entry) => entry.scope === (scope === 'teams' ? 'team' : 'group')),
    [activity, scope],
  )
  const selectedTeam = useMemo(
    () => teamCards.find((card) => card.id === requestedWorkspaceId) ?? null,
    [requestedWorkspaceId, teamCards],
  )
  const visibleCredits = scope === 'teams'
    ? ownedTeams.reduce((total, card) => total + card.remainingCredits, 0)
    : groupSummary.remainingCredits
  const visibleCapacity = scope === 'teams'
    ? ownedTeams.reduce((total, card) => total + card.totalCredits, 0)
    : groupSummary.totalCredits
  const visibleMeta = scope === 'teams'
    ? `${ownedTeams.length} owned`
    : `${groupSummary.groupsCreated}/${groupSummary.groupLimit} groups`

  return (
    <div className="product-page workspace-commerce-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-row">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Billing and usage</h1>
            {status ? <p className="workspace-commerce-status" role="status">{status}</p> : null}
          </div>
          <div className="workspace-commerce-switch" aria-label="Usage scope">
            <button className={scope === 'teams' ? 'is-active' : ''} onClick={() => setScope('teams')} type="button">Teams</button>
            <button className={scope === 'group' ? 'is-active' : ''} onClick={() => setScope('group')} type="button">Group</button>
          </div>
        </div>
      </section>

      <section className="workspace-commerce-summary-grid" aria-label="Usage summary">
        <SummaryCard label="Credits" meta={visibleMeta} value={`${formatCredits(visibleCredits)} / ${formatCredits(visibleCapacity)}`} />
        <SummaryCard label="Activity" meta="Recent changes" value={String(visibleActivities.length)} />
        <SummaryCard
          label="Focus"
          meta={scope === 'teams' ? 'Selected team' : 'Personal group'}
          value={scope === 'teams' ? (selectedTeam?.name ?? 'All teams') : formatPlanBadge(groupSummary.planKey)}
        />
        <SummaryCard
          label="Rail"
          meta={scope === 'teams' ? 'Owned + joined' : 'One subscription'}
          value={scope === 'teams' ? `${orderedOwnedTeams.length + orderedJoinedTeams.length} teams` : `${groupSummary.groupsCreated} groups`}
        />
      </section>

      <div className="workspace-commerce-usage-layout">
        <div className="workspace-commerce-stack">
          {scope === 'teams' ? renderTeamUsage() : renderGroupUsage()}
          <LedgerSection entries={visibleActivities} />
        </div>
        <UsageRail
          groupSummary={groupSummary}
          ownedTeamCount={orderedOwnedTeams.length}
          recentEntries={visibleActivities.slice(0, 5)}
          scope={scope}
        />
      </div>
    </div>
  )

  function renderTeamUsage() {
    return (
      <>
        <UsageSection title="Created teams" count={orderedOwnedTeams.length}>
          <div className="workspace-commerce-card-list">
            {orderedOwnedTeams.map((card, index) => (
              <UsageCard
                canManageBilling
                card={card}
                index={index}
                isPending={isPending?.startsWith(`${card.id}:`) ?? false}
                key={card.id}
                onBuySeat={() => void handleTeamSeat(card)}
                onTopUp={() => void handleTeamTopUp(card)}
              />
            ))}
          </div>
        </UsageSection>

        {orderedJoinedTeams.length ? (
          <UsageSection title="Joined teams" count={orderedJoinedTeams.length}>
            <div className="workspace-commerce-card-list">
              {orderedJoinedTeams.map((card, index) => (
                <UsageCard canManageBilling={false} card={card} index={index} key={card.id} />
              ))}
            </div>
          </UsageSection>
        ) : null}
      </>
    )
  }

  function renderGroupUsage() {
    return (
      <UsageSection title="Group subscription" count={1}>
        <UsageGroupCard
          groupSummary={groupSummary}
          isPending={isPending?.startsWith('group:') ?? false}
          onAddGroup={() => void handleGroupAdd()}
          onTopUp={() => void handleGroupTopUp()}
        />
      </UsageSection>
    )
  }
}

function LedgerSection({ entries }: { entries: WorkspaceCommerceActivity[] }) {
  return (
    <section className="workspace-commerce-ledger">
      <div className="workspace-commerce-section-head">
        <h2>Ledger</h2>
        <span className="workspace-commerce-note">{entries.length} rows</span>
      </div>
      <div className="workspace-commerce-ledger-table">
        <div className="workspace-commerce-ledger-head">
          <span>When</span>
          <span>Scope</span>
          <span>Action</span>
          <span>Change</span>
        </div>
        {entries.map((entry) => (
          <div className="workspace-commerce-ledger-row" key={entry.id}>
            <span>{formatDate(entry.happenedAt)}</span>
            <span>{entry.scopeLabel}</span>
            <span>{entry.actionLabel}</span>
            <span className="workspace-commerce-ledger-amount">{entry.amountLabel}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function UsageRail({
  groupSummary,
  ownedTeamCount,
  recentEntries,
  scope,
}: {
  groupSummary: GroupBillingSummary
  ownedTeamCount: number
  recentEntries: WorkspaceCommerceActivity[]
  scope: UsageScope
}) {
  return (
    <aside className="workspace-commerce-rail">
      <article className="workspace-commerce-rail-card">
        <span className="workspace-commerce-card-eyebrow">Status</span>
        <strong>{scope === 'teams' ? 'Teams' : 'Group'}</strong>
        <span className="workspace-commerce-note">
          {scope === 'teams' ? `${ownedTeamCount} owned teams` : `${groupSummary.groupsCreated} personal groups`}
        </span>
      </article>
      <article className="workspace-commerce-rail-card">
        <span className="workspace-commerce-card-eyebrow">Recent</span>
        <div className="workspace-commerce-rail-list">
          {recentEntries.map((entry) => (
            <div className="workspace-commerce-rail-row" key={entry.id}>
              <strong>{entry.actionLabel}</strong>
              <span>{entry.scopeLabel}</span>
              <small>{entry.amountLabel}</small>
            </div>
          ))}
        </div>
      </article>
      <article className="workspace-commerce-rail-card">
        <Link className="workspace-commerce-secondary-button" href="/billing">Subscription</Link>
        <Link className="workspace-commerce-secondary-button" href="/team">Teams</Link>
        <Link className="workspace-commerce-secondary-button" href="/group">Groups</Link>
      </article>
    </aside>
  )
}
