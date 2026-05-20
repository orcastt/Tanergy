import { Buffer } from 'node:buffer'
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  normalizeBoardShareId,
  type BoardShareLinkRecord,
} from '@/features/boards/boardTypes'

const boardSharePasswordHashIterations = 210_000
const boardSharePasswordMaxLength = 256

export type LocalBoardShareLinkEntry = BoardShareLinkRecord & {
  passwordHash?: string | null
  revokedAt?: string | null
}

export class LocalBoardSharePasswordError extends Error {
  readonly status = 401

  constructor(message = 'Board share password is required.') {
    super(message)
    this.name = 'LocalBoardSharePasswordError'
  }
}

export function normalizeLocalBoardShareLinkEntry(
  link: Partial<LocalBoardShareLinkEntry>,
): LocalBoardShareLinkEntry | null {
  const shareId = typeof link.shareId === 'string' ? normalizeBoardShareId(link.shareId) : null
  if (!shareId || typeof link.id !== 'string' || typeof link.boardId !== 'string' || typeof link.workspaceId !== 'string' || typeof link.createdAt !== 'string' || typeof link.createdBy !== 'string') {
    return null
  }
  if (link.accessRole !== 'viewer' && link.accessRole !== 'editor') return null
  const passwordHash = typeof link.passwordHash === 'string' && link.passwordHash ? link.passwordHash : null
  return {
    accessRole: link.accessRole,
    boardId: link.boardId,
    createdAt: link.createdAt,
    createdBy: link.createdBy,
    expiresAt: link.expiresAt ?? null,
    id: link.id,
    passwordHash,
    passwordProtected: Boolean(passwordHash),
    revokedAt: typeof link.revokedAt === 'string' && link.revokedAt ? link.revokedAt : null,
    shareId,
    workspaceId: link.workspaceId,
  }
}

export function localBoardShareEntryToRecord(entry: LocalBoardShareLinkEntry): BoardShareLinkRecord {
  return {
    accessRole: entry.accessRole,
    boardId: entry.boardId,
    createdAt: entry.createdAt,
    createdBy: entry.createdBy,
    expiresAt: entry.expiresAt ?? null,
    id: entry.id,
    passwordProtected: Boolean(entry.passwordHash),
    shareId: entry.shareId,
    workspaceId: entry.workspaceId,
  }
}

export function setLocalBoardSharePassword(
  entry: LocalBoardShareLinkEntry,
  password?: string | null,
  clearPassword = false,
) {
  if (clearPassword) {
    entry.passwordHash = null
  } else if (password !== undefined && password !== null) {
    entry.passwordHash = createLocalBoardSharePasswordHash(password)
  }
  entry.passwordProtected = Boolean(entry.passwordHash)
}

export function assertLocalBoardSharePassword(
  entry: LocalBoardShareLinkEntry,
  password?: string | null,
) {
  if (!verifyLocalBoardSharePassword(password, entry.passwordHash)) {
    throw new LocalBoardSharePasswordError()
  }
}

export function getLocalBoardShareErrorStatus(error: unknown, fallback = 400) {
  if (typeof error === 'object' && error && 'status' in error && typeof error.status === 'number') {
    return error.status
  }
  return fallback
}

function createLocalBoardSharePasswordHash(password: string) {
  const normalized = normalizeLocalBoardSharePassword(password)
  if (normalized === null) throw new Error('Board share password is required.')
  const salt = randomBytes(16)
  const digest = hashLocalBoardSharePassword(normalized, salt, boardSharePasswordHashIterations)
  return [
    'pbkdf2_sha256',
    String(boardSharePasswordHashIterations),
    urlSafeBase64Encode(salt),
    urlSafeBase64Encode(digest),
  ].join('$')
}

function verifyLocalBoardSharePassword(password: string | null | undefined, passwordHash: string | null | undefined) {
  if (!passwordHash) return true
  let normalized: string | null
  try {
    normalized = normalizeLocalBoardSharePassword(password)
  } catch {
    return false
  }
  if (normalized === null) return false
  try {
    const [algorithm, iterationsValue, saltValue, digestValue] = passwordHash.split('$', 4)
    const iterations = Number(iterationsValue)
    const salt = urlSafeBase64Decode(saltValue)
    const expectedDigest = urlSafeBase64Decode(digestValue)
    if (algorithm !== 'pbkdf2_sha256' || !Number.isInteger(iterations) || iterations < 100_000) return false
    const actualDigest = hashLocalBoardSharePassword(normalized, salt, iterations)
    return actualDigest.byteLength === expectedDigest.byteLength && timingSafeEqual(actualDigest, expectedDigest)
  } catch {
    return false
  }
}

function normalizeLocalBoardSharePassword(value: string | null | undefined) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new Error('Invalid board share password.')
  if (!value.trim()) throw new Error('Board share password cannot be empty.')
  if (value.length > boardSharePasswordMaxLength) throw new Error('Board share password is too long.')
  return value
}

function hashLocalBoardSharePassword(password: string, salt: Buffer, iterations: number) {
  return pbkdf2Sync(password, salt, iterations, 32, 'sha256')
}

function urlSafeBase64Encode(value: Buffer) {
  return value.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function urlSafeBase64Decode(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  return Buffer.from(`${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`, 'base64')
}
