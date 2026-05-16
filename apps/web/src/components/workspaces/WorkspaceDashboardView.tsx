'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatCredits } from '@/features/billing/billingPresentation'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { WorkspaceInvitePanel } from './WorkspaceInvitePanel'
import { WorkspaceMembersPanel } from './WorkspaceMembersPanel'
import {
  type GroupWorkspaceDashboardRecord,
  type WorkspaceDashboardAction,
  type WorkspaceDashboardBoard,
  type TeamWorkspaceDashboardRecord,
} from '@/features/workspaces/workspaceDashboardTypes'
import { formatWorkspacePlanName } from '@/features/workspaces/workspacePresentation'
import { useWorkspaceDashboardRuntime } from './useWorkspaceDashboardRuntime'

type WorkspaceDashboardViewProps = {
  kind: 'group' | 'team'
  workspaceId: string
}

type BoardViewMode = 'gallery' | 'list'

export function WorkspaceDashboardView({ kind, workspaceId }: WorkspaceDashboardViewProps) {
  const [viewMode, setViewMode] = useState<BoardViewMode>('gallery')
  const { error, groupRecord, reload, status, teamRecord, workspace } = useWorkspaceDashboardRuntime(kind, workspaceId)
  const record = kind === 'team' ? teamRecord : groupRecord

  if (!record || status === 'loading') {
    return (
      <div className="product-page workspace-detail-page">
        <section className="product-page-header workspace-detail-header">
          <Link className="workspace-detail-back" href={`/${kind}`}>
            <span aria-hidden="true" />
            <span>Back</span>
          </Link>
          <div className="workspace-detail-header-row">
            <h1 className="product-page-title">{status === 'loading' ? 'Loading workspace' : kind === 'team' ? 'Team not found' : 'Group not found'}</h1>
          </div>
          {error ? <p className="workspace-detail-status">{error}</p> : null}
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
          onMembersChanged={reload}
          workspace={workspace}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : null}
      {kind === 'group' && groupRecord ? (
        <GroupDashboardLayout
          record={groupRecord}
          onMembersChanged={reload}
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
  onMembersChanged,
  record,
  workspace,
  viewMode,
}: {
  onMembersChanged: () => void
  onViewModeChange: (mode: BoardViewMode) => void
  record: TeamWorkspaceDashboardRecord
  workspace: TangentWorkspace
  viewMode: BoardViewMode
}) {
  const creditPercent = getCreditPercent(record.totalCreditsRemaining, record.totalCredits)

  return (
    <div className="workspace-detail-stack">
      <section className="workspace-detail-grid workspace-detail-grid-top">
        <DashboardBoardPanel boards={record.boards} kind="team" onViewModeChange={onViewModeChange} viewMode={viewMode} workspaceId={workspace.id} />
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
          <small className="workspace-detail-status">{record.members.length} members synced from the live workspace contract.</small>
        </section>
      </section>

      <section className="workspace-detail-grid workspace-detail-grid-bottom">
        <WorkspaceMembersPanel members={record.members} onMembersChanged={onMembersChanged} workspace={workspace} />
        <WorkspaceInvitePanel boards={record.boards} seatLabel={`${record.seatsUsed}/${record.seatLimit}`} workspace={workspace} />
      </section>
    </div>
  )
}

function GroupDashboardLayout({
  onViewModeChange,
  onMembersChanged,
  record,
  workspace,
  viewMode,
}: {
  onMembersChanged: () => void
  onViewModeChange: (mode: BoardViewMode) => void
  record: GroupWorkspaceDashboardRecord
  workspace: TangentWorkspace
  viewMode: BoardViewMode
}) {
  const creditPercent = getCreditPercent(record.totalCreditsRemaining, record.totalCredits)

  return (
    <div className="workspace-detail-stack">
      <section className="workspace-detail-grid workspace-detail-grid-top">
        <DashboardBoardPanel boards={record.boards} kind="group" onViewModeChange={onViewModeChange} viewMode={viewMode} workspaceId={workspace.id} />
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
        <WorkspaceMembersPanel members={record.members} onMembersChanged={onMembersChanged} workspace={workspace} />
        <WorkspaceInvitePanel boards={record.boards} workspace={workspace} />
        <DashboardActionsPanel actions={record.actions} />
      </section>
    </div>
  )
}

function getCreditPercent(remaining: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.round((remaining / total) * 100))
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
  workspaceId,
}: {
  boards: WorkspaceDashboardBoard[]
  kind: 'group' | 'team'
  onViewModeChange: (mode: BoardViewMode) => void
  viewMode: BoardViewMode
  workspaceId: string
}) {
  const router = useRouter()
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
        {boards.length === 0 ? (
          <div className="workspace-detail-status">No boards in this workspace yet.</div>
        ) : boards.slice(0, kind === 'group' ? 12 : 9).map((board) => (
          <button
            className={`workspace-detail-board-card ${viewMode === 'list' ? 'is-list' : ''}`}
            data-card-color={board.cardColor}
            key={board.id}
            onClick={() => router.push(buildWorkspaceBoardHref(board.id, workspaceId))}
            type="button"
          >
            <span className="workspace-detail-board-thumb" aria-hidden="true" />
            <strong>{board.title}</strong>
          </button>
        ))}
      </div>
      {boards.length ? <small className="workspace-detail-status">{boards.length} boards synced.</small> : null}
    </section>
  )
}

function buildWorkspaceBoardHref(boardId: string, workspaceId: string) {
  const query = new URLSearchParams({ workspace: workspaceId })
  return `/boards/${encodeURIComponent(boardId)}?${query.toString()}`
}
