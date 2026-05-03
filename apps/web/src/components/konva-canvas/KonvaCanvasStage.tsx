import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import { Layer, Rect, Stage } from 'react-konva'
import {
  appendCanvasShape,
  getShapeBounds,
  pointerToWorld,
  withCanvasShapes,
  zoomCameraAtScreenPoint,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasPoint,
  type CanvasShape,
} from '@/features/canvas-engine'
import { KonvaCanvasShape } from './KonvaCanvasShape'
import { createDraftShape, createStrokePoint, createTextShape, finalizeDraft, updateStrokeDraft } from './konvaDraftShapes'
import type { KonvaCanvasTool, KonvaToolSession } from './konvaCanvasTypes'

type KonvaCanvasStageProps = {
  activeTool: KonvaCanvasTool
  camera: CanvasCamera
  document: CanvasDocument
  height: number
  isSpacePanning: boolean
  selectedIds: string[]
  width: number
  onCameraChange: (camera: CanvasCamera) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
}

export function KonvaCanvasStage({
  activeTool,
  camera,
  document,
  height,
  isSpacePanning,
  onCameraChange,
  onDocumentChange,
  onSelectionChange,
  selectedIds,
  width,
}: KonvaCanvasStageProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const sessionRef = useRef<KonvaToolSession | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingDraftRef = useRef<CanvasShape | null>(null)
  const [draft, setDraft] = useState<CanvasShape | null>(null)

  const handleShapeDragEnd = useCallback((shapeId: string, x: number, y: number) => {
    onDocumentChange((current) => withCanvasShapes(
      current,
      current.shapes.map((item) => item.id === shapeId ? { ...item, x, y } : item)
    ))
  }, [onDocumentChange])
  const handleShapeSelect = useCallback((shapeId: string) => onSelectionChange([shapeId]), [onSelectionChange])

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return
    const shouldPan = isSpacePanning || event.evt.button === 1 || activeTool === 'hand'
    if (shouldPan) {
      event.evt.preventDefault()
      sessionRef.current = { origin: screenPoint, pointerId: event.evt.pointerId, type: 'pan' }
      return
    }

    if (!isStageTarget(event)) return
    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, camera)

    if (activeTool === 'select') {
      onSelectionChange([])
      return
    }
    if (activeTool === 'eraser') {
      sessionRef.current = { pointerId: event.evt.pointerId, type: 'erase' }
      eraseAtPoint(worldPoint)
      return
    }
    if (activeTool === 'text') {
      const shape = createTextShape(worldPoint)
      onDocumentChange((current) => appendCanvasShape(current, shape))
      onSelectionChange([shape.id])
      return
    }

    const draftShape = createDraftShape(activeTool, worldPoint, worldPoint)
    if (!draftShape) return
    sessionRef.current = {
      draft: draftShape,
      origin: worldPoint,
      pointerId: event.evt.pointerId,
      rawPoints: activeTool === 'draw' ? [createStrokePoint(worldPoint, event.evt)] : undefined,
      type: 'create',
    }
    scheduleDraft(draftShape)
  }

  const handlePointerMove = (event: KonvaEventObject<PointerEvent>) => {
    const session = sessionRef.current
    const screenPoint = getStagePointer(stageRef.current)
    if (!session || !screenPoint) return

    if (session.type === 'pan') {
      const delta = { x: screenPoint.x - session.origin.x, y: screenPoint.y - session.origin.y }
      onCameraChange({ ...camera, x: camera.x + delta.x, y: camera.y + delta.y })
      session.origin = screenPoint
      return
    }

    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, camera)
    if (session.type === 'erase') {
      eraseAtPoint(worldPoint)
      return
    }
    if (session.type !== 'create') return

    const nextDraft = activeTool === 'draw'
      ? updateStrokeDraft(session, createStrokePoint(worldPoint, event.evt, session.rawPoints?.at(-1)))
      : createDraftShape(activeTool, session.origin, worldPoint)
    if (!nextDraft) return

    session.draft = nextDraft
    scheduleDraft(nextDraft)
  }

  const handlePointerUp = () => {
    const session = sessionRef.current
    sessionRef.current = null
    const nextDraft = session?.type === 'create' ? finalizeDraft(session.draft) : null
    pendingDraftRef.current = null
    setDraft(null)
    if (!nextDraft) return
    onDocumentChange((current) => appendCanvasShape(current, nextDraft))
    onSelectionChange([nextDraft.id])
  }

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return
    const nextZoom = camera.zoom * (event.evt.deltaY > 0 ? 0.9 : 1.1)
    onCameraChange(zoomCameraAtScreenPoint(camera, screenPoint, nextZoom, 0.2, 4))
  }

  const eraseAtPoint = (point: CanvasPoint) => {
    const radius = 10 / camera.zoom
    const nextShapes = document.shapes.filter((shape) => !boundsContainPoint(getShapeBounds(shape), point, radius))
    if (nextShapes.length !== document.shapes.length) onDocumentChange(withCanvasShapes(document, nextShapes))
  }

  const allShapes = draft ? [...document.shapes, draft] : document.shapes

  return (
    <Stage
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      ref={stageRef}
      scaleX={camera.zoom}
      scaleY={camera.zoom}
      width={width}
      x={camera.x}
      y={camera.y}
    >
      <Layer listening={false}>
        <Rect fill="rgba(255,255,255,0.01)" height={height / camera.zoom} width={width / camera.zoom} x={-camera.x / camera.zoom} y={-camera.y / camera.zoom} />
      </Layer>
      <Layer>
        {allShapes.map((shape) => (
          <KonvaCanvasShape
            isSelected={selectedIds.includes(shape.id)}
            key={shape.id}
            onDragEnd={handleShapeDragEnd}
            onSelect={handleShapeSelect}
            panMode={isSpacePanning}
            shape={shape}
            toolAllowsDrag={activeTool === 'select' && !isSpacePanning}
            zoom={camera.zoom}
          />
        ))}
      </Layer>
    </Stage>
  )

  function scheduleDraft(shape: CanvasShape) {
    pendingDraftRef.current = shape
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setDraft(pendingDraftRef.current)
    })
  }
}

function getStagePointer(stage: Konva.Stage | null): CanvasPoint | null {
  const pointer = stage?.getPointerPosition()
  return pointer ? { x: pointer.x, y: pointer.y } : null
}

function isStageTarget(event: KonvaEventObject<PointerEvent>) {
  return event.target === event.target.getStage()
}

function boundsContainPoint(bounds: ReturnType<typeof getShapeBounds>, point: CanvasPoint, padding: number) {
  return point.x >= bounds.minX - padding && point.x <= bounds.maxX + padding && point.y >= bounds.minY - padding && point.y <= bounds.maxY + padding
}
