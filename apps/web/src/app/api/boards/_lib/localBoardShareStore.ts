import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import {
  type BoardPersistenceRecord,
  type BoardShareAccessRole,
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
import {
  assertLocalBoardSharePassword,
  localBoardShareEntryToRecord,
  normalizeLocalBoardShareLinkEntry,
  setLocalBoardSharePassword,
  type LocalBoardShareLinkEntry,
} from './localBoardSharePassword'

export async function ensureLocalBoardShareLink(
  boardId: string,
  accessRole: BoardShareAccessRole,
  context: ApiRequestContext,
  expiresAt?: string | null,
  password?: string | null,
  clearPassword = false,
  regenerate = false,
) {
  const board = await readRequiredLocalBoardRecord(boardId, context)
  assertLocalBoardCanCreateShareLink(context)
  if (clearPassword && password !== undefined && password !== null) {
    throw new Error('Board share password cannot be set and cleared together.')
  }
  const links = await readLocalBoardShareLinks(board.id)
  const normalizedExpiresAt = normalizeLocalBoardShareExpiresAt(expiresAt)
  let existing = links.find((link) => isLocalBoardShareLinkActive(link))
  if (existing && regenerate) {
    existing.revokedAt = new Date().toISOString()
    existing = undefined
  }
  const nextLink: LocalBoardShareLinkEntry = existing
    ? {
        ...existing,
        accessRole,
        expiresAt: normalizedExpiresAt,
      }
    : {
        accessRole,
        boardId: board.id,
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
        expiresAt: normalizedExpiresAt,
        id: `board_share_${crypto.randomUUID()}`,
        passwordHash: null,
        passwordProtected: false,
        revokedAt: null,
        shareId: createLocalBoardShareId(),
        workspaceId: board.workspaceId,
      }
  setLocalBoardSharePassword(nextLink, password, clearPassword)
  await writeLocalBoardShareLinks(board.id, moveLocalBoardShareLinkToFront(links, nextLink))
  await writeLocalBoardRecord({ ...board, shareId: nextLink.shareId })
  return localBoardShareEntryToRecord(nextLink)
}

export async function revokeLocalBoardShareLink(boardId: string, shareId: string, context: ApiRequestContext) {
  const board = await readRequiredLocalBoardRecord(boardId, context)
  const normalizedShareId = requireLocalBoardShareId(shareId)
  const links = await readLocalBoardShareLinks(board.id)
  const target = links.find((link) => link.shareId === normalizedShareId)
  if (!target) throw new Error('Board share link not found.')
  target.revokedAt = new Date().toISOString()
  await writeLocalBoardShareLinks(board.id, links)
  await writeLocalBoardRecord({ ...board, shareId: null })
  return normalizedShareId
}

export async function resolveLocalBoardShareLink(
  shareId: string,
  password?: string | null,
): Promise<BoardShareLinkResolveRecord> {
  const match = await findLocalBoardShareLink(shareId, password)
  const board = await readLocalBoardRecordById(match.boardId)
  return {
    accessRole: match.accessRole,
    boardId: board.id,
    boardTitle: board.title,
    passwordProtected: Boolean(match.passwordHash),
    shareId: match.shareId,
    workspaceId: board.workspaceId,
  }
}

export async function loadLocalSharedBoard(
  shareId: string,
  password?: string | null,
): Promise<BoardPersistenceRecord> {
  const match = await findLocalBoardShareLink(shareId, password)
  const board = await readLocalBoardRecordById(match.boardId)
  const updatedBoard = { ...board, lastOpenedAt: new Date().toISOString() }
  await writeLocalBoardRecord(updatedBoard)
  return updatedBoard
}

async function findLocalBoardShareLink(shareId: string, password?: string | null) {
  const normalizedShareId = requireLocalBoardShareId(shareId)
  try {
    const files = await readLocalBoardRecordFileIndex()
    for (const file of files.filter((entry) => entry.endsWith('.shares.json'))) {
      const boardId = file.replace(/\.shares\.json$/, '')
      const links = await readLocalBoardShareLinks(boardId)
      const match = links.find((link) => link.shareId === normalizedShareId && isLocalBoardShareLinkActive(link))
      if (match) {
        assertLocalBoardSharePassword(match, password)
        return match
      }
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
    const parsed = JSON.parse(raw) as Partial<LocalBoardShareLinkEntry>[]
    return Array.isArray(parsed)
      ? parsed
        .map(normalizeLocalBoardShareLinkEntry)
        .filter((link): link is LocalBoardShareLinkEntry => link !== null)
      : []
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw error
  }
}

async function writeLocalBoardShareLinks(boardId: string, links: LocalBoardShareLinkEntry[]) {
  await mkdir(localBoardRecordsRoot, { recursive: true })
  await writeFile(getLocalBoardSharePath(boardId), `${JSON.stringify(links, null, 2)}\n`)
}

function isLocalBoardShareLinkActive(link: LocalBoardShareLinkEntry) {
  if (link.revokedAt) return false
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

function moveLocalBoardShareLinkToFront(
  links: LocalBoardShareLinkEntry[],
  target: LocalBoardShareLinkEntry,
) {
  return [target, ...links.filter((link) => link.id !== target.id)]
}

function createLocalBoardShareId() {
  return randomBytes(32).toString('base64url')
}
