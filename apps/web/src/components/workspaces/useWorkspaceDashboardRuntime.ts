'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'
import { loadWorkspaceDashboard } from '@/features/billing/billingClient'
import type { WorkspaceDashboardRecord as RemoteWorkspaceDashboardRecord } from '@/features/billing/billingTypes'
import type { TangentWorkspace, WorkspaceRole } from '@/features/auth/sessionTypes'
import {
  getGroupWorkspaceDashboardRecord,
  getTeamWorkspaceDashboardRecord,
  type GroupWorkspaceDashboardRecord,
  type TeamWorkspaceDashboardRecord,
  type WorkspaceDashboardMember,
} from '@/features/workspaces/workspaceDashboardMock'
import type { WorkspaceMembershipRole } from '@/features/workspaces/workspaceDirectoryMock'

type WorkspaceDashboardKind = 'group' | 'team'
type RuntimeStatus = 'error' | 'loading' | 'local' | 'ready'

export function useWorkspaceDashboardRuntime(kind: WorkspaceDashboardKind, workspaceId: string) {
  const localTeam = useMemo(() => kind === 'team' ? getTeamWorkspaceDashboardRecord(workspaceId) : null, [kind, workspaceId])
  const localGroup = useMemo(() => kind === 'group' ? getGroupWorkspaceDashboardRecord(workspaceId) : null, [kind, workspaceId])
  const fallbackWorkspace = useMemo(() => buildFallbackWorkspace(kind, workspaceId, localTeam, localGroup), [kind, localGroup, localTeam, workspaceId])
  const [remoteDashboard, setRemoteDashboard] = useState<RemoteWorkspaceDashboardRecord | null>(null)
  const [status, setStatus] = useState<RuntimeStatus>(hasRemotePersistenceApi() ? 'loading' : 'local')
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!hasRemotePersistenceApi()) return
    let cancelled = false
    loadWorkspaceDashboard({ workspace: fallbackWorkspace })
      .then((payload) => {
        if (cancelled) return
        setRemoteDashboard(payload.dashboard)
        setError(null)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setRemoteDashboard(null)
        setError(nextError instanceof Error ? nextError.message : 'Workspace dashboard failed to load.')
        setStatus(localTeam || localGroup ? 'local' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [fallbackWorkspace, localGroup, localTeam, reloadToken])

  const workspace = useMemo<TangentWorkspace>(() => {
    const remoteWorkspace = remoteDashboard?.workspace
    if (!remoteWorkspace) return fallbackWorkspace
    return {
      ...fallbackWorkspace,
      id: remoteWorkspace.id,
      kind: remoteWorkspace.kind,
      name: remoteWorkspace.name,
      role: normalizeWorkspaceRole(remoteWorkspace.role),
    }
  }, [fallbackWorkspace, remoteDashboard])

  const remoteMembers = useMemo(() => remoteDashboard ? mapRemoteMembers(remoteDashboard) : null, [remoteDashboard])
  const teamRecord = useMemo(() => {
    if (kind !== 'team') return null
    if (localTeam) return remoteMembers ? { ...localTeam, members: remoteMembers, name: workspace.name, seatsUsed: remoteDashboard?.memberCount ?? localTeam.seatsUsed } : localTeam
    if (!remoteDashboard) return null
    return buildRemoteTeamRecord(workspace, remoteDashboard, remoteMembers ?? [])
  }, [kind, localTeam, remoteDashboard, remoteMembers, workspace])
  const groupRecord = useMemo(() => {
    if (kind !== 'group') return null
    if (localGroup) return remoteMembers ? { ...localGroup, members: remoteMembers, name: workspace.name } : localGroup
    if (!remoteDashboard) return null
    return buildRemoteGroupRecord(workspace, remoteDashboard, remoteMembers ?? [])
  }, [kind, localGroup, remoteDashboard, remoteMembers, workspace])

  return {
    error,
    groupRecord,
    reload: useCallback(() => setReloadToken((value) => value + 1), []),
    status,
    teamRecord,
    workspace,
  }
}

function buildFallbackWorkspace(
  kind: WorkspaceDashboardKind,
  workspaceId: string,
  localTeam: TeamWorkspaceDashboardRecord | null,
  localGroup: GroupWorkspaceDashboardRecord | null,
): TangentWorkspace {
  return {
    boardCount: localTeam?.boards.length ?? localGroup?.boards.length ?? 0,
    id: workspaceId,
    kind: kind === 'team' ? 'team_workspace' : 'group_workspace',
    name: localTeam?.name ?? localGroup?.name ?? (kind === 'team' ? 'Team workspace' : 'Group workspace'),
    planKey: localTeam?.planKey ?? localGroup?.planKey ?? (kind === 'team' ? 'team_start' : 'collaborate_start'),
    role: 'owner',
  }
}

function mapRemoteMembers(dashboard: RemoteWorkspaceDashboardRecord): WorkspaceDashboardMember[] {
  return dashboard.members.map((member) => ({
    boardAssignments: 0,
    displayName: member.displayName,
    email: member.email,
    id: member.userId,
    initials: initials(member.displayName || member.email || member.userId),
    role: normalizeRole(member.role),
    usageCredits: member.usageThisCycle ?? undefined,
  }))
}

function buildRemoteTeamRecord(
  workspace: TangentWorkspace,
  dashboard: RemoteWorkspaceDashboardRecord,
  members: WorkspaceDashboardMember[],
): TeamWorkspaceDashboardRecord {
  const totalUsage = dashboard.totalUsageThisCycle ?? members.reduce((total, member) => total + (member.usageCredits ?? 0), 0)
  const totalCredits = workspace.planKey === 'team_growth' ? 5500 : 2500
  return {
    boards: [],
    id: workspace.id,
    inviteCode: `${workspace.id}-invite`,
    memberUsageLimit: Math.max(900, totalUsage || 900),
    members,
    name: workspace.name,
    planKey: workspace.planKey === 'team_growth' ? 'team_growth' : 'team_start',
    seatLimit: Math.max(dashboard.memberCount, workspace.planKey === 'team_growth' ? 15 : 10),
    seatsUsed: dashboard.memberCount,
    totalCredits,
    totalCreditsRemaining: Math.max(0, totalCredits - totalUsage),
  }
}

function buildRemoteGroupRecord(
  workspace: TangentWorkspace,
  dashboard: RemoteWorkspaceDashboardRecord,
  members: WorkspaceDashboardMember[],
): GroupWorkspaceDashboardRecord {
  const totalCredits = workspace.planKey === 'collaborate_plus' ? 1200 : 400
  return {
    actions: [
      { href: '/usage?scope=group', label: 'Open usage' },
      { href: '/billing', label: 'Subscription' },
      { href: '/group', label: 'All groups' },
      { href: '/workspaces', label: 'Boards' },
    ],
    boards: [],
    id: workspace.id,
    members,
    name: workspace.name,
    planKey: workspace.planKey === 'collaborate_plus' ? 'collaborate_plus' : 'collaborate_start',
    totalCredits,
    totalCreditsRemaining: Math.max(0, totalCredits - (dashboard.totalUsageThisCycle ?? 0)),
  }
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

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'NA'
}
