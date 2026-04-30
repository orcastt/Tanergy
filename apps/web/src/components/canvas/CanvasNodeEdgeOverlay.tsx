'use client'

import { useState } from 'react'
import type { Editor, TLShapeId } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject } from '@/types/nodeRuntime'
import { getResolvedNodePorts } from '@/features/node-runtime/registry'
import {
  syncNodeEdgeInputCounts,
  useNodeEdgeStore,
  type NodeRuntimeEdge,
} from '@/features/node-runtime/nodeEdges'
import { useEditorRevision } from './useEditorRevision'

type CanvasNodeEdgeOverlayProps = {
  editor: Editor | null
}

type EdgeView = {
  color: string
  edge: NodeRuntimeEdge
  midpoint: { x: number; y: number }
  path: string
  start: { x: number; y: number }
  target: { x: number; y: number }
}

export function CanvasNodeEdgeOverlay({ editor }: CanvasNodeEdgeOverlayProps) {
  const edges = useNodeEdgeStore((state) => state.edges)
  const removeEdge = useNodeEdgeStore((state) => state.removeEdge)
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null)
  useEditorRevision(editor)

  if (!editor || edges.length === 0) return null

  const edgeViews = getEdgeViews(editor, edges)

  return (
    <div className="node-edge-overlay" aria-hidden>
      <svg className="node-edge-overlay__svg">
        {edgeViews.map((view) => (
          <path
            className="node-edge-overlay__path"
            d={view.path}
            data-type={view.edge.dataType}
            key={view.edge.id}
            stroke={view.color}
          />
        ))}
        {edgeViews.map((view) => (
          <path
            className="node-edge-overlay__path-hit"
            d={view.path}
            key={`${view.edge.id}-hit`}
            onPointerEnter={() => setHoverEdgeId(view.edge.id)}
            onPointerLeave={() => setHoverEdgeId(null)}
          />
        ))}
      </svg>
      {edgeViews.map((view) => (
        <button
          className="node-edge-overlay__hit"
          key={view.edge.id}
          onClick={(event) => {
            event.stopPropagation()
            removeEdge(view.edge.id)
            syncNodeEdgeInputCounts(editor)
          }}
          onPointerEnter={() => setHoverEdgeId(view.edge.id)}
          onPointerLeave={() => setHoverEdgeId(null)}
          style={{
            left: view.midpoint.x,
            opacity: hoverEdgeId === view.edge.id ? 1 : 0,
            pointerEvents: hoverEdgeId === view.edge.id ? 'auto' : 'none',
            top: view.midpoint.y,
          }}
          title="Disconnect"
          type="button"
        >
          −
        </button>
      ))}
    </div>
  )
}

function getEdgeViews(editor: Editor, edges: NodeRuntimeEdge[]): EdgeView[] {
  return edges.flatMap((edge) => {
    const sourcePoint = getPortScreenPoint(editor, edge.sourceShapeId, edge.sourcePortId)
    const targetPoint = getPortScreenPoint(editor, edge.targetShapeId, edge.targetPortId)
    if (!sourcePoint || !targetPoint) return []

    const curveOffset = Math.max(72, Math.abs(targetPoint.x - sourcePoint.x) * 0.45)
    const path = [
      `M ${sourcePoint.x} ${sourcePoint.y}`,
      `C ${sourcePoint.x + curveOffset} ${sourcePoint.y}`,
      `${targetPoint.x - curveOffset} ${targetPoint.y}`,
      `${targetPoint.x} ${targetPoint.y}`,
    ].join(' ')

    return [{
      color: edge.dataType === 'image' ? '#22c55e' : '#eab308',
      edge,
      midpoint: getBezierMidpoint(sourcePoint, targetPoint, curveOffset),
      path,
      start: sourcePoint,
      target: targetPoint,
    }]
  })
}

function getPortScreenPoint(editor: Editor, shapeId: string, portId: string) {
  const shape = editor.getShape<NodeCardShape>(shapeId as TLShapeId)
  if (!isNodeCard(shape)) return null

  const data = asJsonObject(shape.props.data)
  const port = getResolvedNodePorts(shape.props.nodeType, data).find((item) => item.id === portId)
  if (!port) return null

  const transform = editor.getShapePageTransform(shape.id)
  if (!transform) return null
  const pagePoint = transform.applyToPoint({
    x: port.direction === 'out' ? shape.props.w : 0,
    y: shape.props.h * port.anchorY,
  })
  return editor.pageToScreen(pagePoint)
}

function getBezierMidpoint(start: { x: number; y: number }, target: { x: number; y: number }, offset: number) {
  const first = { x: start.x + offset, y: start.y }
  const second = { x: target.x - offset, y: target.y }
  const t = 0.5
  const x =
    (1 - t) ** 3 * start.x +
    3 * (1 - t) ** 2 * t * first.x +
    3 * (1 - t) * t ** 2 * second.x +
    t ** 3 * target.x
  const y =
    (1 - t) ** 3 * start.y +
    3 * (1 - t) ** 2 * t * first.y +
    3 * (1 - t) * t ** 2 * second.y +
    t ** 3 * target.y
  return { x, y }
}

function isNodeCard(shape: unknown): shape is NodeCardShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'node_card')
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}
