'use client'

import { useState, type SyntheticEvent } from 'react'
import type { Editor, TLShapeId } from 'tldraw'
import {
  createImageNodeFromCanvasImage,
  createImageNodeFromDataUrl,
  isCanvasImageShape,
} from '@/features/node-runtime/imageNodeAssets'
import { CanvasLineIcon, type CanvasLineIconName } from './CanvasLineIcon'
import { alignActions } from './canvasStylePanelModel'
import { useEditorInteractionState } from './useEditorInteractionState'
import { useEditorRevision } from './useEditorRevision'

type CanvasSelectionToolbarProps = {
  editor: Editor | null
}

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasSelectionToolbar({ editor }: CanvasSelectionToolbarProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [alignOpen, setAlignOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const interaction = useEditorInteractionState(editor)
  useEditorRevision(editor, 'selection')

  const selectedIds = editor?.getSelectedShapeIds() ?? []
  if (!editor || selectedIds.length === 0) return null
  if (interaction.isDragging || interaction.isPanning || interaction.cameraState === 'moving') return null

  const bounds = getPageBounds(editor, selectedIds)
  if (!bounds) return null

  const selectedImageIds = selectedIds.filter((id) => isCanvasImageShape(editor.getShape(id)))
  const canAlign = selectedIds.length >= 2
  const canCapture = selectedIds.length >= 2
  const canConvertToImageNode = selectedImageIds.length > 0
  if (!canAlign && !canCapture && !canConvertToImageNode) return null

  const anchor = editor.pageToScreen({ x: bounds.minX + bounds.width / 2, y: bounds.minY })
  const top = Math.max(76, anchor.y - 12)

  const handleCapture = async () => {
    if (!canCapture) return
    clearBrowserSelection()
    setError(null)
    setIsCapturing(true)
    try {
      const result = await editor.toImageDataUrl(selectedIds, {
        background: false,
        format: 'png',
        padding: 0,
        pixelRatio: 1,
      })
      await createImageNodeFromDataUrl(editor, {
        height: result.height,
        source: 'merge_capture',
        title: 'Merged selection',
        url: result.url,
        width: result.width,
        x: bounds.minX,
        y: bounds.minY + bounds.height + 30,
      })
    } catch {
      setError('Capture failed.')
    } finally {
      setIsCapturing(false)
      clearBrowserSelection()
    }
  }

  const handleConvertToImageNode = async () => {
    clearBrowserSelection()
    setError(null)
    try {
      for (const shapeId of selectedImageIds) {
        await createImageNodeFromCanvasImage(editor, shapeId)
      }
    } catch {
      setError('Image node conversion failed.')
    } finally {
      clearBrowserSelection()
    }
  }

  return (
    <div
      className="selection-toolbar"
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
      style={{ left: anchor.x, top }}
    >
      {canConvertToImageNode ? (
        <button
          aria-label="Convert selected image to Image Node"
          className="selection-toolbar__btn"
          data-tooltip="Convert to image node"
          disabled={isCapturing}
          onClick={() => void handleConvertToImageNode()}
          type="button"
        >
          <CanvasLineIcon name="image-node" />
        </button>
      ) : null}

      {canCapture ? (
        <button
          aria-label="Capture selected objects to Image Node"
          className="selection-toolbar__btn"
          data-tooltip="Capture to image node"
          disabled={isCapturing}
          onClick={() => void handleCapture()}
          type="button"
        >
          <CanvasLineIcon name="capture" />
        </button>
      ) : null}

      {canAlign ? (
        <div className="selection-toolbar__align">
          <button
            aria-expanded={alignOpen}
            aria-label="Open alignment actions"
            className="selection-toolbar__btn"
            data-tooltip="Align"
            onClick={() => setAlignOpen((open) => !open)}
            type="button"
          >
            <CanvasLineIcon name="align-center-x" />
          </button>
          {alignOpen ? (
            <div className="selection-toolbar__menu" role="menu">
              {alignActions.map((action) => (
                <button
                  aria-label={action.label}
                  disabled={selectedIds.length < (action.minSelected ?? 1)}
                  key={action.icon}
                  onClick={() => {
                    action.run(editor, selectedIds)
                    setAlignOpen(false)
                  }}
                  role="menuitem"
                  type="button"
                >
                  <CanvasLineIcon name={action.icon as CanvasLineIconName} />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <span className="selection-toolbar__error">{error}</span> : null}
    </div>
  )
}

function clearBrowserSelection() {
  window.getSelection()?.removeAllRanges()
}

function getPageBounds(editor: Editor, ids: TLShapeId[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of ids) {
    const shape = editor.getShape(id)
    if (!shape) continue
    const transform = editor.getShapePageTransform(id)
    if (!transform) continue
    const geo = editor.getShapeGeometry(shape)
    const corners = [
      { x: geo.bounds.minX, y: geo.bounds.minY },
      { x: geo.bounds.minX + geo.bounds.width, y: geo.bounds.minY },
      { x: geo.bounds.minX, y: geo.bounds.minY + geo.bounds.height },
      { x: geo.bounds.minX + geo.bounds.width, y: geo.bounds.minY + geo.bounds.height },
    ]
    for (const corner of corners) {
      const pagePoint = transform.applyToPoint(corner)
      minX = Math.min(minX, pagePoint.x)
      minY = Math.min(minY, pagePoint.y)
      maxX = Math.max(maxX, pagePoint.x)
      maxY = Math.max(maxY, pagePoint.y)
    }
  }
  if (minX === Infinity) return null
  return { height: maxY - minY, minX, minY, width: maxX - minX }
}
