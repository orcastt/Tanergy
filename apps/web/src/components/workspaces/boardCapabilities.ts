import type { TangentSession } from '@/features/auth/sessionTypes'
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
  const workspaceRole = session.workspaces.find((workspace) => workspace.id === board.workspaceId)?.role
    ?? session.activeWorkspace.role
  const canAdministerWorkspace = ['admin', 'owner'].includes(workspaceRole)
  const canManageBoard = isBoardOwner || canAdministerWorkspace
  return {
    canCopyBoard: isBoardOwner || canAdministerWorkspace,
    canDeleteBoard: isBoardOwner || canAdministerWorkspace,
    canManageBoard,
    canShareBoard: canManageBoard,
    isBoardOwner,
  }
}
