'use client'

import type { AdminOperatorAction } from './adminOperatorActions'
import type { AdminOperatorMutationResult } from './adminOperatorActionMutations'
import { readAdminWorkspaceLookupRecord } from './adminWorkspaceLookupCache'
import type {
  AdminOperatorBoardSummary,
  AdminOperatorMemberSummary,
  AdminOperatorUserDetail,
  AdminOperatorWorkspacePlan,
} from './adminTypes'

export function applyAdminOperatorDetailMutation(
  detail: AdminOperatorUserDetail,
  action: AdminOperatorAction,
  result: AdminOperatorMutationResult,
): AdminOperatorUserDetail | null {
  switch (action.type) {
    case 'user-status':
      return ('userId' in result && 'status' in result && result.userId === detail.user.id)
        ? { ...detail, user: { ...detail.user, status: result.status } }
        : null
    case 'workspace-member-role':
      return isWorkspaceMemberMutation(result)
        ? patchWorkspaceCollections(detail, result.workspaceId, (workspace, joined) => {
            if (!workspace.members.some((member) => member.userId === result.userId)) return workspace
            const nextMembers = workspace.members.map((member) => member.userId === result.userId
              ? { ...member, role: result.role ?? member.role }
              : member)
            return {
              ...workspace,
              members: nextMembers,
              role: joined && result.userId === detail.user.id && result.role ? result.role : workspace.role,
            }
          })
        : null
    case 'workspace-member-add':
      return isWorkspaceMemberMutation(result)
        ? patchWorkspaceCollections(detail, result.workspaceId, (workspace) => {
            if (workspace.members.some((member) => member.userId === result.userId)) return workspace
            return {
              ...workspace,
              memberCount: workspace.memberCount + 1,
              members: [...workspace.members, placeholderMember(result.userId, result.role)],
            }
          })
        : null
    case 'user-join-team':
    case 'user-join-group':
      return isWorkspaceMemberMutation(result) && result.userId === detail.user.id
        ? appendJoinedWorkspace(detail, action.type === 'user-join-team' ? 'team' : 'group', result)
        : null
    case 'workspace-member-remove':
      return isWorkspaceMemberMutation(result)
        ? patchWorkspaceCollections(detail, result.workspaceId, (workspace, joined) => {
            if (joined && result.userId === detail.user.id) return null
            const hadMember = workspace.members.some((member) => member.userId === result.userId)
            if (!hadMember) return workspace
            return {
              ...workspace,
              memberCount: Math.max(0, workspace.memberCount - 1),
              members: workspace.members.filter((member) => member.userId !== result.userId),
            }
          })
        : null
    case 'workspace-invite-create':
      return isWorkspaceInvitationMutation(result)
        ? patchWorkspaceCollections(detail, result.workspaceId, (workspace) => ({
            ...workspace,
            invitations: [result.invitation, ...workspace.invitations.filter((invitation) => invitation.id !== result.invitation.id)],
          }))
        : null
    case 'workspace-invite-revoke':
      return isWorkspaceInvitationMutation(result)
        ? patchWorkspaceCollections(detail, result.workspaceId, (workspace) => ({
            ...workspace,
            invitations: workspace.invitations.filter((invitation) => invitation.id !== result.invitation.id),
          }))
        : null
    case 'board-copy':
      if (!isBoardMutation(result) || !result.board) return null
      {
        const board = result.board
      return patchWorkspaceCollections(detail, result.workspaceId, (workspace) => {
            if (workspace.boards.some((existingBoard) => existingBoard.id === board.id)) return workspace
            return {
              ...workspace,
              boardCount: workspace.boardCount + 1,
              boards: [toBoardSummary(board), ...workspace.boards],
            }
          })
      }
    case 'board-delete':
      return isBoardMutation(result)
        ? patchWorkspaceCollections(detail, result.workspaceId, (workspace) => {
            if (!workspace.boards.some((board) => board.id === result.boardId)) return workspace
            return {
              ...workspace,
              boardCount: Math.max(0, workspace.boardCount - 1),
              boards: workspace.boards.filter((board) => board.id !== result.boardId),
            }
          })
        : null
    default:
      return null
  }
}

function patchWorkspaceCollections(
  detail: AdminOperatorUserDetail,
  workspaceId: string,
  patcher: (workspace: AdminOperatorWorkspacePlan, joined: boolean) => AdminOperatorWorkspacePlan | null,
) {
  let changed = false
  const patchRows = (rows: AdminOperatorWorkspacePlan[], joined: boolean) => {
    let localChanged = false
    const nextRows: AdminOperatorWorkspacePlan[] = []
    for (const workspace of rows) {
      if (workspace.id !== workspaceId) {
        nextRows.push(workspace)
        continue
      }
      const nextWorkspace = patcher(workspace, joined)
      if (nextWorkspace !== workspace) localChanged = true
      if (nextWorkspace) nextRows.push(nextWorkspace)
      else localChanged = true
    }
    if (localChanged) changed = true
    return localChanged ? nextRows : rows
  }

  const ownedTeams = patchRows(detail.ownedTeams, false)
  const ownedGroups = patchRows(detail.ownedGroups, false)
  const joinedTeams = patchRows(detail.joinedTeams, true)
  const joinedGroups = patchRows(detail.joinedGroups, true)

  if (!changed) return null
  return {
    ...detail,
    joinedGroups,
    joinedTeams,
    ownedGroups,
    ownedTeams,
  }
}

function placeholderMember(userId: string, role?: null | string): AdminOperatorMemberSummary {
  return {
    displayName: userId,
    email: null,
    role: role ?? 'viewer',
    usageCredits: 0,
    userId,
  }
}

function appendJoinedWorkspace(
  detail: AdminOperatorUserDetail,
  kind: 'group' | 'team',
  result: Extract<AdminOperatorMutationResult, { role?: null | string; userId: string; workspaceId: string }>,
) {
  const targetRows = kind === 'team' ? detail.joinedTeams : detail.joinedGroups
  if (targetRows.some((workspace) => workspace.id === result.workspaceId)) return null
  const lookup = readAdminWorkspaceLookupRecord(result.workspaceId)
  if (!lookup) return null
  const nextWorkspace = workspacePlanFromLookup(lookup, result.role)
  return kind === 'team'
    ? { ...detail, joinedTeams: [nextWorkspace, ...detail.joinedTeams] }
    : { ...detail, joinedGroups: [nextWorkspace, ...detail.joinedGroups] }
}

function workspacePlanFromLookup(
  workspace: {
    boardCount: number
    createdAt: string
    id: string
    kind: string
    memberCount: number
    name: string
    ownerEmail: string
    ownerId?: null | string
    planKey?: null | string
    planStatus?: null | string
    seatCapacity: number
    subscriptionId?: null | string
    subscriptionPeriodEnd?: null | string
    usageCredits: number
    walletCredits: number
  },
  role?: null | string,
): AdminOperatorWorkspacePlan {
  return {
    boardCount: workspace.boardCount,
    boards: [],
    createdAt: workspace.createdAt,
    credit: {
      remainingCredits: workspace.walletCredits,
      spentCredits: workspace.usageCredits,
      totalCredits: workspace.walletCredits + workspace.usageCredits,
    },
    id: workspace.id,
    invitations: [],
    kind: workspace.kind,
    memberCount: workspace.memberCount,
    members: [],
    ownerEmail: workspace.ownerEmail,
    ownerId: workspace.ownerId ?? null,
    periodEnd: workspace.subscriptionPeriodEnd ?? null,
    periodStart: null,
    planKey: workspace.planKey ?? null,
    planStatus: workspace.planStatus ?? null,
    role: role ?? 'viewer',
    seatCapacity: workspace.seatCapacity,
    subscriptionId: workspace.subscriptionId ?? null,
    usageByUser: 0,
    workspaceName: workspace.name,
  }
}

function toBoardSummary(board: {
  id: string
  title: string
  visibility: string
  workspaceId: string
}): AdminOperatorBoardSummary {
  return {
    id: board.id,
    title: board.title,
    visibility: board.visibility,
  }
}

function isBoardMutation(result: AdminOperatorMutationResult): result is Extract<AdminOperatorMutationResult, { boardId: string; workspaceId: string }> {
  return 'boardId' in result && 'workspaceId' in result && typeof result.boardId === 'string' && typeof result.workspaceId === 'string'
}

function isWorkspaceInvitationMutation(result: AdminOperatorMutationResult): result is Extract<AdminOperatorMutationResult, { invitation: { id: string }; workspaceId: string }> {
  return 'invitation' in result && 'workspaceId' in result && typeof result.workspaceId === 'string'
}

function isWorkspaceMemberMutation(result: AdminOperatorMutationResult): result is Extract<AdminOperatorMutationResult, { userId: string; workspaceId: string }> {
  return 'userId' in result && 'workspaceId' in result && typeof result.userId === 'string' && typeof result.workspaceId === 'string'
}
