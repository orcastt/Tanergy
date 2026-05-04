import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  appendCanvasShape,
  pointerToWorld,
  withCanvasShapes,
  type CanvasBounds,
  type CanvasPoint,
} from '@/features/canvas-engine'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import {
  createDraftShape,
  createStrokeEndPoint,
  createStrokePoint,
  createTextShape,
  finalizeDraft,
  updateStrokeDraft,
} from './konvaDraftShapes'
import {
  boundsFromPoints,
  getMarqueeSelectionIds,
  preserveAspectResizeBoundsFromSnappedBounds,
  resizeBoundsFromHandle,
  resizeShapesFromBounds,
  toggleSelectedId,
} from './konvaSelectionUtils'
import { clearBrowserSelection, getStagePointer, isStageTarget } from './konvaStageHelpers'
import { updateLineEndpointShapes, updateLineRouteHandleShapes } from './konvaLineEndpointUtils'
import { getPointAngle, rotateShapesAroundCenter } from './konvaRotationUtils'
import { resizeShapesFromRotatedBox } from './konvaRotatedResize'
import { getResizeSnapSourceKeys, getRotationSnapGuides, snapResizeBoundsToShapes, snapRotationAngle, type KonvaSnapGuide } from './konvaSnapping'
import { getKonvaGroupMemberIds } from './konvaGroupCommands'
import { useKonvaDraftPreview } from './useKonvaDraftPreview'
import { useKonvaDocumentPreviewScheduler } from './useKonvaDocumentPreviewScheduler'
import { useKonvaEraserSession } from './useKonvaEraserSession'
import { useKonvaImageCropSession } from './useKonvaImageCropSession'
import { useKonvaLineEndpointHandlers } from './useKonvaLineEndpointHandlers'
import { useKonvaNodeConnectionSession } from './useKonvaNodeConnectionSession'
import { useKonvaShapeDragHandlers } from './useKonvaShapeDragHandlers'
import { useKonvaStageCamera } from './useKonvaStageCamera'
import { useKonvaTransformStartHandlers } from './useKonvaTransformStartHandlers'
import { useKonvaWheelHandler } from './useKonvaWheelHandler'
import type { KonvaToolSession } from './konvaCanvasTypes'
import type { UseKonvaCanvasInteractionsOptions } from './konvaCanvasInteractionTypes'
export function useKonvaCanvasInteractions(options: UseKonvaCanvasInteractionsOptions) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const sessionRef = useRef<KonvaToolSession | null>(null)
  const documentRef = useRef(options.document)
  const snapAlignment = useCanvasSettingsStore((state) => state.settings.snapAlignment)
  const snapDistance = useCanvasSettingsStore((state) => state.settings.snapDistance)
  const { applyCamera, cameraRef, scheduleCameraCommit } = useKonvaStageCamera({
    camera: options.camera,
    onCameraCommit: options.onCameraCommit,
    onCameraPreview: options.onCameraPreview,
    stageRef,
  })
  const { clearDraft, draft, scheduleDraft } = useKonvaDraftPreview()
  const { flushPreviewDocument, previewDocument, previewDocumentNow } = useKonvaDocumentPreviewScheduler({
    documentRef,
    onDocumentPreview: options.onDocumentPreview,
  })
  const [resizeSnapGuides, setResizeSnapGuides] = useState<KonvaSnapGuide[]>([])
  const [selectionBox, setSelectionBox] = useState<CanvasBounds | null>(null)
  const { clearEraserTrail, eraseAtPoint, eraserTrail, updateEraserTrail } = useKonvaEraserSession({
    cameraRef,
    documentRef,
    onDocumentPreview: options.onDocumentPreview,
  })
  const { handleLineEndpointStart, handleLineRouteHandleStart } = useKonvaLineEndpointHandlers({
    documentRef,
    onHistoryCheckpoint: options.onHistoryCheckpoint,
    sessionRef,
  })
  const {
    clearNodeConnectionPreview,
    finishNodeConnection,
    handleNodePortPointerDown: startNodeConnection,
    runtimeConnectionPreview,
    updateNodeConnectionPreview,
  } = useKonvaNodeConnectionSession({
    cameraRef,
    documentRef,
    onDocumentChange: options.onDocumentChange,
    onHistoryCheckpoint: options.onHistoryCheckpoint,
    onSelectionChange: options.onSelectionChange,
    selectedIds: options.selectedIds,
    stageRef,
  })
  const handleNodePortPointerDown = useCallback((shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => {
    const session = startNodeConnection(shapeId, portId, event)
    if (session) sessionRef.current = session
  }, [startNodeConnection])
  const { handleImageCropStart, updateImageCropPreview } = useKonvaImageCropSession({
    documentRef,
    onHistoryCheckpoint: options.onHistoryCheckpoint,
    previewDocument,
    sessionRef,
  })
  const handleWheel = useKonvaWheelHandler({
    applyCamera,
    cameraRef,
    scheduleCameraCommit,
    stageRef,
  })
  const { handleResizeStart, handleRotateStart } = useKonvaTransformStartHandlers({
    cameraRef,
    documentRef,
    onHistoryCheckpoint: options.onHistoryCheckpoint,
    sessionRef,
    stageRef,
  })
  const { dragPreviewShapes, draggingShapeIds, handleShapeDragEnd, handleShapeDragMove, handleShapeDragStart, selectedBoundsOverride, setSelectedBoundsOverride, snapGuides } = useKonvaShapeDragHandlers({
    activeTool: options.activeTool,
    camera: options.camera,
    documentRef,
    onDocumentChange: options.onDocumentChange,
    onHistoryCheckpoint: options.onHistoryCheckpoint,
    onSelectionChange: options.onSelectionChange,
    selectedIds: options.selectedIds,
  })
  useEffect(() => {
    documentRef.current = options.document
  }, [options.document])
  const handleShapeSelect = useCallback((shapeId: string, config: { additive?: boolean } = {}) => {
    const scopeIds = getKonvaGroupMemberIds(documentRef.current.shapes, shapeId)
    const additive = options.activeTool === 'select' && config.additive
    if (!additive && options.activeTool === 'select' && options.selectedIds.length > 1 && scopeIds.some((id) => options.selectedIds.includes(id))) return
    if (!additive) {
      options.onSelectionChange(scopeIds)
      return
    }
    const removing = scopeIds.every((id) => options.selectedIds.includes(id))
    options.onSelectionChange(removing
      ? options.selectedIds.filter((id) => !scopeIds.includes(id))
      : scopeIds.reduce((ids, id) => toggleSelectedId(ids, id), options.selectedIds))
  }, [options])
  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return
    clearBrowserSelection()
    event.evt.preventDefault()
    if (event.evt.button === 2) {
      sessionRef.current = null
      clearDraft()
      setResizeSnapGuides([])
      setSelectionBox(null)
      return
    }
    if (options.isSpacePanning || event.evt.button === 1 || options.activeTool === 'hand') {
      sessionRef.current = { origin: screenPoint, pointerId: event.evt.pointerId, type: 'pan' }
      return
    }
    const startedOnStage = isStageTarget(event)
    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current)
    if (options.activeTool === 'select') {
      if (!startedOnStage) return
      setSelectionBox(boundsFromPoints(worldPoint, worldPoint))
      sessionRef.current = {
        additive: event.evt.shiftKey,
        current: worldPoint,
        origin: worldPoint,
        pointerId: event.evt.pointerId,
        type: 'select-box',
      }
      return
    }
    if (options.activeTool === 'eraser') {
      options.onHistoryCheckpoint(documentRef.current)
      sessionRef.current = { pointerId: event.evt.pointerId, type: 'erase' }
      updateEraserTrail(worldPoint)
      eraseAtPoint(worldPoint)
      return
    }
    if (options.activeTool === 'text') {
      options.onHistoryCheckpoint(documentRef.current)
      const shape = createTextShape(worldPoint, options.nextStyle)
      options.onDocumentChange((current) => appendCanvasShape(current, shape))
      options.onSelectionChange([shape.id])
      options.onToolChange('select')
      return
    }
    const draftShape = createDraftShape(options.activeTool, worldPoint, worldPoint, { constrainProportions: event.evt.shiftKey, style: options.nextStyle })
    if (!draftShape) return
    options.onHistoryCheckpoint(documentRef.current)
    if (options.selectedIds.length > 0) options.onSelectionChange([])
    sessionRef.current = {
      draft: draftShape,
      origin: worldPoint,
      pointerId: event.evt.pointerId,
      rawPoints: options.activeTool === 'draw' ? [createStrokePoint(worldPoint, event.evt)] : undefined,
      type: 'create',
    }
    scheduleDraft(draftShape)
  }
  const handlePointerMove = (event: KonvaEventObject<PointerEvent>) => {
    const session = sessionRef.current
    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return
    if (session) {
      clearBrowserSelection()
      event.evt.preventDefault()
    }
    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current)
    if (!session) {
      if (options.activeTool === 'eraser') updateEraserTrail(worldPoint)
      return
    }
    if (session.type === 'pan') {
      const delta = { x: screenPoint.x - session.origin.x, y: screenPoint.y - session.origin.y }
      applyCamera({ ...cameraRef.current, x: cameraRef.current.x + delta.x, y: cameraRef.current.y + delta.y })
      scheduleCameraCommit()
      session.origin = screenPoint
      return
    }
    if (session.type === 'erase') {
      updateEraserTrail(worldPoint)
      eraseAtPoint(worldPoint)
      return
    }
    if (session.type === 'select-box') {
      session.current = worldPoint
      setSelectionBox(boundsFromPoints(session.origin, worldPoint))
      return
    }
    if (session.type === 'resize') {
      const preserveAspect = event.evt.shiftKey
      if (session.rotatedBox) {
        setResizeSnapGuides([])
        previewDocumentNow(withCanvasShapes(documentRef.current, resizeShapesFromRotatedBox(documentRef.current.shapes, session.originShapes, session.rotatedBox, session.handle, worldPoint, { preserveAspect })))
        return
      }
      let bounds = resizeBoundsFromHandle(session.originBounds, session.handle, worldPoint, { preserveAspect })
      if (snapAlignment) {
        const snapped = snapResizeBoundsToShapes(documentRef.current.shapes, session.shapeIds, bounds, snapDistance / cameraRef.current.zoom, getResizeSnapSourceKeys(session.handle))
        bounds = preserveAspect
          ? preserveAspectResizeBoundsFromSnappedBounds(session.originBounds, session.handle, snapped.bounds, snapped.guides.map((guide) => guide.orientation))
          : snapped.bounds
        setResizeSnapGuides(snapped.guides)
      }
      previewDocumentNow(withCanvasShapes(documentRef.current, resizeShapesFromBounds(documentRef.current.shapes, session.originShapes, session.originBounds, bounds)))
      return
    }
    if (session.type === 'rotate') {
      const rawRotation = session.originRotation + getPointAngle(session.center, worldPoint) - session.startAngle
      const rotation = snapAlignment ? snapRotationAngle(rawRotation, Math.min(7.5, Math.max(2, snapDistance / 2))) : rawRotation
      setResizeSnapGuides(getRotationSnapGuides(rawRotation, rotation, session.center, session.guideRadius))
      previewDocument(withCanvasShapes(documentRef.current, rotateShapesAroundCenter(documentRef.current.shapes, session.originShapes, session.center, rotation - session.originRotation)))
      return
    }
    if (session.type === 'line-endpoint') {
      previewDocument(withCanvasShapes(documentRef.current, updateLineEndpointShapes(documentRef.current.shapes, session.originShape, session.endpoint, worldPoint, { lockAngle: event.evt.shiftKey })))
      return
    }
    if (session.type === 'line-route-handle') {
      previewDocument(withCanvasShapes(documentRef.current, updateLineRouteHandleShapes(documentRef.current.shapes, session.originShape, session.handle, worldPoint)))
      return
    }
    if (session.type === 'node-connection') {
      updateNodeConnectionPreview(session, worldPoint)
      return
    }
    if (session.type === 'image-crop') {
      updateImageCropPreview(session, worldPoint)
      return
    }
    updateCreateDraft(session, worldPoint, event)
  }
  const handlePointerUp = (event: KonvaEventObject<PointerEvent>) => {
    const session = sessionRef.current
    const screenPoint = getStagePointer(stageRef.current)
    if (session?.type === 'create' && options.activeTool === 'draw' && screenPoint) {
      const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current)
      session.draft = updateStrokeDraft(session, createStrokeEndPoint(worldPoint, event.evt))
    }
    sessionRef.current = null
    if (session?.type === 'pan') scheduleCameraCommit(0)
    if (session?.type === 'erase') clearEraserTrail(120)
    if (session?.type === 'select-box') finishBoxSelection(session)
    if (session?.type === 'resize') { flushPreviewDocument(); setResizeSnapGuides([]); setSelectedBoundsOverride(null) }
    if (session?.type === 'rotate') { flushPreviewDocument(); setResizeSnapGuides([]) }
    if (session?.type === 'line-endpoint' || session?.type === 'line-route-handle' || session?.type === 'image-crop') flushPreviewDocument()
    if (session?.type === 'node-connection') {
      finishNodeConnection(session, screenPoint ? pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current) : null)
    }
    const nextDraft = session?.type === 'create' ? finalizeDraft(session.draft) : null
    clearDraft()
    if (nextDraft) options.onDocumentChange((current) => appendCanvasShape(current, nextDraft))
  }
  return {
    draft, dragPreviewShapes, draggingShapeIds, eraserTrail, handleLineEndpointStart, handleLineRouteHandleStart, handleNodePortPointerDown, handlePointerDown,
    handlePointerLeave: () => {
      clearEraserTrail()
      clearNodeConnectionPreview()
    },
    handlePointerMove, handlePointerUp, handleResizeStart, handleRotateStart,
    handleImageCropStart,
    handleShapeDragEnd, handleShapeDragMove, handleShapeDragStart, handleShapeSelect, handleWheel,
    runtimeConnectionPreview, selectedBoundsOverride, selectionBox,
    snapGuides: snapGuides.length > 0 ? snapGuides : resizeSnapGuides,
    stageRef,
  }
  function updateCreateDraft(session: Extract<KonvaToolSession, { type: 'create' }>, worldPoint: CanvasPoint, event: KonvaEventObject<PointerEvent>) {
    const nextDraft = options.activeTool === 'draw'
      ? updateStrokeDraft(session, createStrokePoint(worldPoint, event.evt, session.rawPoints?.at(-1)))
      : createDraftShape(options.activeTool, session.origin, worldPoint, { constrainProportions: event.evt.shiftKey, style: options.nextStyle })
    if (!nextDraft) return
    session.draft = nextDraft
    scheduleDraft(nextDraft)
  }
  function finishBoxSelection(session: Extract<KonvaToolSession, { type: 'select-box' }>) {
    const bounds = boundsFromPoints(session.origin, session.current)
    setSelectionBox(null)
    options.onSelectionChange(getMarqueeSelectionIds(documentRef.current.shapes, bounds, options.selectedIds, session.additive))
  }
}
