'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatCredits } from '@/features/billing/billingPresentation'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { WorkspaceInvitePanel } from './WorkspaceInvitePanel'
import { WorkspaceMembersPanel } from './WorkspaceMembersPanel'
import {
  getGroupWorkspaceDashboardRecord,
  getTeamWorkspaceDashboardRecord,
  type GroupWorkspaceDashboardRecord,
  type WorkspaceDashboardAction,
  type WorkspaceDashboardBoard,
  type TeamWorkspaceDashboardRecord,
} from '@/features/workspaces/workspaceDashboardMock'
import { formatWorkspacePlanName } from '@/features/workspaces/workspaceDirectoryMock'

type WorkspaceDashboardViewProps = {
  kind: 'group' | 'team'
  workspaceId: string
}

type BoardViewMode = 'gallery' | 'list'

export function WorkspaceDashboardView({ kind, workspaceId }: WorkspaceDashboardViewProps) {
  const [viewMode, setViewMode] = useState<BoardViewMode>('gallery')
  const teamRecord = useMemo(
    () => kind === 'team' ? getTeamWorkspaceDashboardRecord(workspaceId) : null,
    [kind, workspaceId],
  )
  const groupRecord = useMemo(
    () => kind === 'group' ? getGroupWorkspaceDashboardRecord(workspaceId) : null,
    [kind, workspaceId],
  )
  const record = kind === 'team' ? teamRecord : groupRecord
  const workspace = useMemo<TangentWorkspace | null>(() => {
    if (!record) return null
    return {
      boardCount: record.boards.length,
      id: record.id,
      kind: kind === 'team' ? 'team_workspace' : 'group_workspace',
      name: record.name,
      planKey: record.planKey,
      role: 'owner',
    }
  }, [kind, record])

  if (!record || !workspace) {
    return (
      <div className="product-page workspace-detail-page">
        <section className="product-page-header workspace-detail-header">
          <Link className="workspace-detail-back" href={`/${kind}`}>
            <span aria-hidden="true" />
            <span>Back</span>
          </Link>
          <div className="workspace-detail-header-row">
            <h1 className="product-page-title">{kind === 'team' ? 'Team not found' : 'Group not found'}</h1>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="product-page workspace-detail-page">
      <section className="product-page-header workspace-detail-header">
        <Link className="workspace-detail-back" href={`/${kind}`}>
          <span aria-hidden="true" />
          <span>Back</span>
        </Link>
        <div className="workspace-detail-header-row">
          <h1 className="product-page-title">{record.name}</h1>
          <span className="workspace-detail-header-label">Dashboard</span>
        </div>
      </section>

      {kind === 'team' && teamRecord ? (
        <TeamDashboardLayout
          record={teamRecord}
          workspace={workspace}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : null}
      {kind === 'group' && groupRecord ? (
        <GroupDashboardLayout
          record={groupRecord}
          workspace={workspace}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : null}
    </div>
  )
}

function TeamDashboardLayout({
  onViewModeChange,
  record,
  workspace,
  viewMode,
}: {
  onViewModeChange: (mode: BoardViewMode) => void
  record: TeamWorkspaceDashboardRecord
  workspace: TangentWorkspace
  viewMode: BoardViewMode
}) {
  const creditPercent = Math.min(100, Math.round((record.totalCreditsRemaining / record.totalCredits) * 100))

  return (
    <div className="workspace-detail-stack">
      <section className="workspace-detail-grid workspace-detail-grid-top">
        <DashboardBoardPanel boards={record.boards} kind="team" onViewModeChange={onViewModeChange} viewMode={viewMode} />
        <section className="workspace-detail-panel workspace-detail-side-panel">
          <div className="workspace-detail-panel-head"><h2>Usage</h2></div>
          <div className="workspace-detail-dark-card">
            <div className="workspace-detail-dark-row">
              <strong>{formatCredits(record.totalCreditsRemaining)}</strong>
              <Link className="workspace-detail-danger-button" href={`/usage?scope=teams&workspace=${encodeURIComponent(record.id)}`}>
                Top Up
              </Link>
            </div>
            <small>{formatCredits(record.totalCredits)} credits</small>
            <div className="workspace-detail-progress"><span style={{ width: `${creditPercent}%` }} /></div>
          </div>
          <div className="workspace-detail-usage-list">
            {record.members.map((member) => (
              <div className="workspace-detail-usage-row" key={member.id}>
                <span className="workspace-detail-avatar">{member.initials}</span>
                <div className="workspace-detail-progress is-light">
                  <span style={{ width: `${Math.min(100, Math.round(((member.usageCredits ?? 0) / record.memberUsageLimit) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="workspace-detail-pagination"><span>1</span><span>2</span><span>3</span><span>...</span><span>10</span></div>
        </section>
      </section>

      <section className="workspace-detail-grid workspace-detail-grid-bottom">
        <WorkspaceMembersPanel members={record.members} workspace={workspace} />
        <WorkspaceInvitePanel seatLabel={`${record.seatsUsed}/${record.seatLimit}`} workspace={workspace} />
      </section>
    </div>
  )
}

function GroupDashboardLayout({
  onViewModeChange,
  record,
  workspace,
  viewMode,
}: {
  onViewModeChange: (mode: BoardViewMode) => void
  record: GroupWorkspaceDashboardRecord
  workspace: TangentWorkspace
  viewMode: BoardViewMode
}) {
  const creditPercent = Math.min(100, Math.round((record.totalCreditsRemaining / record.totalCredits) * 100))

  return (
    <div className="workspace-detail-stack">
      <section className="workspace-detail-grid workspace-detail-grid-top">
        <DashboardBoardPanel boards={record.boards} kind="group" onViewModeChange={onViewModeChange} viewMode={viewMode} />
        <section className="workspace-detail-panel workspace-detail-side-panel">
          <div className="workspace-detail-panel-head"><h2>Subscription</h2></div>
          <div className="workspace-detail-dark-card">
            <div className="workspace-detail-dark-row">
              <strong>{formatCredits(record.totalCreditsRemaining)}</strong>
              <Link className="workspace-detail-danger-button" href="/usage?scope=group">
                Top Up
              </Link>
            </div>
            <small>{formatCredits(record.totalCredits)} credits</small>
            <div className="workspace-detail-progress"><span style={{ width: `${creditPercent}%` }} /></div>
          </div>
          <div className="workspace-detail-summary-list">
            <div className="workspace-detail-summary-row">
              <span>Plan</span>
              <strong>{formatWorkspacePlanName(record.planKey)}</strong>
            </div>
            <div className="workspace-detail-summary-row">
              <span>Boards</span>
              <strong>{record.boards.length}</strong>
            </div>
          </div>
        </section>
      </section>

      <section className="workspace-detail-grid workspace-detail-grid-bottom">
        <WorkspaceMembersPanel members={record.members} workspace={workspace} />
        <WorkspaceInvitePanel workspace={workspace} />
        <DashboardActionsPanel actions={record.actions} />
      </section>
    </div>
  )
}

function DashboardActionsPanel({
  actions,
}: {
  actions: WorkspaceDashboardAction[]
}) {
  return (
    <section className="workspace-detail-panel workspace-detail-side-panel">
      <div className="workspace-detail-panel-head"><h2>Actions</h2></div>
      <div className="workspace-detail-action-list">
        {actions.map((action) => (
          <Link className="workspace-detail-action-link" href={action.href} key={action.label}>
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function DashboardBoardPanel({
  boards,
  kind,
  onViewModeChange,
  viewMode,
}: {
  boards: WorkspaceDashboardBoard[]
  kind: 'group' | 'team'
  onViewModeChange: (mode: BoardViewMode) => void
  viewMode: BoardViewMode
}) {
  return (
    <section className="workspace-detail-panel workspace-detail-board-panel">
      <div className="workspace-detail-panel-head">
        <h2>Boards</h2>
        <div className="workspace-view-toggle" aria-label="Board view mode">
          <button className={viewMode === 'gallery' ? 'is-active' : ''} onClick={() => onViewModeChange('gallery')} type="button">Gallery</button>
          <button className={viewMode === 'list' ? 'is-active' : ''} onClick={() => onViewModeChange('list')} type="button">List</button>
        </div>
      </div>
      <div className={viewMode === 'gallery'
        ? `workspace-detail-board-grid${kind === 'group' ? ' is-group' : ''}`
        : 'workspace-detail-board-list'}
      >
        {boards.slice(0, kind === 'group' ? 12 : 9).map((board) => (
          <button className={`workspace-detail-board-card ${viewMode === 'list' ? 'is-list' : ''}`} data-card-color={board.cardColor} key={board.id} type="button">
            <span className="workspace-detail-board-thumb" aria-hidden="true" />
            <strong>{board.title}</strong>
          </button>
        ))}
      </div>
      <div className="workspace-detail-pagination"><span>1</span><span>2</span><span>3</span><span>...</span><span>10</span></div>
    </section>
  )
}
