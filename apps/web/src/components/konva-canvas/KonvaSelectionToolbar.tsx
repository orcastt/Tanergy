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
  canCaptureSelection: boolean
  canConvertImageToNode: boolean
  canCropImage: boolean
  canRemoveBackground: boolean
  canStartObjectCutout: boolean
  isCapturingSelection?: boolean
  isRemovingBackground?: boolean
  selectedIds: string[]
  shellRect: DOMRect | null
  onCaptureSelection: () => void
  onConvertImageToNode: () => void
  onCropImage: () => void
  onRemoveBackground: () => void
}

export function KonvaSelectionToolbar({
  camera,
  canCaptureSelection,
  canConvertImageToNode,
  canCropImage,
  canRemoveBackground,
  canStartObjectCutout,
  document,
  isCapturingSelection,
  isRemovingBackground,
  onCaptureSelection,
  onConvertImageToNode,
  onCropImage,
  onRemoveBackground,
  selectedIds,
  shellRect,
}: KonvaSelectionToolbarProps) {
  if (isSingleNodeSelection(document.shapes, selectedIds)) return null
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
      {canConvertImageToNode ? (
        <button
          aria-label="Convert image to node"
          className="selection-toolbar__btn"
          data-tooltip="Convert image to node"
          onClick={onConvertImageToNode}
          type="button"
        >
          <span aria-hidden className="style-action-icon style-action-icon--image-node" />
        </button>
      ) : null}
      {canCropImage ? (
        <button
          aria-label="Crop image"
          className="selection-toolbar__btn"
          data-tooltip="Crop image"
          onClick={onCropImage}
          type="button"
        >
          <span aria-hidden className="style-action-icon style-action-icon--crop" />
        </button>
      ) : null}
      {canCropImage || canRemoveBackground || canStartObjectCutout ? (
        <>
          <button
            aria-label="Remove background"
            className="selection-toolbar__btn"
            data-tooltip={isRemovingBackground ? 'Removing background' : 'Remove background'}
            disabled={!canRemoveBackground || isRemovingBackground}
            onClick={onRemoveBackground}
            type="button"
          >
            <span aria-hidden className="style-action-icon style-action-icon--remove-bg" />
          </button>
          <button
            aria-label="Object cutout"
            className="selection-toolbar__btn"
            data-tooltip="Object cutout"
            disabled
            type="button"
          >
            <span aria-hidden className="style-action-icon style-action-icon--object-cutout" />
          </button>
        </>
      ) : null}
      <button
        aria-label="Capture selection to image node"
        className="selection-toolbar__btn"
        data-tooltip={isCapturingSelection ? 'Capturing selection' : 'Capture selection to image node'}
        disabled={!canCaptureSelection || isCapturingSelection}
        onClick={onCaptureSelection}
        type="button"
      >
        <span aria-hidden className="style-action-icon style-action-icon--capture" />
      </button>
    </div>
  )
}

function isSingleNodeSelection(shapes: CanvasShape[], selectedIds: string[]) {
  if (selectedIds.length !== 1) return false
  return shapes.some((shape) => shape.id === selectedIds[0] && shape.type === 'node_card')
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
