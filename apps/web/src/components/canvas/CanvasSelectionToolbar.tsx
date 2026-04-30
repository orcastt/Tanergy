'use client'

import { useState, type SyntheticEvent } from 'react'
import type { Editor, TLShapeId } from 'tldraw'
import { useEditorRevision } from './useEditorRevision'
import { useEditorInteractionState } from './useEditorInteractionState'
import {
  createImageNodeFromCanvasImage,
  createImageNodeFromDataUrl,
  isCanvasImageShape,
} from '@/features/node-runtime/imageNodeAssets'

type CanvasSelectionToolbarProps = {
  editor: Editor | null
}

type AlignOption = {
  icon: string
  label: string
  value: string
}

const alignOptions: AlignOption[] = [
  { icon: '↑', label: 'Top', value: 'top' },
  { icon: '↓', label: 'Bottom', value: 'bottom' },
  { icon: '←', label: 'Left', value: 'left' },
  { icon: '→', label: 'Right', value: 'right' },
  { icon: '⊞', label: 'Center', value: 'center' },
]

function stopEvent(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function clearBrowserSelection() {
  window.getSelection()?.removeAllRanges()
}

function getPageBounds(editor: Editor, ids: TLShapeId[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
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

function getSingleBounds(editor: Editor, id: TLShapeId) {
  const shape = editor.getShape(id)
  if (!shape) return null
  const transform = editor.getShapePageTransform(id)
  if (!transform) return null
  const geo = editor.getShapeGeometry(shape)
  const topLeft = transform.applyToPoint({ x: geo.bounds.minX, y: geo.bounds.minY })
  return { height: geo.bounds.height, minX: topLeft.x, minY: topLeft.y, width: geo.bounds.width }
}

export function CanvasSelectionToolbar({ editor }: CanvasSelectionToolbarProps) {
  const [showAlign, setShowAlign] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const interaction = useEditorInteractionState(editor)
  useEditorRevision(editor, 'selection')

  const selectedIds = editor?.getSelectedShapeIds() ?? []
  if (!editor || selectedIds.length === 0) return null
  if (interaction.isDragging || interaction.isPanning || interaction.cameraState === 'moving') return null

  const selectedImageIds = selectedIds.filter((id) => isCanvasImageShape(editor.getShape(id)))
  const canAlign = selectedIds.length >= 2
  const canCapture = selectedIds.length >= 2
  const canConvertToImageNode = selectedImageIds.length > 0
  if (!canCapture && !canConvertToImageNode) return null

  const bounds = getPageBounds(editor, selectedIds)
  if (!bounds) return null
  const screenTopLeft = editor.pageToScreen({ x: bounds.minX, y: bounds.minY })

  const handleScreenshot = async () => {
    if (!canCapture) return
    clearBrowserSelection()
    setCaptureError(null)
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

  const handleAlign = (option: string) => {
    setShowAlign(false)
    const shapes = selectedIds.map((id) => editor.getShape(id)!).filter(Boolean)
    if (shapes.length < 2) return
    const bBoxes = shapes.map((s) => getSingleBounds(editor, s.id))
    if (bBoxes.some((b) => !b)) return

    switch (option) {
      case 'top': {
        const minY = Math.min(...bBoxes.map((b) => b!.minY))
        shapes.forEach((s) => editor.updateShape({ id: s.id, type: s.type, x: s.x, y: minY }))
        break
      }
      case 'bottom': {
        const maxBottom = Math.max(...bBoxes.map((b) => b!.minY + b!.height))
        shapes.forEach((s, idx) => editor.updateShape({ id: s.id, type: s.type, x: s.x, y: maxBottom - bBoxes[idx]!.height }))
        break
      }
      case 'left': {
        const minX = Math.min(...bBoxes.map((b) => b!.minX))
        shapes.forEach((s) => editor.updateShape({ id: s.id, type: s.type, x: minX, y: s.y }))
        break
      }
      case 'right': {
        const maxRight = Math.max(...bBoxes.map((b) => b!.minX + b!.width))
        shapes.forEach((s, idx) => editor.updateShape({ id: s.id, type: s.type, x: maxRight - bBoxes[idx]!.width, y: s.y }))
        break
      }
      case 'center': {
        const avgCx = bBoxes.reduce((s, b) => s + b!.minX + b!.width / 2, 0) / bBoxes.length
        const avgCy = bBoxes.reduce((s, b) => s + b!.minY + b!.height / 2, 0) / bBoxes.length
        shapes.forEach((s, idx) => editor.updateShape({ id: s.id, type: s.type, x: avgCx - bBoxes[idx]!.width / 2, y: avgCy - bBoxes[idx]!.height / 2 }))
        break
      }
    }
  }

  return (
    <div
      className="selection-toolbar"
      onDoubleClick={stopEvent}
      onMouseDown={stopEvent}
      onPointerDown={stopEvent}
      onWheel={stopEvent}
      style={{ left: screenTopLeft.x, top: screenTopLeft.y - 44 }}
    >
      {canConvertToImageNode ? (
        <button
          className="selection-toolbar__btn"
          onClick={() => void handleConvertToImageNode()}
          onMouseDown={stopEvent}
          onPointerDown={stopEvent}
          title="Convert to image node"
          type="button"
        >
          ▣
        </button>
      ) : null}

      {canCapture ? (
        <button
          className="selection-toolbar__btn"
          disabled={isCapturing}
          onClick={() => void handleScreenshot()}
          onMouseDown={stopEvent}
          onPointerDown={stopEvent}
          title="Screenshot"
          type="button"
        >
          📷
        </button>
      ) : null}

      {canAlign ? (
        <>
          <div className="selection-toolbar__separator" />

          <div className="selection-toolbar__align-wrapper">
            <button
              className="selection-toolbar__btn"
              onClick={() => setShowAlign(!showAlign)}
              onMouseDown={stopEvent}
              onPointerDown={stopEvent}
              title="Align"
              type="button"
            >
              ⊞
            </button>
            {showAlign ? (
              <div className="selection-toolbar__align-dropdown">
                {alignOptions.map((opt) => (
                  <button
                    className="selection-toolbar__align-item"
                    key={opt.value}
                    onClick={() => handleAlign(opt.value)}
                    onMouseDown={stopEvent}
                    onPointerDown={stopEvent}
                    title={opt.label}
                    type="button"
                  >
                    {opt.icon} <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {captureError ? <span className="selection-toolbar__error">{captureError}</span> : null}
    </div>
  )
}
