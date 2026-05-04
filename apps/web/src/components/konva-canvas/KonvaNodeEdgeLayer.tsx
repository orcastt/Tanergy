import { memo, useMemo } from 'react'
import { Circle, Group, Path } from 'react-konva'
import type { CanvasNodeShape, CanvasPoint } from '@/features/canvas-engine'
import type { NodePortDataType } from '@/types/nodeRuntime'
import { getKonvaNodePortWorldPoint } from './konvaNodePorts'
import type { KonvaRuntimeConnectionPreview, KonvaRuntimeEdge } from './konvaRuntimeEdges'

type KonvaNodeEdgeLayerProps = {
  edges: KonvaRuntimeEdge[]
  preview?: KonvaRuntimeConnectionPreview | null
  shapes: CanvasNodeShape[]
  zoom: number
}

type EdgeView = {
  color: string
  edgeId: string
  path: string
  start: CanvasPoint
  target: CanvasPoint
}

type BezierControls = [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint]

export const KonvaNodeEdgeLayer = memo(function KonvaNodeEdgeLayer({
  edges,
  preview,
  shapes,
  zoom,
}: KonvaNodeEdgeLayerProps) {
  const edgeViews = useMemo(() => getKonvaRuntimeEdgeViews(shapes, edges), [edges, shapes])
  const previewView = useMemo(() => (
    preview ? getKonvaRuntimePreviewView(shapes, preview) : null
  ), [preview, shapes])
  const strokeWidth = Math.max(2, 2.5 / getSafeZoom(zoom))
  const hitStrokeWidth = Math.max(14, 18 / getSafeZoom(zoom))
  const endpointRadius = Math.max(3, 4 / getSafeZoom(zoom))

  return (
    <Group listening={false}>
      {edgeViews.map((view) => (
        <Path
          data={view.path}
          hitStrokeWidth={hitStrokeWidth}
          key={view.edgeId}
          lineCap="round"
          lineJoin="round"
          shadowBlur={2 / getSafeZoom(zoom)}
          shadowColor="rgba(15, 23, 42, 0.16)"
          shadowOpacity={0.55}
          stroke={view.color}
          strokeWidth={strokeWidth}
        />
      ))}
      {edgeViews.map((view) => (
        <Circle
          fill="#ffffff"
          key={`${view.edgeId}:target`}
          radius={endpointRadius}
          stroke={view.color}
          strokeWidth={strokeWidth}
          x={view.target.x}
          y={view.target.y}
        />
      ))}
      {previewView ? (
        <>
          <Path
            dash={[8 / getSafeZoom(zoom), 7 / getSafeZoom(zoom)]}
            data={previewView.path}
            lineCap="round"
            lineJoin="round"
            opacity={0.72}
            stroke={previewView.color}
            strokeWidth={strokeWidth}
          />
          <Circle
            fill={previewView.color}
            opacity={0.82}
            radius={endpointRadius}
            x={previewView.start.x}
            y={previewView.start.y}
          />
        </>
      ) : null}
    </Group>
  )
})

export function getKonvaRuntimeEdgeViews(shapes: CanvasNodeShape[], edges: KonvaRuntimeEdge[]): EdgeView[] {
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]))
  return edges.flatMap((edge) => {
    const sourceShape = shapeById.get(edge.sourceShapeId)
    const targetShape = shapeById.get(edge.targetShapeId)
    if (!sourceShape || !targetShape) return []

    const start = getKonvaNodePortWorldPoint(sourceShape, edge.sourcePortId)
    const target = getKonvaNodePortWorldPoint(targetShape, edge.targetPortId)
    if (!start || !target) return []

    return [{
      color: getKonvaRuntimeEdgeColor(edge.dataType),
      edgeId: edge.id,
      path: getKonvaRuntimeEdgePath(start, target),
      start,
      target,
    }]
  })
}

export function getKonvaRuntimePreviewView(
  shapes: CanvasNodeShape[],
  preview: KonvaRuntimeConnectionPreview
): EdgeView | null {
  const sourceShape = shapes.find((shape) => shape.id === preview.source.shapeId)
  if (!sourceShape) return null

  const start = getKonvaNodePortWorldPoint(sourceShape, preview.source.portId)
  if (!start) return null

  return {
    color: getKonvaRuntimeEdgeColor(preview.dataType),
    edgeId: 'preview',
    path: getKonvaRuntimeEdgePath(start, preview.pointer),
    start,
    target: preview.pointer,
  }
}

export function getKonvaRuntimeEdgeColor(dataType: NodePortDataType) {
  return dataType === 'image' ? '#22c55e' : '#eab308'
}

export function getKonvaRuntimeEdgePath(start: CanvasPoint, target: CanvasPoint) {
  return getBezierPath(getKonvaRuntimeEdgeControls(start, target))
}

function getKonvaRuntimeEdgeControls(start: CanvasPoint, target: CanvasPoint): BezierControls {
  const distanceX = Math.abs(target.x - start.x)
  const distanceY = Math.abs(target.y - start.y)
  const offset = Math.max(56, Math.min(180, distanceX * 0.5 + distanceY * 0.12))
  return [
    start,
    { x: start.x + offset, y: start.y },
    { x: target.x - offset, y: target.y },
    target,
  ]
}

function getBezierPath([start, first, second, target]: BezierControls) {
  return [
    `M ${format(start.x)} ${format(start.y)}`,
    `C ${format(first.x)} ${format(first.y)}`,
    `${format(second.x)} ${format(second.y)}`,
    `${format(target.x)} ${format(target.y)}`,
  ].join(' ')
}

function getSafeZoom(zoom: number) {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

function format(value: number) {
  return Number(value.toFixed(1))
}
