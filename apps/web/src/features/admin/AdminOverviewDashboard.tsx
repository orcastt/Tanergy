'use client'

import { AiCallout, formatNumber } from './adminAiShared'
import type { AdminSummaryResource } from './adminClient'
import type { AdminDirectoryUserRecord, AdminDirectoryWorkspaceRecord } from './adminDirectoryClient'

export function AdminOverviewDashboard({
  groups,
  status,
  summary,
  teams,
  users,
}: {
  groups: AdminDirectoryWorkspaceRecord[]
  status: string
  summary: AdminSummaryResource
  teams: AdminDirectoryWorkspaceRecord[]
  users: AdminDirectoryUserRecord[]
}) {
  const userWalletCredits = users.reduce((total, user) => total + user.personalWalletCredits, 0)
  const teamWalletCredits = teams.reduce((total, team) => total + team.walletCredits, 0)
  const groupBoards = groups.reduce((total, group) => total + group.boardCount, 0)
  const teamBoards = teams.reduce((total, team) => total + team.boardCount, 0)

  return (
    <>
      <section className="management-summary-grid" aria-label="Admin overview">
        <AiCallout body="Registered non-deleted accounts" label="Users" value={value(summary.summary?.usersCount, status)} />
        <AiCallout body="Team workspaces with shared wallet billing" label="Teams" value={teams.length.toLocaleString('en-US')} />
        <AiCallout body="Group workspaces with personal billing" label="Groups" value={groups.length.toLocaleString('en-US')} />
        <AiCallout body="Saved boards across workspaces" label="Boards" value={value(summary.summary?.boardsCount, status)} />
        <AiCallout body="Personal wallet balance in visible directory" label="User credits" value={formatNumber(userWalletCredits)} />
        <AiCallout body="Team wallet balance in visible directory" label="Team credits" value={formatNumber(teamWalletCredits)} />
      </section>

      <section className="management-section-grid">
        <article className="management-panel">
          <h2>Admin map</h2>
          <dl className="management-definition-list">
            <div><dt>User management</dt><dd>Account overview, personal wallet top-up and Collaborate / Group plan assignment.</dd></div>
            <div><dt>Team dashboard</dt><dd>Team list, member and board facts, Team wallet top-up and Team plan assignment.</dd></div>
            <div><dt>Group dashboard</dt><dd>Group list, shared board facts, and owner-level personal billing controls.</dd></div>
            <div><dt>AI API routes</dt><dd>Image/text route metrics plus official model, provider route and pricing controls.</dd></div>
          </dl>
        </article>
        <article className="management-panel">
          <h2>Workspace inventory</h2>
          <dl className="management-definition-list">
            <div><dt>Team boards</dt><dd>{teamBoards.toLocaleString('en-US')}</dd></div>
            <div><dt>Group boards</dt><dd>{groupBoards.toLocaleString('en-US')}</dd></div>
            <div><dt>Admin users</dt><dd>{value(summary.summary?.adminUserCount, status)}</dd></div>
            <div><dt>API state</dt><dd>{status}</dd></div>
          </dl>
        </article>
      </section>
    </>
  )
}

function value(nextValue: number | undefined, status: string) {
  if (status === 'loading') return '...'
  if (typeof nextValue !== 'number') return 'Unavailable'
  return nextValue.toLocaleString('en-US')
}
