import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { BoardPersistenceRecord } from '@/features/boards/boardTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import {
  getLocalBoardPath,
  localBoardRecordsRoot,
  sanitizeLocalBoardId,
  shareableWorkspaceKinds,
} from './localBoardMembersSupport'

export async function readRequiredLocalBoardRecord(
  boardId: string,
  context: ApiRequestContext,
): Promise<BoardPersistenceRecord> {
  const safeBoardId = sanitizeLocalBoardId(boardId)
  if (!safeBoardId) throw new Error('Invalid board id.')
  const raw = await readFile(getLocalBoardPath(safeBoardId), 'utf8')
  const board = JSON.parse(raw) as Partial<BoardPersistenceRecord>
  if (board.workspaceId !== context.workspaceId) {
    throw new Error('Board not found in workspace.')
  }
  if (!board.id || !board.ownerId) {
    throw new Error('Board record is invalid.')
  }
  return board as BoardPersistenceRecord
}

export async function readLocalBoardRecordById(boardId: string) {
  const raw = await readFile(getLocalBoardPath(boardId), 'utf8')
  return JSON.parse(raw) as BoardPersistenceRecord
}

export async function writeLocalBoardRecord(board: BoardPersistenceRecord) {
  await mkdir(localBoardRecordsRoot, { recursive: true })
  await writeFile(getLocalBoardPath(board.id), `${JSON.stringify(board, null, 2)}\n`)
}

export function assertLocalBoardCanCreateShareLink(context: ApiRequestContext) {
  if (!shareableWorkspaceKinds.has(context.workspaceKind)) {
    throw new Error('Board share links are only available in Team or Group workspaces.')
  }
}
