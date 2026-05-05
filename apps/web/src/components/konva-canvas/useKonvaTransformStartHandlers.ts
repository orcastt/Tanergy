import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, type MutableRefObject } from 'react'
import { pointerToWorld, type CanvasCamera, type CanvasDocument } from '@/features/canvas-engine'
import { createRotatedResizeBox } from './konvaRotatedResize'
import { getPointAngle } from './konvaRotationUtils'
import { getSelectedShapeBounds, getShapesByIds } from './konvaSelectionUtils'
import { canKonvaSelectionRotate } from './konvaShapeCapabilities'
import { getStagePointer } from './konvaStageHelpers'
import type { KonvaResizeHandle, KonvaToolSession } from './konvaCanvasTypes'

type UseKonvaTransformStartHandlersOptions = {
  cameraRef: { current: CanvasCamera }
  documentRef: { current: CanvasDocument }
  sessionRef: MutableRefObject<KonvaToolSession | null>
  stageRef: { current: Konva.Stage | null }
  onHistoryCheckpoint: (document: CanvasDocument) => void
}

export function useKonvaTransformStartHandlers({
  cameraRef,
  documentRef,
  onHistoryCheckpoint,
  sessionRef,
  stageRef,
}: UseKonvaTransformStartHandlersOptions) {
  const handleResizeStart = useCallback((shapeIds: string[], handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true
    event.evt.preventDefault()
    const originShapes = getShapesByIds(documentRef.current.shapes, shapeIds)
    const originBounds = getSelectedShapeBounds(documentRef.current.shapes, shapeIds)
    if (originShapes.some((shape) => shape.type === 'node_card') && isEdgeResizeHandle(handle)) return
    if (originShapes.length === 0 || originShapes.some((shape) => shape.isLocked) || !originBounds) return
    onHistoryCheckpoint(documentRef.current)
    sessionRef.current = {
      handle,
      originBounds,
      originShapes,
      pointerId: event.evt.pointerId,
      rotatedBox: createRotatedResizeBox(originShapes),
      shapeIds,
      type: 'resize',
    }
  }, [documentRef, onHistoryCheckpoint, sessionRef])

  const handleRotateStart = useCallback((shapeIds: string[], event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true
    event.evt.preventDefault()
    const screenPoint = getStagePointer(stageRef.current)
    const originShapes = getShapesByIds(documentRef.current.shapes, shapeIds)
    const bounds = getSelectedShapeBounds(documentRef.current.shapes, shapeIds)
    if (!canKonvaSelectionRotate(originShapes)) return
    if (originShapes.length === 0 || originShapes.some((shape) => shape.isLocked) || !bounds || !screenPoint) return
    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current)
    const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
    const guideRadius = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 + 42 / cameraRef.current.zoom
    const originRotation = originShapes.length === 1 ? originShapes[0]?.rotation ?? 0 : 0
    onHistoryCheckpoint(documentRef.current)
    sessionRef.current = { center, guideRadius, originRotation, originShapes, pointerId: event.evt.pointerId, shapeIds, startAngle: getPointAngle(center, worldPoint), type: 'rotate' }
  }, [cameraRef, documentRef, onHistoryCheckpoint, sessionRef, stageRef])

  return { handleResizeStart, handleRotateStart }
}

function isEdgeResizeHandle(handle: KonvaResizeHandle) {
  return handle === 'n' || handle === 'e' || handle === 's' || handle === 'w'
}
