'use client'

import { useEffect, useReducer } from 'react'
import type { Editor, TLArrowShape, TLShapeId } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { getArrowTerminalPagePoint } from './useArrowPortSnapping'
import { useEditorRevision } from './useEditorRevision'

type CanvasConnectionCutOverlayProps = {
  editor: Editor | null
}

type CutButton = {
  arrowId: TLShapeId
  x: number
  y: number
}

const cutHoverScreenDistance = 22

export function CanvasConnectionCutOverlay({ editor }: CanvasConnectionCutOverlayProps) {
  const [, bumpPointerRevision] = useReducer((revision: number) => revision + 1, 0)
  useEditorRevision(editor)

  useEffect(() => {
    if (!editor) return
    const updateOverlay = () => bumpPointerRevision()
    editor.on('event', updateOverlay)
    editor.on('resize', updateOverlay)
    return () => {
      editor.off('event', updateOverlay)
      editor.off('resize', updateOverlay)
    }
  }, [editor])

  if (!editor) return null

  const buttons = getConnectionCutButtons(editor)
  if (buttons.length === 0) return null

  return (
    <div className="connection-cut-overlay" aria-hidden>
      {buttons.map((button) => (
        <button
          aria-label="Disconnect"
          key={button.arrowId}
          onClick={(event) => {
            event.stopPropagation()
            editor.deleteShapes([button.arrowId])
          }}
          style={{ left: button.x, top: button.y }}
          title="Disconnect"
          type="button"
        >
          −
        </button>
      ))}
    </div>
  )
}

function getConnectionCutButtons(editor: Editor): CutButton[] {
  return editor
    .getCurrentPageShapes()
    .filter((shape): shape is TLArrowShape => shape.type === 'arrow')
    .flatMap((arrow) => {
      const bindings = editor.getBindingsFromShape(arrow.id, 'arrow')
      const startBinding = bindings.find((binding) => binding.props.terminal === 'start')
      const endBinding = bindings.find((binding) => binding.props.terminal === 'end')
      if (!startBinding || !endBinding) return []

      const source = editor.getShape<NodeCardShape>(startBinding.toId)
      const target = editor.getShape<NodeCardShape>(endBinding.toId)
      if (!isNodeCard(source) || !isNodeCard(target)) return []

      const start = getArrowTerminalPagePoint(editor, arrow, 'start')
      const end = getArrowTerminalPagePoint(editor, arrow, 'end')
      if (!start || !end) return []
      if (!shouldShowCutButton(editor, arrow, start, end)) return []

      const screenPoint = editor.pageToScreen({
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      })

      return [{ arrowId: arrow.id, x: screenPoint.x, y: screenPoint.y }]
    })
}

function shouldShowCutButton(
  editor: Editor,
  arrow: TLArrowShape,
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  if (editor.getSelectedShapeIds().includes(arrow.id)) return true

  const point = editor.inputs.getCurrentPagePoint()
  const distance = distanceToSegment(point, start, end)
  return distance <= cutHoverScreenDistance / editor.getZoomLevel()
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const lengthSquared = segmentX * segmentX + segmentY * segmentY
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)

  const amount = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared)
  )
  const projection = {
    x: start.x + amount * segmentX,
    y: start.y + amount * segmentY,
  }

  return Math.hypot(point.x - projection.x, point.y - projection.y)
}

function isNodeCard(shape: unknown): shape is NodeCardShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'node_card')
}
