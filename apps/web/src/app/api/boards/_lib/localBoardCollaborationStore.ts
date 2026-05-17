import type {
  BoardCollaborationSessionDeleteResponse,
  BoardCollaborationSessionsResponse,
  BoardCollaborationSessionUpsertInput,
} from '@/features/boards/boardCollaborationTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import {
  readRequiredLocalBoardCollaborationBoard,
  resolveLocalBoardCollaborationPermission,
} from './localBoardCollaborationAccess'
import { normalizeLocalBoardCollaborationPresence } from './localBoardCollaborationPresence'
import {
  buildRoomKey,
  formatDisplayName,
  getInitials,
  inferWorkspaceRole,
  normalizeSessionIdentifier,
  normalizeTtlSeconds,
} from './localBoardCollaborationSupport'
import {
  limitActiveSessions,
  readActiveLocalBoardCollaborationSessions,
  toLocalBoardCollaborationSessionRecords,
  writeLocalBoardCollaborationSessions,
} from './localBoardCollaborationSessionStore'

export async function claimLocalBoardCollaborationSession(
  boardId: string,
  input: BoardCollaborationSessionUpsertInput,
  context: ApiRequestContext,
): Promise<BoardCollaborationSessionsResponse> {
  const board = await readRequiredLocalBoardCollaborationBoard(boardId, context)
  const permission = await resolveLocalBoardCollaborationPermission(board, context)
  const clientInstanceId = normalizeSessionIdentifier(input.clientInstanceId, 'client instance id')
  const presence = normalizeLocalBoardCollaborationPresence(input.presence)
  const ttlSeconds = normalizeTtlSeconds(input.ttlSeconds)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString()
  const sessions = await readActiveLocalBoardCollaborationSessions(board.workspaceId, board.id)
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
    workspaceRole: inferWorkspaceRole(permission),
  }
  const nextSessions = limitActiveSessions([
    ...sessions.filter((session) => !(session.userId === context.userId && session.clientInstanceId === clientInstanceId)),
    nextSession,
  ])
  await writeLocalBoardCollaborationSessions(board.workspaceId, board.id, nextSessions)
  const activeSessions = toLocalBoardCollaborationSessionRecords(nextSessions, context.userId)
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
  const board = await readRequiredLocalBoardCollaborationBoard(boardId, context)
  const permission = await resolveLocalBoardCollaborationPermission(board, context)
  return {
    activeSessions: toLocalBoardCollaborationSessionRecords(
      await readActiveLocalBoardCollaborationSessions(board.workspaceId, board.id),
      context.userId,
    ),
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
  const board = await readRequiredLocalBoardCollaborationBoard(boardId, context)
  const normalizedSessionId = normalizeSessionIdentifier(sessionId, 'session id')
  const sessions = await readActiveLocalBoardCollaborationSessions(board.workspaceId, board.id)
  const nextSessions = sessions.filter((session) => !(session.id === normalizedSessionId && session.userId === context.userId))
  if (nextSessions.length === sessions.length) {
    throw new Error('Collaboration session not found.')
  }
  await writeLocalBoardCollaborationSessions(board.workspaceId, board.id, nextSessions)
  return {
    activeSessions: toLocalBoardCollaborationSessionRecords(nextSessions, context.userId),
    boardId: board.id,
    boardSavedAt: board.savedAt,
    ok: true,
    sessionId: normalizedSessionId,
    workspaceId: board.workspaceId,
  }
}
