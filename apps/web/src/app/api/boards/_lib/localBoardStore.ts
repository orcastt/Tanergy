import { randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { auditBoardDocument } from '@/features/boards/boardDocumentGuard'
import { coerceBoardTitle, normalizeBoardTitle } from '@/features/boards/boardTitle'
import {
  getBoardDocumentMetrics,
  normalizeBoardCardColor,
  normalizeBoardDescription,
  normalizeBoardShareId,
  normalizeBoardThumbnailUrl,
  normalizeBoardVisibility,
  summarizeBoardRecord,
  type BoardMetadataUpdateInput,
  type BoardPersistenceRecord,
  type BoardSaveInput,
} from '@/features/boards/boardTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'

const storageRoot = process.env.TANGENT_BOARD_STORAGE_DIR ?? path.join(process.cwd(), '.tangent-boards')
const boardsRoot = path.join(storageRoot, 'boards')
const shareableWorkspaceKinds = new Set(['group_workspace', 'team_workspace'])

export async function saveLocalBoard(input: BoardSaveInput, context: ApiRequestContext) {
  const audit = auditBoardDocument(input.document)
  if (!audit.ok) {
    return { audit, board: null }
  }

  const boardId = sanitizeBoardId(input.boardId) ?? `board_${randomUUID()}`
  const metrics = getBoardDocumentMetrics(input.document)
  const existing = await readLocalBoardRecord(boardId, context)
  if (existing) assertBoardAccess(existing, context)
  if (!existing && input.createIfMissing === false) throw new Error('Board not found in workspace.')
  if (!existing) assertWorkspaceCanCreateBoard(context)
  const savedAt = new Date().toISOString()
  const record: BoardPersistenceRecord = {
    assetCount: metrics.assetCount,
    byteSize: audit.byteSize,
    cardColor: normalizeBoardCardColor(input.cardColor ?? existing?.cardColor),
    createdAt: existing?.createdAt ?? savedAt,
    description: normalizeBoardDescription(input.description ?? existing?.description),
    document: input.document,
    id: boardId,
    isPinned: existing?.isPinned ?? false,
    isStarred: existing?.isStarred ?? false,
    lastOpenedAt: existing?.lastOpenedAt ?? null,
    ownerId: existing?.ownerId ?? context.userId,
    savedAt,
    shapeCount: metrics.shapeCount,
    shareId: normalizeBoardShareId(existing?.shareId),
    thumbnailUrl: normalizeBoardThumbnailUrl(input.thumbnailUrl ?? existing?.thumbnailUrl),
    title: input.title === undefined
      ? coerceBoardTitle(existing?.title)
      : normalizeBoardTitle(input.title),
    visibility: normalizeBoardVisibility(existing?.visibility),
    workspaceId: context.workspaceId,
  }

  await mkdir(boardsRoot, { recursive: true })
  await writeFile(getBoardPath(boardId), `${JSON.stringify(record, null, 2)}\n`)
  return { audit, board: record }
}

export async function loadLocalBoard(boardId: string, context: ApiRequestContext) {
  const safeBoardId = sanitizeBoardId(boardId)
  if (!safeBoardId) throw new Error('Invalid board id.')
  const board = await readRequiredBoardRecord(safeBoardId, context)
  assertBoardAccess(board, context)
  const updated = {
    ...board,
    lastOpenedAt: new Date().toISOString(),
  }
  await writeBoardRecord(updated)
  return updated
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
    if (
      !entry.isFile()
      || !entry.name.endsWith('.json')
      || entry.name.endsWith('.shares.json')
      || entry.name.endsWith('.members.json')
    ) {
      continue
    }
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
  return updateLocalBoardMetadata({ boardId, title }, context)
}

export async function updateLocalBoardMetadata(input: BoardMetadataUpdateInput, context: ApiRequestContext) {
  const board = await readRequiredBoardRecord(input.boardId, context)
  assertBoardAccess(board, context)
  const hasTitle = Object.prototype.hasOwnProperty.call(input, 'title')
  const nextTitle = hasTitle ? normalizeBoardTitle(input.title, board.title) : board.title

  const nextVisibility = Object.prototype.hasOwnProperty.call(input, 'visibility')
    ? normalizeBoardVisibility(input.visibility)
    : normalizeBoardVisibility(board.visibility)
  const updated: BoardPersistenceRecord = {
    ...board,
    cardColor: Object.prototype.hasOwnProperty.call(input, 'cardColor')
      ? normalizeBoardCardColor(input.cardColor)
      : board.cardColor,
    description: Object.prototype.hasOwnProperty.call(input, 'description')
      ? normalizeBoardDescription(input.description)
      : board.description,
    isPinned: Object.prototype.hasOwnProperty.call(input, 'isPinned')
      ? Boolean(input.isPinned)
      : Boolean(board.isPinned),
    isStarred: Object.prototype.hasOwnProperty.call(input, 'isStarred')
      ? Boolean(input.isStarred)
      : Boolean(board.isStarred),
    savedAt: new Date().toISOString(),
    shareId: Object.prototype.hasOwnProperty.call(input, 'shareId')
      ? normalizeBoardShareId(input.shareId)
      : normalizeBoardShareId(board.shareId),
    thumbnailUrl: Object.prototype.hasOwnProperty.call(input, 'thumbnailUrl')
      ? normalizeBoardThumbnailUrl(input.thumbnailUrl)
      : normalizeBoardThumbnailUrl(board.thumbnailUrl),
    title: nextTitle,
    visibility: nextVisibility,
  }
  assertWorkspaceAllowsBoardVisibility(context.workspaceKind, nextVisibility ?? 'private')
  if (!shareableWorkspaceKinds.has(context.workspaceKind)) {
    updated.shareId = null
  }
  await writeBoardRecord(updated)
  return summarizeBoardRecord(updated)
}

export async function deleteLocalBoard(boardId: string, context: ApiRequestContext) {
  const board = await readRequiredBoardRecord(boardId, context)
  assertBoardDeleteAllowed(board, context)
  await unlink(getBoardPath(board.id))
  return board.id
}

export async function copyLocalBoard(boardId: string, context: ApiRequestContext) {
  const source = await readRequiredBoardRecord(boardId, context)
  assertBoardOwner(source, context)
  const audit = auditBoardDocument(source.document)
  if (!audit.ok) {
    return { audit, board: null }
  }

  const boardIdCopy = `board_${randomUUID()}`
  const savedAt = new Date().toISOString()
  const record: BoardPersistenceRecord = {
    ...source,
    createdAt: savedAt,
    id: boardIdCopy,
    lastOpenedAt: null,
    ownerId: context.userId,
    savedAt,
    shareId: null,
    title: `${source.title || 'Untitled Board'} Copy`,
  }
  await writeBoardRecord(record)
  return { audit, board: summarizeBoardRecord(record) }
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
  const metrics = getBoardDocumentMetrics(record.document)
  return {
    assetCount: record.assetCount ?? metrics.assetCount,
    byteSize: record.byteSize ?? 0,
    cardColor: normalizeBoardCardColor(record.cardColor),
    createdAt: record.createdAt ?? record.savedAt ?? new Date(0).toISOString(),
    description: normalizeBoardDescription(record.description),
    document: record.document ?? null,
    id: record.id ?? '',
    isPinned: Boolean(record.isPinned),
    isStarred: Boolean(record.isStarred),
    lastOpenedAt: record.lastOpenedAt ?? null,
    ownerId: record.ownerId ?? context.userId,
    savedAt: record.savedAt ?? new Date(0).toISOString(),
    shapeCount: record.shapeCount ?? metrics.shapeCount,
    shareId: normalizeBoardShareId(record.shareId),
    thumbnailUrl: normalizeBoardThumbnailUrl(record.thumbnailUrl),
    title: coerceBoardTitle(record.title),
    visibility: normalizeBoardVisibility(record.visibility),
    workspaceId: record.workspaceId ?? context.workspaceId,
  }
}

function assertBoardAccess(board: BoardPersistenceRecord, context: ApiRequestContext) {
  if (board.workspaceId !== context.workspaceId) {
    throw new Error('Board not found in workspace.')
  }
}

function assertBoardOwner(board: BoardPersistenceRecord, context: ApiRequestContext) {
  assertBoardAccess(board, context)
  if (board.ownerId !== context.userId) {
    throw new Error('Only the Board owner can copy or delete this board.')
  }
}

function assertBoardDeleteAllowed(board: BoardPersistenceRecord, context: ApiRequestContext) {
  assertBoardAccess(board, context)
  if (shareableWorkspaceKinds.has(context.workspaceKind) && isWorkspaceManager(context)) return
  if (board.ownerId === context.userId) return
  throw new Error('Only workspace owners or admins can delete this board.')
}

function assertWorkspaceCanCreateBoard(context: ApiRequestContext) {
  if (isWorkspaceManager(context)) return
  throw new Error('Workspace role cannot create or save boards.')
}

function isWorkspaceManager(context: ApiRequestContext) {
  return context.workspaceRole === 'owner' || context.workspaceRole === 'admin'
}

async function readLocalBoardRecord(boardId: string, context: ApiRequestContext) {
  try {
    const board = await readRequiredBoardRecord(boardId, context)
    return board.workspaceId === context.workspaceId ? board : null
  } catch {
    return null
  }
}

async function readRequiredBoardRecord(boardId: string, context: ApiRequestContext) {
  const safeBoardId = sanitizeBoardId(boardId)
  if (!safeBoardId) throw new Error('Invalid board id.')
  const raw = await readFile(getBoardPath(safeBoardId), 'utf8')
  return normalizeBoardRecord(JSON.parse(raw) as Partial<BoardPersistenceRecord>, context)
}

async function writeBoardRecord(record: BoardPersistenceRecord) {
  await mkdir(boardsRoot, { recursive: true })
  await writeFile(getBoardPath(record.id), `${JSON.stringify(record, null, 2)}\n`)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function assertWorkspaceAllowsBoardVisibility(workspaceKind: ApiRequestContext['workspaceKind'], visibility: NonNullable<BoardPersistenceRecord['visibility']>) {
  if (visibility === 'private') return
  if (shareableWorkspaceKinds.has(workspaceKind)) return
  throw new Error('Solo workspace boards must stay private. Move the board into a Team or Group workspace to share it.')
}
