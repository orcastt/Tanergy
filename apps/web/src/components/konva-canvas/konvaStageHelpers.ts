import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { CanvasBounds, CanvasPoint } from '@/features/canvas-engine'

export function getStagePointer(stage: Konva.Stage | null): CanvasPoint | null {
  const pointer = stage?.getPointerPosition()
  return pointer ? { x: pointer.x, y: pointer.y } : null
}

export function isStageTarget(event: KonvaEventObject<Event>) {
  return event.target === event.target.getStage()
}

export function boundsContainPoint(bounds: CanvasBounds, point: CanvasPoint, padding: number) {
  return point.x >= bounds.minX - padding && point.x <= bounds.maxX + padding && point.y >= bounds.minY - padding && point.y <= bounds.maxY + padding
}

export function clearBrowserSelection() {
  window.getSelection()?.removeAllRanges()
}
