import { memo, useMemo } from 'react'
import { Circle, Group, Path } from 'react-konva'
import type { CanvasNodeShape, CanvasPoint } from '@/features/canvas-engine'
import type { BoardCollaborationConnectionPreview } from '@/features/boards/boardCollaborationTypes'
import { getCollaborationAccent } from '@/features/collaboration/collaborationAccent'
import type { NodePortDataType } from '@/types/nodeRuntime'
import { konvaCaptureExcludeName, konvaRuntimeEdgeNodeIdPrefix, konvaRuntimeEdgeNodeName } from './konvaCaptureNames'
import { getKonvaNodePortWorldPoint } from './konvaNodePorts'
import { getKonvaRuntimeEdgePath } from './konvaRuntimeEdgeGeometry'
import type { KonvaRuntimeConnectionPreview, KonvaRuntimeEdge } from './konvaRuntimeEdges'

export type KonvaCollaborationEdgeSession = {
  clientInstanceId: string
  connectionPreview?: BoardCollaborationConnectionPreview | null
  displayName: string
  selectedEdgeId?: string | null
  sessionId: string
}

type KonvaNodeEdgeLayerProps = {
  collaborationSessions?: readonly KonvaCollaborationEdgeSession[]
  edges: KonvaRuntimeEdge[]
  interactive?: boolean
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

type CollaborationEdgeView = EdgeView & {
  accent: string
  key: string
}

type CollaborationPreviewView = CollaborationEdgeView & {
  snapped: boolean
  targetPoint: CanvasPoint | null
}

export const KonvaNodeEdgeLayer = memo(function KonvaNodeEdgeLayer({
  collaborationSessions = [],
  edges,
  interactive = true,
  onEdgeDisconnect,
  onEdgeSelect,
  preview,
  selectedEdgeId,
  shapes,
  zoom,
}: KonvaNodeEdgeLayerProps) {
  const shapeById = useMemo(() => new Map(shapes.map((shape) => [shape.id, shape])), [shapes])
  const edgeViews = useMemo(() => getKonvaRuntimeEdgeViews(shapes, edges), [edges, shapes])
  const collaborationSelectedEdgeViews = useMemo(() => {
    const edgeViewById = new Map(edgeViews.map((view) => [view.edgeId, view]))
    return collaborationSessions.flatMap((session) => {
      const edgeId = session.selectedEdgeId?.trim()
      if (!edgeId) return []
      const view = edgeViewById.get(edgeId)
      if (!view) return []
      return [{
        ...view,
        accent: getCollaborationAccent(session.clientInstanceId),
        key: `${session.sessionId}:${edgeId}`,
      } satisfies CollaborationEdgeView]
    })
  }, [collaborationSessions, edgeViews])
  const collaborationPreviewViews = useMemo(() => (
    collaborationSessions.flatMap((session) => getKonvaCollaborationPreviewViews(shapeById, session))
  ), [collaborationSessions, shapeById])
  const previewViews = useMemo(() => (
    preview ? getKonvaRuntimePreviewViews(shapes, preview) : []
  ), [preview, shapes])
  const strokeWidth = Math.max(2, 2.5 / getSafeZoom(zoom))
  const hitStrokeWidth = Math.max(14, 18 / getSafeZoom(zoom))
  const endpointRadius = Math.max(3, 4 / getSafeZoom(zoom))
  const previewSnapped = Boolean(preview?.target)

  return (
    <Group listening={interactive}>
      {collaborationSelectedEdgeViews.map((view) => (
        <Group key={`remote-edge:${view.key}`} listening={false} name={konvaCaptureExcludeName}>
          <Path
            dash={[8 / getSafeZoom(zoom), 7 / getSafeZoom(zoom)]}
            data={view.path}
            lineCap="round"
            lineJoin="round"
            opacity={0.8}
            shadowBlur={3 / getSafeZoom(zoom)}
            shadowColor={view.accent}
            shadowOpacity={0.32}
            stroke={view.accent}
            strokeWidth={strokeWidth * 2.1}
          />
          <Circle
            fill="#ffffff"
            opacity={0.96}
            radius={endpointRadius * 1.15}
            stroke={view.accent}
            strokeWidth={Math.max(2, strokeWidth)}
            x={view.target.x}
            y={view.target.y}
          />
        </Group>
      ))}
      {edgeViews.map((view) => (
        <Group id={`${konvaRuntimeEdgeNodeIdPrefix}${view.edgeId}`} key={view.edgeId} name={konvaRuntimeEdgeNodeName}>
          <Path
            data={view.path}
            hitStrokeWidth={hitStrokeWidth}
            lineCap="round"
            lineJoin="round"
            onClick={interactive ? (event) => {
              event.cancelBubble = true
              onEdgeSelect?.(view.edgeId)
            } : undefined}
            onPointerDown={interactive ? (event) => {
              event.cancelBubble = true
            } : undefined}
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
              onClick={interactive ? (event) => {
                event.cancelBubble = true
                onEdgeDisconnect?.(view.edgeId)
              } : undefined}
              onPointerDown={interactive ? (event) => {
                event.cancelBubble = true
              } : undefined}
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
      {collaborationPreviewViews.map((previewView) => (
        <Group key={previewView.key} listening={false} name={konvaCaptureExcludeName}>
          <Path
            dash={previewView.snapped ? undefined : [8 / getSafeZoom(zoom), 7 / getSafeZoom(zoom)]}
            data={previewView.path}
            lineCap="round"
            lineJoin="round"
            opacity={previewView.snapped ? 0.92 : 0.68}
            shadowBlur={2 / getSafeZoom(zoom)}
            shadowColor={previewView.accent}
            shadowOpacity={0.24}
            stroke={previewView.accent}
            strokeWidth={previewView.snapped ? strokeWidth * 1.35 : strokeWidth}
          />
          <Circle
            fill={previewView.accent}
            opacity={0.82}
            radius={endpointRadius}
            x={previewView.start.x}
            y={previewView.start.y}
          />
          {previewView.snapped && previewView.targetPoint ? (
            <>
              <Circle
                fill={previewView.accent}
                opacity={0.12}
                radius={Math.max(16, 18 / getSafeZoom(zoom))}
                x={previewView.targetPoint.x}
                y={previewView.targetPoint.y}
              />
              <Circle
                fill="#ffffff"
                radius={Math.max(7, 8 / getSafeZoom(zoom))}
                stroke={previewView.accent}
                strokeWidth={Math.max(2, 2.5 / getSafeZoom(zoom))}
                x={previewView.targetPoint.x}
                y={previewView.targetPoint.y}
              />
            </>
          ) : null}
        </Group>
      ))}
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

function getKonvaCollaborationPreviewViews(
  shapeById: Map<string, CanvasNodeShape>,
  session: KonvaCollaborationEdgeSession,
): CollaborationPreviewView[] {
  const preview = session.connectionPreview
  if (!preview) return []
  const targetShape = preview.target ? shapeById.get(preview.target.shapeId) : null
  const sources = preview.sources?.length ? preview.sources : [preview.source]
  const targetPoint = targetShape && preview.target
    ? getKonvaNodePortWorldPoint(targetShape, preview.target.portId)
    : null
  const accent = getCollaborationAccent(session.clientInstanceId)
  return sources.flatMap((source, index) => {
    const sourceShape = shapeById.get(source.shapeId)
    if (!sourceShape) return []
    const start = getKonvaNodePortWorldPoint(sourceShape, source.portId)
    if (!start) return []
    const target = targetPoint ?? preview.pointer
    return [{
      accent,
      color: accent,
      edgeId: `remote-preview:${session.sessionId}:${index}`,
      key: `remote-preview:${session.sessionId}:${index}`,
      path: getKonvaRuntimeEdgePath(start, target),
      snapped: Boolean(targetPoint),
      start,
      target,
      targetPoint,
    }]
  })
}
