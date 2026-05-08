'use client'

import { useState } from 'react'
import {
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  upsertWorkspaceSeat,
} from '@/features/billing/billingClient'
import { planCatalog } from '@/features/billing/billingContracts'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { formatWorkspaceMembershipRole, type WorkspaceMembershipRole } from '@/features/workspaces/workspaceDirectoryMock'
import type { WorkspaceDashboardMember } from '@/features/workspaces/workspaceDashboardMock'

type WorkspaceMembersPanelProps = {
  members: WorkspaceDashboardMember[]
  onMembersChanged?: () => void
  workspace: TangentWorkspace
}

const editableRoles: WorkspaceMembershipRole[] = ['admin', 'editor', 'viewer']

export function WorkspaceMembersPanel({ members, onMembersChanged, workspace }: WorkspaceMembersPanelProps) {
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(() => new Set())
  const [pendingMemberId, setPendingMemberId] = useState<null | string>(null)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, WorkspaceMembershipRole>>({})
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
                <strong>{member.displayName || formatWorkspaceMembershipRole(member.role)}</strong>
                <small>{member.email ?? `${formatWorkspaceMembershipRole(member.role)} · ${member.boardAssignments} boards`}</small>
              </div>
            </div>
            <div className="workspace-detail-member-actions">
              {member.role === 'owner' ? (
                <span className="workspace-detail-member-role-label">Owner</span>
              ) : (
                <select
                  aria-label={`Role for ${member.displayName || member.id}`}
                  disabled={pendingMemberId === member.id}
                  onChange={(event) => setRoleDrafts((current) => ({ ...current, [member.id]: event.target.value as WorkspaceMembershipRole }))}
                  value={roleDrafts[member.id] ?? member.role}
                >
                  {editableRoles.map((role) => <option key={role} value={role}>{formatWorkspaceMembershipRole(role)}</option>)}
                </select>
              )}
              {member.role === 'owner' ? null : (
                <button className="workspace-detail-muted-button" disabled={pendingMemberId === member.id} onClick={() => saveRole(member)} type="button">Save role</button>
              )}
              {workspace.kind === 'team_workspace' && member.role !== 'owner' ? (
                <button className="workspace-detail-muted-button" disabled={pendingMemberId === member.id} onClick={() => assignSeat(member.id)} type="button">Assign seat</button>
              ) : null}
              {member.role === 'owner' ? null : (
                <button className="workspace-detail-danger-button" disabled={pendingMemberId === member.id} onClick={() => removeMember(member.id)} type="button">Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )

  async function saveRole(member: WorkspaceDashboardMember) {
    const nextRole = roleDrafts[member.id] ?? member.role
    setPendingMemberId(member.id)
    setStatus(null)
    try {
      await updateWorkspaceMemberRole(member.id, { role: nextRole }, { workspace })
      setStatus('Role updated.')
      onMembersChanged?.()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Role update failed.')
    } finally {
      setPendingMemberId(null)
    }
  }

  async function assignSeat(userId: string) {
    const planKey = workspace.planKey === 'team_growth' ? 'team_growth' : 'team_start'
    setPendingMemberId(userId)
    setStatus(null)
    try {
      await upsertWorkspaceSeat({
        includedCredits: planCatalog[planKey].includedCredits,
        planKey,
        userId,
      }, { workspace })
      setStatus('Seat assigned.')
      onMembersChanged?.()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Seat assignment failed.')
    } finally {
      setPendingMemberId(null)
    }
  }

  async function removeMember(userId: string) {
    setPendingMemberId(userId)
    setStatus(null)
    try {
      await removeWorkspaceMember(userId, { workspace })
      setHiddenMemberIds((current) => new Set([...current, userId]))
      setStatus('Member removed.')
      onMembersChanged?.()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Remove failed.')
    } finally {
      setPendingMemberId(null)
    }
  }
}
