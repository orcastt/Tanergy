import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationPresence,
  BoardCollaborationPresenceState,
  BoardCollaborationPortEndpoint,
  BoardCollaborationTransformKind,
} from './boardCollaborationTypes'
import { normalizeBoardCollaborationDraftPreview } from './boardCollaborationDraftPresenceSanitizer'

const activePresenceStates = new Set<BoardCollaborationPresenceState>([
  'drawing',
  'idle',
  'panning',
  'running',
  'selecting',
  'typing',
  'viewing',
])
const maxPresenceIds = 50
const maxPresenceIdLength = 120
const maxToolLength = 40
const activeTransformKinds = new Set<BoardCollaborationTransformKind>([
  'move',
  'resize',
  'rotate',
])

export function sanitizeBoardCollaborationPresence(
  presence: BoardCollaborationPresence | null | undefined,
): BoardCollaborationPresence | null {
  if (!presence) return null
  return {
    activePageId: normalizeId(presence.activePageId),
    connectionPreview: normalizeConnectionPreview(presence.connectionPreview),
    cursor: normalizeCursor(presence.cursor),
    draftPreview: normalizeBoardCollaborationDraftPreview(presence.draftPreview),
    editingShapeIds: normalizeIds(presence.editingShapeIds),
    hoveredShapeId: normalizeId(presence.hoveredShapeId),
    selectedEdgeId: normalizeId(presence.selectedEdgeId),
    selectionBox: normalizeSelectionBox(presence.selectionBox),
    selectionIds: normalizeIds(presence.selectionIds),
    state: normalizeState(presence.state),
    tool: normalizeTool(presence.tool),
    transformBox: normalizeSelectionBox(presence.transformBox),
    transformKind: normalizeTransformKind(presence.transformKind),
  }
}

function normalizeCursor(value: BoardCollaborationPresence['cursor']) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null
  return {
    x: Math.round(value.x * 1000) / 1000,
    y: Math.round(value.y * 1000) / 1000,
  }
}

function normalizeSelectionBox(value: BoardCollaborationPresence['selectionBox']) {
  if (
    !value
    || !Number.isFinite(value.minX)
    || !Number.isFinite(value.minY)
    || !Number.isFinite(value.maxX)
    || !Number.isFinite(value.maxY)
  ) {
    return null
  }
  const minX = Math.round(Math.min(value.minX, value.maxX) * 1000) / 1000
  const maxX = Math.round(Math.max(value.minX, value.maxX) * 1000) / 1000
  const minY = Math.round(Math.min(value.minY, value.maxY) * 1000) / 1000
  const maxY = Math.round(Math.max(value.minY, value.maxY) * 1000) / 1000
  if (maxX <= minX || maxY <= minY) return null
  return {
    maxX,
    maxY,
    minX,
    minY,
  }
}

function normalizeConnectionPreview(value: BoardCollaborationPresence['connectionPreview']) {
  if (!value) return null
  const source = normalizePortEndpoint(value.source)
  const pointer = normalizeCursor(value.pointer)
  const dataType = normalizeConnectionDataType(value.dataType)
  if (!source || !pointer || !dataType) return null
  const sources = Array.isArray(value.sources)
    ? value.sources
        .map(normalizePortEndpoint)
        .filter((item): item is BoardCollaborationPortEndpoint => Boolean(item))
        .slice(0, maxPresenceIds)
    : []
  return {
    dataType,
    pointer,
    source,
    sources: sources.length > 0 ? sources : [source],
    target: normalizePortEndpoint(value.target ?? null),
  } satisfies BoardCollaborationConnectionPreview
}

function normalizeIds(values: unknown) {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  for (const value of values) {
    const id = normalizeId(value)
    if (!id || seen.has(id)) continue
    seen.add(id)
    if (seen.size >= maxPresenceIds) break
  }
  return [...seen]
}

function normalizeId(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxPresenceIdLength) : null
}

function normalizeState(value: unknown) {
  return typeof value === 'string' && activePresenceStates.has(value as BoardCollaborationPresenceState)
    ? value as BoardCollaborationPresenceState
    : null
}

function normalizeTool(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxToolLength)
    : null
}

function normalizeTransformKind(value: unknown) {
  return typeof value === 'string' && activeTransformKinds.has(value as BoardCollaborationTransformKind)
    ? value as BoardCollaborationTransformKind
    : null
}

function normalizePortEndpoint(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const shapeId = normalizeId((value as { shapeId?: unknown }).shapeId)
  const portId = normalizeId((value as { portId?: unknown }).portId)
  if (!shapeId || !portId) return null
  return { portId, shapeId }
}

function normalizeConnectionDataType(value: unknown) {
  return value === 'image' || value === 'text'
    ? value
    : null
}
