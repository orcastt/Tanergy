'use client'

import { useEffect, useMemo, useState } from 'react'
import { AiCallout, EmptyRow, MetaLine, formatDate, formatNumber } from './adminAiShared'
import {
  loadAdminDirectoryWorkspaceDetail,
  type AdminDirectoryWorkspaceDetailResource,
  type AdminDirectoryWorkspaceRecord,
} from './adminDirectoryClient'
import { AdminUserFinanceActions } from './AdminUserFinanceActions'
import { AdminWorkspaceFinanceActions } from './AdminWorkspaceFinanceActions'

const emptyDetail: AdminDirectoryWorkspaceDetailResource = { boards: [], members: [], ok: false }

export function AdminWorkspacesDashboard({
  enabled,
  kind,
  label,
  onMutated,
  status,
  workspaces,
}: {
  enabled: boolean
  kind: 'group' | 'team'
  label: string
  onMutated: () => void
  status: string
  workspaces: AdminDirectoryWorkspaceRecord[]
}) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [detail, setDetail] = useState<AdminDirectoryWorkspaceDetailResource>(emptyDetail)
  const [detailStatus, setDetailStatus] = useState<'error' | 'loading' | 'ready'>('loading')
  const [reloadToken, setReloadToken] = useState(0)
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces[0] ?? null
  const totalMembers = useMemo(() => workspaces.reduce((total, workspace) => total + workspace.memberCount, 0), [workspaces])
  const totalBoards = useMemo(() => workspaces.reduce((total, workspace) => total + workspace.boardCount, 0), [workspaces])

  useEffect(() => {
    if (!enabled || !selectedWorkspace?.id) return
    let cancelled = false
    loadAdminDirectoryWorkspaceDetail(selectedWorkspace.id)
      .then((nextDetail) => {
        if (cancelled) return
        setDetail(nextDetail)
        setDetailStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setDetail(emptyDetail)
        setDetailStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken, selectedWorkspace?.id])

  function refresh() {
    setReloadToken((value) => value + 1)
    onMutated()
  }

  return (
    <>
      <section className="management-summary-grid" aria-label={`${label} summary`}>
        <AiCallout body={`${label} workspaces in the system`} label={label} value={workspaces.length.toLocaleString('en-US')} />
        <AiCallout body="Members across this workspace type" label="Members" value={totalMembers.toLocaleString('en-US')} />
        <AiCallout body="Boards created inside these workspaces" label="Boards" value={totalBoards.toLocaleString('en-US')} />
      </section>

      <section className="management-main-grid" aria-label={`${label} dashboard`}>
        <article className="management-panel">
          <div className="management-panel-heading">
            <div><h2>{label} dashboard</h2><p>Developer view of owners, members, boards, wallet and plan state.</p></div>
            <span className={`management-status ${status === 'ready' ? 'is-success' : ''}`}>{status}</span>
          </div>
          <div className="management-table-wrap">
            <table className="management-table compact">
              <thead><tr><th>Name</th><th>Owner</th><th>Members</th><th>Plan</th></tr></thead>
              <tbody>
                {workspaces.length ? workspaces.map((workspace) => (
                  <tr
                    key={workspace.id}
                    className={workspace.id === selectedWorkspace?.id ? 'is-selected' : undefined}
                    onClick={() => setSelectedWorkspaceId(workspace.id)}
                  >
                    <td><strong>{workspace.name}</strong><MetaLine>{workspace.id}</MetaLine></td>
                    <td>{workspace.ownerEmail || workspace.ownerId || 'Unknown'}</td>
                    <td>{workspace.memberCount}<MetaLine>{workspace.boardCount} boards</MetaLine></td>
                    <td>{workspace.planKey ?? workspace.ownerCollaboratePlanKey ?? 'free'}</td>
                  </tr>
                )) : <EmptyRow colSpan={4} message={`No ${label.toLowerCase()} found.`} />}
              </tbody>
            </table>
          </div>
        </article>

        <article className="management-panel">
          {selectedWorkspace ? (
            <>
              <WorkspaceHeader workspace={selectedWorkspace} detailStatus={detailStatus} />
              <dl className="management-definition-list">
                <div><dt>Wallet credits</dt><dd>{formatNumber(selectedWorkspace.walletCredits)}</dd></div>
                <div><dt>Usage credits</dt><dd>{formatNumber(selectedWorkspace.usageCredits)}</dd></div>
                <div><dt>Subscription ends</dt><dd>{selectedWorkspace.subscriptionPeriodEnd ? formatDate(selectedWorkspace.subscriptionPeriodEnd) : 'Open ended'}</dd></div>
                <div><dt>Seat capacity</dt><dd>{selectedWorkspace.seatCapacity || 'Not assigned'}</dd></div>
              </dl>
              <div className="management-section-gap">
                {kind === 'team' ? (
                  <AdminWorkspaceFinanceActions enabled={enabled} onMutated={refresh} workspaceId={selectedWorkspace.id} />
                ) : (
                  <AdminUserFinanceActions
                    enabled={enabled}
                    onMutated={refresh}
                    title="Group owner billing actions"
                    userId={selectedWorkspace.ownerId ?? ''}
                  />
                )}
                <MembersTable detail={detail} />
                <BoardsTable detail={detail} />
              </div>
            </>
          ) : <p>Select a workspace to inspect members, boards and billing.</p>}
        </article>
      </section>
    </>
  )
}

function WorkspaceHeader({ detailStatus, workspace }: { detailStatus: string; workspace: AdminDirectoryWorkspaceRecord }) {
  return (
    <div className="management-panel-heading">
      <div><h2>{workspace.name}</h2><p>{workspace.ownerEmail || workspace.ownerId || 'Unknown owner'}</p></div>
      <span className={`management-status ${detailStatus === 'ready' ? 'is-success' : ''}`}>{detailStatus}</span>
    </div>
  )
}

function MembersTable({ detail }: { detail: AdminDirectoryWorkspaceDetailResource }) {
  return (
    <div>
      <h3 className="management-subheading">Members</h3>
      <div className="management-table-wrap"><table className="management-table compact">
        <thead><tr><th>Member</th><th>Role</th><th>Usage</th></tr></thead>
        <tbody>{detail.members.length ? detail.members.map((member) => (
          <tr key={member.userId}><td><strong>{member.displayName}</strong><MetaLine>{member.email ?? member.userId}</MetaLine></td><td><span className="management-badge">{member.role}</span></td><td>{formatNumber(member.usageCredits)}<MetaLine>{member.chargeCount} charges</MetaLine></td></tr>
        )) : <EmptyRow colSpan={3} message="No members loaded." />}</tbody>
      </table></div>
    </div>
  )
}

function BoardsTable({ detail }: { detail: AdminDirectoryWorkspaceDetailResource }) {
  return (
    <div>
      <h3 className="management-subheading">Boards</h3>
      <div className="management-table-wrap"><table className="management-table compact">
        <thead><tr><th>Board</th><th>Visibility</th><th>Saved</th></tr></thead>
        <tbody>{detail.boards.length ? detail.boards.map((board) => (
          <tr key={board.id}><td><strong>{board.title}</strong><MetaLine>{board.id}</MetaLine></td><td>{board.visibility}</td><td>{formatDate(board.savedAt)}</td></tr>
        )) : <EmptyRow colSpan={3} message="No boards loaded." />}</tbody>
      </table></div>
    </div>
  )
}
