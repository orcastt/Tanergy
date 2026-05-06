'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell/AppShell'
import { loadWorkspaceDashboard } from '@/features/billing/billingClient'
import type { WorkspaceDashboardRecord } from '@/features/billing/billingTypes'

type LoadState = 'error' | 'loading' | 'ready'

export default function TeamPage() {
  const [dashboard, setDashboard] = useState<WorkspaceDashboardRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<LoadState>('loading')

  useEffect(() => {
    let isCancelled = false
    loadWorkspaceDashboard()
      .then((payload) => {
        if (isCancelled) return
        setDashboard(payload.dashboard)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (isCancelled) return
        setError(nextError instanceof Error ? nextError.message : 'Workspace dashboard lookup failed.')
        setStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Workspace</p>
          <h1 className="product-page-title">{dashboard?.workspace.name ?? 'Workspace dashboard'}</h1>
        </section>

        {status === 'error' ? (
          <section className="management-notice" role="status">
            <div>
              <h2>Workspace contract unavailable</h2>
              <p>{error}</p>
            </div>
          </section>
        ) : null}

        {dashboard ? (
          <>
            <section className="management-summary-grid" aria-label="Workspace summary">
              <article className="management-callout mint">
                <span>Mode</span>
                <h2>{formatWorkspaceKind(dashboard.workspace.kind)}</h2>
                <p>{dashboard.canSeeMemberUsage ? 'Member usage visible to workspace admins.' : 'Member billing usage stays private.'}</p>
              </article>
              <article className="management-callout cream">
                <span>Boards</span>
                <h2>{dashboard.boardCount}</h2>
                <p>Active workspace Board count</p>
              </article>
              <article className="management-callout">
                <span>Members</span>
                <h2>{dashboard.memberCount}</h2>
                <p>{dashboard.canSeeMemberUsage ? `${formatCredits(dashboard.totalUsageThisCycle ?? 0)} credits used` : 'Structural member view'}</p>
              </article>
            </section>

            <section className="management-panel management-panel-wide" aria-label="Workspace members">
              <div className="management-panel-heading">
                <div>
                  <h2>Members</h2>
                  <p>{dashboard.dashboardKind === 'team_usage' ? 'Team usage summary' : 'Group workspace structure'}</p>
                </div>
                <span className="management-status">{dashboard.canSeeMemberUsage ? 'Usage visible' : 'Usage private'}</span>
              </div>
              <div className="management-table-wrap">
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>AI usage</th>
                      <th>Billing boundary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.members.map((member) => (
                      <tr key={member.userId}>
                        <td>
                          <span className="management-member">
                            <span className="management-avatar small" aria-hidden="true">{getInitials(member.displayName)}</span>
                            <span>
                              <strong>{member.displayName}</strong>
                              <small>{member.email ?? member.userId}</small>
                            </span>
                          </span>
                        </td>
                        <td><span className="management-badge">{formatLabel(member.role)}</span></td>
                        <td>{member.usageThisCycle === null || member.usageThisCycle === undefined ? 'Private' : formatCredits(member.usageThisCycle)}</td>
                        <td>{dashboard.workspace.kind === 'team_workspace' ? 'Actor-personal credits' : 'Personal billing only'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : status === 'loading' ? (
          <section className="management-panel management-panel-wide" role="status">
            <h2>Loading workspace dashboard</h2>
          </section>
        ) : null}
      </div>
    </AppShell>
  )
}

function formatWorkspaceKind(value: string) {
  if (value === 'team_workspace') return 'Team workspace'
  if (value === 'group_workspace') return 'Group workspace'
  if (value === 'enterprise_workspace') return 'Enterprise workspace'
  return 'Solo workspace'
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function formatCredits(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'T'
}
