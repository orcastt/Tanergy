import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { auditBoardDocument } from '@/features/boards/boardDocumentGuard'
import type { BoardPersistenceRecord, BoardSaveInput } from '@/features/boards/boardTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'

const storageRoot = process.env.TANGENT_BOARD_STORAGE_DIR ?? path.join(process.cwd(), '.tangent-boards')
const boardsRoot = path.join(storageRoot, 'boards')

export async function saveLocalBoard(input: BoardSaveInput, context: ApiRequestContext) {
  const audit = auditBoardDocument(input.document)
  if (!audit.ok) {
    return { audit, board: null }
  }

  const boardId = sanitizeBoardId(input.boardId) ?? `board_${randomUUID()}`
  const record: BoardPersistenceRecord = {
    byteSize: audit.byteSize,
    document: input.document,
    id: boardId,
    ownerId: context.userId,
    savedAt: new Date().toISOString(),
    title: input.title?.trim() || 'Untitled Board',
    workspaceId: context.workspaceId,
  }

  await mkdir(boardsRoot, { recursive: true })
  await writeFile(getBoardPath(boardId), `${JSON.stringify(record, null, 2)}\n`)
  return { audit, board: record }
}

export async function loadLocalBoard(boardId: string, context: ApiRequestContext) {
  const safeBoardId = sanitizeBoardId(boardId)
  if (!safeBoardId) throw new Error('Invalid board id.')
  const raw = await readFile(getBoardPath(safeBoardId), 'utf8')
  const board = normalizeBoardRecord(JSON.parse(raw) as Partial<BoardPersistenceRecord>, context)
  assertBoardAccess(board, context)
  return board
}

function getBoardPath(boardId: string) {
  return path.join(boardsRoot, `${boardId}.json`)
}

function sanitizeBoardId(value: string | undefined) {
  if (!value) return null
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes('..') ? value : null
}

function normalizeBoardRecord(
  record: Partial<BoardPersistenceRecord>,
  context: ApiRequestContext
): BoardPersistenceRecord {
  return {
    byteSize: record.byteSize ?? 0,
    document: record.document ?? null,
    id: record.id ?? '',
    ownerId: record.ownerId ?? context.userId,
    savedAt: record.savedAt ?? new Date(0).toISOString(),
    title: record.title ?? 'Untitled Board',
    workspaceId: record.workspaceId ?? context.workspaceId,
  }
}

function assertBoardAccess(board: BoardPersistenceRecord, context: ApiRequestContext) {
  if (board.workspaceId !== context.workspaceId) {
    throw new Error('Board not found in workspace.')
  }
}
