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
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import { useEditorRevision } from './useEditorRevision'

type CanvasNodeEdgeOverlayProps = {
  editor: Editor | null
}

type EdgeView = {
  actionPoint: { x: number; y: number }
  color: string
  edge: NodeRuntimeEdge
  hitPath: string
  path: string
  start: { x: number; y: number }
  target: { x: number; y: number }
}

type BezierControls = [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
]

export function CanvasNodeEdgeOverlay({ editor }: CanvasNodeEdgeOverlayProps) {
  const edges = useNodeEdgeStore((state) => state.edges)
  const removeEdge = useNodeEdgeStore((state) => state.removeEdge)
  const edgeColorMode = useCanvasSettingsStore((state) => state.settings.edgeColorMode)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  useEditorRevision(editor, 'node-geometry')

  if (!editor || edges.length === 0) return null

  const edgeViews = getEdgeViews(editor, edges, edgeColorMode)
  const activeSelectedEdgeId = selectedEdgeId && edges.some((edge) => edge.id === selectedEdgeId)
    ? selectedEdgeId
    : null

  return (
    <div className="node-edge-overlay">
      <svg className="node-edge-overlay__svg">
        {edgeViews.map((view) => (
          <path
            className={`node-edge-overlay__path ${activeSelectedEdgeId === view.edge.id ? 'node-edge-overlay__path--selected' : ''}`}
            d={view.path}
            data-type={view.edge.dataType}
            key={view.edge.id}
            stroke={view.color}
          />
        ))}
        {edgeViews.map((view) => (
          <path
            className="node-edge-overlay__path-hit"
            d={view.hitPath}
            key={`${view.edge.id}-hit`}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setSelectedEdgeId(view.edge.id)
            }}
          />
        ))}
      </svg>
      {edgeViews.map((view) => (
        activeSelectedEdgeId === view.edge.id ? (
          <button
            aria-label="Disconnect selected edge"
            className="node-edge-overlay__hit"
            key={view.edge.id}
            onClick={(event) => {
              event.stopPropagation()
              removeEdge(view.edge.id)
              setSelectedEdgeId(null)
              syncNodeEdgeInputCounts(editor)
            }}
            onPointerDown={(event) => { event.stopPropagation() }}
            style={{
              left: view.actionPoint.x,
              top: view.actionPoint.y,
            }}
            title="Disconnect"
            type="button"
          >
            −
          </button>
        ) : null
      ))}
    </div>
  )
}

function getEdgeViews(editor: Editor, edges: NodeRuntimeEdge[], edgeColorMode: 'follow-handle' | 'standard'): EdgeView[] {
  return edges.flatMap((edge) => {
    const sourcePoint = getPortScreenPoint(editor, edge.sourceShapeId, edge.sourcePortId)
    const targetPoint = getPortScreenPoint(editor, edge.targetShapeId, edge.targetPortId)
    if (!sourcePoint || !targetPoint) return []

    const curveOffset = Math.max(72, Math.abs(targetPoint.x - sourcePoint.x) * 0.45)
    const controls = getBezierControls(sourcePoint, targetPoint, curveOffset)

    return [{
      actionPoint: getBezierPoint(controls, 0.88),
      color: edgeColorMode === 'standard' ? '#64748b' : edge.dataType === 'image' ? '#22c55e' : '#eab308',
      edge,
      hitPath: getBezierSamplePath(controls, 0.16, 0.84, 18),
      path: getBezierPath(controls),
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

function getBezierControls(start: { x: number; y: number }, target: { x: number; y: number }, offset: number): BezierControls {
  return [
    start,
    { x: start.x + offset, y: start.y },
    { x: target.x - offset, y: target.y },
    target,
  ]
}

function getBezierPath([start, first, second, target]: BezierControls) {
  return [
    `M ${start.x} ${start.y}`,
    `C ${first.x} ${first.y}`,
    `${second.x} ${second.y}`,
    `${target.x} ${target.y}`,
  ].join(' ')
}

function getBezierSamplePath(controls: BezierControls, startT: number, endT: number, steps: number) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = startT + ((endT - startT) * index) / steps
    const point = getBezierPoint(controls, t)
    return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  }).join(' ')
}

function getBezierPoint([start, first, second, target]: BezierControls, t: number) {
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
