import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  appendCanvasShape,
  pointerToWorld,
  withCanvasShapes,
  type CanvasBounds,
  type CanvasDocument,
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
  getBoxSelectedIds,
  getSelectedShapeBounds,
  preserveAspectResizeBoundsFromSnappedBounds,
  resizeBoundsFromHandle,
  resizeShapesFromBounds,
  mergeSelectedIds,
  toggleSelectedId,
} from './konvaSelectionUtils'
import { clearBrowserSelection, getStagePointer, isStageTarget } from './konvaStageHelpers'
import { updateLineEndpointShapes, updateLineRouteHandleShapes } from './konvaLineEndpointUtils'
import { getPointAngle, rotateShapesAroundCenter } from './konvaRotationUtils'
import { resizeShapesFromRotatedBox } from './konvaRotatedResize'
import { getResizeSnapSourceKeys, getRotationSnapGuides, snapResizeBoundsToShapes, snapRotationAngle, type KonvaSnapGuide } from './konvaSnapping'
import { getKonvaGroupMemberIds } from './konvaGroupCommands'
import { hasRemoteShapeLock } from './konvaCollaborationLocks'
import { applyFrameContainment } from './konvaFrameContainment'
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
import { isKonvaCreateTool, type KonvaToolSession } from './konvaCanvasTypes'
import type { UseKonvaCanvasInteractionsOptions } from './konvaCanvasInteractionTypes'
export function useKonvaCanvasInteractions(options: UseKonvaCanvasInteractionsOptions) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const sessionRef = useRef<KonvaToolSession | null>(null)
  const documentRef = useRef(options.document)
  const onInteractionShapeIdsChange = options.onInteractionShapeIdsChange
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
  const {
    handleLineEndpointStart: startLineEndpoint,
    handleLineRouteHandleStart: startLineRouteHandle,
  } = useKonvaLineEndpointHandlers({
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
    onConnectionPreviewChange: options.onConnectionPreviewChange,
    onHistoryCheckpoint: options.onHistoryCheckpoint,
    onSelectionChange: options.onSelectionChange,
    selectedIds: options.selectedIds,
    stageRef,
  })
  const handleNodePortPointerDown = useCallback((shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => {
    const session = startNodeConnection(shapeId, portId, event)
    if (session) sessionRef.current = session
  }, [startNodeConnection])
  const { handleImageCropStart: startImageCrop, updateImageCropPreview } = useKonvaImageCropSession({
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
  const {
    handleResizeStart: startResize,
    handleRotateStart: startRotate,
  } = useKonvaTransformStartHandlers({
    cameraRef,
    documentRef,
    onHistoryCheckpoint: options.onHistoryCheckpoint,
    onInteractionShapeIdsChange: options.onInteractionShapeIdsChange,
    remoteLockedShapeOwnerById: options.remoteLockedShapeOwnerById,
    sessionRef,
    stageRef,
  })
  const { dragPreviewShapes, draggingShapeIds, handleShapeDragEnd, handleShapeDragMove, handleShapeDragStart, selectedBoundsOverride, setSelectedBoundsOverride, snapGuides } = useKonvaShapeDragHandlers({
    activeTool: options.activeTool,
    camera: options.camera,
    documentRef,
    onInteractionShapeIdsChange: options.onInteractionShapeIdsChange,
    onTransformPreviewChange: options.onTransformPreviewChange,
    onDocumentChange: options.onDocumentChange,
    onHistoryCheckpoint: options.onHistoryCheckpoint,
    onSelectionChange: options.onSelectionChange,
    remoteLockedShapeOwnerById: options.remoteLockedShapeOwnerById,
    selectedIds: options.selectedIds,
  })
  useEffect(() => {
    documentRef.current = options.document
  }, [options.document])
  const handleLineEndpointStart = useCallback((shapeId: string, endpoint: Parameters<typeof startLineEndpoint>[1], event: KonvaEventObject<PointerEvent>) => {
    startLineEndpoint(shapeId, endpoint, event)
  }, [startLineEndpoint])
  const handleLineRouteHandleStart = useCallback((shapeId: string, handle: Parameters<typeof startLineRouteHandle>[1], event: KonvaEventObject<PointerEvent>) => {
    startLineRouteHandle(shapeId, handle, event)
  }, [startLineRouteHandle])
  const handleImageCropStart = useCallback((shapeId: string, handle: Parameters<typeof startImageCrop>[1], event: KonvaEventObject<PointerEvent>) => {
    startImageCrop(shapeId, handle, event)
  }, [startImageCrop])
  const handleResizeStart = useCallback((shapeIds: string[], handle: Parameters<typeof startResize>[1], event: KonvaEventObject<PointerEvent>) => {
    startResize(shapeIds, handle, event)
  }, [startResize])
  const handleRotateStart = useCallback((shapeIds: string[], event: KonvaEventObject<PointerEvent>) => {
    startRotate(shapeIds, event)
  }, [startRotate])
  const publishInteractionShapeIds = useCallback((shapeIds: string[]) => {
    onInteractionShapeIdsChange?.(shapeIds)
  }, [onInteractionShapeIdsChange])
  const handleShapeSelect = useCallback((shapeId: string, config: { additive?: boolean } = {}) => {
    const scopeIds = getKonvaGroupMemberIds(documentRef.current.shapes, shapeId)
    const interactionScopeIds = expandInteractionShapeIds(documentRef.current.shapes, scopeIds)
    const additive = options.activeTool === 'select' && config.additive
    if (hasRemoteShapeLock(interactionScopeIds, options.remoteLockedShapeOwnerById)) return
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
    if (event.evt.button === 2) {
      event.evt.preventDefault()
      sessionRef.current = null
      clearDraft()
      clearNodeConnectionPreview()
      setResizeSnapGuides([])
      setSelectionBox(null)
      options.onSelectionBoxChange?.(null)
      options.onTransformPreviewChange?.(null)
      publishInteractionShapeIds([])
      return
    }
    if (options.isSpacePanning || event.evt.button === 1 || options.activeTool === 'hand') {
      event.evt.preventDefault()
      publishInteractionShapeIds([])
      sessionRef.current = { origin: screenPoint, pointerId: event.evt.pointerId, type: 'pan' }
      return
    }
    const startedOnStage = isStageTarget(event)
    const targetShapeId = getTargetShapeId(event)
    const targetShape = targetShapeId ? documentRef.current.shapes.find((shape) => shape.id === targetShapeId) : null
    const canCreateInsideFrame = Boolean(targetShape && targetShape.type === 'frame')
    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current)
    if (options.activeTool === 'select') {
      if (startedOnStage) event.evt.preventDefault()
      setSelectionBox(null)
      options.onSelectionBoxChange?.(null)
      options.onTransformPreviewChange?.(null)
      if (targetShapeId) {
        const targetInteractionShapeIds = expandInteractionShapeIds(
          documentRef.current.shapes,
          getKonvaGroupMemberIds(documentRef.current.shapes, targetShapeId),
        )
        publishInteractionShapeIds(
          hasRemoteShapeLock(targetInteractionShapeIds, options.remoteLockedShapeOwnerById)
            ? []
            : targetInteractionShapeIds,
        )
      } else {
        publishInteractionShapeIds([])
      }
      sessionRef.current = {
        additive: event.evt.shiftKey,
        current: worldPoint,
        origin: worldPoint,
        pointerId: event.evt.pointerId,
        targetShapeId: getTargetShapeId(event),
        type: 'select-box',
      }
      return
    }
    if (options.activeTool === 'eraser') {
      event.evt.preventDefault()
      publishInteractionShapeIds([])
      options.onHistoryCheckpoint(documentRef.current)
      sessionRef.current = { pointerId: event.evt.pointerId, type: 'erase' }
      updateEraserTrail(worldPoint)
      eraseAtPoint(worldPoint)
      return
    }
    if (options.activeTool === 'text') {
      if (!startedOnStage && !canCreateInsideFrame) return
      event.evt.preventDefault()
      publishInteractionShapeIds([])
      options.onHistoryCheckpoint(documentRef.current)
      const shape = createTextShape(worldPoint, options.nextStyle)
      options.onDocumentChange((current) => {
        const nextDocument = appendCanvasShape(current, shape)
        return withCanvasShapes(nextDocument, applyFrameContainment([...nextDocument.shapes], [shape.id]))
      })
      options.onSelectionChange([])
      options.onToolChange('select')
      return
    }
    const draftShape = createDraftShape(options.activeTool, worldPoint, worldPoint, { constrainProportions: event.evt.shiftKey, style: options.nextStyle })
    if (!draftShape) return
    if (!startedOnStage && options.activeTool !== 'draw' && !canCreateInsideFrame) return
    if (startedOnStage || options.activeTool === 'draw' || canCreateInsideFrame) event.evt.preventDefault()
    publishInteractionShapeIds([])
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
      const bounds = boundsFromPoints(session.origin, worldPoint)
      const nextSelectionBox = isTinyScreenBounds(bounds, cameraRef.current.zoom) ? null : bounds
      setSelectionBox(nextSelectionBox)
      options.onSelectionBoxChange?.(nextSelectionBox)
      if (!nextSelectionBox) {
        if (session.targetShapeId) {
          const targetInteractionShapeIds = expandInteractionShapeIds(
            documentRef.current.shapes,
            getKonvaGroupMemberIds(documentRef.current.shapes, session.targetShapeId),
          )
          publishInteractionShapeIds(
            hasRemoteShapeLock(targetInteractionShapeIds, options.remoteLockedShapeOwnerById)
              ? []
              : targetInteractionShapeIds,
          )
        } else {
          publishInteractionShapeIds([])
        }
        return
      }
      publishInteractionShapeIds(expandInteractionShapeIds(
        documentRef.current.shapes,
        getBoxSelectedIds(documentRef.current.shapes, bounds)
          .filter((shapeId) => (
            !hasRemoteShapeLock(
              expandInteractionShapeIds(documentRef.current.shapes, [shapeId]),
              options.remoteLockedShapeOwnerById,
            )
          )),
      ))
      return
    }
    if (session.type === 'resize') {
      const preserveAspect = !event.evt.shiftKey && !isEdgeResizeHandle(session.handle)
      const scaleText = !isEdgeResizeHandle(session.handle)
      if (session.rotatedBox) {
        setResizeSnapGuides([])
        const nextShapes = resizeShapesFromRotatedBox(documentRef.current.shapes, session.originShapes, session.rotatedBox, session.handle, worldPoint, { preserveAspect, scaleText })
        previewDocumentNow(withCanvasShapes(documentRef.current, nextShapes))
        const nextBounds = getSelectedShapeBounds(nextShapes, session.shapeIds)
        options.onTransformPreviewChange?.(nextBounds ? { bounds: nextBounds, kind: 'resize' } : null)
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
      const nextShapes = resizeShapesFromBounds(documentRef.current.shapes, session.originShapes, session.originBounds, bounds, { scaleText })
      previewDocumentNow(withCanvasShapes(documentRef.current, nextShapes))
      const nextBounds = getSelectedShapeBounds(nextShapes, session.shapeIds)
      options.onTransformPreviewChange?.(nextBounds ? { bounds: nextBounds, kind: 'resize' } : null)
      return
    }
    if (session.type === 'rotate') {
      const rawRotation = session.originRotation + getPointAngle(session.center, worldPoint) - session.startAngle
      const rotation = snapAlignment ? snapRotationAngle(rawRotation, Math.min(7.5, Math.max(2, snapDistance / 2))) : rawRotation
      setResizeSnapGuides(getRotationSnapGuides(rawRotation, rotation, session.center, session.guideRadius))
      const nextShapes = rotateShapesAroundCenter(documentRef.current.shapes, session.originShapes, session.center, rotation - session.originRotation)
      previewDocument(withCanvasShapes(documentRef.current, nextShapes))
      const nextBounds = getSelectedShapeBounds(nextShapes, session.shapeIds)
      options.onTransformPreviewChange?.(nextBounds ? { bounds: nextBounds, kind: 'rotate' } : null)
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
    if (session?.type === 'resize') { flushPreviewDocument(); setResizeSnapGuides([]); setSelectedBoundsOverride(null); options.onTransformPreviewChange?.(null) }
    if (session?.type === 'rotate') { flushPreviewDocument(); setResizeSnapGuides([]); options.onTransformPreviewChange?.(null) }
    if (session?.type === 'line-endpoint' || session?.type === 'line-route-handle' || session?.type === 'image-crop') flushPreviewDocument()
    if (session?.type === 'node-connection') {
      finishNodeConnection(session, screenPoint ? pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, cameraRef.current) : null)
    }
    const nextDraft = session?.type === 'create' ? finalizeDraft(session.draft) : null
    clearDraft()
    const shouldStayInTool = session?.type === 'create' && options.activeTool === 'draw'
    if (session?.type === 'create' && isKonvaCreateTool(options.activeTool) && !shouldStayInTool) options.onToolChange('select')
    if (nextDraft) {
      options.onHistoryCheckpoint(documentRef.current)
      options.onDocumentChange((current) => {
        const nextDocument = appendCanvasShape(current, nextDraft)
        return withCanvasShapes(nextDocument, applyFrameContainment([...nextDocument.shapes], [nextDraft.id]))
      })
      options.onSelectionChange([])
    }
    publishInteractionShapeIds([])
  }
  return {
    draft, dragPreviewShapes, draggingShapeIds, eraserTrail, handleLineEndpointStart, handleLineRouteHandleStart, handleNodePortPointerDown, handlePointerDown,
    handlePointerLeave: () => {
      if (sessionRef.current?.type === 'node-connection') sessionRef.current = null
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
    options.onSelectionBoxChange?.(null)
    if (isTinyScreenBounds(bounds, cameraRef.current.zoom)) {
      if (session.targetShapeId) {
        handleShapeSelect(session.targetShapeId, { additive: session.additive })
        return
      }
      if (!session.additive) options.onSelectionChange([])
      return
    }
    const selected = getBoxSelectedIds(documentRef.current.shapes, bounds).filter((shapeId) => (
      !hasRemoteShapeLock(
        expandInteractionShapeIds(documentRef.current.shapes, [shapeId]),
        options.remoteLockedShapeOwnerById,
      )
    ))
    options.onSelectionChange(session.additive ? mergeSelectedIds(options.selectedIds, selected) : selected)
  }
}

function isEdgeResizeHandle(handle: string) {
  return handle === 'n' || handle === 'e' || handle === 's' || handle === 'w'
}

function isTinyScreenBounds(bounds: CanvasBounds, zoom: number) {
  return (bounds.maxX - bounds.minX) * zoom < 4 && (bounds.maxY - bounds.minY) * zoom < 4
}

function getTargetShapeId(event: KonvaEventObject<PointerEvent>) {
  let node: Konva.Node | null = event.target
  while (node) {
    const id = node.id()
    if (id.startsWith('shape:')) return id.slice('shape:'.length)
    node = node.getParent()
  }
  return undefined
}

function expandInteractionShapeIds(shapes: CanvasDocument['shapes'], shapeIds: string[]) {
  const expanded = new Set<string>()
  for (const shapeId of shapeIds) {
    for (const memberId of getKonvaGroupMemberIds(shapes, shapeId)) {
      expanded.add(memberId)
    }
  }
  return expandFrameChildren(shapes, [...expanded])
}

function expandFrameChildren(shapes: CanvasDocument['shapes'], shapeIds: string[]) {
  const expanded = new Set(shapeIds)
  let changed = true
  while (changed) {
    changed = false
    for (const shape of shapes) {
      if (shape.parentId && expanded.has(shape.parentId) && !expanded.has(shape.id)) {
        expanded.add(shape.id)
        changed = true
      }
    }
  }
  return [...expanded]
}
