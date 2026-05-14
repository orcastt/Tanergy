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
  const workspace = session.workspaces.find((item) => item.id === board.workspaceId)
    ?? (session.activeWorkspace.id === board.workspaceId ? session.activeWorkspace : undefined)
  const workspaceRole = workspace?.role ?? session.activeWorkspace.role
  const canAdministerWorkspace = ['admin', 'owner'].includes(workspaceRole)
  const canOwnViaSoloWorkspace = workspace?.kind === 'solo_workspace' && workspace.role === 'owner'
  const canOwnBoard = isBoardOwner || canOwnViaSoloWorkspace
  const canManageBoard = isBoardOwner || canAdministerWorkspace
  return {
    canCopyBoard: canOwnBoard,
    canDeleteBoard: canOwnBoard,
    canManageBoard,
    canShareBoard: canManageBoard,
    isBoardOwner,
  }
}
