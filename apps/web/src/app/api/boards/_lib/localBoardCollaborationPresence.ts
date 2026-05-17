import type { BoardCollaborationPresence } from '@/features/boards/boardCollaborationTypes'
import {
  localBoardActivePresenceStates,
  maxSelectionIds,
  normalizeSessionIdentifier,
} from './localBoardCollaborationSupport'

export function normalizeLocalBoardCollaborationPresence(
  presence: BoardCollaborationPresence | undefined,
): BoardCollaborationPresence {
  const connectionPreview = normalizeConnectionPreview(presence?.connectionPreview)
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
  const selectedEdgeId = typeof presence?.selectedEdgeId === 'string' && presence.selectedEdgeId.trim()
    ? normalizeSessionIdentifier(presence.selectedEdgeId, 'selected edge id')
    : null
  const selectionBox = (
    presence?.selectionBox
    && Number.isFinite(presence.selectionBox.minX)
    && Number.isFinite(presence.selectionBox.minY)
    && Number.isFinite(presence.selectionBox.maxX)
    && Number.isFinite(presence.selectionBox.maxY)
  )
    ? normalizeSelectionBox(presence.selectionBox)
    : null
  const transformBox = (
    presence?.transformBox
    && Number.isFinite(presence.transformBox.minX)
    && Number.isFinite(presence.transformBox.minY)
    && Number.isFinite(presence.transformBox.maxX)
    && Number.isFinite(presence.transformBox.maxY)
  )
    ? normalizeSelectionBox(presence.transformBox)
    : null
  const transformKind = typeof presence?.transformKind === 'string' && ['move', 'resize', 'rotate'].includes(presence.transformKind)
    ? presence.transformKind
    : null
  const tool = typeof presence?.tool === 'string' && presence.tool.trim() ? presence.tool.trim().slice(0, 40) : null
  const state = typeof presence?.state === 'string' && localBoardActivePresenceStates.has(presence.state)
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
    connectionPreview,
    cursor,
    editingShapeIds,
    hoveredShapeId,
    selectedEdgeId,
    selectionBox,
    selectionIds,
    state,
    tool,
    transformBox,
    transformKind,
  }
}

function normalizeSelectionBox(value: {
  maxX: number
  maxY: number
  minX: number
  minY: number
}) {
  const minX = Math.round(Math.min(value.minX, value.maxX) * 1000) / 1000
  const maxX = Math.round(Math.max(value.minX, value.maxX) * 1000) / 1000
  const minY = Math.round(Math.min(value.minY, value.maxY) * 1000) / 1000
  const maxY = Math.round(Math.max(value.minY, value.maxY) * 1000) / 1000
  if (maxX <= minX || maxY <= minY) return null
  return { maxX, maxY, minX, minY }
}

function normalizeConnectionPreview(value: BoardCollaborationPresence['connectionPreview']) {
  if (!value) return null
  const pointer = value.pointer && Number.isFinite(value.pointer.x) && Number.isFinite(value.pointer.y)
    ? {
        x: Math.round(value.pointer.x * 1000) / 1000,
        y: Math.round(value.pointer.y * 1000) / 1000,
      }
    : null
  const source = normalizePortEndpoint(value.source)
  const dataType = value.dataType === 'image' || value.dataType === 'text' ? value.dataType : null
  if (!pointer || !source || !dataType) return null
  const sources = Array.isArray(value.sources)
    ? value.sources
        .map(normalizePortEndpoint)
        .filter((item): item is NonNullable<ReturnType<typeof normalizePortEndpoint>> => Boolean(item))
        .slice(0, maxSelectionIds)
    : []
  return {
    dataType,
    pointer,
    source,
    sources: sources.length > 0 ? sources : [source],
    target: normalizePortEndpoint(value.target ?? null),
  }
}

function normalizePortEndpoint(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const shapeId = typeof (value as { shapeId?: unknown }).shapeId === 'string' && (value as { shapeId: string }).shapeId.trim()
    ? normalizeSessionIdentifier((value as { shapeId: string }).shapeId, 'connection shape id')
    : null
  const portId = typeof (value as { portId?: unknown }).portId === 'string' && (value as { portId: string }).portId.trim()
    ? normalizeSessionIdentifier((value as { portId: string }).portId, 'connection port id')
    : null
  if (!shapeId || !portId) return null
  return { portId, shapeId }
}
