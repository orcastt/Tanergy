import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import {
  pointerToWorld,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasNodeShape,
  type CanvasPoint,
} from '@/features/canvas-engine'
import { maxChatInputPorts, maxImageInputPorts, maxTextInputPorts } from '@/features/node-runtime/registry'
import type { NodePortDataType } from '@/types/nodeRuntime'
import { getKonvaNodePort, hitTestKonvaNodePort } from './konvaNodePorts'
import { addKonvaRuntimeEdge, addKonvaRuntimeEdges, type KonvaRuntimeConnectionEndpoint, type KonvaRuntimeConnectionPreview } from './konvaRuntimeEdges'
import type { KonvaToolSession } from './konvaCanvasTypes'
import { getStagePointer } from './konvaStageHelpers'

type UseKonvaNodeConnectionSessionOptions = {
  cameraRef: { current: CanvasCamera }
  documentRef: { current: CanvasDocument }
  stageRef: RefObject<Konva.Stage | null>
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
  selectedIds: string[]
}

export function useKonvaNodeConnectionSession({
  cameraRef,
  documentRef,
  onDocumentChange,
  onHistoryCheckpoint,
  onSelectionChange,
  selectedIds,
  stageRef,
}: UseKonvaNodeConnectionSessionOptions) {
  const [runtimeConnectionPreview, setRuntimeConnectionPreview] = useState<KonvaRuntimeConnectionPreview | null>(null)

  const handleNodePortPointerDown = useCallback((shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true
    event.evt.preventDefault()
    if (event.evt.button !== 0) return null
    const nodeShape = getNodeShape(documentRef.current.shapes, shapeId)
    if (!nodeShape || nodeShape.isLocked) return null
    const port = getKonvaNodePort(nodeShape, portId)
    if (!port || port.direction !== 'out') return null
    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return null
    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current)
    const sourceEndpoints = getBatchSourceEndpoints(documentRef.current.shapes, selectedIds, nodeShape, port.id)
    setRuntimeConnectionPreview({
      dataType: port.dataType,
      pointer: worldPoint,
      source: { portId: port.id, shapeId },
      sources: sourceEndpoints,
    })
    return {
      dataType: port.dataType,
      pointerId: event.evt.pointerId,
      sourceEndpoints,
      sourcePortId: port.id,
      sourceShapeId: shapeId,
      type: 'node-connection' as const,
    }
  }, [cameraRef, documentRef, selectedIds, stageRef])

  const updateNodeConnectionPreview = useCallback((session: NodeConnectionSession, worldPoint: CanvasPoint) => {
    const target = getCompatibleTarget(documentRef.current.shapes, session, worldPoint, cameraRef.current.zoom)
    setRuntimeConnectionPreview({
      dataType: session.dataType,
      pointer: target?.world ?? worldPoint,
      source: { portId: session.sourcePortId, shapeId: session.sourceShapeId },
      sources: session.sourceEndpoints,
      target: target ? {
        point: target.world,
        portId: target.id,
        shapeId: target.shapeId,
      } : undefined,
    })
  }, [cameraRef, documentRef])

  const finishNodeConnection = useCallback((session: NodeConnectionSession, worldPoint: CanvasPoint | null) => {
    setRuntimeConnectionPreview(null)
    if (!worldPoint) return
    const target = getCompatibleTarget(documentRef.current.shapes, session, worldPoint, cameraRef.current.zoom)
    if (!target) return
    onHistoryCheckpoint(documentRef.current)
    const batchEdges = getBatchRuntimeEdges(documentRef.current.shapes, session, target)
    const nextDocument = batchEdges.length > 0
      ? addKonvaRuntimeEdges(documentRef.current, batchEdges)
      : addKonvaRuntimeEdge(documentRef.current, {
          dataType: session.dataType,
          sourcePortId: session.sourcePortId,
          sourceShapeId: session.sourceShapeId,
          targetPortId: target.id,
          targetShapeId: target.shapeId,
        })
    documentRef.current = nextDocument
    onDocumentChange(nextDocument)
    onSelectionChange([target.shapeId])
  }, [cameraRef, documentRef, onDocumentChange, onHistoryCheckpoint, onSelectionChange])

  return {
    clearNodeConnectionPreview: () => setRuntimeConnectionPreview(null),
    finishNodeConnection,
    handleNodePortPointerDown,
    runtimeConnectionPreview,
    updateNodeConnectionPreview,
  }
}

type NodeConnectionSession = Extract<KonvaToolSession, { type: 'node-connection' }>

function getNodeShape(shapes: CanvasDocument['shapes'], shapeId: string): CanvasNodeShape | null {
  return shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card') ?? null
}

function getNodeShapes(shapes: CanvasDocument['shapes']): CanvasNodeShape[] {
  return shapes.filter((shape): shape is CanvasNodeShape => shape.type === 'node_card')
}

function getCompatibleTarget(
  shapes: CanvasDocument['shapes'],
  session: NodeConnectionSession,
  worldPoint: CanvasPoint,
  zoom: number
) {
  return hitTestKonvaNodePort(getNodeShapes(shapes), worldPoint, zoom, {
    dataType: session.dataType,
    direction: 'in',
    excludeShapeId: session.sourceShapeId,
  })
}

function getBatchSourceEndpoints(
  shapes: CanvasDocument['shapes'],
  selectedIds: string[],
  clickedShape: CanvasNodeShape,
  clickedPortId: string
): KonvaRuntimeConnectionEndpoint[] {
  const clickedEndpoint = { portId: clickedPortId, shapeId: clickedShape.id }
  const clickedPort = getKonvaNodePort(clickedShape, clickedPortId)
  if (!clickedPort || clickedPort.direction !== 'out' || !selectedIds.includes(clickedShape.id)) {
    return [clickedEndpoint]
  }
  const selected = new Set(selectedIds)
  const sourceNodes = shapes
    .filter((shape): shape is CanvasNodeShape => (
      selected.has(shape.id) &&
      shape.type === 'node_card' &&
      !shape.isLocked &&
      Boolean(getKonvaNodePort(shape, clickedPortId)) &&
      getKonvaNodePort(shape, clickedPortId)?.dataType === clickedPort.dataType
    ))
    .sort((a, b) => Math.abs(a.y - b.y) > 8 ? a.y - b.y : a.x - b.x)

  return sourceNodes.length > 1
    ? sourceNodes.map((shape) => ({ portId: clickedPortId, shapeId: shape.id }))
    : [clickedEndpoint]
}

function getBatchRuntimeEdges(
  shapes: CanvasDocument['shapes'],
  session: NodeConnectionSession,
  target: NonNullable<ReturnType<typeof getCompatibleTarget>>
) {
  const sources = session.sourceEndpoints?.length ? session.sourceEndpoints : [{ portId: session.sourcePortId, shapeId: session.sourceShapeId }]
  if (sources.length <= 1) return []
  const targetShape = getNodeShape(shapes, target.shapeId)
  if (!targetShape) return []
  const allocation = getBatchTargetAllocation(targetShape, target.id, target.dataType)
  if (!allocation) return []
  const startIndex = getDynamicInputPortIndex(target.id, allocation.prefix)
  if (!startIndex) return []
  const capacity = Math.max(0, allocation.max - startIndex + 1)
  return sources.slice(0, capacity).map((source, index) => ({
    dataType: session.dataType,
    sourcePortId: source.portId,
    sourceShapeId: source.shapeId,
    targetPortId: getDynamicTargetPortId(allocation, startIndex + index),
    targetShapeId: target.shapeId,
  }))
}

function getBatchTargetAllocation(shape: CanvasNodeShape, portId: string, dataType: NodePortDataType) {
  if (dataType === 'image') {
    if (shape.props.nodeType === 'chat') return { max: maxChatInputPorts, prefix: 'image_in' as const }
    if (shape.props.nodeType === 'image_gen' || shape.props.nodeType === 'image_gen_4') return { max: maxImageInputPorts, prefix: 'image_in' as const }
    return null
  }
  if (dataType === 'text') {
    if (shape.props.nodeType === 'chat') return { max: maxChatInputPorts, prefix: 'text_in' as const }
    if (shape.props.nodeType === 'image_gen' || shape.props.nodeType === 'image_gen_4') return { firstPortId: 'text_in', max: maxTextInputPorts, prefix: 'text_in' as const }
  }
  return portId.startsWith('image_in_') || portId.startsWith('text_in_') ? null : null
}

function getDynamicInputPortIndex(portId: string, prefix: 'image_in' | 'text_in') {
  if (portId === prefix) return 1
  const match = new RegExp(`^${prefix}_(\\d+)$`).exec(portId)
  if (!match) return 0
  const index = Number(match[1])
  return Number.isFinite(index) && index > 0 ? index : 0
}

function getDynamicTargetPortId(
  allocation: NonNullable<ReturnType<typeof getBatchTargetAllocation>>,
  index: number
) {
  if (index === 1 && allocation.firstPortId) return allocation.firstPortId
  return `${allocation.prefix}_${index}`
}
