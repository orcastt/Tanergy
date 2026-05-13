import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  BoardCollaborationPermission,
  BoardCollaborationPresence,
  BoardCollaborationSessionDeleteResponse,
  BoardCollaborationSessionRecord,
  BoardCollaborationSessionsResponse,
  BoardCollaborationSessionUpsertInput,
} from '@/features/boards/boardCollaborationTypes'
import type { BoardPersistenceRecord } from '@/features/boards/boardTypes'
import { listLocalBoardMembers } from './localBoardMembersStore'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'

const storageRoot = process.env.TANGENT_BOARD_STORAGE_DIR ?? path.join(process.cwd(), '.tangent-boards')
const boardsRoot = path.join(storageRoot, 'boards')
const collaborationRoot = path.join(storageRoot, 'collaboration')
const activePresenceStates = new Set(['drawing', 'idle', 'panning', 'running', 'selecting', 'typing', 'viewing'])
const sessionIdPattern = /^[a-zA-Z0-9._-]{1,120}$/
const maxActiveSessionsPerBoard = 100
const maxSelectionIds = 50

export async function claimLocalBoardCollaborationSession(
  boardId: string,
  input: BoardCollaborationSessionUpsertInput,
  context: ApiRequestContext,
): Promise<BoardCollaborationSessionsResponse> {
  const board = await readRequiredBoardRecord(boardId, context)
  const permission = await resolveLocalBoardPermission(board, context)
  const clientInstanceId = normalizeSessionIdentifier(input.clientInstanceId, 'client instance id')
  const presence = normalizePresence(input.presence)
  const ttlSeconds = normalizeTtlSeconds(input.ttlSeconds)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString()
  const sessions = await readActiveSessions(board.workspaceId, board.id)
  const existing = sessions.find((session) => (
    session.userId === context.userId && session.clientInstanceId === clientInstanceId
  ))
  const sessionId = existing?.id ?? `collab_${crypto.randomUUID()}`
  const nextSession = {
    avatarInitials: getInitials(context.userId),
    boardId: board.id,
    clientInstanceId,
    createdAt: existing?.createdAt ?? now.toISOString(),
    displayName: formatDisplayName(context.userId),
    expiresAt,
    id: sessionId,
    lastHeartbeatAt: now.toISOString(),
    permission,
    presence,
    userId: context.userId,
    workspaceId: board.workspaceId,
    workspaceRole: board.ownerId === context.userId ? 'owner' : 'member',
  }
  const nextSessions = limitActiveSessions([
    ...sessions.filter((session) => !(session.userId === context.userId && session.clientInstanceId === clientInstanceId)),
    nextSession,
  ])
  await writeSessions(board.workspaceId, board.id, nextSessions)
  const activeSessions = toSessionRecords(nextSessions, context.userId)
  return {
    activeSessions,
    boardId: board.id,
    boardSavedAt: board.savedAt,
    canEdit: permission !== 'view',
    ok: true,
    permission,
    roomKey: buildRoomKey(board.workspaceId, board.id),
    selfSession: activeSessions.find((session) => session.id === sessionId) ?? null,
    workspaceId: board.workspaceId,
  }
}

export async function listLocalBoardCollaborationSessions(
  boardId: string,
  context: ApiRequestContext,
): Promise<BoardCollaborationSessionsResponse> {
  const board = await readRequiredBoardRecord(boardId, context)
  const permission = await resolveLocalBoardPermission(board, context)
  return {
    activeSessions: toSessionRecords(await readActiveSessions(board.workspaceId, board.id), context.userId),
    boardId: board.id,
    boardSavedAt: board.savedAt,
    canEdit: permission !== 'view',
    ok: true,
    permission,
    roomKey: buildRoomKey(board.workspaceId, board.id),
    selfSession: null,
    workspaceId: board.workspaceId,
  }
}

export async function releaseLocalBoardCollaborationSession(
  boardId: string,
  sessionId: string,
  context: ApiRequestContext,
): Promise<BoardCollaborationSessionDeleteResponse> {
  const board = await readRequiredBoardRecord(boardId, context)
  const normalizedSessionId = normalizeSessionIdentifier(sessionId, 'session id')
  const sessions = await readActiveSessions(board.workspaceId, board.id)
  const nextSessions = sessions.filter((session) => !(session.id === normalizedSessionId && session.userId === context.userId))
  if (nextSessions.length === sessions.length) {
    throw new Error('Collaboration session not found.')
  }
  await writeSessions(board.workspaceId, board.id, nextSessions)
  return {
    activeSessions: toSessionRecords(nextSessions, context.userId),
    boardId: board.id,
    boardSavedAt: board.savedAt,
    ok: true,
    sessionId: normalizedSessionId,
    workspaceId: board.workspaceId,
  }
}

async function resolveLocalBoardPermission(
  board: BoardPersistenceRecord,
  context: ApiRequestContext,
): Promise<BoardCollaborationPermission> {
  if (board.ownerId === context.userId) return 'owner'
  try {
    const members = await listLocalBoardMembers(board.id, context)
    const member = members.find((entry) => entry.userId === context.userId)
    if (member?.role === 'owner') return 'owner'
    if (member?.role === 'admin') return 'manage'
    if (member?.role === 'editor') return 'edit'
    if (member?.role === 'viewer' || member?.role === 'temporary_viewer') return 'view'
  } catch {
    return 'view'
  }
  return 'view'
}

async function readRequiredBoardRecord(boardId: string, context: ApiRequestContext) {
  const normalizedBoardId = normalizeSessionIdentifier(boardId, 'board id')
  const raw = await readFile(path.join(boardsRoot, `${normalizedBoardId}.json`), 'utf8')
  const board = JSON.parse(raw) as Partial<BoardPersistenceRecord>
  if (board.workspaceId !== context.workspaceId) {
    throw new Error('Board not found in workspace.')
  }
  if (!board.id || !board.ownerId) {
    throw new Error('Board record is invalid.')
  }
  return board as BoardPersistenceRecord
}

async function readActiveSessions(workspaceId: string, boardId: string) {
  try {
    const raw = await readFile(getSessionPath(workspaceId, boardId), 'utf8')
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    const now = Date.now()
    return (Array.isArray(parsed) ? parsed : [])
      .map((session) => {
        try {
          return normalizeStoredSession(session)
        } catch {
          return null
        }
      })
      .filter((session): session is StoredBoardCollaborationSession => Boolean(session))
      .filter((session) => Date.parse(session.expiresAt) > now)
      .sort((left, right) => Date.parse(right.lastHeartbeatAt) - Date.parse(left.lastHeartbeatAt))
      .slice(0, maxActiveSessionsPerBoard)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw error
  }
}

async function writeSessions(workspaceId: string, boardId: string, sessions: StoredBoardCollaborationSession[]) {
  await mkdir(collaborationRoot, { recursive: true })
  await writeFile(
    getSessionPath(workspaceId, boardId),
    `${JSON.stringify(
      limitActiveSessions(sessions),
      null,
      2,
    )}\n`,
  )
}

function limitActiveSessions(sessions: StoredBoardCollaborationSession[]) {
  return [...sessions]
    .sort((left, right) => Date.parse(right.lastHeartbeatAt) - Date.parse(left.lastHeartbeatAt))
    .slice(0, maxActiveSessionsPerBoard)
}

function getSessionPath(workspaceId: string, boardId: string) {
  return path.join(collaborationRoot, `${workspaceId}__${boardId}.json`)
}

function toSessionRecords(sessions: StoredBoardCollaborationSession[], currentUserId: string): BoardCollaborationSessionRecord[] {
  return sessions.map((session) => ({
    avatarInitials: session.avatarInitials,
    boardId: session.boardId,
    clientInstanceId: session.clientInstanceId,
    createdAt: session.createdAt,
    displayName: session.displayName,
    expiresAt: session.expiresAt,
    id: session.id,
    isSelf: session.userId === currentUserId,
    lastHeartbeatAt: session.lastHeartbeatAt,
    permission: session.permission,
    presence: session.presence,
    userId: session.userId,
    workspaceId: session.workspaceId,
    workspaceRole: session.workspaceRole,
  }))
}

function normalizeStoredSession(session: Record<string, unknown>): StoredBoardCollaborationSession | null {
  const id = normalizeSessionIdentifier(typeof session.id === 'string' ? session.id : '', 'session id')
  const boardId = normalizeSessionIdentifier(typeof session.boardId === 'string' ? session.boardId : '', 'board id')
  const userId = normalizeSessionIdentifier(typeof session.userId === 'string' ? session.userId : '', 'user id')
  const workspaceId = normalizeSessionIdentifier(typeof session.workspaceId === 'string' ? session.workspaceId : '', 'workspace id')
  const clientInstanceId = normalizeSessionIdentifier(
    typeof session.clientInstanceId === 'string' ? session.clientInstanceId : '',
    'client instance id',
  )
  const permission = normalizePermission(session.permission)
  if (!permission) return null
  return {
    avatarInitials: typeof session.avatarInitials === 'string' ? session.avatarInitials.slice(0, 8) : 'NA',
    boardId,
    clientInstanceId,
    createdAt: normalizeIsoString(session.createdAt),
    displayName: typeof session.displayName === 'string' ? session.displayName.slice(0, 120) : 'Unknown',
    expiresAt: normalizeIsoString(session.expiresAt),
    id,
    lastHeartbeatAt: normalizeIsoString(session.lastHeartbeatAt),
    permission,
    presence: normalizePresence(session.presence as BoardCollaborationPresence | undefined),
    userId,
    workspaceId,
    workspaceRole: typeof session.workspaceRole === 'string' ? session.workspaceRole.slice(0, 40) : 'member',
  }
}

function normalizePresence(presence: BoardCollaborationPresence | undefined): BoardCollaborationPresence {
  const selectionIds = Array.isArray(presence?.selectionIds)
    ? presence.selectionIds
        .filter((value): value is string => typeof value === 'string')
        .map((value) => normalizeSessionIdentifier(value, 'selection id'))
        .slice(0, maxSelectionIds)
    : []
  const editingShapeIds = Array.isArray(presence?.editingShapeIds)
    ? presence.editingShapeIds
        .filter((value): value is string => typeof value === 'string')
        .map((value) => normalizeSessionIdentifier(value, 'editing shape id'))
        .slice(0, maxSelectionIds)
    : []
  const activePageId = typeof presence?.activePageId === 'string' && presence.activePageId.trim()
    ? normalizeSessionIdentifier(presence.activePageId, 'active page id')
    : null
  const hoveredShapeId = typeof presence?.hoveredShapeId === 'string' && presence.hoveredShapeId.trim()
    ? normalizeSessionIdentifier(presence.hoveredShapeId, 'hovered shape id')
    : null
  const tool = typeof presence?.tool === 'string' && presence.tool.trim() ? presence.tool.trim().slice(0, 40) : null
  const state = typeof presence?.state === 'string' && activePresenceStates.has(presence.state)
    ? presence.state
    : null
  const cursor = presence?.cursor && Number.isFinite(presence.cursor.x) && Number.isFinite(presence.cursor.y)
    ? {
        x: Math.round(presence.cursor.x * 1000) / 1000,
        y: Math.round(presence.cursor.y * 1000) / 1000,
      }
    : null
  return {
    activePageId,
    cursor,
    editingShapeIds,
    hoveredShapeId,
    selectionIds,
    state,
    tool,
  }
}

function normalizePermission(value: unknown): BoardCollaborationPermission | null {
  return typeof value === 'string' && ['view', 'edit', 'manage', 'owner'].includes(value)
    ? value as BoardCollaborationPermission
    : null
}

function normalizeSessionIdentifier(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed || !sessionIdPattern.test(trimmed) || trimmed.includes('..')) {
    throw new Error(`Invalid ${label}.`)
  }
  return trimmed
}

function normalizeTtlSeconds(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 45
  return Math.max(15, Math.min(Math.round(value), 300))
}

function normalizeIsoString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return new Date(0).toISOString()
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? new Date(0).toISOString() : new Date(parsed).toISOString()
}

function formatDisplayName(userId: string) {
  return userId
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ') || 'Workspace member'
}

function getInitials(userId: string) {
  return formatDisplayName(userId)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'NA'
}

function buildRoomKey(workspaceId: string, boardId: string) {
  return `board:${workspaceId}:${boardId}`
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

type StoredBoardCollaborationSession = {
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
  workspaceRole: string
}
