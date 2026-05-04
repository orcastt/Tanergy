import type { SyntheticEvent } from 'react'
import {
  getShapeBounds,
  worldToScreen,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasShape,
} from '@/features/canvas-engine'

type KonvaSelectionToolbarProps = {
  camera: CanvasCamera
  document: CanvasDocument
  canConvertImageToNode: boolean
  canNodeToCanvas: boolean
  selectedIds: string[]
  shellRect: DOMRect | null
  onCaptureSelection: () => void
  onConvertImageToNode: () => void
  onNodeToCanvas: () => void
}

export function KonvaSelectionToolbar({
  camera,
  canConvertImageToNode,
  canNodeToCanvas,
  document,
  onCaptureSelection,
  onConvertImageToNode,
  onNodeToCanvas,
  selectedIds,
  shellRect,
}: KonvaSelectionToolbarProps) {
  const point = getSelectionToolbarPoint(document.shapes, selectedIds, camera, shellRect)
  if (!point) return null
  return (
    <div
      aria-label="Selection actions"
      className="selection-toolbar selection-toolbar--konva"
      onContextMenu={stopCanvasEvent}
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
      role="toolbar"
      style={{ left: point.x, top: point.y }}
    >
      <button
        aria-label="Convert image to node"
        className="selection-toolbar__btn"
        data-tooltip="Convert image to node"
        disabled={!canConvertImageToNode}
        onClick={onConvertImageToNode}
        type="button"
      >
        <span aria-hidden className="style-action-icon style-action-icon--image-node" />
      </button>
      <button
        aria-label="Image node to canvas"
        className="selection-toolbar__btn"
        data-tooltip="Image node to canvas"
        disabled={!canNodeToCanvas}
        onClick={onNodeToCanvas}
        type="button"
      >
        <span aria-hidden className="style-action-icon style-action-icon--node-to-canvas" />
      </button>
      <button
        aria-label="Capture selection to image node"
        className="selection-toolbar__btn"
        data-tooltip="Capture selection to image node"
        disabled
        onClick={onCaptureSelection}
        type="button"
      >
        <span aria-hidden className="style-action-icon style-action-icon--capture" />
      </button>
    </div>
  )
}

function getSelectionToolbarPoint(
  shapes: CanvasShape[],
  selectedIds: string[],
  camera: CanvasCamera,
  shellRect: DOMRect | null
) {
  if (!shellRect || selectedIds.length === 0) return null
  const selected = new Set(selectedIds)
  const bounds = shapes.filter((shape) => selected.has(shape.id)).map(getShapeBounds)
  if (bounds.length === 0) return null
  const merged = bounds.reduce((current, item) => ({
    maxX: Math.max(current.maxX, item.maxX),
    maxY: Math.max(current.maxY, item.maxY),
    minX: Math.min(current.minX, item.minX),
    minY: Math.min(current.minY, item.minY),
  }))
  const screen = worldToScreen({ x: (merged.minX + merged.maxX) / 2, y: merged.minY }, camera)
  return {
    x: shellRect.left + screen.x,
    y: shellRect.top + screen.y - 10,
  }
}

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}
