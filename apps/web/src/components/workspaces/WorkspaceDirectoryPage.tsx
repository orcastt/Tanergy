'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadWorkspaceDashboard } from '@/features/billing/billingClient'
import type { PlanKey, WorkspaceKind } from '@/features/billing/billingTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { mapWithConcurrency } from '@/features/shared/asyncConcurrency'
import { WorkspaceDirectoryView } from './WorkspaceDirectoryView'
import {
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
  const [enrichedItems, setEnrichedItems] = useState<null | { items: WorkspaceDirectoryItem[]; signature: string }>(null)
  const sessionWorkspaces = useMemo(
    () => sessionStatus === 'ready'
      ? session.workspaces.filter((workspace): workspace is TangentWorkspace & { kind: typeof kind } => workspace.kind === kind)
      : [],
    [kind, session.workspaces, sessionStatus],
  )
  const baseItems = useMemo(
    () => sessionWorkspaces.map((workspace) => toDirectoryItem(workspace, session.user.avatarInitials)),
    [session.user.avatarInitials, sessionWorkspaces],
  )
  const workspaceSignature = useMemo(
    () => sessionWorkspaces.map((workspace) => `${workspace.id}:${workspace.role}:${workspace.planKey ?? ''}:${workspace.boardCount}`).join('|'),
    [sessionWorkspaces],
  )
  const items = enrichedItems?.signature === workspaceSignature ? enrichedItems.items : baseItems

  useEffect(() => {
    if (sessionStatus !== 'ready') return
    if (baseItems.length === 0) return

    let cancelled = false

    mapWithConcurrency(sessionWorkspaces, maxConcurrentWorkspaceDashboardLoads, async (workspace) => {
      try {
        const payload = await loadWorkspaceDashboard({ workspace })
        const memberInitials = payload.dashboard.members
          .slice(0, 4)
          .map((member) => initials(member.displayName || member.email || member.userId))
          .filter(Boolean)
        return toDirectoryItem(workspace, session.user.avatarInitials, {
          memberCount: payload.dashboard.memberCount,
          memberInitials,
        })
      } catch {
        return toDirectoryItem(workspace, session.user.avatarInitials)
      }
    })
      .then((nextItems) => {
        if (cancelled) return
        setEnrichedItems({ items: nextItems, signature: workspaceSignature })
      })

    return () => {
      cancelled = true
    }
  }, [baseItems.length, session.user.avatarInitials, sessionStatus, sessionWorkspaces, workspaceSignature])

  return (
    <WorkspaceDirectoryView
      createLabel={createLabel}
      emptyCreatedLabel={emptyCreatedLabel}
      emptyJoinedLabel={emptyJoinedLabel}
      isLoading={sessionStatus === 'loading'}
      joinLabel={joinLabel}
      kind={kind}
      items={items}
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

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'NA'
}

function normalizePlanKey(
  planKey: PlanKey | undefined,
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>,
): PlanKey {
  if (planKey) return planKey
  return kind === 'team_workspace' ? 'team_start' : 'collaborate_start'
}
