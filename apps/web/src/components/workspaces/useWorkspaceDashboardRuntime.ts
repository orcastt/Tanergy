'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'
import {
  loadBillingMe,
  loadWorkspaceDashboard,
} from '@/features/billing/billingClient'
import type {
  BillingMeResponse,
  WorkspaceDashboardRecord as RemoteWorkspaceDashboardRecord,
} from '@/features/billing/billingTypes'
import type { TangentWorkspace, WorkspaceRole } from '@/features/auth/sessionTypes'
import { listLocalBoardDocuments } from '@/features/boards/localBoardClient'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import {
  getPublicUserEmail,
  getPublicUserInitials,
  getPublicUserLabel,
} from '@/features/shared/publicUserDisplay'
import type {
  GroupWorkspaceDashboardRecord,
  TeamWorkspaceDashboardRecord,
  WorkspaceDashboardMember,
} from '@/features/workspaces/workspaceDashboardTypes'
import { normalizeGroupPersonalPlanKey } from '@/features/workspaces/groupPersonalPlanSupport'
import type { WorkspaceMembershipRole } from '@/features/workspaces/workspacePresentation'

type WorkspaceDashboardKind = 'group' | 'team'
type RuntimeStatus = 'error' | 'loading' | 'ready'

export function useWorkspaceDashboardRuntime(kind: WorkspaceDashboardKind, workspaceId: string) {
  const remoteApiAvailable = hasRemotePersistenceApi()
  const defaultWorkspace = useMemo(() => buildDefaultWorkspace(kind, workspaceId), [kind, workspaceId])
  const [remoteBilling, setRemoteBilling] = useState<BillingMeResponse | null>(null)
  const [remoteBoards, setRemoteBoards] = useState<BoardPersistenceSummary[]>([])
  const [remoteDashboard, setRemoteDashboard] = useState<RemoteWorkspaceDashboardRecord | null>(null)
  const [remoteBoardsLoaded, setRemoteBoardsLoaded] = useState(false)
  const [status, setStatus] = useState<RuntimeStatus>(remoteApiAvailable ? 'loading' : 'error')
  const [error, setError] = useState<string | null>(remoteApiAvailable ? null : 'Persistence API is unavailable.')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!remoteApiAvailable) return
    let cancelled = false

    Promise.allSettled([
      loadWorkspaceDashboard({ force: reloadToken > 0, workspace: defaultWorkspace }),
      loadBillingMe({ force: reloadToken > 0, workspace: defaultWorkspace }),
      listLocalBoardDocuments(defaultWorkspace),
    ])
      .then(([dashboardResult, billingResult, boardsResult]) => {
        if (cancelled) return
        const nextDashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value.dashboard : null
        const nextBilling = billingResult.status === 'fulfilled' ? billingResult.value : null
        const nextBoards = boardsResult.status === 'fulfilled' ? boardsResult.value.boards : []
        setRemoteDashboard(nextDashboard)
        setRemoteBilling(nextBilling)
        setRemoteBoards(nextBoards)
        setRemoteBoardsLoaded(boardsResult.status === 'fulfilled')

        const failures = [dashboardResult, billingResult, boardsResult].filter((result) => result.status === 'rejected')
        if (failures.length === 3) {
          setError(firstFailureMessage(failures[0]))
          setStatus('error')
          return
        }

        setError(failures.length ? firstFailureMessage(failures[0]) : null)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setRemoteBoards([])
        setRemoteBilling(null)
        setRemoteDashboard(null)
        setRemoteBoardsLoaded(false)
        setError(nextError instanceof Error ? nextError.message : 'Workspace dashboard failed to load.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [defaultWorkspace, reloadToken, remoteApiAvailable])

  const workspace = useMemo<TangentWorkspace>(() => {
    const remoteWorkspace = remoteBilling?.workspace ?? remoteDashboard?.workspace
    if (!remoteWorkspace) return defaultWorkspace
    return {
      ...defaultWorkspace,
      boardCount: remoteBoardsLoaded
        ? remoteBoards.length
        : remoteDashboard?.boardCount ?? defaultWorkspace.boardCount,
      id: remoteWorkspace.id,
      kind: remoteWorkspace.kind,
      name: remoteWorkspace.name,
      planKey: normalizeWorkspacePlanKey(remoteBilling?.plan.planKey, defaultWorkspace.planKey),
      role: normalizeWorkspaceRole(remoteWorkspace.role),
    }
  }, [defaultWorkspace, remoteBilling, remoteBoards.length, remoteBoardsLoaded, remoteDashboard])

  const resolvedBoards = useMemo(
    () => remoteBoardsLoaded ? remoteBoards.map((board) => ({
      ...board,
      cardColor: board.cardColor ?? 'soft',
    })) : null,
    [remoteBoards, remoteBoardsLoaded],
  )

  const teamRecord = useMemo(() => {
    if (kind !== 'team') return null
    if (!remoteBilling && !remoteDashboard) return null
    return buildTeamRecord({
      billing: remoteBilling,
      boards: resolvedBoards ?? [],
      dashboard: remoteDashboard,
      workspace,
    })
  }, [kind, remoteBilling, remoteDashboard, resolvedBoards, workspace])

  const groupRecord = useMemo(() => {
    if (kind !== 'group') return null
    if (!remoteBilling && !remoteDashboard) return null
    return buildGroupRecord({
      billing: remoteBilling,
      boards: resolvedBoards ?? [],
      dashboard: remoteDashboard,
      workspace,
    })
  }, [kind, remoteBilling, remoteDashboard, resolvedBoards, workspace])

  return {
    error,
    groupRecord,
    reload: useCallback(() => {
      if (!remoteApiAvailable) {
        setError('Persistence API is unavailable.')
        setStatus('error')
        return
      }
      setStatus((current) => (current === 'ready' ? 'ready' : 'loading'))
      setReloadToken((value) => value + 1)
    }, [remoteApiAvailable]),
    status,
    teamRecord,
    workspace,
  }
}

function buildDefaultWorkspace(
  kind: WorkspaceDashboardKind,
  workspaceId: string,
): TangentWorkspace {
  return {
    boardCount: 0,
    id: workspaceId,
    kind: kind === 'team' ? 'team_workspace' : 'group_workspace',
    name: kind === 'team' ? 'Team workspace' : 'Group workspace',
    planKey: kind === 'team' ? 'team_start' : 'free_canvas',
    role: 'owner',
  }
}

function buildTeamRecord({
  billing,
  boards,
  dashboard,
  workspace,
}: {
  billing: BillingMeResponse | null
  boards: TeamWorkspaceDashboardRecord['boards']
  dashboard: RemoteWorkspaceDashboardRecord | null
  workspace: TangentWorkspace
}): TeamWorkspaceDashboardRecord | null {
  if (!billing && !dashboard) return null
  const members = dashboard ? mapRemoteMembers(dashboard) : []
  const totalCredits = billing ? billing.credits.includedTotal + billing.credits.topUpBalance : 0
  const remainingCredits = billing ? billing.credits.includedRemaining + billing.credits.topUpBalance : totalCredits

  return {
    boards,
    currentPeriodStart: billing?.currentPeriodStart,
    currentPeriodEnd: billing?.currentPeriodEnd,
    id: workspace.id,
    includedCredits: billing?.credits.includedTotal ?? 0,
    inviteCode: `${workspace.id}-invite`,
    memberUsageLimit: Math.max(
      ...members.map((member) => member.usageCredits ?? 0),
      billing?.credits.usedThisCycle ?? 0,
      100,
    ),
    memberCount: dashboard?.memberCount ?? members.length,
    members,
    name: workspace.name,
    nextRefreshAt: billing?.nextRefreshAt,
    planKey: workspace.planKey === 'team_growth' ? 'team_growth' : 'team_start',
    planName: resolvePlanName(billing?.plan.name, workspace.planKey),
    seatLimit: billing?.plan.seatMax ?? Math.max(dashboard?.memberCount ?? 1, 1),
    seatMax: billing?.plan.seatMax ?? null,
    seatMin: billing?.plan.seatMin ?? null,
    seatsUsed: dashboard?.memberCount ?? members.length,
    topUpBalance: billing?.credits.topUpBalance ?? 0,
    totalCredits,
    totalCreditsRemaining: remainingCredits,
  }
}

function buildGroupRecord({
  billing,
  boards,
  dashboard,
  workspace,
}: {
  billing: BillingMeResponse | null
  boards: GroupWorkspaceDashboardRecord['boards']
  dashboard: RemoteWorkspaceDashboardRecord | null
  workspace: TangentWorkspace
}): GroupWorkspaceDashboardRecord | null {
  if (!billing && !dashboard) return null
  const members = dashboard ? mapRemoteMembers(dashboard) : []
  const totalCredits = billing ? billing.credits.includedTotal + billing.credits.topUpBalance : 0
  const remainingCredits = billing ? billing.credits.includedRemaining + billing.credits.topUpBalance : totalCredits

  return {
    boards,
    boardLimit: billing?.plan.boardLimit ?? null,
    currentPeriodStart: billing?.currentPeriodStart,
    currentPeriodEnd: billing?.currentPeriodEnd,
    id: workspace.id,
    includedCredits: billing?.credits.includedTotal ?? 0,
    memberCount: dashboard?.memberCount ?? members.length,
    members,
    name: workspace.name,
    nextRefreshAt: billing?.nextRefreshAt,
    pageLimit: billing?.plan.pageLimit ?? null,
    planKey: normalizeGroupPersonalPlanKey(workspace.planKey),
    planName: resolvePlanName(billing?.plan.name, workspace.planKey),
    topUpBalance: billing?.credits.topUpBalance ?? 0,
    totalCredits,
    totalCreditsRemaining: remainingCredits,
  }
}

function mapRemoteMembers(dashboard: RemoteWorkspaceDashboardRecord): WorkspaceDashboardMember[] {
  return dashboard.members.map((member) => ({
    boardAssignments: 0,
    displayName: getPublicUserLabel({
      displayName: member.displayName,
      email: member.email,
      fallback: 'Member',
      userId: member.userId,
    }),
    email: getPublicUserEmail(member.email),
    id: member.userId,
    initials: getPublicUserInitials({
      displayName: member.displayName,
      email: member.email,
      fallback: 'Member',
      userId: member.userId,
    }),
    role: normalizeRole(member.role),
    usageCredits: member.usageThisCycle ?? undefined,
  }))
}

function normalizeRole(role: string): WorkspaceMembershipRole {
  if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer') return role
  if (role === 'member') return 'editor'
  return 'viewer'
}

function normalizeWorkspaceRole(role: string): WorkspaceRole {
  if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer' || role === 'member' || role === 'guest') return role
  return 'viewer'
}

function normalizeWorkspacePlanKey(planKey: string | null | undefined, fallback: TangentWorkspace['planKey']) {
  if (planKey === 'team_growth' || planKey === 'team_start' || planKey === 'collaborate_plus' || planKey === 'collaborate_start' || planKey === 'free_canvas' || planKey === 'enterprise') {
    return planKey
  }
  return fallback
}

function resolvePlanName(name: string | null | undefined, fallback: TangentWorkspace['planKey'] | undefined) {
  if (typeof name === 'string' && name.trim()) return name.trim()
  return (fallback ?? 'free_canvas')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function firstFailureMessage(result: PromiseRejectedResult | PromiseSettledResult<unknown>) {
  if (result.status !== 'rejected') return null
  return result.reason instanceof Error ? result.reason.message : 'Workspace dashboard failed to load.'
}
