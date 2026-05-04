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
import { getKonvaNodePort, hitTestKonvaNodePort } from './konvaNodePorts'
import { addKonvaRuntimeEdge, type KonvaRuntimeConnectionPreview } from './konvaRuntimeEdges'
import type { KonvaToolSession } from './konvaCanvasTypes'
import { getStagePointer } from './konvaStageHelpers'

type UseKonvaNodeConnectionSessionOptions = {
  cameraRef: { current: CanvasCamera }
  documentRef: { current: CanvasDocument }
  stageRef: RefObject<Konva.Stage | null>
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaNodeConnectionSession({
  cameraRef,
  documentRef,
  onDocumentChange,
  onHistoryCheckpoint,
  onSelectionChange,
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
    setRuntimeConnectionPreview({
      dataType: port.dataType,
      pointer: worldPoint,
      source: { portId: port.id, shapeId },
    })
    return {
      dataType: port.dataType,
      pointerId: event.evt.pointerId,
      sourcePortId: port.id,
      sourceShapeId: shapeId,
      type: 'node-connection' as const,
    }
  }, [cameraRef, documentRef, stageRef])

  const updateNodeConnectionPreview = useCallback((session: NodeConnectionSession, worldPoint: CanvasPoint) => {
    const target = getCompatibleTarget(documentRef.current.shapes, session, worldPoint, cameraRef.current.zoom)
    setRuntimeConnectionPreview({
      dataType: session.dataType,
      pointer: target?.world ?? worldPoint,
      source: { portId: session.sourcePortId, shapeId: session.sourceShapeId },
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
    const nextDocument = addKonvaRuntimeEdge(documentRef.current, {
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
