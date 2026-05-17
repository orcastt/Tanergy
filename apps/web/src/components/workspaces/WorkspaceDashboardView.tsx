'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatCredits } from '@/features/billing/billingPresentation'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import { WorkspaceInvitePanel } from './WorkspaceInvitePanel'
import { WorkspaceMembersPanel } from './WorkspaceMembersPanel'
import { WorkspaceDashboardBoardsPanel } from './WorkspaceDashboardBoardsPanel'
import { WorkspaceSettingsPanel } from './WorkspaceSettingsPanel'
import {
  type GroupWorkspaceDashboardRecord,
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
  const { session } = useTangentSession()
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
          boardSignature={recordBoardSignature(teamRecord.boards)}
          session={session}
          record={teamRecord}
          onMembersChanged={reload}
          workspace={workspace}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : null}
      {kind === 'group' && groupRecord ? (
        <GroupDashboardLayout
          boardSignature={recordBoardSignature(groupRecord.boards)}
          session={session}
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
  boardSignature,
  onViewModeChange,
  onMembersChanged,
  record,
  session,
  workspace,
  viewMode,
}: {
  boardSignature: string
  onMembersChanged: () => void
  onViewModeChange: (mode: BoardViewMode) => void
  record: TeamWorkspaceDashboardRecord
  session: ReturnType<typeof useTangentSession>['session']
  workspace: TangentWorkspace
  viewMode: BoardViewMode
}) {
  const creditPercent = getCreditPercent(record.totalCreditsRemaining, record.totalCredits)

  return (
    <div className="workspace-detail-stack">
      <section className="workspace-detail-grid workspace-detail-grid-top">
        <div>
          <div className="workspace-detail-panel-head workspace-detail-board-panel-head">
            <div>
              <h2>Boards</h2>
              <small>{record.boards.length} synced boards.</small>
            </div>
            <div className="workspace-view-toggle" aria-label="Board view mode">
              <button className={viewMode === 'gallery' ? 'is-active' : ''} onClick={() => onViewModeChange('gallery')} type="button">Gallery</button>
              <button className={viewMode === 'list' ? 'is-active' : ''} onClick={() => onViewModeChange('list')} type="button">List</button>
            </div>
          </div>
          <WorkspaceDashboardBoardsPanel
            key={`${workspace.id}:${boardSignature}:${viewMode}`}
            boards={record.boards}
            onWorkspaceRefresh={onMembersChanged}
            session={session}
            viewMode={viewMode}
            workspace={workspace}
          />
        </div>
        <div className="workspace-detail-side-stack">
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
            <div className="workspace-detail-summary-list">
              <div className="workspace-detail-summary-row">
                <span>Plan</span>
                <strong>{formatWorkspacePlanName(record.planKey)}</strong>
              </div>
              <div className="workspace-detail-summary-row">
                <span>Valid until</span>
                <strong>{formatPeriodEnd(record.currentPeriodEnd)}</strong>
              </div>
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
            <small className="workspace-detail-status">Team credits stay on the subscribed plan even if you clear this workspace.</small>
          </section>
          <WorkspaceSettingsPanel key={`${workspace.id}:${record.name}`} kind="team" onWorkspaceRefresh={onMembersChanged} planKey={record.planKey} workspace={workspace} />
        </div>
      </section>

      <section className="workspace-detail-grid workspace-detail-grid-bottom">
        <WorkspaceMembersPanel members={record.members} onMembersChanged={onMembersChanged} workspace={workspace} />
        <WorkspaceInvitePanel
          boards={record.boards}
          members={record.members}
          onWorkspaceRefresh={onMembersChanged}
          seatLabel={`${record.seatsUsed}/${record.seatLimit}`}
          workspace={workspace}
        />
      </section>
    </div>
  )
}

function GroupDashboardLayout({
  boardSignature,
  onViewModeChange,
  onMembersChanged,
  record,
  session,
  workspace,
  viewMode,
}: {
  boardSignature: string
  onMembersChanged: () => void
  onViewModeChange: (mode: BoardViewMode) => void
  record: GroupWorkspaceDashboardRecord
  session: ReturnType<typeof useTangentSession>['session']
  workspace: TangentWorkspace
  viewMode: BoardViewMode
}) {
  const creditPercent = getCreditPercent(record.totalCreditsRemaining, record.totalCredits)

  return (
    <div className="workspace-detail-stack">
      <section className="workspace-detail-grid workspace-detail-grid-top">
        <div>
          <div className="workspace-detail-panel-head workspace-detail-board-panel-head">
            <div>
              <h2>Boards</h2>
              <small>{record.boards.length} synced boards.</small>
            </div>
            <div className="workspace-view-toggle" aria-label="Board view mode">
              <button className={viewMode === 'gallery' ? 'is-active' : ''} onClick={() => onViewModeChange('gallery')} type="button">Gallery</button>
              <button className={viewMode === 'list' ? 'is-active' : ''} onClick={() => onViewModeChange('list')} type="button">List</button>
            </div>
          </div>
          <WorkspaceDashboardBoardsPanel
            key={`${workspace.id}:${boardSignature}:${viewMode}`}
            boards={record.boards}
            onWorkspaceRefresh={onMembersChanged}
            session={session}
            viewMode={viewMode}
            workspace={workspace}
          />
        </div>
        <div className="workspace-detail-side-stack">
          <section className="workspace-detail-panel workspace-detail-side-panel">
            <div className="workspace-detail-panel-head"><h2>My credits</h2></div>
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
                <span>My personal plan</span>
                <strong>{formatWorkspacePlanName(record.planKey)}</strong>
              </div>
              <div className="workspace-detail-summary-row">
                <span>Valid until</span>
                <strong>{formatPeriodEnd(record.currentPeriodEnd)}</strong>
              </div>
              <div className="workspace-detail-summary-row">
                <span>Boards</span>
                <strong>{record.boards.length}</strong>
              </div>
            </div>
            <small className="workspace-detail-status">AI runs in this Group always charge your own personal credits. Removing the Group does not move or merge credits.</small>
          </section>
          <WorkspaceSettingsPanel key={`${workspace.id}:${record.name}`} kind="group" onWorkspaceRefresh={onMembersChanged} planKey={record.planKey} workspace={workspace} />
        </div>
      </section>

      <section className="workspace-detail-grid workspace-detail-grid-bottom">
        <WorkspaceMembersPanel members={record.members} onMembersChanged={onMembersChanged} workspace={workspace} />
        <WorkspaceInvitePanel
          boards={record.boards}
          members={record.members}
          onWorkspaceRefresh={onMembersChanged}
          workspace={workspace}
        />
      </section>
    </div>
  )
}

function getCreditPercent(remaining: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.round((remaining / total) * 100))
}

function recordBoardSignature(boards: TeamWorkspaceDashboardRecord['boards'] | GroupWorkspaceDashboardRecord['boards']) {
  return boards.map((board) => `${board.id}:${board.savedAt}:${board.thumbnailUrl ?? ''}:${board.visibility ?? 'private'}`).join('|')
}

function formatPeriodEnd(value?: null | string) {
  if (!value) return 'No expiry'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}
