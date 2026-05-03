import { getShapeBounds, type CanvasFrameShape, type CanvasShape } from '@/features/canvas-engine'

export function applyFrameContainment(shapes: CanvasShape[], movedShapeIds: string[]): CanvasShape[] {
  const moved = new Set(movedShapeIds)
  const frames = shapes.filter((shape): shape is CanvasFrameShape => shape.type === 'frame')
  if (frames.length === 0 || moved.size === 0) return shapes

  return shapes.map((shape) => {
    if (!moved.has(shape.id) || shape.type === 'frame') return shape
    const frame = findContainingFrame(shape, frames)
    const parentId = frame?.id ?? null
    return shape.parentId === parentId ? shape : { ...shape, parentId }
  })
}

function findContainingFrame(shape: CanvasShape, frames: CanvasFrameShape[]) {
  const bounds = getShapeBounds(shape)
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
  return [...frames].reverse().find((frame) => {
    const frameBounds = getShapeBounds(frame)
    return center.x >= frameBounds.minX
      && center.x <= frameBounds.maxX
      && center.y >= frameBounds.minY
      && center.y <= frameBounds.maxY
  })
}
