import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  appendCanvasShape,
  pointerToWorld,
  withCanvasShapes,
  type CanvasBounds,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasPoint,
  type CanvasShapeStyle,
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
  getSelectedShapeBounds,
  getShapesByIds,
  resizeBoundsFromHandle,
  resizeShapesFromBounds,
  toggleSelectedId,
} from './konvaSelectionUtils'
import { clearBrowserSelection, getStagePointer, isStageTarget } from './konvaStageHelpers'
import { updateLineEndpointShapes, updateLineRouteHandleShapes } from './konvaLineEndpointUtils'
import { getPointAngle, getRotatedShapes, getShapeRotationCenter } from './konvaRotationUtils'
import { getResizeSnapSourceKeys, getRotationSnapGuides, snapResizeBoundsToShapes, snapRotationAngle, type KonvaSnapGuide } from './konvaSnapping'
import { useKonvaDraftPreview } from './useKonvaDraftPreview'
import { useKonvaEraserSession } from './useKonvaEraserSession'
import { useKonvaLineEndpointHandlers } from './useKonvaLineEndpointHandlers'
import { useKonvaShapeDragHandlers } from './useKonvaShapeDragHandlers'
import { useKonvaStageCamera } from './useKonvaStageCamera'
import { useKonvaWheelHandler } from './useKonvaWheelHandler'
import type { KonvaCanvasTool, KonvaResizeHandle, KonvaToolSession } from './konvaCanvasTypes'
type UseKonvaCanvasInteractionsOptions = {
  activeTool: KonvaCanvasTool
  camera: CanvasCamera
  document: CanvasDocument
  isSpacePanning: boolean
  nextStyle: CanvasShapeStyle
  selectedIds: string[]
  onCameraCommit: (camera: CanvasCamera) => void
  onCameraPreview: (camera: CanvasCamera) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
  onToolChange: (tool: KonvaCanvasTool) => void
}
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
  const handleWheel = useKonvaWheelHandler({
    applyCamera,
    cameraRef,
    scheduleCameraCommit,
    stageRef,
  })
  const { handleShapeDragEnd, handleShapeDragMove, handleShapeDragStart, selectedBoundsOverride, setSelectedBoundsOverride, snapGuides } = useKonvaShapeDragHandlers({
    activeTool: options.activeTool,
    camera: options.camera,
    documentRef,
    onDocumentChange: options.onDocumentChange,
    onDocumentPreview: options.onDocumentPreview,
    onHistoryCheckpoint: options.onHistoryCheckpoint,
    onSelectionChange: options.onSelectionChange,
    selectedIds: options.selectedIds,
  })
  useEffect(() => {
    documentRef.current = options.document
  }, [options.document])
  const handleShapeSelect = useCallback((shapeId: string, config: { additive?: boolean } = {}) => {
    const additive = options.activeTool === 'select' && config.additive
    if (!additive && options.activeTool === 'select' && options.selectedIds.length > 1 && options.selectedIds.includes(shapeId)) return
    options.onSelectionChange(additive ? toggleSelectedId(options.selectedIds, shapeId) : [shapeId])
  }, [options])
  const handleResizeStart = useCallback((shapeIds: string[], handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true
    event.evt.preventDefault()
    const originShapes = getShapesByIds(documentRef.current.shapes, shapeIds)
    const originBounds = getSelectedShapeBounds(documentRef.current.shapes, shapeIds)
    if (originShapes.length === 0 || !originBounds) return
    options.onHistoryCheckpoint(documentRef.current)
    sessionRef.current = {
      handle,
      originBounds,
      originShapes,
      pointerId: event.evt.pointerId,
      shapeIds,
      type: 'resize',
    }
  }, [options])
  const handleRotateStart = useCallback((shapeId: string, event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true
    event.evt.preventDefault()
    const shape = documentRef.current.shapes.find((item) => item.id === shapeId)
    const screenPoint = getStagePointer(stageRef.current)
    if (!shape || !screenPoint) return
    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current)
    const center = getShapeRotationCenter(shape)
    const bounds = getSelectedShapeBounds(documentRef.current.shapes, [shapeId])
    const guideRadius = bounds ? Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 + 42 / cameraRef.current.zoom : 64 / cameraRef.current.zoom
    options.onHistoryCheckpoint(documentRef.current)
    sessionRef.current = { center, guideRadius, originRotation: shape.rotation ?? 0, pointerId: event.evt.pointerId, shapeId, startAngle: getPointAngle(center, worldPoint), type: 'rotate' }
  }, [cameraRef, options])
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
    if (!isStageTarget(event)) return
    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current)
    if (options.activeTool === 'select') {
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
      let bounds = resizeBoundsFromHandle(session.originBounds, session.handle, worldPoint, { preserveAspect: event.evt.shiftKey })
      if (snapAlignment) {
        const snapped = snapResizeBoundsToShapes(documentRef.current.shapes, session.shapeIds, bounds, snapDistance / cameraRef.current.zoom, getResizeSnapSourceKeys(session.handle))
        bounds = snapped.bounds
        setResizeSnapGuides(snapped.guides)
      }
      previewDocument(withCanvasShapes(documentRef.current, resizeShapesFromBounds(documentRef.current.shapes, session.originShapes, session.originBounds, bounds)))
      return
    }
    if (session.type === 'rotate') {
      const rawRotation = session.originRotation + getPointAngle(session.center, worldPoint) - session.startAngle
      const rotation = snapAlignment ? snapRotationAngle(rawRotation, Math.min(7.5, Math.max(2, snapDistance / 2))) : rawRotation
      setResizeSnapGuides(getRotationSnapGuides(rawRotation, rotation, session.center, session.guideRadius))
      previewDocument(withCanvasShapes(documentRef.current, getRotatedShapes(documentRef.current.shapes, session.shapeId, rotation)))
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
    if (session?.type === 'resize') { setResizeSnapGuides([]); setSelectedBoundsOverride(null) }
    if (session?.type === 'rotate') setResizeSnapGuides([])
    const nextDraft = session?.type === 'create' ? finalizeDraft(session.draft) : null
    clearDraft()
    if (nextDraft) options.onDocumentChange((current) => appendCanvasShape(current, nextDraft))
  }

  return {
    draft, eraserTrail, handleLineEndpointStart, handleLineRouteHandleStart, handlePointerDown,
    handlePointerLeave: () => clearEraserTrail(),
    handlePointerMove, handlePointerUp, handleResizeStart, handleRotateStart,
    handleShapeDragEnd, handleShapeDragMove, handleShapeDragStart, handleShapeSelect, handleWheel,
    selectedBoundsOverride, selectionBox,
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

  function previewDocument(document: CanvasDocument) {
    documentRef.current = document
    options.onDocumentPreview(document)
  }
}
