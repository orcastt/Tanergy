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
  canGroupSelection: boolean
  canLockSelection: boolean
  canRemoveBackground: boolean
  canStartObjectCutout: boolean
  canUngroupSelection: boolean
  canUnlockSelection: boolean
  actionError?: string | null
  isCapturingSelection?: boolean
  isRemovingBackground?: boolean
  selectedIds: string[]
  shellRect: DOMRect | null
  onCaptureSelection: () => void
  onConvertImageToNode: () => void
  onCropImage: () => void
  onGroupSelection: () => void
  onLockSelection: () => void
  onRemoveBackground: () => void
  onUngroupSelection: () => void
  onUnlockSelection: () => void
}

export function KonvaSelectionToolbar({
  camera,
  actionError,
  canCaptureSelection,
  canConvertImageToNode,
  canCropImage,
  canGroupSelection,
  canLockSelection,
  canRemoveBackground,
  canStartObjectCutout,
  canUngroupSelection,
  canUnlockSelection,
  document,
  isCapturingSelection,
  isRemovingBackground,
  onCaptureSelection,
  onConvertImageToNode,
  onCropImage,
  onGroupSelection,
  onLockSelection,
  onRemoveBackground,
  onUngroupSelection,
  onUnlockSelection,
  selectedIds,
  shellRect,
}: KonvaSelectionToolbarProps) {
  if (selectedIds.length < 2) return null
  const point = getSelectionToolbarPoint(document.shapes, selectedIds, camera, shellRect)
  if (!point) return null
  const showGroupToggle = canGroupSelection || canUngroupSelection
  const showLockToggle = canLockSelection || canUnlockSelection
  const groupAction = canUngroupSelection
    ? { icon: 'style-action-icon style-action-icon--ungroup', label: 'Ungroup', onClick: onUngroupSelection }
    : { icon: 'style-action-icon style-action-icon--group', label: 'Group', onClick: onGroupSelection }
  const lockAction = canUnlockSelection && !canLockSelection
    ? { icon: 'style-action-icon style-action-icon--unlock', label: 'Unlock', onClick: onUnlockSelection }
    : { icon: 'style-action-icon style-action-icon--lock', label: 'Lock', onClick: onLockSelection }
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
      {showGroupToggle ? (
        <button
          aria-label={groupAction.label}
          className="selection-toolbar__btn"
          data-tooltip={groupAction.label}
          onClick={groupAction.onClick}
          type="button"
        >
          <span aria-hidden className={groupAction.icon} />
        </button>
      ) : null}
      {showLockToggle ? (
        <button
          aria-label={lockAction.label}
          className="selection-toolbar__btn"
          data-tooltip={lockAction.label}
          onClick={lockAction.onClick}
          type="button"
        >
          <span aria-hidden className={lockAction.icon} />
        </button>
      ) : null}
      {actionError ? (
        <span className="selection-toolbar__error" role="status">
          {actionError}
        </span>
      ) : null}
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
