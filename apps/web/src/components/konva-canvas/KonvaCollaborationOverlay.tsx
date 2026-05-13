'use client'

import { getShapeBounds, worldToScreen, type CanvasBounds, type CanvasCamera, type CanvasDocument, type CanvasShape } from '@/features/canvas-engine'
import type {
  BoardCollaborationSessionRecord,
  BoardCollaborationShapeOccupancy,
} from '@/features/boards/boardCollaborationTypes'

type KonvaCollaborationOverlayProps = {
  activePageId?: string | null
  camera: CanvasCamera
  document: CanvasDocument
  occupancy: BoardCollaborationShapeOccupancy[]
  sessions: BoardCollaborationSessionRecord[]
  stageHeight: number
  stageWidth: number
}

export function KonvaCollaborationOverlay({
  activePageId = null,
  camera,
  document,
  occupancy,
  sessions,
  stageHeight,
  stageWidth,
}: KonvaCollaborationOverlayProps) {
  const visibleSessions = sessions
    .filter((session) => !session.isSelf)
    .filter((session) => isSessionVisibleOnPage(activePageId, session.presence.activePageId ?? null))
    .filter((session) => Boolean(session.presence.cursor))
  const occupancyRects = occupancy
    .filter((entry) => !entry.isSelf)
    .filter((entry) => isSessionVisibleOnPage(activePageId, entry.activePageId))
    .map((entry) => {
      const bounds = getOccupancyBounds(document.shapes, entry.shapeIds)
      if (!bounds) return null
      const rect = projectBounds(bounds, camera)
      if (rect.width <= 0 || rect.height <= 0) return null
      if (rect.x > stageWidth + 160 || rect.y > stageHeight + 120) return null
      if (rect.x + rect.width < -160 || rect.y + rect.height < -120) return null
      return { entry, rect }
    })
    .filter((item): item is { entry: BoardCollaborationShapeOccupancy; rect: ScreenRect } => Boolean(item))

  if (visibleSessions.length === 0 && occupancyRects.length === 0) return null

  return (
    <div className="konva-collaboration-overlay" aria-hidden="true">
      {occupancyRects.map(({ entry, rect }) => (
        <div
          className={`konva-collaboration-occupancy is-${entry.kind}`}
          key={`${entry.sessionId}:${entry.kind}:${entry.shapeIds.join('|')}`}
          style={{
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            ['--collab-accent' as string]: getSessionAccent(entry.userId),
          }}
        >
          <span className="konva-collaboration-occupancy__outline" />
          <span className="konva-collaboration-occupancy__label">
            {getOccupancyLabel(entry)}
          </span>
        </div>
      ))}
      {visibleSessions.map((session) => {
        const cursor = session.presence.cursor
        if (!cursor) return null
        const point = worldToScreen(cursor, camera)
        if (point.x < -120 || point.y < -80 || point.x > stageWidth + 120 || point.y > stageHeight + 80) {
          return null
        }
        return (
          <div
            className="konva-collaboration-cursor"
            key={session.id}
            style={{
              left: `${point.x}px`,
              top: `${point.y}px`,
              ['--collab-accent' as string]: getSessionAccent(session.userId),
            }}
          >
            <span className="konva-collaboration-cursor__pointer" />
            <span className="konva-collaboration-cursor__label">
              <strong>{session.displayName}</strong>
              {session.presence.selectionIds?.length ? <small>{session.presence.selectionIds.length} selected</small> : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}

type ScreenRect = {
  height: number
  width: number
  x: number
  y: number
}

function isSessionVisibleOnPage(activePageId: string | null, sessionPageId: string | null) {
  if (!activePageId || !sessionPageId) return true
  return sessionPageId === activePageId
}

function getOccupancyBounds(shapes: CanvasShape[], shapeIds: string[]) {
  const selected = new Set(shapeIds)
  const bounds = shapes
    .filter((shape) => selected.has(shape.id))
    .map(getShapeBounds)
  if (bounds.length === 0) return null
  return mergeBounds(bounds)
}

function mergeBounds(bounds: CanvasBounds[]) {
  return bounds.reduce((merged, item) => ({
    maxX: Math.max(merged.maxX, item.maxX),
    maxY: Math.max(merged.maxY, item.maxY),
    minX: Math.min(merged.minX, item.minX),
    minY: Math.min(merged.minY, item.minY),
  }))
}

function projectBounds(bounds: CanvasBounds, camera: CanvasCamera): ScreenRect {
  const origin = worldToScreen({ x: bounds.minX, y: bounds.minY }, camera)
  const far = worldToScreen({ x: bounds.maxX, y: bounds.maxY }, camera)
  return {
    height: Math.max(18, far.y - origin.y),
    width: Math.max(18, far.x - origin.x),
    x: origin.x,
    y: origin.y,
  }
}

function getOccupancyLabel(entry: BoardCollaborationShapeOccupancy) {
  if (entry.kind === 'editing') return `${entry.displayName} editing`
  if (entry.kind === 'selection') {
    return entry.shapeIds.length > 1
      ? `${entry.displayName} selected ${entry.shapeIds.length}`
      : `${entry.displayName} selected`
  }
  return `${entry.displayName} hovering`
}

function getSessionAccent(seed: string) {
  const palette = ['#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed', '#0891b2']
  const normalized = seed.trim()
  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0
  }
  return palette[hash % palette.length]
}
