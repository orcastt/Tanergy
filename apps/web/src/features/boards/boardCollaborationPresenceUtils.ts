import type { LocalBoardAwarenessState } from '@/features/collaboration/localBoardAwareness'
import type {
  BoardCollaborationSessionRecord,
  BoardCollaborationShapeOccupancy,
} from './boardCollaborationTypes'

const maxPresenceShapeIds = 12

export function deriveBoardShapeOccupancy(
  sessions: BoardCollaborationSessionRecord[],
  awarenessStates: Map<string, LocalBoardAwarenessState>,
) {
  const occupancy: BoardCollaborationShapeOccupancy[] = []

  for (const session of sessions) {
    const awareness = awarenessStates.get(session.clientInstanceId)
    const presence = awareness?.presence ?? session.presence
    const editingShapeIds = normalizePresenceShapeIds(presence.editingShapeIds)
    const editingSet = new Set(editingShapeIds)
    const selectionShapeIds = normalizePresenceShapeIds(presence.selectionIds)
      .filter((shapeId) => !editingSet.has(shapeId))
    const selectionSet = new Set(selectionShapeIds)
    const hoveredShapeId = normalizePresenceShapeId(presence.hoveredShapeId)
    const expiresAt = awareness?.expiresAt ?? session.expiresAt
    const updatedAt = awareness?.updatedAt ?? session.lastHeartbeatAt

    if (editingShapeIds.length > 0) {
      occupancy.push(createOccupancy(session, {
        activePageId: presence.activePageId ?? null,
        expiresAt,
        kind: 'editing',
        shapeIds: editingShapeIds,
        updatedAt,
      }))
    }

    if (selectionShapeIds.length > 0) {
      occupancy.push(createOccupancy(session, {
        activePageId: presence.activePageId ?? null,
        expiresAt,
        kind: 'selection',
        shapeIds: selectionShapeIds,
        updatedAt,
      }))
    }

    if (hoveredShapeId && !editingSet.has(hoveredShapeId) && !selectionSet.has(hoveredShapeId)) {
      occupancy.push(createOccupancy(session, {
        activePageId: presence.activePageId ?? null,
        expiresAt,
        kind: 'hover',
        shapeIds: [hoveredShapeId],
        updatedAt,
      }))
    }
  }

  return occupancy.sort(compareOccupancy)
}

export function normalizePresenceShapeId(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function normalizePresenceShapeIds(values: unknown) {
  if (!Array.isArray(values)) return []
  return [...new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean))]
    .slice(0, maxPresenceShapeIds)
}

function createOccupancy(
  session: BoardCollaborationSessionRecord,
  options: {
    activePageId: string | null
    expiresAt: string
    kind: BoardCollaborationShapeOccupancy['kind']
    shapeIds: string[]
    updatedAt: string
  },
): BoardCollaborationShapeOccupancy {
  return {
    activePageId: options.activePageId,
    clientInstanceId: session.clientInstanceId,
    displayName: session.displayName,
    expiresAt: options.expiresAt,
    isSelf: session.isSelf,
    kind: options.kind,
    sessionId: session.id,
    shapeIds: options.shapeIds,
    updatedAt: options.updatedAt,
    userId: session.userId,
  }
}

function compareOccupancy(left: BoardCollaborationShapeOccupancy, right: BoardCollaborationShapeOccupancy) {
  const priority = getOccupancyPriority(left.kind) - getOccupancyPriority(right.kind)
  if (priority !== 0) return priority
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
}

function getOccupancyPriority(kind: BoardCollaborationShapeOccupancy['kind']) {
  if (kind === 'editing') return 0
  if (kind === 'selection') return 1
  return 2
}
