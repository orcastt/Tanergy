'use client'

import { useState } from 'react'
import {
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '@/features/billing/billingClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { getPublicUserLabel } from '@/features/shared/publicUserDisplay'
import type { WorkspaceDashboardBoard } from '@/features/workspaces/workspaceDashboardTypes'
import { formatWorkspaceMembershipRole, type WorkspaceMembershipRole } from '@/features/workspaces/workspacePresentation'
import type { WorkspaceDashboardMember } from '@/features/workspaces/workspaceDashboardTypes'
import { WorkspaceMemberBoardAssignmentsDialog } from './WorkspaceMemberBoardAssignmentsDialog'

type WorkspaceMembersPanelProps = {
  boards: WorkspaceDashboardBoard[]
  members: WorkspaceDashboardMember[]
  onMembersChanged?: () => void
  workspace: TangentWorkspace
}

const editableRoles: WorkspaceMembershipRole[] = ['admin', 'editor', 'viewer']
const managerRoles = new Set(['owner', 'admin'])

export function WorkspaceMembersPanel({ boards, members, onMembersChanged, workspace }: WorkspaceMembersPanelProps) {
  const [assignmentMember, setAssignmentMember] = useState<WorkspaceDashboardMember | null>(null)
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(() => new Set())
  const [pendingMemberId, setPendingMemberId] = useState<null | string>(null)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, WorkspaceMembershipRole>>({})
  const [status, setStatus] = useState<null | string>(null)
  const visibleMembers = members.filter((member) => !hiddenMemberIds.has(member.id))
  const canManageMembers = managerRoles.has(workspace.role)
  const canManageAdmins = workspace.role === 'owner'

  return (
    <section className="workspace-detail-panel workspace-detail-members-panel">
      <div className="workspace-detail-panel-head">
        <div>
          <h2>Members</h2>
          <small>{canManageMembers ? 'Role changes are saved to the workspace contract.' : 'Your role can view members only.'}</small>
        </div>
      </div>
      {status ? <small className="workspace-detail-status" role="status">{status}</small> : null}
      <div className="workspace-detail-member-list">
        {visibleMembers.map((member) => {
          const memberLabel = getPublicUserLabel({
            displayName: member.displayName,
            email: member.email,
            fallback: formatWorkspaceMembershipRole(member.role),
            userId: member.id,
          })

          return (
            <div className="workspace-detail-member-row" key={member.id}>
              <div className="workspace-detail-member-copy">
                <span className="workspace-detail-avatar large">{member.initials}</span>
                <div>
                  <strong>{memberLabel}</strong>
                  <small>
                    {member.email ? `${member.email} · ` : ''}
                    {formatWorkspaceMembershipRole(member.role)} · {member.boardAssignments} boards
                  </small>
                </div>
              </div>
              <div className="workspace-detail-member-actions">
                {member.role === 'owner' || !canEditMember(member.role) ? (
                  <span className="workspace-detail-member-role-label">{formatWorkspaceMembershipRole(member.role)}</span>
                ) : (
                  <select
                    aria-label={`Role for ${memberLabel}`}
                    disabled={pendingMemberId === member.id || !canManageMembers}
                    onChange={(event) => setRoleDrafts((current) => ({ ...current, [member.id]: event.target.value as WorkspaceMembershipRole }))}
                    value={roleDrafts[member.id] ?? member.role}
                  >
                    {editableRoles
                      .filter((role) => role !== 'admin' || canManageAdmins)
                      .map((role) => <option key={role} value={role}>{formatWorkspaceMembershipRole(role)}</option>)}
                  </select>
                )}
                {member.role === 'owner' || !canEditMember(member.role) ? null : (
                  <button className="workspace-detail-muted-button" disabled={pendingMemberId === member.id || !canManageMembers} onClick={() => saveRole(member)} type="button">Save role</button>
                )}
                {canAssignBoards(member.role) ? (
                  <button
                    className="workspace-detail-muted-button"
                    disabled={pendingMemberId === member.id || !canManageMembers}
                    onClick={() => setAssignmentMember(member)}
                    type="button"
                  >
                    Assign boards
                  </button>
                ) : null}
                {member.role === 'owner' || !canRemoveMember(member.role) ? null : (
                  <button className="workspace-detail-danger-button" disabled={pendingMemberId === member.id || !canManageMembers} onClick={() => removeMember(member.id)} type="button">Remove</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {assignmentMember ? (
        <WorkspaceMemberBoardAssignmentsDialog
          boards={boards}
          key={`${assignmentMember.id}:${boards.map((board) => board.id).join('|')}`}
          member={assignmentMember}
          onClose={() => setAssignmentMember(null)}
          onSaved={onMembersChanged ?? (() => undefined)}
          workspace={workspace}
        />
      ) : null}
    </section>
  )

  async function saveRole(member: WorkspaceDashboardMember) {
    const nextRole = roleDrafts[member.id] ?? member.role
    if (!canManageMembers) return setStatus('Your workspace role cannot manage members.')
    if (nextRole === 'admin' && !canManageAdmins) return setStatus('Only owners can grant admin.')
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

  async function removeMember(userId: string) {
    if (!canManageMembers) return setStatus('Your workspace role cannot remove members.')
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

  function canEditMember(role: WorkspaceMembershipRole) {
    if (!canManageMembers) return false
    if (role === 'admin') return canManageAdmins
    return role !== 'owner'
  }

  function canRemoveMember(role: WorkspaceMembershipRole) {
    if (!canManageMembers) return false
    if (role === 'admin') return canManageAdmins
    return role !== 'owner'
  }

  function canAssignBoards(role: WorkspaceMembershipRole) {
    if (!canManageMembers) return false
    return role === 'editor' || role === 'viewer'
  }
}
