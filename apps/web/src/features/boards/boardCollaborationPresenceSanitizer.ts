import type {
  BoardCollaborationPresence,
  BoardCollaborationPresenceState,
} from './boardCollaborationTypes'

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

export function sanitizeBoardCollaborationPresence(
  presence: BoardCollaborationPresence | null | undefined,
): BoardCollaborationPresence | null {
  if (!presence) return null
  return {
    activePageId: normalizeId(presence.activePageId),
    cursor: normalizeCursor(presence.cursor),
    editingShapeIds: normalizeIds(presence.editingShapeIds),
    hoveredShapeId: normalizeId(presence.hoveredShapeId),
    selectionIds: normalizeIds(presence.selectionIds),
    state: normalizeState(presence.state),
    tool: normalizeTool(presence.tool),
  }
}

function normalizeCursor(value: BoardCollaborationPresence['cursor']) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null
  return {
    x: Math.round(value.x * 1000) / 1000,
    y: Math.round(value.y * 1000) / 1000,
  }
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
