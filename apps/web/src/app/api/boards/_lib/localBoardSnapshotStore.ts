import { createHash, randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { auditBoardDocument } from '@/features/boards/boardDocumentGuard'
import { getBoardDocumentMetrics, type BoardSnapshotCreateInput, type BoardSnapshotRecord } from '@/features/boards/boardTypes'
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
    thumbnailUrl: null,
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

function summarizeSnapshot(snapshot: BoardSnapshotRecord) {
  const { document: _document, ...summary } = snapshot
  void _document
  return summary
}

async function enforceSnapshotLimit(context: ApiRequestContext, boardId: string) {
  const limit = Number.isFinite(snapshotLimit) && snapshotLimit > 0 ? snapshotLimit : 100
  const snapshots = await listLocalBoardSnapshots(boardId, context)
  const expired = snapshots.slice(limit)
  await Promise.all(expired.map((snapshot) => rm(getSnapshotPath(context.workspaceId, boardId, snapshot.id), { force: true })))
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
