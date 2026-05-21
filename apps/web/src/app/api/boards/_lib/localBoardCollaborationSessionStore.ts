import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  BoardCollaborationSessionRecord,
} from '@/features/boards/boardCollaborationTypes'
import { normalizeLocalBoardCollaborationPresence } from './localBoardCollaborationPresence'
import {
  isNodeError,
  localBoardCollaborationRoot,
  maxActiveSessionsPerBoard,
  normalizeIsoString,
  normalizePermission,
  normalizeSessionIdentifier,
  normalizeStoredWorkspaceRole,
  type StoredBoardCollaborationSession,
} from './localBoardCollaborationSupport'

export async function readActiveLocalBoardCollaborationSessions(workspaceId: string, boardId: string) {
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

export async function writeLocalBoardCollaborationSessions(
  workspaceId: string,
  boardId: string,
  sessions: StoredBoardCollaborationSession[],
) {
  await mkdir(localBoardCollaborationRoot, { recursive: true })
  await writeFile(
    getSessionPath(workspaceId, boardId),
    `${JSON.stringify(limitActiveSessions(sessions), null, 2)}\n`,
  )
}

export function toLocalBoardCollaborationSessionRecords(
  sessions: StoredBoardCollaborationSession[],
  currentUserId: string,
): BoardCollaborationSessionRecord[] {
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

export function limitActiveSessions(sessions: StoredBoardCollaborationSession[]) {
  return [...sessions]
    .sort((left, right) => Date.parse(right.lastHeartbeatAt) - Date.parse(left.lastHeartbeatAt))
    .slice(0, maxActiveSessionsPerBoard)
}

function getSessionPath(workspaceId: string, boardId: string) {
  return path.join(localBoardCollaborationRoot, `${workspaceId}__${boardId}.json`)
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
    presence: normalizeLocalBoardCollaborationPresence(session.presence as StoredBoardCollaborationSession['presence'] | undefined),
    userId,
    workspaceId,
    workspaceRole: normalizeStoredWorkspaceRole(session.workspaceRole),
  }
}
