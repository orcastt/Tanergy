import type { BoardCollaborationPermission } from '@/features/boards/boardCollaborationTypes'
import type { BoardPersistenceRecord } from '@/features/boards/boardTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { listLocalBoardMembers } from './localBoardMembersStore'
import { readRequiredLocalBoardRecord } from './localBoardRecordAccess'

export async function readRequiredLocalBoardCollaborationBoard(
  boardId: string,
  context: ApiRequestContext,
) {
  return readRequiredLocalBoardRecord(boardId, context)
}

export async function resolveLocalBoardCollaborationPermission(
  board: BoardPersistenceRecord,
  context: ApiRequestContext,
): Promise<BoardCollaborationPermission> {
  if (board.ownerId === context.userId) return 'owner'
  try {
    const members = await listLocalBoardMembers(board.id, context)
    const member = members.find((entry) => entry.userId === context.userId)
    if (member?.role === 'owner') return 'owner'
    if (member?.role === 'admin') return 'manage'
    if (member?.role === 'editor') return 'edit'
    if (member?.role === 'viewer' || member?.role === 'temporary_viewer') return 'view'
  } catch {
    return 'view'
  }
  return 'view'
}
