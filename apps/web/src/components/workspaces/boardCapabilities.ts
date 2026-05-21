import type { TangentSession, TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'

export type BoardCapabilities = {
  canCopyBoard: boolean
  canDeleteBoard: boolean
  canManageBoard: boolean
  canShareBoard: boolean
  isBoardOwner: boolean
}

export function getBoardCapabilities(board: BoardPersistenceSummary, session: TangentSession): BoardCapabilities {
  const isBoardOwner = board.ownerId === session.user.id
  const workspace = session.workspaces.find((item) => item.id === board.workspaceId)
    ?? (session.activeWorkspace.id === board.workspaceId ? session.activeWorkspace : undefined)
  const workspaceRole = workspace?.role ?? session.activeWorkspace.role
  const workspaceKind = workspace?.kind ?? session.activeWorkspace.kind
  const canAdministerWorkspace = ['admin', 'owner'].includes(workspaceRole)
  const isSharedWorkspace = ['group_workspace', 'team_workspace'].includes(workspaceKind)
  const canOwnBoard = isSharedWorkspace ? workspaceRole === 'owner' : isBoardOwner
  const canDeleteBoard = isSharedWorkspace ? canAdministerWorkspace : isBoardOwner
  const canManageBoard = isBoardOwner || canAdministerWorkspace
  return {
    canCopyBoard: canOwnBoard,
    canDeleteBoard,
    canManageBoard,
    canShareBoard: canManageBoard && ['group_workspace', 'team_workspace'].includes(workspaceKind),
    isBoardOwner,
  }
}

export function canCreateWorkspaceBoards(workspace: Pick<TangentWorkspace, 'role'>) {
  return workspace.role === 'owner' || workspace.role === 'admin'
}
