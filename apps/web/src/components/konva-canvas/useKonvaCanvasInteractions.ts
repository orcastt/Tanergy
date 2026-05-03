import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  appendCanvasShape,
  getShapeBounds,
  pointerToWorld,
  withCanvasShapes,
  zoomCameraAtScreenPoint,
  type CanvasBounds,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasPoint,
  type CanvasShape,
  type CanvasShapeStyle,
} from '@/features/canvas-engine'
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
  isTinyBounds,
  resizeBoundsFromHandle,
  resizeShapeToBounds,
} from './konvaSelectionUtils'
import { boundsContainPoint, clearBrowserSelection, getStagePointer, isStageTarget } from './konvaStageHelpers'
import { useKonvaStageCamera } from './useKonvaStageCamera'
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
}

export function useKonvaCanvasInteractions(options: UseKonvaCanvasInteractionsOptions) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const sessionRef = useRef<KonvaToolSession | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingDraftRef = useRef<CanvasShape | null>(null)
  const documentRef = useRef(options.document)
  const { applyCamera, cameraRef, scheduleCameraCommit } = useKonvaStageCamera({
    camera: options.camera,
    onCameraCommit: options.onCameraCommit,
    onCameraPreview: options.onCameraPreview,
    stageRef,
  })
  const [draft, setDraft] = useState<CanvasShape | null>(null)
  const [eraserTrail, setEraserTrail] = useState<CanvasPoint[]>([])
  const [selectionBox, setSelectionBox] = useState<CanvasBounds | null>(null)

  useEffect(() => {
    documentRef.current = options.document
  }, [options.document])

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  const handleShapeDragEnd = useCallback((shapeId: string, x: number, y: number) => {
    options.onHistoryCheckpoint(documentRef.current)
    options.onDocumentChange((current) => withCanvasShapes(
      current,
      current.shapes.map((item) => item.id === shapeId ? { ...item, x, y } : item)
    ))
  }, [options])

  const handleShapeSelect = useCallback((shapeId: string, config: { additive?: boolean } = {}) => {
    options.onSelectionChange(config.additive ? toggleId(options.selectedIds, shapeId) : [shapeId])
  }, [options])

  const handleResizeStart = useCallback((shapeId: string, handle: KonvaResizeHandle, event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true
    event.evt.preventDefault()
    const shape = documentRef.current.shapes.find((item) => item.id === shapeId)
    if (!shape) return
    options.onHistoryCheckpoint(documentRef.current)
    sessionRef.current = {
      handle,
      originBounds: getShapeBounds(shape),
      pointerId: event.evt.pointerId,
      shapeId,
      type: 'resize',
    }
  }, [options])

  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return
    clearBrowserSelection()
    event.evt.preventDefault()
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
      const bounds = resizeBoundsFromHandle(session.originBounds, session.handle, worldPoint, { preserveAspect: event.evt.shiftKey })
      previewDocument(withCanvasShapes(documentRef.current, documentRef.current.shapes.map((shape) => (
        shape.id === session.shapeId ? resizeShapeToBounds(shape, bounds) : shape
      ))))
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
    if (session?.type === 'erase') window.setTimeout(() => setEraserTrail([]), 120)
    if (session?.type === 'select-box') finishBoxSelection(session)
    const nextDraft = session?.type === 'create' ? finalizeDraft(session.draft) : null
    pendingDraftRef.current = null
    setDraft(null)
    if (nextDraft) options.onDocumentChange((current) => appendCanvasShape(current, nextDraft))
  }

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return
    const currentCamera = cameraRef.current
    const nextZoom = currentCamera.zoom * (event.evt.deltaY > 0 ? 0.9 : 1.1)
    applyCamera(zoomCameraAtScreenPoint(currentCamera, screenPoint, nextZoom, 0.2, 4))
    scheduleCameraCommit()
  }

  return {
    draft,
    eraserTrail,
    handlePointerDown,
    handlePointerLeave: () => setEraserTrail([]),
    handlePointerMove,
    handlePointerUp,
    handleResizeStart,
    handleShapeDragEnd,
    handleShapeSelect,
    handleWheel,
    selectionBox,
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
    if (isTinyBounds(bounds)) {
      if (!session.additive) options.onSelectionChange([])
      return
    }
    const selected = getBoxSelectedIds(documentRef.current.shapes, bounds)
    options.onSelectionChange(session.additive ? mergeIds(options.selectedIds, selected) : selected)
  }

  function scheduleDraft(shape: CanvasShape) {
    pendingDraftRef.current = shape
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setDraft(pendingDraftRef.current)
    })
  }

  function eraseAtPoint(point: CanvasPoint) {
    const radius = 10 / cameraRef.current.zoom
    const current = documentRef.current
    const nextShapes = current.shapes.filter((shape) => !boundsContainPoint(getShapeBounds(shape), point, radius))
    if (nextShapes.length === current.shapes.length) return
    previewDocument(withCanvasShapes(current, nextShapes))
  }

  function previewDocument(document: CanvasDocument) {
    documentRef.current = document
    options.onDocumentPreview(document)
  }

  function updateEraserTrail(point: CanvasPoint) {
    setEraserTrail((trail) => [...trail.slice(-7), point])
  }
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

function mergeIds(current: string[], next: string[]) {
  return Array.from(new Set([...current, ...next]))
}
