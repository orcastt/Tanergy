import { randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { auditBoardDocument } from '@/features/boards/boardDocumentGuard'
import { summarizeBoardRecord, type BoardPersistenceRecord, type BoardSaveInput } from '@/features/boards/boardTypes'
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

export async function listLocalBoards(context: ApiRequestContext) {
  let entries: Dirent[]
  try {
    entries = await readdir(boardsRoot, { withFileTypes: true })
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw error
  }

  const boards = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      const raw = await readFile(path.join(boardsRoot, entry.name), 'utf8')
      const board = normalizeBoardRecord(JSON.parse(raw) as Partial<BoardPersistenceRecord>, context)
      if (board.workspaceId === context.workspaceId) boards.push(summarizeBoardRecord(board))
    } catch {
      continue
    }
  }

  return boards.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
}

export async function renameLocalBoard(boardId: string, title: string, context: ApiRequestContext) {
  const board = await loadLocalBoard(boardId, context)
  const nextTitle = title.trim()
  if (!nextTitle) throw new Error('Board title is required.')
  if (nextTitle.length > 80) throw new Error('Board title must be 80 characters or fewer.')

  const updated: BoardPersistenceRecord = {
    ...board,
    savedAt: new Date().toISOString(),
    title: nextTitle,
  }
  await writeFile(getBoardPath(updated.id), `${JSON.stringify(updated, null, 2)}\n`)
  return summarizeBoardRecord(updated)
}

export async function deleteLocalBoard(boardId: string, context: ApiRequestContext) {
  const board = await loadLocalBoard(boardId, context)
  await unlink(getBoardPath(board.id))
  return board.id
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
