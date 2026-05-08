import { memo, useMemo } from 'react'
import { Circle, Group, Path } from 'react-konva'
import type { CanvasNodeShape, CanvasPoint } from '@/features/canvas-engine'
import type { NodePortDataType } from '@/types/nodeRuntime'
import { konvaCaptureExcludeName, konvaRuntimeEdgeNodeIdPrefix, konvaRuntimeEdgeNodeName } from './konvaCaptureNames'
import { getKonvaNodePortWorldPoint } from './konvaNodePorts'
import { getKonvaRuntimeEdgePath } from './konvaRuntimeEdgeGeometry'
import type { KonvaRuntimeConnectionPreview, KonvaRuntimeEdge } from './konvaRuntimeEdges'

type KonvaNodeEdgeLayerProps = {
  edges: KonvaRuntimeEdge[]
  preview?: KonvaRuntimeConnectionPreview | null
  selectedEdgeId?: string | null
  shapes: CanvasNodeShape[]
  zoom: number
  onEdgeDisconnect?: (edgeId: string) => void
  onEdgeSelect?: (edgeId: string) => void
}

type EdgeView = {
  color: string
  edgeId: string
  path: string
  start: CanvasPoint
  target: CanvasPoint
}

export const KonvaNodeEdgeLayer = memo(function KonvaNodeEdgeLayer({
  edges,
  onEdgeDisconnect,
  onEdgeSelect,
  preview,
  selectedEdgeId,
  shapes,
  zoom,
}: KonvaNodeEdgeLayerProps) {
  const edgeViews = useMemo(() => getKonvaRuntimeEdgeViews(shapes, edges), [edges, shapes])
  const previewViews = useMemo(() => (
    preview ? getKonvaRuntimePreviewViews(shapes, preview) : []
  ), [preview, shapes])
  const strokeWidth = Math.max(2, 2.5 / getSafeZoom(zoom))
  const hitStrokeWidth = Math.max(14, 18 / getSafeZoom(zoom))
  const endpointRadius = Math.max(3, 4 / getSafeZoom(zoom))
  const previewSnapped = Boolean(preview?.target)

  return (
    <Group>
      {edgeViews.map((view) => (
        <Group id={`${konvaRuntimeEdgeNodeIdPrefix}${view.edgeId}`} key={view.edgeId} name={konvaRuntimeEdgeNodeName}>
          <Path
            data={view.path}
            hitStrokeWidth={hitStrokeWidth}
            lineCap="round"
            lineJoin="round"
            onClick={(event) => {
              event.cancelBubble = true
              onEdgeSelect?.(view.edgeId)
            }}
            onPointerDown={(event) => {
              event.cancelBubble = true
            }}
            shadowBlur={2 / getSafeZoom(zoom)}
            shadowColor="rgba(15, 23, 42, 0.16)"
            shadowOpacity={0.55}
            stroke={view.color}
            strokeWidth={view.edgeId === selectedEdgeId ? strokeWidth * 1.7 : strokeWidth}
          />
          <Circle
            fill="#ffffff"
            radius={endpointRadius}
            stroke={view.color}
            strokeWidth={strokeWidth}
            x={view.target.x}
            y={view.target.y}
          />
        </Group>
      ))}
      {edgeViews.map((view) => {
        if (view.edgeId !== selectedEdgeId) return null
        const actionPoint = getDisconnectPoint(view.start, view.target)
        const size = Math.max(16, 18 / getSafeZoom(zoom))
        return (
          <Group key={`${view.edgeId}:disconnect`} name={konvaCaptureExcludeName}>
            <Circle
              fill="#111827"
              onClick={(event) => {
                event.cancelBubble = true
                onEdgeDisconnect?.(view.edgeId)
              }}
              onPointerDown={(event) => {
                event.cancelBubble = true
              }}
              radius={size / 2}
              x={actionPoint.x}
              y={actionPoint.y}
            />
            <Path
              data={`M ${format(actionPoint.x - size * 0.22)} ${format(actionPoint.y)} L ${format(actionPoint.x + size * 0.22)} ${format(actionPoint.y)}`}
              lineCap="round"
              listening={false}
              stroke="#ffffff"
              strokeWidth={Math.max(2, 2 / getSafeZoom(zoom))}
            />
          </Group>
        )
      })}
      {previewViews.map((previewView) => (
        <Group key={previewView.edgeId} name={konvaCaptureExcludeName}>
          <Path
            dash={previewSnapped ? undefined : [8 / getSafeZoom(zoom), 7 / getSafeZoom(zoom)]}
            data={previewView.path}
            lineCap="round"
            lineJoin="round"
            opacity={previewSnapped ? 0.95 : 0.72}
            stroke={previewView.color}
            strokeWidth={previewSnapped ? strokeWidth * 1.3 : strokeWidth}
          />
          <Circle
            fill={previewView.color}
            opacity={0.82}
            radius={endpointRadius}
            x={previewView.start.x}
            y={previewView.start.y}
          />
          {previewSnapped ? (
            <>
              <Circle
                fill={previewView.color}
                opacity={0.12}
                radius={Math.max(16, 18 / getSafeZoom(zoom))}
                x={previewView.target.x}
                y={previewView.target.y}
              />
              <Circle
                fill="#ffffff"
                radius={Math.max(7, 8 / getSafeZoom(zoom))}
                stroke={previewView.color}
                strokeWidth={Math.max(2, 2.5 / getSafeZoom(zoom))}
                x={previewView.target.x}
                y={previewView.target.y}
              />
            </>
          ) : null}
        </Group>
      ))}
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

export function getKonvaRuntimePreviewViews(
  shapes: CanvasNodeShape[],
  preview: KonvaRuntimeConnectionPreview
): EdgeView[] {
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]))
  const sources = preview.sources?.length ? preview.sources : [preview.source]
  return sources.flatMap((source, index) => {
    const sourceShape = shapeById.get(source.shapeId)
    if (!sourceShape) return []
    const start = getKonvaNodePortWorldPoint(sourceShape, source.portId)
    if (!start) return []
    return [{
      color: getKonvaRuntimeEdgeColor(preview.dataType),
      edgeId: `preview:${index}`,
      path: getKonvaRuntimeEdgePath(start, preview.pointer),
      start,
      target: preview.pointer,
    }]
  })
}

export function getKonvaRuntimeEdgeColor(dataType: NodePortDataType) {
  return dataType === 'image' ? '#22c55e' : '#eab308'
}

function getDisconnectPoint(start: CanvasPoint, target: CanvasPoint): CanvasPoint {
  return {
    x: target.x * 0.78 + start.x * 0.22,
    y: target.y * 0.78 + start.y * 0.22,
  }
}

function getSafeZoom(zoom: number) {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

function format(value: number) {
  return Number(value.toFixed(1))
}
