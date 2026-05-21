import type { CanvasNodeShape, CanvasPoint } from '@/features/canvas-engine'
import { getResolvedNodePorts } from '@/features/node-runtime/registry'
import type { JsonObject, NodePortDataType, NodePortDirection, ResolvedNodePort } from '@/types/nodeRuntime'

export type KonvaNodePortAnchor = {
  dataType: NodePortDataType
  direction: NodePortDirection
  id: string
  label: string
  local: CanvasPoint
  nodeId: string
  port: ResolvedNodePort
  shapeId: string
  world: CanvasPoint
}

export type KonvaNodePortHit = KonvaNodePortAnchor & {
  distance: number
}

type HitTestOptions = {
  dataType?: NodePortDataType
  direction?: NodePortDirection
  excludeShapeId?: string
  maxScreenDistance?: number
}

const defaultMaxScreenDistance = 44

export function getKonvaNodePorts(shape: CanvasNodeShape): KonvaNodePortAnchor[] {
  const data = asJsonObject(shape.props.data)
  return getResolvedNodePorts(shape.props.nodeType, data).map((port) => {
    const local = getLocalPortPoint(shape, port)
    return {
      dataType: port.dataType,
      direction: port.direction,
      id: port.id,
      label: port.label,
      local,
      nodeId: shape.props.nodeId,
      port,
      shapeId: shape.id,
      world: localNodePointToWorld(shape, local),
    }
  })
}

export function getKonvaNodePort(shape: CanvasNodeShape, portId: string): KonvaNodePortAnchor | null {
  return getKonvaNodePorts(shape).find((port) => port.id === portId) ?? null
}

export function getKonvaNodePortWorldPoint(shape: CanvasNodeShape, portId: string): CanvasPoint | null {
  return getKonvaNodePort(shape, portId)?.world ?? null
}

export function hitTestKonvaNodePort(
  shapes: CanvasNodeShape[],
  point: CanvasPoint,
  zoom: number,
  options: HitTestOptions = {}
): KonvaNodePortHit | null {
  const maxDistance = getKonvaNodePortHitWorldRadius(zoom, options.maxScreenDistance)
  const maxDistanceSquared = maxDistance * maxDistance
  let bestHit: KonvaNodePortHit | null = null
  let bestDistanceSquared = Infinity

  for (const shape of shapes) {
    if (shape.id === options.excludeShapeId) continue

    for (const anchor of getKonvaNodePorts(shape)) {
      if (options.direction && anchor.direction !== options.direction) continue
      if (options.dataType && anchor.dataType !== options.dataType) continue

      const distanceSquared = (anchor.world.x - point.x) ** 2 + (anchor.world.y - point.y) ** 2
      if (distanceSquared > maxDistanceSquared || distanceSquared >= bestDistanceSquared) continue

      bestDistanceSquared = distanceSquared
      bestHit = {
        ...anchor,
        distance: Math.sqrt(distanceSquared),
      }
    }
  }

  return bestHit
}

export function getKonvaNodePortHitWorldRadius(zoom: number, maxScreenDistance = defaultMaxScreenDistance) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return maxScreenDistance / safeZoom
}

export function localNodePointToWorld(shape: CanvasNodeShape, point: CanvasPoint): CanvasPoint {
  return {
    x: shape.x + point.x,
    y: shape.y + point.y,
  }
}

function getLocalPortPoint(shape: CanvasNodeShape, port: ResolvedNodePort): CanvasPoint {
  return {
    x: port.direction === 'out' ? shape.props.width : 0,
    y: shape.props.height * port.anchorY,
  }
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}
