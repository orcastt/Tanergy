'use client'

import { useState } from 'react'
import {
  removeWorkspaceMember,
  transferWorkspaceOwner,
  updateWorkspaceMemberRole,
  upsertWorkspaceSeat,
} from '@/features/billing/billingClient'
import { planCatalog } from '@/features/billing/billingContracts'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { getPublicUserLabel } from '@/features/shared/publicUserDisplay'
import { formatWorkspaceMembershipRole, type WorkspaceMembershipRole } from '@/features/workspaces/workspacePresentation'
import type { WorkspaceDashboardMember } from '@/features/workspaces/workspaceDashboardTypes'

type WorkspaceMembersPanelProps = {
  members: WorkspaceDashboardMember[]
  onMembersChanged?: () => void
  workspace: TangentWorkspace
}

const editableRoles: WorkspaceMembershipRole[] = ['admin', 'editor', 'viewer']
const managerRoles = new Set(['owner', 'admin'])

export function WorkspaceMembersPanel({ members, onMembersChanged, workspace }: WorkspaceMembersPanelProps) {
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
                  <small>{member.email ?? `${formatWorkspaceMembershipRole(member.role)} · ${member.boardAssignments} boards`}</small>
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
                {workspace.kind === 'team_workspace' && member.role !== 'owner' && canManageMembers ? (
                  <button className="workspace-detail-muted-button" disabled={pendingMemberId === member.id} onClick={() => assignSeat(member.id)} type="button">Assign seat</button>
                ) : null}
                {canTransferOwnership(member.role) ? (
                  <button className="workspace-detail-muted-button" disabled={pendingMemberId === member.id} onClick={() => transferOwnership(member.id)} type="button">Transfer owner</button>
                ) : null}
                {member.role === 'owner' || !canRemoveMember(member.role) ? null : (
                  <button className="workspace-detail-danger-button" disabled={pendingMemberId === member.id || !canManageMembers} onClick={() => removeMember(member.id)} type="button">Remove</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
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

  async function assignSeat(userId: string) {
    if (!canManageMembers) return setStatus('Your workspace role cannot manage seats.')
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

  async function transferOwnership(userId: string) {
    if (!canManageAdmins) return setStatus('Only owners can transfer workspace ownership.')
    if (workspace.kind !== 'team_workspace') return setStatus('Owner transfer is available for Team workspaces only right now.')
    setPendingMemberId(userId)
    setStatus(null)
    try {
      await transferWorkspaceOwner({ userId }, { workspace })
      requestCurrentSessionRefresh()
      setStatus('Workspace ownership transferred. Refreshing workspace session...')
      onMembersChanged?.()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Owner transfer failed.')
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

  function canTransferOwnership(role: WorkspaceMembershipRole) {
    if (!canManageAdmins) return false
    if (workspace.kind !== 'team_workspace') return false
    return role !== 'owner'
  }
}
