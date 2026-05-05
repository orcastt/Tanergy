import { createHash, randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { auditBoardDocument } from '@/features/boards/boardDocumentGuard'
import {
  getBoardDocumentMetrics,
  normalizeBoardThumbnailUrl,
  type BoardSnapshotCreateInput,
  type BoardSnapshotRecord,
} from '@/features/boards/boardTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'

const storageRoot = process.env.TANGENT_BOARD_STORAGE_DIR ?? path.join(process.cwd(), '.tangent-boards')
const snapshotLimit = Number(process.env.TANGENT_FREE_BOARD_SNAPSHOT_LIMIT ?? 100)

export async function createLocalBoardSnapshot(input: BoardSnapshotCreateInput, context: ApiRequestContext) {
  const boardId = sanitizeBoardId(input.boardId)
  if (!boardId) throw new Error('Invalid board id.')
  const audit = auditBoardDocument(input.document)
  if (!audit.ok) throw new Error(audit.issues.find((issue) => issue.blocking)?.message ?? 'Board document is blocked.')

  const createdAt = new Date().toISOString()
  const metrics = getBoardDocumentMetrics(input.document)
  const snapshot: BoardSnapshotRecord = {
    assetCount: metrics.assetCount,
    boardId,
    byteSize: audit.byteSize,
    createdAt,
    createdBy: context.userId,
    document: input.document,
    documentHash: hashDocument(input.document),
    expiresAt: null,
    id: `snapshot_${randomUUID()}`,
    reason: input.reason,
    retentionTier: 'free',
    shapeCount: metrics.shapeCount,
    thumbnailUrl: normalizeBoardThumbnailUrl(input.thumbnailUrl),
    title: input.title?.trim() || 'Untitled snapshot',
    workspaceId: context.workspaceId,
  }

  await mkdir(getSnapshotRoot(context.workspaceId, boardId), { recursive: true })
  await writeSnapshot(snapshot)
  await enforceSnapshotLimit(context, boardId)
  return summarizeSnapshot(snapshot)
}

export async function listLocalBoardSnapshots(boardId: string, context: ApiRequestContext) {
  const safeBoardId = sanitizeBoardId(boardId)
  if (!safeBoardId) throw new Error('Invalid board id.')
  let entries: Dirent[]
  try {
    entries = await readdir(getSnapshotRoot(context.workspaceId, safeBoardId), { withFileTypes: true })
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw error
  }

  const snapshots = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      const snapshot = await readSnapshot(context.workspaceId, safeBoardId, entry.name.replace(/\.json$/, ''))
      snapshots.push(summarizeSnapshot(snapshot))
    } catch {
      continue
    }
  }
  return snapshots.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

export async function loadLocalBoardSnapshot(boardId: string, snapshotId: string, context: ApiRequestContext) {
  const safeBoardId = sanitizeBoardId(boardId)
  const safeSnapshotId = sanitizeSnapshotId(snapshotId)
  if (!safeBoardId || !safeSnapshotId) throw new Error('Invalid snapshot id.')
  const snapshot = await readSnapshot(context.workspaceId, safeBoardId, safeSnapshotId)
  if (snapshot.workspaceId !== context.workspaceId || snapshot.boardId !== safeBoardId) {
    throw new Error('Board history entry not found in workspace.')
  }
  return snapshot
}

export async function clearLocalBoardSnapshots(boardId: string, context: ApiRequestContext) {
  const safeBoardId = sanitizeBoardId(boardId)
  if (!safeBoardId) throw new Error('Invalid board id.')
  const snapshots = await listLocalBoardSnapshots(safeBoardId, context)
  await rm(getSnapshotRoot(context.workspaceId, safeBoardId), { force: true, recursive: true })
  return snapshots.length
}

function summarizeSnapshot(snapshot: BoardSnapshotRecord) {
  const { document, ...summary } = snapshot
  return {
    ...summary,
    title: getSnapshotDisplayTitle(document, summary.title),
  }
}

function getSnapshotDisplayTitle(document: unknown, fallbackTitle: string) {
  const fallback = fallbackTitle.trim()
  return getKonvaActivePageTitle(document) ?? (fallback || 'Untitled snapshot')
}

function getKonvaActivePageTitle(document: unknown) {
  if (!document || typeof document !== 'object') return null
  const envelope = document as Record<string, unknown>
  if (envelope.renderer !== 'konva' || envelope.version !== 2) return null
  const activePageId = typeof envelope.activePageId === 'string' ? envelope.activePageId : 'page-1'
  const pages = Array.isArray(envelope.pages) ? envelope.pages : []
  const activePage = pages.find((page) => (
    Boolean(page)
    && typeof page === 'object'
    && (page as Record<string, unknown>).id === activePageId
  ))
  const pageTitle = activePage && typeof activePage === 'object'
    ? (activePage as Record<string, unknown>).title
    : null
  if (typeof pageTitle === 'string' && pageTitle.trim()) return pageTitle.trim()
  const canvasDocument = envelope.canvasDocument
  if (!canvasDocument || typeof canvasDocument !== 'object') return null
  const metadata = (canvasDocument as Record<string, unknown>).metadata
  if (!metadata || typeof metadata !== 'object') return null
  const documentTitle = (metadata as Record<string, unknown>).name
  return typeof documentTitle === 'string' && documentTitle.trim() ? documentTitle.trim() : null
}

async function enforceSnapshotLimit(context: ApiRequestContext, boardId: string) {
  const limit = Number.isFinite(snapshotLimit) && snapshotLimit > 0 ? snapshotLimit : 100
  const snapshots = await listLocalBoardSnapshots(boardId, context)
  const autosaves = snapshots.filter((snapshot) => getSnapshotRetentionKind(snapshot.reason) === 'autosave')
  const userSaves = snapshots.filter((snapshot) => getSnapshotRetentionKind(snapshot.reason) === 'user')
  const expired = [...autosaves.slice(limit), ...userSaves.slice(limit)]
  await Promise.all(expired.map((snapshot) => rm(getSnapshotPath(context.workspaceId, boardId, snapshot.id), { force: true })))
}

function getSnapshotRetentionKind(reason: BoardSnapshotRecord['reason']) {
  return reason === 'autosave' || reason === 'auto_interval' ? 'autosave' : 'user'
}

async function readSnapshot(workspaceId: string, boardId: string, snapshotId: string) {
  const raw = await readFile(getSnapshotPath(workspaceId, boardId, snapshotId), 'utf8')
  return JSON.parse(raw) as BoardSnapshotRecord
}

async function writeSnapshot(snapshot: BoardSnapshotRecord) {
  await writeFile(getSnapshotPath(snapshot.workspaceId, snapshot.boardId, snapshot.id), `${JSON.stringify(snapshot, null, 2)}\n`)
}

function getSnapshotRoot(workspaceId: string, boardId: string) {
  return path.join(storageRoot, 'snapshots', workspaceId, boardId)
}

function getSnapshotPath(workspaceId: string, boardId: string, snapshotId: string) {
  return path.join(getSnapshotRoot(workspaceId, boardId), `${snapshotId}.json`)
}

function hashDocument(document: unknown) {
  return createHash('sha256').update(JSON.stringify(document)).digest('hex')
}

function sanitizeBoardId(value: string | undefined) {
  if (!value) return null
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes('..') ? value : null
}

function sanitizeSnapshotId(value: string | undefined) {
  if (!value) return null
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes('..') ? value : null
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
