'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatWorkspaceMembershipRole } from '@/features/workspaces/workspaceDirectoryMock'
import { getTeamDashboardRecord } from '@/features/workspaces/teamDashboardMock'

type TeamDashboardViewProps = {
  teamId: string
}

type BoardViewMode = 'gallery' | 'list'

export function TeamDashboardView({ teamId }: TeamDashboardViewProps) {
  const [viewMode, setViewMode] = useState<BoardViewMode>('gallery')
  const team = useMemo(() => getTeamDashboardRecord(teamId), [teamId])

  if (!team) {
    return (
      <div className="product-page team-dashboard-page">
        <section className="product-page-header team-dashboard-header">
          <Link className="team-dashboard-back" href="/team">
            <span aria-hidden="true" />
            <span>Back</span>
          </Link>
          <div className="team-dashboard-title-row">
            <h1 className="product-page-title">Team not found</h1>
          </div>
        </section>

        <section className="management-notice" role="status">
          <div>
            <h2>This Team is unavailable</h2>
            <p>The directory entry could not be resolved.</p>
          </div>
        </section>
      </div>
    )
  }

  const usagePercent = Math.min(100, Math.round((team.totalCreditsRemaining / (team.planKey === 'team_growth' ? 5500 : 2500)) * 100))
  const seatPercent = Math.min(100, Math.round((team.seatsUsed / team.seatLimit) * 100))

  return (
    <div className="product-page team-dashboard-page">
      <section className="product-page-header team-dashboard-header">
        <Link className="team-dashboard-back" href="/team">
          <span aria-hidden="true" />
          <span>Back</span>
        </Link>
        <div className="team-dashboard-title-row">
          <h1 className="product-page-title">{team.name}</h1>
        </div>
      </section>

      <div className="team-dashboard-stack">
        <section className="team-dashboard-grid" aria-label="Team dashboard overview">
          <article className="team-dashboard-panel team-dashboard-boards-panel">
            <div className="team-dashboard-panel-head">
              <h2>Boards</h2>
              <div className="workspace-view-toggle" aria-label="Board view mode">
                <button className={viewMode === 'gallery' ? 'is-active' : ''} onClick={() => setViewMode('gallery')} type="button">
                  Gallery
                </button>
                <button className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} type="button">
                  List
                </button>
              </div>
            </div>
            <div className={viewMode === 'gallery' ? 'team-dashboard-board-grid' : 'team-dashboard-board-list'}>
              {team.boards.slice(0, 9).map((board) => (
                <button
                  className={`team-dashboard-board-card ${viewMode === 'list' ? 'is-list' : ''}`}
                  data-card-color={board.cardColor}
                  key={board.id}
                  type="button"
                >
                  <span className="team-dashboard-board-thumb" aria-hidden="true" />
                  <strong>{board.title}</strong>
                </button>
              ))}
            </div>
            <div className="team-dashboard-pagination" aria-hidden="true">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>...</span>
              <span>10</span>
            </div>
          </article>

          <article className="team-dashboard-panel team-dashboard-usage-panel">
            <div className="team-dashboard-panel-head">
              <h2>Usage</h2>
            </div>
            <div className="team-dashboard-dark-card">
              <div className="team-dashboard-dark-top">
                <strong>{team.totalCreditsRemaining.toLocaleString('en-US')}</strong>
                <button className="team-dashboard-accent-button" type="button">
                  Top Up
                </button>
              </div>
              <div className="team-dashboard-progress">
                <span style={{ width: `${usagePercent}%` }} />
              </div>
            </div>
            <div className="team-dashboard-usage-list">
              {team.members.slice(0, 6).map((member) => (
                <div className="team-dashboard-usage-row" key={member.id}>
                  <span className="team-dashboard-member-avatar">{member.initials}</span>
                  <div className="team-dashboard-progress is-member">
                    <span style={{ width: `${Math.min(100, Math.round((member.usageCredits / team.memberUsageLimit) * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="team-dashboard-pagination" aria-hidden="true">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>...</span>
              <span>10</span>
            </div>
          </article>
        </section>

        <section className="team-dashboard-grid team-dashboard-grid-bottom" aria-label="Team member and invite controls">
          <article className="team-dashboard-panel team-dashboard-members-panel">
            <div className="team-dashboard-panel-head">
              <h2>Members</h2>
            </div>
            <div className="team-dashboard-member-list">
              {team.members.map((member) => (
                <div className="team-dashboard-member-row" key={member.id}>
                  <div className="team-dashboard-member-copy">
                    <span className="team-dashboard-member-avatar large">{member.initials}</span>
                    <div>
                      <strong>{formatWorkspaceMembershipRole(member.role)}</strong>
                      <small>{member.boardAssignments} assigned boards</small>
                    </div>
                  </div>
                  <div className="team-dashboard-member-actions">
                    <button className="team-dashboard-muted-button" type="button">Manage</button>
                    <button className="team-dashboard-muted-button" type="button">Assign board</button>
                    {member.role === 'owner' ? null : (
                      <button className="team-dashboard-danger-button" type="button">Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="team-dashboard-panel team-dashboard-invite-panel">
            <div className="team-dashboard-panel-head">
              <h2>Invite</h2>
            </div>
            <div className="team-dashboard-dark-card">
              <div className="team-dashboard-dark-top">
                <strong>{team.seatsUsed}/{team.seatLimit}</strong>
              </div>
              <div className="team-dashboard-progress">
                <span style={{ width: `${seatPercent}%` }} />
              </div>
            </div>
            <label className="team-dashboard-invite-field">
              <span>Invite link</span>
              <div className="team-dashboard-invite-row">
                <input readOnly value={team.inviteCode} />
                <button className="team-dashboard-danger-button" type="button">Invite</button>
              </div>
            </label>
          </article>
        </section>
      </div>
    </div>
  )
}
