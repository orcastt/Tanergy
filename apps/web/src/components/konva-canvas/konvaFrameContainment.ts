import { getShapeBounds, type CanvasBounds, type CanvasFrameShape, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'

export function applyFrameContainment(shapes: CanvasShape[], movedShapeIds: string[]): CanvasShape[] {
  const moved = new Set(movedShapeIds)
  const frames = shapes.filter((shape): shape is CanvasFrameShape => shape.type === 'frame')
  if (moved.size === 0) return shapes

  return shapes.map((shape) => {
    if (!moved.has(shape.id)) return shape
    if (shape.type === 'frame') {
      // Frame nesting is intentionally disabled for this first pass.
      return shape.parentId ? { ...shape, parentId: null } : shape
    }
    const frame = findTopmostContainingFrame(shape, frames)
    const parentId = frame?.id ?? null
    return shape.parentId === parentId ? shape : { ...shape, parentId }
  })
}

export function findTopmostContainingFrame(shape: CanvasShape, frames: CanvasFrameShape[]): CanvasFrameShape | null {
  if (shape.type === 'frame') return null
  const center = getBoundsCenter(getShapeBounds(shape))

  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index]
    if (isPointInBounds(center, getFrameVisibleBounds(frame))) return frame
  }

  return null
}

export function getFrameVisibleBounds(frame: CanvasFrameShape): CanvasBounds {
  return getShapeBounds(frame)
}

export function getShapeVisibleBoundsUnderFrame(shape: CanvasShape, frame: CanvasFrameShape): CanvasBounds | null {
  if (shape.type === 'frame') return null
  return intersectBounds(getShapeBounds(shape), getFrameVisibleBounds(frame))
}

function getBoundsCenter(bounds: CanvasBounds): CanvasPoint {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

function isPointInBounds(point: CanvasPoint, bounds: CanvasBounds) {
  return point.x >= bounds.minX
    && point.x <= bounds.maxX
    && point.y >= bounds.minY
    && point.y <= bounds.maxY
}

function intersectBounds(a: CanvasBounds, b: CanvasBounds): CanvasBounds | null {
  const bounds = {
    maxX: Math.min(a.maxX, b.maxX),
    maxY: Math.min(a.maxY, b.maxY),
    minX: Math.max(a.minX, b.minX),
    minY: Math.max(a.minY, b.minY),
  }
  return bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY ? bounds : null
}
