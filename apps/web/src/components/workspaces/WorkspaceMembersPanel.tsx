'use client'

import { useState } from 'react'
import { removeWorkspaceMember } from '@/features/billing/billingClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { formatWorkspaceMembershipRole } from '@/features/workspaces/workspaceDirectoryMock'
import type { WorkspaceDashboardMember } from '@/features/workspaces/workspaceDashboardMock'

type WorkspaceMembersPanelProps = {
  members: WorkspaceDashboardMember[]
  workspace: TangentWorkspace
}

export function WorkspaceMembersPanel({ members, workspace }: WorkspaceMembersPanelProps) {
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(() => new Set())
  const [status, setStatus] = useState<null | string>(null)
  const visibleMembers = members.filter((member) => !hiddenMemberIds.has(member.id))

  return (
    <section className="workspace-detail-panel workspace-detail-members-panel">
      <div className="workspace-detail-panel-head"><h2>Members</h2></div>
      {status ? <small className="workspace-detail-status" role="status">{status}</small> : null}
      <div className="workspace-detail-member-list">
        {visibleMembers.map((member) => (
          <div className="workspace-detail-member-row" key={member.id}>
            <div className="workspace-detail-member-copy">
              <span className="workspace-detail-avatar large">{member.initials}</span>
              <div>
                <strong>{formatWorkspaceMembershipRole(member.role)}</strong>
                <small>{member.boardAssignments} boards</small>
              </div>
            </div>
            <div className="workspace-detail-member-actions">
              <button className="workspace-detail-muted-button" type="button">Manage</button>
              <button className="workspace-detail-muted-button" type="button">Assign board</button>
              {member.role === 'owner' ? null : (
                <button className="workspace-detail-danger-button" onClick={() => removeMember(member.id)} type="button">Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )

  async function removeMember(userId: string) {
    setStatus(null)
    try {
      await removeWorkspaceMember(userId, { workspace })
      setHiddenMemberIds((current) => new Set([...current, userId]))
      setStatus('Member removed.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Remove failed.')
    }
  }
}
