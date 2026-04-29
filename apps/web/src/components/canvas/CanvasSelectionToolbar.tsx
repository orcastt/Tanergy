'use client'

import { useState, type SyntheticEvent } from 'react'
import type { Editor, TLShapeId } from 'tldraw'
import { useEditorRevision } from './useEditorRevision'
import { createNodeCard } from '@/features/node-runtime/createNodeCard'

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
  event.stopPropagation()
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
  useEditorRevision(editor)

  const selectedIds = editor?.getSelectedShapeIds() ?? []
  if (!editor || selectedIds.length < 2) return null

  const bounds = getPageBounds(editor, selectedIds)
  if (!bounds) return null
  const screenTopLeft = editor.pageToScreen({ x: bounds.minX, y: bounds.minY })

  const handleScreenshot = async () => {
    setCaptureError(null)
    setIsCapturing(true)
    try {
      await editor.toImageDataUrl(selectedIds, {
        background: false,
        format: 'png',
        padding: 0,
        pixelRatio: 1,
      })
      createNodeCard(editor, {
        type: 'image',
        x: bounds.minX,
        y: bounds.minY + bounds.height + 30,
      })
    } catch {
      setCaptureError('Capture failed.')
    } finally {
      setIsCapturing(false)
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
      onPointerDown={stopEvent}
      onWheel={stopEvent}
      style={{ left: screenTopLeft.x, top: screenTopLeft.y - 44 }}
    >
      <button className="selection-toolbar__btn" disabled={isCapturing} onClick={handleScreenshot} title="Screenshot" type="button">
        📷
      </button>

      <div className="selection-toolbar__separator" />

      <div className="selection-toolbar__align-wrapper">
        <button className="selection-toolbar__btn" onClick={() => setShowAlign(!showAlign)} title="Align" type="button">
          ⊞
        </button>
        {showAlign ? (
          <div className="selection-toolbar__align-dropdown">
            {alignOptions.map((opt) => (
              <button
                className="selection-toolbar__align-item"
                key={opt.value}
                onClick={() => handleAlign(opt.value)}
                title={opt.label}
                type="button"
              >
                {opt.icon} <span>{opt.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {captureError ? <span className="selection-toolbar__error">{captureError}</span> : null}
    </div>
  )
}
