'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import {
  createGroupWorkspace,
  loadBillingPayments,
  loadCreditLedger,
} from './billingClient'
import {
  formatCredits,
} from './billingPresentation'
import {
  BillingEmptyState,
  BillingSectionHeader,
} from './billingSurfaceBlocks'
import {
  type ActivityRow,
  formatLedgerAction,
  formatPaymentAmount,
  PersonalUsageBand,
  TeamUsageBand,
  UsageActivityTable,
  UsageShell,
} from './billingUsageBands'
import {
  useWorkspaceCommerceOverview,
} from './useWorkspaceCommerceOverview'

export function BillingWorkspaceUsageView() {
  const searchParams = useSearchParams()
  return <UsageScreen requestedWorkspaceId={searchParams.get('workspace')} />
}

function UsageScreen({ requestedWorkspaceId }: { requestedWorkspaceId: null | string }) {
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([])
  const [isActionPending, setIsActionPending] = useState<null | string>(null)
  const [isActivityLoading, setIsActivityLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const { error, overview, reload, status } = useWorkspaceCommerceOverview()

  const ownedTeams = useMemo(() => overview?.teamCards.filter((card) => card.relationship === 'created') ?? [], [overview])
  const joinedTeams = useMemo(() => overview?.teamCards.filter((card) => card.relationship === 'joined') ?? [], [overview])
  const selectedTeam = useMemo(
    () => overview?.teamCards.find((card) => card.id === requestedWorkspaceId) ?? null,
    [overview, requestedWorkspaceId],
  )
  const activityScopes = useMemo(
    () => {
      if (!overview) return []
      const teamScopes = requestedWorkspaceId && selectedTeam ? [selectedTeam] : ownedTeams.slice(0, 8)
      const seen = new Set<string>()
      return [overview.groupSummary.workspace, ...teamScopes.map((card) => card.workspace)].filter((workspace) => {
        if (seen.has(workspace.id)) return false
        seen.add(workspace.id)
        return true
      })
    },
    [overview, ownedTeams, requestedWorkspaceId, selectedTeam],
  )

  useEffect(() => {
    if (!overview || activityScopes.length === 0) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setIsActivityLoading(true)
    })

    Promise.all(activityScopes.map(async (workspace) => {
      const [ledger, payments] = await Promise.allSettled([
        loadCreditLedger({ limit: 10, workspaceId: workspace.id }, { workspace }),
        loadBillingPayments({ limit: 6, workspaceScoped: true }, { workspace }),
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
          actionLabel: `${payment.kind.replace(/_/g, ' ')} · ${payment.status}`,
          amountLabel: formatPaymentAmount(payment.amountCents, payment.currency),
          happenedAt: payment.createdAt,
          id: payment.id,
          scopeLabel: workspace.name,
        })) : []),
      ]
    }))
      .then((rows) => {
        if (cancelled) return
        setActivityRows(rows.flat().sort((left, right) => new Date(right.happenedAt).getTime() - new Date(left.happenedAt).getTime()))
      })
      .finally(() => {
        if (!cancelled) setIsActivityLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activityScopes, overview])

  if (!overview && status === 'loading') {
    return <UsageShell subtitle="Loading active plans, workspace credits, and recent activity…" />
  }

  if (!overview) {
    return <UsageShell subtitle={error ?? 'Usage failed to load.'} />
  }

  const { groupSummary } = overview

  return (
    <div className="product-page workspace-commerce-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-copy">
          <h1 className="product-page-title">Usage</h1>
          <p className="product-hero-copy">
            Active personal and Team plans, current credit state, and recent activity across the workspaces you actually use.
          </p>
          {statusMessage ? <p className="workspace-commerce-status" role="status">{statusMessage}</p> : null}
          {!statusMessage && error ? <p className="workspace-commerce-status" role="status">{error}</p> : null}
        </div>
      </section>

      <section className="workspace-commerce-section-shell">
        <BillingSectionHeader
          action={<Link className="workspace-commerce-tertiary-link" href="/billing">Open Subscription</Link>}
          description="Personal plan state, personal wallet balance, Group creation capacity, and personal-credit-backed Group activity."
          title="Personal usage"
        />
        <PersonalUsageBand
          groupSummary={groupSummary}
          isPending={Boolean(isActionPending?.startsWith('group:'))}
          onAddGroup={() => void handleGroupAdd()}
        />
      </section>

      <section className="workspace-commerce-section-shell">
        <BillingSectionHeader
          description="Owned Team workspaces can top up or buy seats here. Joined Team workspaces are visible for status, but only owner/admin can change billing."
          title="Team usage"
        />
        <div className="workspace-commerce-band-stack">
          {ownedTeams.length ? ownedTeams.map((team) => (
            <TeamUsageBand
              key={team.id}
              team={team}
            />
          )) : <BillingEmptyState message="No owned Team workspaces yet." />}
          {joinedTeams.length ? joinedTeams.map((team) => <TeamUsageBand key={team.id} team={team} />) : null}
        </div>
      </section>

      <section className="workspace-commerce-section-shell workspace-commerce-ledger">
        <BillingSectionHeader
          action={<span className="workspace-commerce-note">{isActivityLoading ? 'Refreshing…' : `${activityRows.length} rows`}</span>}
          description="Recent credit ledger and payment activity from your personal scope and visible Team workspaces."
          title="Recent activity"
        />
        <UsageActivityTable activityRows={activityRows} />
      </section>
    </div>
  )

  async function handleGroupAdd() {
    await runAction('group:add', async () => {
      const created = await createGroupWorkspace({ name: `Group ${groupSummary.groupsCreated + 1}` })
      refreshUsage()
      return created.workspace ? `${created.workspace.name} created.` : 'Group created.'
    })
  }

  function refreshUsage() {
    requestCurrentSessionRefresh()
    reload()
  }

  async function runAction(actionKey: string, callback: () => Promise<string>) {
    setIsActionPending(actionKey)
    setStatusMessage(null)
    try {
      setStatusMessage(await callback())
    } catch (nextError) {
      setStatusMessage(nextError instanceof Error ? nextError.message : 'Action failed.')
    } finally {
      setIsActionPending(null)
    }
  }
}
