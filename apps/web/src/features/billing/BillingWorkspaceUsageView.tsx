'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatCredits, formatDate } from './billingPresentation'
import {
  formatPlanBadge,
  formatRenewLabel,
  getBillingActivitySeed,
  getGroupBillingSummary,
  getTeamBillingCards,
  type GroupBillingSummary,
  type TeamBillingCard,
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
  const [scope, setScope] = useState<UsageScope>(initialScope)
  const [teamCards, setTeamCards] = useState(() => getTeamBillingCards({ includeJoined: true }))
  const [groupSummary, setGroupSummary] = useState(() => getGroupBillingSummary())
  const [activity, setActivity] = useState(() => getBillingActivitySeed())

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
    () => activity.filter((entry) => entry.scope === scope),
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

  function recordActivity(entry: WorkspaceCommerceActivity) {
    setActivity((current) => [entry, ...current].slice(0, 20))
  }

  function updateTeamCard(teamId: string, updater: (card: TeamBillingCard) => TeamBillingCard, entry: WorkspaceCommerceActivity | null) {
    setTeamCards((current) => current.map((card) => (card.id === teamId ? updater(card) : card)))
    if (entry) recordActivity(entry)
  }

  function updateGroupSummary(updater: (card: GroupBillingSummary) => GroupBillingSummary, entry: WorkspaceCommerceActivity | null) {
    setGroupSummary((current) => updater(current))
    if (entry) recordActivity(entry)
  }

  return (
    <div className="product-page workspace-commerce-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-row">
          <div className="workspace-commerce-header-copy">
            <h1 className="product-page-title">Billing and usage</h1>
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
          {scope === 'teams' ? (
            <>
              <UsageSection title="Created teams" count={orderedOwnedTeams.length}>
                <div className="workspace-commerce-card-list">
                  {orderedOwnedTeams.map((card, index) => (
                    <UsageCard
                      canManageBilling
                      card={card}
                      index={index}
                      key={card.id}
                      onTopUp={() => handleTeamTopUp(card.id)}
                      onBuySeat={() => handleTeamSeat(card.id)}
                    />
                  ))}
                </div>
              </UsageSection>

              {orderedJoinedTeams.length ? (
                <UsageSection title="Joined teams" count={orderedJoinedTeams.length}>
                  <div className="workspace-commerce-card-list">
                    {orderedJoinedTeams.map((card, index) => (
                      <UsageCard
                        canManageBilling={false}
                        card={card}
                        index={index}
                        key={card.id}
                      />
                    ))}
                  </div>
                </UsageSection>
              ) : null}
            </>
          ) : (
            <UsageSection title="Group subscription" count={1}>
              <UsageGroupCard
                groupSummary={groupSummary}
                onAddGroup={() => handleGroupAdd()}
                onTopUp={() => handleGroupTopUp()}
              />
            </UsageSection>
          )}

          <section className="workspace-commerce-ledger">
            <div className="workspace-commerce-section-head">
              <h2>Ledger</h2>
              <span className="workspace-commerce-note">{visibleActivities.length} rows</span>
            </div>
            <div className="workspace-commerce-ledger-table">
              <div className="workspace-commerce-ledger-head">
                <span>When</span>
                <span>Scope</span>
                <span>Action</span>
                <span>Change</span>
              </div>
              {visibleActivities.map((entry) => (
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
          <article className="workspace-commerce-rail-card">
            <span className="workspace-commerce-card-eyebrow">Status</span>
            <strong>{scope === 'teams' ? 'Teams' : 'Group'}</strong>
            <span className="workspace-commerce-note">
              {scope === 'teams'
                ? `${orderedOwnedTeams.length} owned teams`
                : `${groupSummary.groupsCreated} personal groups`}
            </span>
          </article>

          <article className="workspace-commerce-rail-card">
            <span className="workspace-commerce-card-eyebrow">Recent</span>
            <div className="workspace-commerce-rail-list">
              {visibleActivities.slice(0, 5).map((entry) => (
                <div className="workspace-commerce-rail-row" key={entry.id}>
                  <strong>{entry.actionLabel}</strong>
                  <span>{entry.scopeLabel}</span>
                  <small>{entry.amountLabel}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="workspace-commerce-rail-card">
            <Link className="workspace-commerce-secondary-button" href="/billing">
              Subscription
            </Link>
            <Link className="workspace-commerce-secondary-button" href="/team">
              Teams
            </Link>
            <Link className="workspace-commerce-secondary-button" href="/group">
              Groups
            </Link>
          </article>
        </aside>
      </div>
    </div>
  )

  function handleTeamTopUp(teamId: string) {
    const card = teamCards.find((item) => item.id === teamId)
    if (!card || !card.canManageBilling) return
    const credits = card.planKey === 'team_growth' ? 1200 : 800
    const nextEntry: WorkspaceCommerceActivity = {
      actionLabel: 'Top-up',
      amountLabel: `+${formatCredits(credits)} credits`,
      happenedAt: new Date().toISOString(),
      id: `activity-${teamId}-topup-${Date.now()}`,
      scope: 'team',
      scopeLabel: card.name,
      workspaceId: card.id,
    }
    updateTeamCard(teamId, (current) => ({
      ...current,
      remainingCredits: current.remainingCredits + credits,
      totalCredits: current.totalCredits + credits,
    }), nextEntry)
  }

  function handleTeamSeat(teamId: string) {
    const card = teamCards.find((item) => item.id === teamId)
    if (!card || !card.canManageBilling) return
    const nextEntry: WorkspaceCommerceActivity = {
      actionLabel: 'Seat added',
      amountLabel: '+1 seat',
      happenedAt: new Date().toISOString(),
      id: `activity-${teamId}-seat-${Date.now()}`,
      scope: 'team',
      scopeLabel: card.name,
      workspaceId: card.id,
    }
    updateTeamCard(teamId, (current) => ({
      ...current,
      seatLimit: current.seatLimit + 1,
    }), nextEntry)
  }

  function handleGroupTopUp() {
    const credits = 400
    const nextEntry: WorkspaceCommerceActivity = {
      actionLabel: 'Top-up',
      amountLabel: `+${formatCredits(credits)} credits`,
      happenedAt: new Date().toISOString(),
      id: `activity-group-topup-${Date.now()}`,
      scope: 'group',
      scopeLabel: 'Group',
      workspaceId: groupSummary.id,
    }
    updateGroupSummary((current) => ({
      ...current,
      remainingCredits: current.remainingCredits + credits,
      totalCredits: current.totalCredits + credits,
    }), nextEntry)
  }

  function handleGroupAdd() {
    const nextEntry: WorkspaceCommerceActivity = {
      actionLabel: 'Group added',
      amountLabel: '+1 group',
      happenedAt: new Date().toISOString(),
      id: `activity-group-add-${Date.now()}`,
      scope: 'group',
      scopeLabel: 'Group',
      workspaceId: groupSummary.id,
    }
    updateGroupSummary((current) => ({
      ...current,
      groupsCreated: Math.min(current.groupLimit, current.groupsCreated + 1),
    }), nextEntry)
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

function UsageCard({
  canManageBilling,
  card,
  index,
  onBuySeat,
  onTopUp,
}: {
  canManageBilling: boolean
  card: TeamBillingCard
  index: number
  onBuySeat?: () => void
  onTopUp?: () => void
}) {
  const creditPercent = Math.min(100, Math.round((card.remainingCredits / card.totalCredits) * 100))
  const seatPercent = Math.min(100, Math.round((card.seatsUsed / card.seatLimit) * 100))

  return (
    <article className={`workspace-commerce-usage-card${canManageBilling ? '' : ' is-muted'}`} data-tone="team">
      <div className="workspace-commerce-card-top">
        <div>
          <span className="workspace-commerce-card-eyebrow">Team</span>
          <h3>{card.name}</h3>
        </div>
        <span className="workspace-commerce-plan-badge">{formatPlanBadge(card.planKey)}</span>
      </div>
      <div className="workspace-commerce-usage-tag-row">
        <span className="workspace-commerce-usage-tag">{card.relationship === 'created' ? 'Owned' : 'Joined'}</span>
        <span className="workspace-commerce-usage-tag">{card.membershipRole}</span>
        <span className="workspace-commerce-note">{formatRenewLabel(index)}</span>
      </div>
      <div className="workspace-commerce-card-stats">
        <div className="workspace-commerce-stat">
          <span>Credits</span>
          <strong>{formatCredits(card.remainingCredits)} / {formatCredits(card.totalCredits)}</strong>
        </div>
        <div className="workspace-commerce-stat">
          <span>Seats</span>
          <strong>{card.seatsUsed} / {card.seatLimit}</strong>
        </div>
      </div>
      <div className="workspace-commerce-progress"><span style={{ width: `${creditPercent}%` }} /></div>
      <div className="workspace-commerce-progress is-light"><span style={{ width: `${seatPercent}%` }} /></div>
      <div className="workspace-commerce-card-actions">
        <Link className="workspace-commerce-secondary-button" href={`/team/${encodeURIComponent(card.id)}`}>
          Open
        </Link>
        {canManageBilling ? (
          <>
            <button className="workspace-commerce-secondary-button" onClick={onTopUp} type="button">Top up</button>
            <button className="workspace-commerce-secondary-button" onClick={onBuySeat} type="button">Buy seat</button>
          </>
        ) : null}
      </div>
    </article>
  )
}

function UsageGroupCard({
  groupSummary,
  onAddGroup,
  onTopUp,
}: {
  groupSummary: GroupBillingSummary
  onAddGroup: () => void
  onTopUp: () => void
}) {
  const creditPercent = Math.min(100, Math.round((groupSummary.remainingCredits / groupSummary.totalCredits) * 100))
  const groupPercent = Math.min(100, Math.round((groupSummary.groupsCreated / groupSummary.groupLimit) * 100))

  return (
    <article className="workspace-commerce-usage-card" data-tone="group">
      <div className="workspace-commerce-card-top">
        <div>
          <span className="workspace-commerce-card-eyebrow">Group</span>
          <h3>Personal collaboration</h3>
        </div>
        <span className="workspace-commerce-plan-badge">{formatPlanBadge(groupSummary.planKey)}</span>
      </div>
      <div className="workspace-commerce-usage-tag-row">
        <span className="workspace-commerce-usage-tag">Owned</span>
        <span className="workspace-commerce-note">{groupSummary.groupsCreated} groups</span>
      </div>
      <div className="workspace-commerce-card-stats">
        <div className="workspace-commerce-stat">
          <span>Credits</span>
          <strong>{formatCredits(groupSummary.remainingCredits)} / {formatCredits(groupSummary.totalCredits)}</strong>
        </div>
        <div className="workspace-commerce-stat">
          <span>Groups</span>
          <strong>{groupSummary.groupsCreated} / {groupSummary.groupLimit}</strong>
        </div>
      </div>
      <div className="workspace-commerce-progress"><span style={{ width: `${creditPercent}%` }} /></div>
      <div className="workspace-commerce-progress is-light"><span style={{ width: `${groupPercent}%` }} /></div>
      <div className="workspace-commerce-card-actions">
        <Link className="workspace-commerce-secondary-button" href="/group">
          Open
        </Link>
        <button className="workspace-commerce-secondary-button" onClick={onTopUp} type="button">Top up</button>
        <button className="workspace-commerce-secondary-button" onClick={onAddGroup} type="button">Add group</button>
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

function prioritizeTeamCards(cards: TeamBillingCard[], workspaceId: string | null) {
  if (!workspaceId) return cards
  return [...cards].sort((left, right) => {
    if (left.id === workspaceId) return -1
    if (right.id === workspaceId) return 1
    return 0
  })
}
