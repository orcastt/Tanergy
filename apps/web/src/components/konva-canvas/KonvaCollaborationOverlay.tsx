'use client'

import { useMemo } from 'react'
import { getShapeBounds, worldToScreen, type CanvasBounds, type CanvasCamera, type CanvasDocument, type CanvasShape } from '@/features/canvas-engine'
import type {
  BoardCollaborationSessionRecord,
  BoardCollaborationShapeOccupancy,
} from '@/features/boards/boardCollaborationTypes'
import { getCollaborationAccent } from '@/features/collaboration/collaborationAccent'
import {
  formatSessionPresenceActivity,
  type KonvaPresencePageSummary,
} from './konvaCollaborationPresencePresentation'
import { useSmoothedCollaborationCursors } from './useSmoothedCollaborationCursors'

type KonvaCollaborationOverlayProps = {
  activePageId?: string | null
  camera: CanvasCamera
  document: CanvasDocument
  occupancy: BoardCollaborationShapeOccupancy[]
  pageSummaries?: KonvaPresencePageSummary[]
  sessions: BoardCollaborationSessionRecord[]
  stageHeight: number
  stageWidth: number
}

export function KonvaCollaborationOverlay({
  activePageId = null,
  camera,
  document,
  occupancy,
  pageSummaries = [],
  sessions,
  stageHeight,
  stageWidth,
}: KonvaCollaborationOverlayProps) {
  const shapeById = new Map(document.shapes.map((shape) => [shape.id, shape] as const))
  const visibleSessions = sessions
    .filter((session) => !session.isSelf)
    .filter((session) => isSessionVisibleOnPage(activePageId, session.presence.activePageId ?? null))
    .filter((session) => Boolean(session.presence.cursor))
  const animatedCursorPositions = useSmoothedCollaborationCursors(useMemo(
    () => visibleSessions.flatMap((session) => {
      const point = session.presence.cursor
      if (!point) return []
      return [{ id: session.id, point }] as const
    }),
    [visibleSessions],
  ))
  const visibleTransformHints = sessions
    .filter((session) => !session.isSelf)
    .filter((session) => isSessionVisibleOnPage(activePageId, session.presence.activePageId ?? null))
    .map((session) => {
      const transformBox = session.presence.transformBox
      const transformKind = session.presence.transformKind
      if (!transformBox || !transformKind) return null
      const rect = projectBounds(transformBox, camera)
      if (rect.width <= 0 || rect.height <= 0) return null
      if (rect.x > stageWidth + 160 || rect.y > stageHeight + 120) return null
      if (rect.x + rect.width < -160 || rect.y + rect.height < -120) return null
      return { rect, session, transformKind }
    })
    .filter((item): item is { rect: ScreenRect; session: BoardCollaborationSessionRecord; transformKind: NonNullable<BoardCollaborationSessionRecord['presence']['transformKind']> } => Boolean(item))
  const occupancyRects = occupancy
    .filter((entry) => !entry.isSelf)
    .filter((entry) => entry.kind === 'editing')
    .filter((entry) => isSessionVisibleOnPage(activePageId, entry.activePageId))
    .map((entry) => {
      const bounds = getOccupancyBounds(shapeById, entry.shapeIds)
      if (!bounds) return null
      const rect = projectBounds(bounds, camera)
      if (rect.width <= 0 || rect.height <= 0) return null
      if (rect.x > stageWidth + 160 || rect.y > stageHeight + 120) return null
      if (rect.x + rect.width < -160 || rect.y + rect.height < -120) return null
      return { entry, rect }
    })
    .filter((item): item is { entry: BoardCollaborationShapeOccupancy; rect: ScreenRect } => Boolean(item))

  if (visibleSessions.length === 0 && visibleTransformHints.length === 0 && occupancyRects.length === 0) return null

  return (
    <div className="konva-collaboration-overlay" aria-hidden="true">
      {visibleTransformHints.map(({ rect, session, transformKind }) => (
        <div
          className={`konva-collaboration-transform is-${transformKind}`}
          key={`${session.id}:transform:${transformKind}`}
          style={{
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        >
          <span className="konva-collaboration-transform__outline" />
          <span className="konva-collaboration-transform__label">
            {session.displayName} {getTransformLabel(transformKind)}
          </span>
        </div>
      ))}
      {occupancyRects.map(({ entry, rect }) => (
        <div
          className={`konva-collaboration-occupancy is-${entry.kind}`}
          key={`${entry.sessionId}:${entry.kind}:${entry.shapeIds.join('|')}`}
          style={{
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        >
          <span className="konva-collaboration-occupancy__outline" />
          <span className="konva-collaboration-occupancy__label">
            {getOccupancyLabel(entry)}
          </span>
        </div>
      ))}
      {visibleSessions.map((session) => {
        const cursor = animatedCursorPositions.get(session.id) ?? session.presence.cursor
        const activity = formatSessionPresenceActivity(session, { currentPageId: activePageId, pageSummaries })
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
              transform: `translate3d(${point.x}px, ${point.y}px, 0)`,
              ['--collab-accent' as string]: getCollaborationAccent(session.clientInstanceId),
            }}
          >
            <span className="konva-collaboration-cursor__pointer" />
            <span className="konva-collaboration-cursor__label">
              <span className="konva-collaboration-cursor__identity">
                <span className="konva-collaboration-cursor__avatar">{session.displayName.slice(0, 1).toUpperCase()}</span>
                <strong>{session.displayName}</strong>
              </span>
              {activity ? <small>{activity}</small> : null}
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

function getOccupancyBounds(shapeById: Map<string, CanvasShape>, shapeIds: string[]) {
  const bounds = shapeIds
    .map((shapeId) => shapeById.get(shapeId))
    .filter((shape): shape is CanvasShape => Boolean(shape))
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
  if (entry.kind === 'editing') return `${entry.displayName} editing here`
  if (entry.kind === 'selection') {
    return entry.shapeIds.length > 1
      ? `${entry.displayName} selected ${entry.shapeIds.length} objects`
      : `${entry.displayName} selected this object`
  }
  return `${entry.displayName} hovering here`
}

function getTransformLabel(kind: NonNullable<BoardCollaborationSessionRecord['presence']['transformKind']>) {
  if (kind === 'move') return 'moving'
  if (kind === 'resize') return 'resizing'
  return 'rotating'
}
