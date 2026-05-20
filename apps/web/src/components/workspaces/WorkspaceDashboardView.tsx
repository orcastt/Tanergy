'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import { WorkspaceInvitePanel } from './WorkspaceInvitePanel'
import { WorkspaceMembersPanel } from './WorkspaceMembersPanel'
import { WorkspaceDashboardBoardsPanel } from './WorkspaceDashboardBoardsPanel'
import { WorkspaceSettingsPanel } from './WorkspaceSettingsPanel'
import {
  GroupDashboardSummaryPanel,
  TeamDashboardSummaryPanel,
} from './WorkspaceDashboardSummaryPanels'
import {
  type GroupWorkspaceDashboardRecord,
  type TeamWorkspaceDashboardRecord,
} from '@/features/workspaces/workspaceDashboardTypes'
import { useWorkspaceDashboardRuntime } from './useWorkspaceDashboardRuntime'

type WorkspaceDashboardViewProps = {
  kind: 'group' | 'team'
  workspaceId: string
}

type BoardViewMode = 'gallery' | 'list'
const inviteManagerRoles = new Set(['owner', 'admin'])

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
  const canManageInvites = inviteManagerRoles.has(workspace.role)
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
          <TeamDashboardSummaryPanel record={record} />
          <WorkspaceSettingsPanel key={`${workspace.id}:${record.name}`} kind="team" onWorkspaceRefresh={onMembersChanged} planLabel={record.planName} workspace={workspace} />
        </div>
      </section>

      <section className={`workspace-detail-grid workspace-detail-grid-bottom${canManageInvites ? '' : ' is-single'}`}>
        <WorkspaceMembersPanel boards={record.boards} members={record.members} onMembersChanged={onMembersChanged} workspace={workspace} />
        {canManageInvites ? (
          <WorkspaceInvitePanel
            members={record.members}
            onWorkspaceRefresh={onMembersChanged}
            seatLabel={`${record.seatsUsed}/${record.seatLimit}`}
            seatLimit={record.seatLimit}
            seatPlanMax={record.seatMax}
            seatsUsed={record.seatsUsed}
            workspace={workspace}
          />
        ) : null}
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
  const canManageInvites = inviteManagerRoles.has(workspace.role)
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
          <GroupDashboardSummaryPanel record={record} />
          <WorkspaceSettingsPanel key={`${workspace.id}:${record.name}`} kind="group" onWorkspaceRefresh={onMembersChanged} planLabel={record.planName} workspace={workspace} />
        </div>
      </section>

      <section className={`workspace-detail-grid workspace-detail-grid-bottom${canManageInvites ? '' : ' is-single'}`}>
        <WorkspaceMembersPanel boards={record.boards} members={record.members} onMembersChanged={onMembersChanged} workspace={workspace} />
        {canManageInvites ? (
          <WorkspaceInvitePanel
            members={record.members}
            onWorkspaceRefresh={onMembersChanged}
            workspace={workspace}
          />
        ) : null}
      </section>
    </div>
  )
}

function recordBoardSignature(boards: TeamWorkspaceDashboardRecord['boards'] | GroupWorkspaceDashboardRecord['boards']) {
  return boards.map((board) => `${board.id}:${board.savedAt}:${board.thumbnailUrl ?? ''}:${board.visibility ?? 'private'}`).join('|')
}
