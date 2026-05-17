import path from 'node:path'
import {
  normalizeBoardShareId,
  type BoardPersistenceRecord,
} from '@/features/boards/boardTypes'
import {
  type CanonicalWorkspaceRole,
  normalizeCanonicalWorkspaceRole,
  type WorkspaceRole,
} from '@/features/auth/sessionTypes'

export const localBoardStorageRoot = process.env.TANGENT_BOARD_STORAGE_DIR ?? path.join(process.cwd(), '.tangent-boards')
export const localBoardRecordsRoot = path.join(localBoardStorageRoot, 'boards')
export const localWorkspaceRecordsRoot = path.join(localBoardStorageRoot, 'workspaces')
export const shareableWorkspaceKinds = new Set(['group_workspace', 'team_workspace'])

export type LocalWorkspacePerson = {
  displayName: string
  email: string
  userId: string
  workspaceRole: CanonicalWorkspaceRole
}

export function getLocalBoardPath(boardId: string) {
  return path.join(localBoardRecordsRoot, `${boardId}.json`)
}

export function getLocalBoardMemberPath(boardId: string) {
  return path.join(localBoardRecordsRoot, `${boardId}.members.json`)
}

export function getLocalBoardSharePath(boardId: string) {
  return path.join(localBoardRecordsRoot, `${boardId}.shares.json`)
}

export function getLocalWorkspacePeoplePath(workspaceId: string) {
  return path.join(localWorkspaceRecordsRoot, `${workspaceId}.people.json`)
}

export function sanitizeLocalBoardId(value: string | undefined) {
  if (!value) return null
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes('..') ? value : null
}

export function normalizeLocalBoardUserId(value: string) {
  const trimmed = value.trim()
  return trimmed && /^[a-zA-Z0-9._@-]+$/.test(trimmed) && !trimmed.includes('..') ? trimmed : null
}

export function requireLocalBoardUserId(value: string) {
  const normalized = normalizeLocalBoardUserId(value)
  if (!normalized) throw new Error('Invalid user id.')
  return normalized
}

export function normalizeLocalBoardDisplayName(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 80) : null
}

export function normalizeStoredLocalWorkspaceRole(value: unknown): WorkspaceRole | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return normalizeCanonicalWorkspaceRole(value)
}

export function requireLocalBoardEmail(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) throw new Error('Valid email is required.')
  return trimmed
}

export function requireLocalBoardShareId(value: string) {
  const normalized = normalizeBoardShareId(value)
  if (!normalized) throw new Error('Invalid board share id.')
  return normalized
}

export function createLocalBoardPersonId(email: string) {
  const stem = email.split('@')[0].replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 24) || 'member'
  return requireLocalBoardUserId(`user_${stem}_${Math.random().toString(36).slice(2, 8)}`)
}

export function getLocalBoardOwnerPerson(
  board: BoardPersistenceRecord,
  currentUserId?: string,
): LocalWorkspacePerson {
  return {
    displayName: board.ownerId === (currentUserId ?? 'dev-user') ? 'Dev User' : board.ownerId,
    email: board.ownerId === 'dev-user' ? 'dev@tangent.local' : `${board.ownerId}@local.tangent`,
    userId: board.ownerId,
    workspaceRole: 'owner',
  }
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
