export const boardCollaborationPermissionValues = ['view', 'edit', 'manage', 'owner'] as const

export type BoardCollaborationPermission = typeof boardCollaborationPermissionValues[number]

export type BoardCollaborationPresenceCursor = {
  x: number
  y: number
}

export type BoardCollaborationPresenceState =
  | 'drawing'
  | 'idle'
  | 'panning'
  | 'running'
  | 'selecting'
  | 'typing'
  | 'viewing'

export type BoardCollaborationPresence = {
  activePageId?: string | null
  cursor?: BoardCollaborationPresenceCursor | null
  editingShapeIds?: string[]
  hoveredShapeId?: string | null
  selectionIds?: string[]
  state?: BoardCollaborationPresenceState | null
  tool?: string | null
}

export type BoardCollaborationShapeOccupancyKind = 'editing' | 'hover' | 'selection'

export type BoardCollaborationShapeOccupancy = {
  activePageId: string | null
  clientInstanceId: string
  displayName: string
  expiresAt: string
  isSelf: boolean
  kind: BoardCollaborationShapeOccupancyKind
  sessionId: string
  shapeIds: string[]
  updatedAt: string
  userId: string
}

export type BoardCollaborationSessionUpsertInput = {
  clientInstanceId: string
  presence?: BoardCollaborationPresence
  ttlSeconds?: number
}

export type BoardCollaborationSessionRecord = {
  avatarInitials: string
  boardId: string
  clientInstanceId: string
  createdAt: string
  displayName: string
  expiresAt: string
  id: string
  isSelf: boolean
  lastHeartbeatAt: string
  permission: BoardCollaborationPermission
  presence: BoardCollaborationPresence
  userId: string
  workspaceId: string
  workspaceRole: string
}

export type BoardCollaborationSessionsResponse = {
  activeSessions: BoardCollaborationSessionRecord[]
  boardId: string
  boardSavedAt: string
  canEdit: boolean
  error?: string
  ok: boolean
  permission: BoardCollaborationPermission
  roomKey: string
  selfSession?: BoardCollaborationSessionRecord | null
  workspaceId: string
}

export type BoardCollaborationSessionDeleteResponse = {
  activeSessions: BoardCollaborationSessionRecord[]
  boardId: string
  boardSavedAt: string
  error?: string
  ok: boolean
  sessionId: string
  workspaceId: string
}
