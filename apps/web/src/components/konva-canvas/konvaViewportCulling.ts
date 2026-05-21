import { getShapeBounds, type CanvasBounds, type CanvasCamera, type CanvasShape } from '@/features/canvas-engine'

type GetVisibleKonvaShapesOptions = {
  camera: CanvasCamera
  cropEditingImageId?: string | null
  draggingShapeIds: string[]
  height: number
  captureMode?: boolean
  selectedIds: string[]
  shapes: CanvasShape[]
  width: number
}

export function getVisibleKonvaShapes({
  camera,
  captureMode,
  cropEditingImageId,
  draggingShapeIds,
  height,
  selectedIds,
  shapes,
  width,
}: GetVisibleKonvaShapesOptions) {
  if (captureMode) return shapes
  const viewport = getWorldViewportBounds(camera, width, height)
  const pinnedIds = new Set([...selectedIds, ...draggingShapeIds, ...(cropEditingImageId ? [cropEditingImageId] : [])])
  return shapes.filter((shape) => (
    pinnedIds.has(shape.id) ||
    boundsIntersect(getShapeBounds(shape), viewport)
  ))
}

function getWorldViewportBounds(camera: CanvasCamera, width: number, height: number): CanvasBounds {
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1
  const padding = Math.max(800, 220 / zoom)
  return {
    maxX: (width - camera.x) / zoom + padding,
    maxY: (height - camera.y) / zoom + padding,
    minX: -camera.x / zoom - padding,
    minY: -camera.y / zoom - padding,
  }
}

function boundsIntersect(a: CanvasBounds, b: CanvasBounds) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}
