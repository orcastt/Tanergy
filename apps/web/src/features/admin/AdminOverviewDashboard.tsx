'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminOverviewTrendChart } from './AdminOverviewTrendChart'
import { AiCallout, formatNumber } from './adminAiShared'
import {
  groupWorkspaceDirectoryKind,
  loadAdminSummaryResource,
  loadAdminUsersDirectoryResource,
  loadAdminWorkspaceDirectoryResource,
  primeAdminSummaryResource,
  primeAdminUsersDirectoryResource,
  primeAdminWorkspaceDirectoryResource,
  teamWorkspaceDirectoryKind,
} from './adminDirectoryCache'
import type {
  AdminDirectoryUsersResource,
  AdminDirectoryWorkspacesResource,
  AdminSummaryResource,
} from './adminTypes'

type OverviewStatus = 'error' | 'loading' | 'ready'

const baseUsersQuery = { limit: 100 }
const baseTeamsQuery = { kind: teamWorkspaceDirectoryKind, limit: 100 }
const baseGroupsQuery = { kind: groupWorkspaceDirectoryKind, limit: 100 }
const emptySummary: AdminSummaryResource = { ok: false }
const emptyUsers: AdminDirectoryUsersResource = { limit: 100, offset: 0, ok: false, totalCount: 0, users: [] }
const emptyWorkspaces: AdminDirectoryWorkspacesResource = { limit: 100, offset: 0, ok: false, totalCount: 0, workspaces: [] }

export function AdminOverviewDashboard({
  enabled,
  groupsSeed,
  summarySeed,
  teamsSeed,
  usersSeed,
}: {
  enabled: boolean
  groupsSeed: AdminDirectoryWorkspacesResource
  summarySeed: AdminSummaryResource
  teamsSeed: AdminDirectoryWorkspacesResource
  usersSeed: AdminDirectoryUsersResource
}) {
  const [summary, setSummary] = useState<AdminSummaryResource>(summarySeed.ok ? summarySeed : emptySummary)
  const [users, setUsers] = useState<AdminDirectoryUsersResource>(usersSeed.ok ? usersSeed : emptyUsers)
  const [teams, setTeams] = useState<AdminDirectoryWorkspacesResource>(teamsSeed.ok ? teamsSeed : emptyWorkspaces)
  const [groups, setGroups] = useState<AdminDirectoryWorkspacesResource>(groupsSeed.ok ? groupsSeed : emptyWorkspaces)
  const [status, setStatus] = useState<OverviewStatus>(hasOverviewData(summarySeed, usersSeed, teamsSeed, groupsSeed) ? 'ready' : 'loading')
  const [error, setError] = useState<string | null>(summarySeed.error || usersSeed.error || teamsSeed.error || groupsSeed.error || null)

  useEffect(() => {
    if (summarySeed.ok) primeAdminSummaryResource(summarySeed)
    if (usersSeed.ok) primeAdminUsersDirectoryResource(baseUsersQuery, usersSeed)
    if (teamsSeed.ok) primeAdminWorkspaceDirectoryResource(baseTeamsQuery, teamsSeed)
    if (groupsSeed.ok) primeAdminWorkspaceDirectoryResource(baseGroupsQuery, groupsSeed)
  }, [groupsSeed, summarySeed, teamsSeed, usersSeed])

  useEffect(() => {
    if (!enabled) return
    if (hasOverviewData(summary, users, teams, groups)) return

    let cancelled = false

    Promise.allSettled([
      loadAdminSummaryResource(),
      loadAdminUsersDirectoryResource(baseUsersQuery),
      loadAdminWorkspaceDirectoryResource(baseTeamsQuery),
      loadAdminWorkspaceDirectoryResource(baseGroupsQuery),
    ]).then((results) => {
      if (cancelled) return
      const messages: string[] = []
      const nextSummary = results[0].status === 'fulfilled' ? results[0].value : summary
      const nextUsers = results[1].status === 'fulfilled' ? results[1].value : users
      const nextTeams = results[2].status === 'fulfilled' ? results[2].value : teams
      const nextGroups = results[3].status === 'fulfilled' ? results[3].value : groups
      if (results[0].status === 'rejected') messages.push(errorMessage(results[0].reason, 'Overview summary failed to load.'))
      if (results[1].status === 'rejected') messages.push(errorMessage(results[1].reason, 'Overview users failed to load.'))
      if (results[2].status === 'rejected') messages.push(errorMessage(results[2].reason, 'Overview teams failed to load.'))
      if (results[3].status === 'rejected') messages.push(errorMessage(results[3].reason, 'Overview groups failed to load.'))
      setSummary(nextSummary)
      setUsers(nextUsers)
      setTeams(nextTeams)
      setGroups(nextGroups)
      setError(messages.length ? messages.join(' ') : null)
      setStatus(hasOverviewData(nextSummary, nextUsers, nextTeams, nextGroups) ? 'ready' : 'error')
    })

    return () => {
      cancelled = true
    }
  }, [enabled, groups, summary, teams, users])

  const overviewUsers = users.users
  const overviewTeams = teams.workspaces
  const overviewGroups = groups.workspaces
  const overviewTeamCount = teams.totalCount || overviewTeams.length
  const overviewGroupCount = groups.totalCount || overviewGroups.length
  const userWalletCredits = useMemo(
    () => overviewUsers.reduce((total, user) => total + user.personalWalletCredits, 0),
    [overviewUsers],
  )
  const teamWalletCredits = useMemo(
    () => overviewTeams.reduce((total, team) => total + team.walletCredits, 0),
    [overviewTeams],
  )
  return (
    <>
      {error ? <section className="management-notice"><div><h2>Overview data warning</h2><p>{error}</p></div></section> : null}

      <section className="management-summary-grid admin-overview-summary-grid" aria-label="Admin overview">
        <AiCallout label="Users" value={value(summary.summary?.usersCount, status)} />
        <AiCallout label="Teams" value={overviewTeamCount.toLocaleString('en-US')} />
        <AiCallout label="Groups" value={overviewGroupCount.toLocaleString('en-US')} />
        <AiCallout label="Boards" value={value(summary.summary?.boardsCount, status)} />
        <AiCallout label="User credits" value={formatNumber(userWalletCredits)} />
        <AiCallout label="Team credits" value={formatNumber(teamWalletCredits)} />
      </section>

      <section className="management-section-grid admin-overview-section-grid">
        <AdminOverviewTrendChart users={overviewUsers} workspaces={[...overviewTeams, ...overviewGroups]} />
      </section>
    </>
  )
}

function hasOverviewData(
  summary: AdminSummaryResource,
  users: AdminDirectoryUsersResource,
  teams: AdminDirectoryWorkspacesResource,
  groups: AdminDirectoryWorkspacesResource,
) {
  return summary.ok && users.ok && teams.ok && groups.ok
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function value(nextValue: number | undefined, status: OverviewStatus) {
  if (status === 'loading' && typeof nextValue !== 'number') return '...'
  if (typeof nextValue !== 'number') return 'Unavailable'
  return nextValue.toLocaleString('en-US')
}
