import { mkdir, readFile, writeFile } from 'node:fs/promises'
import {
  normalizeBoardShareId,
  type BoardPersistenceRecord,
  type BoardShareAccessRole,
  type BoardShareLinkRecord,
  type BoardShareLinkResolveRecord,
} from '@/features/boards/boardTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import {
  getLocalBoardSharePath,
  isNodeError,
  localBoardRecordsRoot,
  requireLocalBoardShareId,
} from './localBoardMembersSupport'
import {
  assertLocalBoardCanCreateShareLink,
  readLocalBoardRecordById,
  readRequiredLocalBoardRecord,
  writeLocalBoardRecord,
} from './localBoardRecordAccess'

export async function ensureLocalBoardShareLink(
  boardId: string,
  accessRole: BoardShareAccessRole,
  context: ApiRequestContext,
  expiresAt?: string | null,
) {
  const board = await readRequiredLocalBoardRecord(boardId, context)
  assertLocalBoardCanCreateShareLink(context)
  const links = await readLocalBoardShareLinks(board.id)
  const normalizedExpiresAt = normalizeLocalBoardShareExpiresAt(expiresAt)
  const existing = links.find((link) => isLocalBoardShareLinkActive(link))
  const nextLink: BoardShareLinkRecord = existing
    ? { ...existing, accessRole, expiresAt: normalizedExpiresAt }
    : {
        accessRole,
        boardId: board.id,
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
        expiresAt: normalizedExpiresAt,
        id: `board_share_${crypto.randomUUID()}`,
        shareId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        workspaceId: board.workspaceId,
      }
  await writeLocalBoardShareLinks(board.id, [nextLink])
  await writeLocalBoardRecord({ ...board, shareId: nextLink.shareId })
  return nextLink
}

export async function revokeLocalBoardShareLink(boardId: string, shareId: string, context: ApiRequestContext) {
  const board = await readRequiredLocalBoardRecord(boardId, context)
  const normalizedShareId = requireLocalBoardShareId(shareId)
  const links = await readLocalBoardShareLinks(board.id)
  const nextLinks = links.filter((link) => link.shareId !== normalizedShareId)
  if (nextLinks.length === links.length) throw new Error('Board share link not found.')
  await writeLocalBoardShareLinks(board.id, nextLinks)
  await writeLocalBoardRecord({ ...board, shareId: null })
  return normalizedShareId
}

export async function resolveLocalBoardShareLink(shareId: string): Promise<BoardShareLinkResolveRecord> {
  const match = await findLocalBoardShareLink(shareId)
  const board = await readLocalBoardRecordById(match.boardId)
  return {
    accessRole: match.accessRole,
    boardId: board.id,
    boardTitle: board.title,
    shareId: match.shareId,
    workspaceId: board.workspaceId,
  }
}

export async function loadLocalSharedBoard(shareId: string): Promise<BoardPersistenceRecord> {
  const match = await findLocalBoardShareLink(shareId)
  const board = await readLocalBoardRecordById(match.boardId)
  const updatedBoard = { ...board, lastOpenedAt: new Date().toISOString() }
  await writeLocalBoardRecord(updatedBoard)
  return updatedBoard
}

async function findLocalBoardShareLink(shareId: string) {
  const normalizedShareId = requireLocalBoardShareId(shareId)
  try {
    const files = await readLocalBoardRecordFileIndex()
    for (const file of files.filter((entry) => entry.endsWith('.shares.json'))) {
      const boardId = file.replace(/\.shares\.json$/, '')
      const links = await readLocalBoardShareLinks(boardId)
      const match = links.find((link) => link.shareId === normalizedShareId && isLocalBoardShareLinkActive(link))
      if (match) return match
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error('Board share link not found.')
    }
    throw error
  }
  throw new Error('Board share link not found.')
}

async function readLocalBoardShareLinks(boardId: string) {
  try {
    const raw = await readFile(getLocalBoardSharePath(boardId), 'utf8')
    const parsed = JSON.parse(raw) as Partial<BoardShareLinkRecord>[]
    return Array.isArray(parsed)
      ? parsed
        .map(normalizeLocalBoardShareLinkRecord)
        .filter((link): link is BoardShareLinkRecord => link !== null)
      : []
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw error
  }
}

async function writeLocalBoardShareLinks(boardId: string, links: BoardShareLinkRecord[]) {
  await mkdir(localBoardRecordsRoot, { recursive: true })
  await writeFile(getLocalBoardSharePath(boardId), `${JSON.stringify(links, null, 2)}\n`)
}

function normalizeLocalBoardShareLinkRecord(link: Partial<BoardShareLinkRecord>): BoardShareLinkRecord | null {
  const shareId = typeof link.shareId === 'string' ? normalizeBoardShareId(link.shareId) : null
  if (!shareId || typeof link.id !== 'string' || typeof link.boardId !== 'string' || typeof link.workspaceId !== 'string' || typeof link.createdAt !== 'string' || typeof link.createdBy !== 'string') {
    return null
  }
  if (link.accessRole !== 'viewer' && link.accessRole !== 'editor') return null
  return {
    accessRole: link.accessRole,
    boardId: link.boardId,
    createdAt: link.createdAt,
    createdBy: link.createdBy,
    expiresAt: link.expiresAt ?? null,
    id: link.id,
    shareId,
    workspaceId: link.workspaceId,
  }
}

function isLocalBoardShareLinkActive(link: BoardShareLinkRecord) {
  if (!link.expiresAt) return true
  const expiresAt = new Date(link.expiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now()
}

function normalizeLocalBoardShareExpiresAt(value?: string | null) {
  if (!value) return null
  const expiresAt = new Date(value)
  if (Number.isNaN(expiresAt.getTime())) throw new Error('Invalid board share expiry.')
  if (expiresAt.getTime() <= Date.now()) throw new Error('Board share expiry must be in the future.')
  return expiresAt.toISOString()
}

async function readLocalBoardRecordFileIndex() {
  const { readdir } = await import('node:fs/promises')
  return readdir(localBoardRecordsRoot)
}
