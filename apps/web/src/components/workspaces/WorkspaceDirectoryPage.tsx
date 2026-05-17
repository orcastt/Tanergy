'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadWorkspaceDashboard } from '@/features/billing/billingClient'
import type { PlanKey, WorkspaceKind } from '@/features/billing/billingTypes'
import { useWorkspaceCommerceOverview } from '@/features/billing/useWorkspaceCommerceOverview'
import { useTangentSession } from '@/features/auth/useTangentSession'
import { getPublicUserInitials } from '@/features/shared/publicUserDisplay'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { mapWithConcurrency } from '@/features/shared/asyncConcurrency'
import { WorkspaceDirectoryView } from './WorkspaceDirectoryView'
import {
  formatWorkspacePlanName,
  normalizeWorkspaceMembershipRole,
  workspaceRelationshipFromRole,
  type WorkspaceDirectoryItem,
} from '@/features/workspaces/workspacePresentation'

type WorkspaceDirectoryPageProps = {
  createLabel: string
  emptyCreatedLabel: string
  emptyJoinedLabel: string
  joinLabel: string
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>
  title: string
}
const maxConcurrentWorkspaceDashboardLoads = 4

export function WorkspaceDirectoryPage({
  createLabel,
  emptyCreatedLabel,
  emptyJoinedLabel,
  joinLabel,
  kind,
  title,
}: WorkspaceDirectoryPageProps) {
  const { error: sessionError, session, status: sessionStatus } = useTangentSession()
  const { overview } = useWorkspaceCommerceOverview()
  const [enrichedItems, setEnrichedItems] = useState<null | { items: WorkspaceDirectoryItem[]; signature: string }>(null)
  const currentUserInitials = useMemo(
    () => getPublicUserInitials({
      displayName: session.user.displayName,
      email: session.user.email,
      fallback: 'You',
      userId: session.user.id,
    }),
    [session.user.displayName, session.user.email, session.user.id],
  )
  const sessionWorkspaces = useMemo(
    () => sessionStatus === 'ready'
      ? session.workspaces.filter((workspace): workspace is TangentWorkspace & { kind: typeof kind } => workspace.kind === kind)
      : [],
    [kind, session.workspaces, sessionStatus],
  )
  const baseItems = useMemo(
    () => sessionWorkspaces.map((workspace) => toDirectoryItem(workspace, currentUserInitials)),
    [currentUserInitials, sessionWorkspaces],
  )
  const workspaceSignature = useMemo(
    () => sessionWorkspaces.map((workspace) => `${workspace.id}:${workspace.role}:${workspace.planKey ?? ''}:${workspace.boardCount}`).join('|'),
    [sessionWorkspaces],
  )
  const items = useMemo(() => {
    const sourceItems = enrichedItems?.signature === workspaceSignature ? enrichedItems.items : baseItems
    if (!overview || kind !== 'team_workspace') return sourceItems
    const commerceById = new Map(overview.teamCards.map((card) => [card.id, card]))
    return sourceItems.map((item) => {
      const commerce = commerceById.get(item.id)
      if (!commerce) return item
      return {
        ...item,
        currentPeriodEnd: commerce.currentPeriodEnd,
        remainingCredits: commerce.remainingCredits,
        totalCredits: commerce.totalCredits,
        usedThisCycle: commerce.usedThisCycle,
      }
    })
  }, [baseItems, enrichedItems, kind, overview, workspaceSignature])

  const featuredSummary = useMemo(() => {
    if (kind !== 'group_workspace' || !overview) return null
    return {
      currentPeriodEnd: overview.groupSummary.currentPeriodEnd,
      label: 'My credits',
      meta: formatGroupSummaryMeta(overview.groupSummary.groupsCreated, overview.groupSummary.groupLimit),
      planLabel: formatWorkspacePlanName(overview.groupSummary.planKey),
      remainingCredits: overview.groupSummary.remainingCredits,
      title: 'My personal plan',
      totalCredits: overview.groupSummary.totalCredits,
      usedThisCycle: overview.groupSummary.usedThisCycle,
    }
  }, [kind, overview])

  useEffect(() => {
    if (sessionStatus !== 'ready') return
    if (baseItems.length === 0) return

    let cancelled = false

    mapWithConcurrency(sessionWorkspaces, maxConcurrentWorkspaceDashboardLoads, async (workspace) => {
      try {
        const payload = await loadWorkspaceDashboard({ workspace })
        const memberInitials = payload.dashboard.members
          .slice(0, 4)
          .map((member) => getPublicUserInitials({
            displayName: member.displayName,
            email: member.email,
            fallback: 'Member',
            userId: member.userId,
          }))
          .filter(Boolean)
        return toDirectoryItem(workspace, currentUserInitials, {
          memberCount: payload.dashboard.memberCount,
          memberInitials,
        })
      } catch {
        return toDirectoryItem(workspace, currentUserInitials)
      }
    })
      .then((nextItems) => {
        if (cancelled) return
        setEnrichedItems({ items: nextItems, signature: workspaceSignature })
      })

    return () => {
      cancelled = true
    }
  }, [baseItems.length, currentUserInitials, sessionStatus, sessionWorkspaces, workspaceSignature])

  return (
    <WorkspaceDirectoryView
      createLabel={createLabel}
      emptyCreatedLabel={emptyCreatedLabel}
      emptyJoinedLabel={emptyJoinedLabel}
      isLoading={sessionStatus === 'loading'}
      joinLabel={joinLabel}
      kind={kind}
      items={items}
      featuredSummary={featuredSummary}
      statusMessage={sessionStatus === 'error' ? sessionError : null}
      title={title}
    />
  )
}

function toDirectoryItem(
  workspace: TangentWorkspace & { kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'> },
  currentUserInitials: string,
  detail?: {
    memberCount: number
    memberInitials: string[]
  },
): WorkspaceDirectoryItem {
  const relationship = workspaceRelationshipFromRole(workspace.role)
  const memberInitials = detail?.memberInitials?.length ? detail.memberInitials : [currentUserInitials]
  const memberCount = Math.max(detail?.memberCount ?? memberInitials.length, memberInitials.length, 1)

  return {
    boardCount: workspace.boardCount,
    href: workspace.kind === 'team_workspace'
      ? `/team/${encodeURIComponent(workspace.id)}`
      : `/group/${encodeURIComponent(workspace.id)}`,
    id: workspace.id,
    kind: workspace.kind,
    memberCount,
    memberInitials,
    membershipRole: normalizeWorkspaceMembershipRole(workspace.role),
    name: workspace.name,
    planKey: normalizePlanKey(workspace.planKey, workspace.kind),
    relationship,
  }
}

function normalizePlanKey(
  planKey: PlanKey | undefined,
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>,
): PlanKey {
  if (planKey) return planKey
  return kind === 'team_workspace' ? 'team_start' : 'free_canvas'
}

function formatGroupSummaryMeta(groupsCreated: number, groupLimit: number) {
  if (!Number.isFinite(groupLimit) || groupLimit <= 0) return `${groupsCreated} groups`
  return `${groupsCreated} / ${groupLimit} groups`
}
