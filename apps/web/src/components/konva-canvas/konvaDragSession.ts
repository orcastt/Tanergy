import { getShapeBounds, type CanvasBounds, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import { getSelectedShapeBounds, getShapesByIds, moveBounds, moveShapesFromOrigins } from './konvaSelectionUtils'

export type KonvaShapeDragSession = {
  anchorShape: CanvasShape
  baseShapes: CanvasShape[]
  lastPoint?: CanvasPoint
  mode: 'duplicate' | 'move'
  movingShapeIds: string[]
  movingShapes: CanvasShape[]
  originBounds: CanvasBounds
  selectOnEndIds?: string[]
  shapeId: string
  snapTargetBounds: CanvasBounds[]
}

export function createMoveDragSession(shapes: CanvasShape[], movingShapeIds: string[], shapeId: string): KonvaShapeDragSession | null {
  const anchorShape = shapes.find((shape) => shape.id === shapeId)
  const movingShapes = getShapesByIds(shapes, movingShapeIds)
  return anchorShape ? createDragSession({
    anchorShape,
    baseShapes: shapes,
    mode: 'move',
    movingShapes,
    shapeId,
    snapTargetShapes: shapes.filter((shape) => !movingShapeIds.includes(shape.id)),
  }) : null
}

export function createDuplicateDragSession(options: {
  baseShapes: CanvasShape[]
  duplicateShapes: CanvasShape[]
  shapeId: string
  sourceShapes: CanvasShape[]
  snapTargetShapes: CanvasShape[]
}): KonvaShapeDragSession | null {
  const anchorShape = options.sourceShapes.find((shape) => shape.id === options.shapeId)
  return anchorShape ? createDragSession({
    anchorShape,
    baseShapes: options.baseShapes,
    mode: 'duplicate',
    movingShapes: options.duplicateShapes,
    selectOnEndIds: options.duplicateShapes.map((shape) => shape.id),
    shapeId: options.shapeId,
    snapTargetShapes: options.snapTargetShapes,
  }) : null
}

export function getShapeDragSessionBounds(session: KonvaShapeDragSession, x: number, y: number): CanvasBounds {
  return moveBounds(session.originBounds, getShapeDragSessionDelta(session, x, y))
}

export function getShapeDragSessionShapes(session: KonvaShapeDragSession, x: number, y: number): CanvasShape[] {
  return moveShapesFromOrigins(session.baseShapes, session.movingShapes, getShapeDragSessionDelta(session, x, y))
}

function createDragSession(options: {
  anchorShape: CanvasShape
  baseShapes: CanvasShape[]
  mode: KonvaShapeDragSession['mode']
  movingShapes: CanvasShape[]
  selectOnEndIds?: string[]
  shapeId: string
  snapTargetShapes: CanvasShape[]
}): KonvaShapeDragSession | null {
  const movingShapeIds = options.movingShapes.map((shape) => shape.id)
  const originBounds = getSelectedShapeBounds(options.movingShapes, movingShapeIds)
  return originBounds && options.movingShapes.length > 0 ? {
    anchorShape: options.anchorShape,
    baseShapes: options.baseShapes,
    mode: options.mode,
    movingShapeIds,
    movingShapes: options.movingShapes,
    originBounds,
    selectOnEndIds: options.selectOnEndIds,
    shapeId: options.shapeId,
    snapTargetBounds: options.snapTargetShapes.map(getShapeBounds),
  } : null
}

function getShapeDragSessionDelta(session: KonvaShapeDragSession, x: number, y: number): CanvasPoint {
  return {
    x: x - session.anchorShape.x,
    y: y - session.anchorShape.y,
  }
}
