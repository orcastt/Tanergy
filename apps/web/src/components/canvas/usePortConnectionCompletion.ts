'use client'

import { useEffect } from 'react'
import { type Editor, type TLShapeId } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { validateNodeConnection } from '@/features/node-runtime/connectionRules'
import { getResolvedNodePorts } from '@/features/node-runtime/registry'
import type { JsonObject, NodePortDataType, ResolvedNodePort } from '@/types/nodeRuntime'
import { syncNodeEdgeInputCounts, useNodeEdgeStore } from '@/features/node-runtime/nodeEdges'

type ConnectionFrom = {
  pagePoint: { x: number; y: number }
  portDataType: 'image' | 'text'
  portDirection: 'in' | 'out'
  portId: string
  shapeId: string
}

type CompleteDetail = {
  from: ConnectionFrom | null
  targetPortId?: string
  targetScreenPoint?: { x: number; y: number }
  targetShapeId?: string
}

type PortTarget = {
  pagePoint: { x: number; y: number }
  port: ResolvedNodePort
  shape: NodeCardShape
}

type ConnectionEvent = {
  text: string
  tone: 'error' | 'success'
}

export function usePortConnectionCompletion(editor: Editor | null, onEvent: (event: ConnectionEvent) => void) {
  useEffect(() => {
    if (!editor) return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CompleteDetail>).detail
      completeConnection(editor, detail, onEvent)
    }
    window.addEventListener('port:complete', handler)
    return () => { window.removeEventListener('port:complete', handler) }
  }, [editor, onEvent])
}

function completeConnection(editor: Editor, detail: CompleteDetail, onEvent: (event: ConnectionEvent) => void) {
  const { from } = detail
  if (!from) return

  const sourceShape = editor.getShape<NodeCardShape>(from.shapeId as TLShapeId)
  if (!isNodeCard(sourceShape)) return

  const sourceData = asJsonObject(sourceShape.props.data)
  const sourcePorts = getResolvedNodePorts(sourceShape.props.nodeType, sourceData)
  const sourcePort = sourcePorts.find((p) => p.id === from.portId)
  if (!sourcePort) return

  const target = getConnectionTarget(editor, detail, from)
  if (!target) return

  const result = validateNodeConnection(sourceShape, sourcePort, target.shape, target.port)
  if (!result.valid || !result.dataType) {
    onEvent({ text: result.reason, tone: 'error' })
    return
  }

  const existingEdges = useNodeEdgeStore.getState().edges
  if (existingEdges.some((edge) => (
    edge.targetShapeId === target.shape.id &&
    edge.targetPortId === target.port.id
  ))) {
    onEvent({ text: `Input already connected: ${target.port.label}`, tone: 'error' })
    return
  }

  useNodeEdgeStore.getState().addEdge({
    dataType: result.dataType,
    sourcePortId: sourcePort.id,
    sourceShapeId: sourceShape.id,
    targetPortId: target.port.id,
    targetShapeId: target.shape.id,
  })
  syncNodeEdgeInputCounts(editor)
  onEvent({ text: result.reason, tone: 'success' })
}

function getConnectionTarget(editor: Editor, detail: CompleteDetail, from: ConnectionFrom): PortTarget | null {
  const exactTarget = getExactDomTarget(editor, detail)
  if (exactTarget) return exactTarget
  if (!detail.targetScreenPoint) return null

  const pointerPagePoint = editor.screenToPage(detail.targetScreenPoint)
  return findNearestInputPort(editor, pointerPagePoint, {
    sourceShapeId: from.shapeId,
    sourceType: from.portDataType,
  })
}

function getExactDomTarget(editor: Editor, detail: CompleteDetail): PortTarget | null {
  const targetFromDetail = getPortTargetFromIds(editor, detail.targetShapeId, detail.targetPortId)
  if (targetFromDetail) return targetFromDetail
  if (!detail.targetScreenPoint) return null

  const element = document.elementFromPoint(detail.targetScreenPoint.x, detail.targetScreenPoint.y)
  const portElement = element?.closest('[data-port-id]') as HTMLElement | null
  if (!portElement || portElement.dataset.portDirection !== 'in') return null

  return getPortTargetFromIds(editor, portElement.dataset.shapeId, portElement.dataset.portId)
}

function getPortTargetFromIds(editor: Editor, shapeId?: string, portId?: string): PortTarget | null {
  if (!shapeId || !portId) return null
  const shape = editor.getShape<NodeCardShape>(shapeId as TLShapeId)
  if (!isNodeCard(shape)) return null

  const data = asJsonObject(shape.props.data)
  const port = getResolvedNodePorts(shape.props.nodeType, data).find((item) => item.id === portId)
  if (!port || port.direction !== 'in') return null

  const pagePoint = getPortPagePoint(editor, shape, port)
  return pagePoint ? { pagePoint, port, shape } : null
}

function findNearestInputPort(
  editor: Editor,
  pointerPagePoint: { x: number; y: number },
  options: { sourceShapeId: string; sourceType: NodePortDataType }
): PortTarget | null {
  const maxDistance = 96 / editor.getZoomLevel()
  const maxDistanceSquared = maxDistance * maxDistance
  let bestTarget: PortTarget | null = null
  let bestDistance = Infinity

  for (const shape of [...editor.getCurrentPageShapesSorted()].reverse()) {
    if (!isNodeCard(shape) || shape.id === options.sourceShapeId) continue

    const data = asJsonObject(shape.props.data)
    const ports = getResolvedNodePorts(shape.props.nodeType, data).filter((port) => (
      port.direction === 'in' && port.dataType === options.sourceType
    ))
    for (const port of ports) {
      const pagePoint = getPortPagePoint(editor, shape, port)
      if (!pagePoint) continue

      const distance = (pagePoint.x - pointerPagePoint.x) ** 2 + (pagePoint.y - pointerPagePoint.y) ** 2
      const typePenalty = port.dataType === options.sourceType ? 0 : maxDistanceSquared
      const weightedDistance = distance + typePenalty
      if (distance <= maxDistanceSquared && weightedDistance < bestDistance) {
        bestDistance = weightedDistance
        bestTarget = { pagePoint, port, shape }
      }
    }
  }

  return bestTarget
}

function getPortPagePoint(editor: Editor, shape: NodeCardShape, port: ResolvedNodePort) {
  const transform = editor.getShapePageTransform(shape.id)
  if (!transform) return null
  return transform.applyToPoint({
    x: port.direction === 'out' ? shape.props.w : 0,
    y: shape.props.h * port.anchorY,
  })
}

function isNodeCard(shape: unknown): shape is NodeCardShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'node_card')
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as unknown as JsonObject) : {}
}
