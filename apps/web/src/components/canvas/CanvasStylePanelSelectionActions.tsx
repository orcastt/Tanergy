'use client'

import { useState } from 'react'
import type { Editor, TLShapeId } from 'tldraw'
import {
  createImageNodeFromCanvasImage,
  createImageNodeFromDataUrl,
  isCanvasImageShape,
} from '@/features/node-runtime/imageNodeAssets'

type CanvasStylePanelSelectionActionsProps = {
  editor: Editor
  selectedIds: TLShapeId[]
}

export function CanvasStylePanelSelectionActions({
  editor,
  selectedIds,
}: CanvasStylePanelSelectionActionsProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const selectedImageIds = selectedIds.filter((id) => isCanvasImageShape(editor.getShape(id)))
  const canCapture = selectedIds.length >= 2
  const canConvertToImageNode = selectedImageIds.length > 0

  if (!canCapture && !canConvertToImageNode) return null

  const handleScreenshot = async () => {
    if (!canCapture) return
    clearBrowserSelection()
    setCaptureError(null)
    setIsCapturing(true)
    try {
      const bounds = getPageBounds(editor, selectedIds)
      if (!bounds) throw new Error('Selection bounds unavailable.')
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
      setCaptureError('Capture failed.')
    } finally {
      setIsCapturing(false)
      clearBrowserSelection()
    }
  }

  const handleConvertToImageNode = async () => {
    clearBrowserSelection()
    setCaptureError(null)
    try {
      for (const shapeId of selectedImageIds) {
        await createImageNodeFromCanvasImage(editor, shapeId)
      }
    } catch {
      setCaptureError('Image node conversion failed.')
    } finally {
      clearBrowserSelection()
    }
  }

  return (
    <section className="canvas-style-panel__block">
      <p>Selection</p>
      <div className="canvas-style-panel__icon-grid">
        <button
          aria-label="Convert selected image to Image Node"
          disabled={!canConvertToImageNode || isCapturing}
          onClick={() => void handleConvertToImageNode()}
          title="Convert to image node"
          type="button"
        >
          <span className="style-action-icon style-action-icon--image-node" aria-hidden />
        </button>
        <button
          aria-label="Capture selected objects to Image Node"
          disabled={!canCapture || isCapturing}
          onClick={() => void handleScreenshot()}
          title="Capture to image node"
          type="button"
        >
          <span className="style-action-icon style-action-icon--capture" aria-hidden />
        </button>
      </div>
      {captureError ? <small className="canvas-style-panel__error">{captureError}</small> : null}
    </section>
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
      const pagePt = transform.applyToPoint(corner)
      if (pagePt.x < minX) minX = pagePt.x
      if (pagePt.y < minY) minY = pagePt.y
      if (pagePt.x > maxX) maxX = pagePt.x
      if (pagePt.y > maxY) maxY = pagePt.y
    }
  }
  if (minX === Infinity) return null
  return { height: maxY - minY, minX, minY, width: maxX - minX }
}
