import path from 'node:path'
import type {
  BoardCollaborationPermission,
  BoardCollaborationPresence,
} from '@/features/boards/boardCollaborationTypes'
import {
  type WorkspaceRole,
  normalizeCanonicalWorkspaceRole,
} from '@/features/auth/sessionTypes'

export const localBoardStorageRoot = process.env.TANGENT_BOARD_STORAGE_DIR ?? path.join(process.cwd(), '.tangent-boards')
export const localBoardCollaborationRoot = path.join(localBoardStorageRoot, 'collaboration')
export const localBoardActivePresenceStates = new Set(['drawing', 'idle', 'panning', 'running', 'selecting', 'typing', 'viewing'])
export const localBoardSessionIdPattern = /^[a-zA-Z0-9._-]{1,120}$/
export const maxActiveSessionsPerBoard = 100
export const maxSelectionIds = 50

export type StoredBoardCollaborationSession = {
  avatarInitials: string
  boardId: string
  clientInstanceId: string
  createdAt: string
  displayName: string
  expiresAt: string
  id: string
  lastHeartbeatAt: string
  permission: BoardCollaborationPermission
  presence: BoardCollaborationPresence
  userId: string
  workspaceId: string
  workspaceRole: WorkspaceRole
}

export function normalizePermission(value: unknown): BoardCollaborationPermission | null {
  return typeof value === 'string' && ['view', 'edit', 'manage', 'owner'].includes(value)
    ? value as BoardCollaborationPermission
    : null
}

export function normalizeSessionIdentifier(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed || !localBoardSessionIdPattern.test(trimmed) || trimmed.includes('..')) {
    throw new Error(`Invalid ${label}.`)
  }
  return trimmed
}

export function normalizeTtlSeconds(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 45
  return Math.max(15, Math.min(Math.round(value), 300))
}

export function normalizeIsoString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return new Date(0).toISOString()
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? new Date(0).toISOString() : new Date(parsed).toISOString()
}

export function formatDisplayName(userId: string) {
  return userId
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ') || 'Workspace member'
}

export function getInitials(userId: string) {
  return formatDisplayName(userId)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'NA'
}

export function buildRoomKey(workspaceId: string, boardId: string) {
  return `board:${workspaceId}:${boardId}`
}

export function inferWorkspaceRole(permission: BoardCollaborationPermission): WorkspaceRole {
  if (permission === 'owner') return 'owner'
  if (permission === 'manage') return 'admin'
  if (permission === 'edit') return 'editor'
  return 'viewer'
}

export function normalizeStoredWorkspaceRole(value: unknown): WorkspaceRole {
  if (typeof value !== 'string' || !value.trim()) return 'viewer'
  return normalizeCanonicalWorkspaceRole(value.slice(0, 40))
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
