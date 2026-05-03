import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef, useState } from 'react'
import { Layer, Rect, Stage } from 'react-konva'
import {
  appendCanvasShape,
  createPoint,
  distanceBetweenPoints,
  getShapeBounds,
  pointerToWorld,
  simplifyStrokePoints,
  smoothStrokePoints,
  withCanvasShapes,
  zoomCameraAtScreenPoint,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasPoint,
  type CanvasShape,
  type StrokePoint,
} from '@/features/canvas-engine'
import { KonvaCanvasShape } from './KonvaCanvasShape'
import type { KonvaCanvasTool, KonvaToolSession } from './konvaCanvasTypes'

type KonvaCanvasStageProps = {
  activeTool: KonvaCanvasTool
  camera: CanvasCamera
  document: CanvasDocument
  height: number
  selectedIds: string[]
  width: number
  onCameraChange: (camera: CanvasCamera) => void
  onDocumentChange: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
}

const boxTools = new Set<KonvaCanvasTool>(['rect', 'diamond', 'ellipse', 'triangle', 'cloud'])

export function KonvaCanvasStage({
  activeTool,
  camera,
  document,
  height,
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

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    if (!isStageTarget(event)) return

    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return
    const worldPoint = pointerToWorld({ ...screenPoint, pressure: event.evt.pressure }, camera)

    if (activeTool === 'select') {
      onSelectionChange([])
      return
    }
    if (activeTool === 'hand') {
      sessionRef.current = { origin: screenPoint, pointerId: event.evt.pointerId, type: 'pan' }
      return
    }
    if (activeTool === 'eraser') {
      sessionRef.current = { pointerId: event.evt.pointerId, type: 'erase' }
      eraseAtPoint(worldPoint)
      return
    }
    if (activeTool === 'text') {
      const shape = createTextShape(worldPoint)
      onDocumentChange(appendCanvasShape(document, shape))
      onSelectionChange([shape.id])
      return
    }

    const draftShape = createDraftShape(activeTool, worldPoint, worldPoint)
    if (!draftShape) return
    sessionRef.current = {
      draft: draftShape,
      origin: worldPoint,
      pointerId: event.evt.pointerId,
      rawPoints: activeTool === 'draw' ? [worldPoint] : undefined,
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
      ? updateStrokeDraft(session, worldPoint)
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
    onDocumentChange(appendCanvasShape(document, nextDraft))
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
            onDragEnd={(shapeId, x, y) => onDocumentChange(withCanvasShapes(document, document.shapes.map((item) => item.id === shapeId ? { ...item, x, y } : item)))}
            onSelect={(shapeId) => onSelectionChange([shapeId])}
            shape={shape}
            toolAllowsDrag={activeTool === 'select'}
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

function updateStrokeDraft(session: Extract<KonvaToolSession, { type: 'create' }>, point: CanvasPoint): CanvasShape {
  if (session.draft.type !== 'stroke') return session.draft
  const rawPoints: StrokePoint[] = session.rawPoints ?? [{ ...session.origin, pressure: 0.5 }]
  const previous = rawPoints[rawPoints.length - 1]
  if (distanceBetweenPoints(previous, point) > 1.5) rawPoints.push(point)
  session.rawPoints = rawPoints
  return {
    ...session.draft,
    props: {
      points: rawPoints.map((rawPoint) => ({
        pressure: rawPoint.pressure ?? 0.5,
        x: rawPoint.x - session.origin.x,
        y: rawPoint.y - session.origin.y,
      })),
    },
  }
}

function finalizeDraft(shape: CanvasShape): CanvasShape | null {
  if (shape.type === 'stroke') {
    if (shape.props.points.length < 2) return null
    const points = simplifyStrokePoints(smoothStrokePoints(shape.props.points, { radius: 2 }), { minDistance: 0.9, tolerance: 1.2 })
    return { ...shape, props: { points } }
  }
  if ('width' in shape.props && 'height' in shape.props && (shape.props.width < 6 || shape.props.height < 6)) return null
  if ((shape.type === 'line' || shape.type === 'arrow') && distanceBetweenPoints(createPoint(), shape.props.end) < 8) return null
  return shape
}

function createDraftShape(tool: KonvaCanvasTool, origin: CanvasPoint, point: CanvasPoint): CanvasShape | null {
  if (tool === 'draw') {
    return { id: createShapeId('stroke'), props: { points: [{ x: 0, y: 0, pressure: 0.5 } as StrokePoint] }, style: baseStyle(2), type: 'stroke', x: origin.x, y: origin.y }
  }
  if (tool === 'line' || tool === 'arrow') {
    return { id: createShapeId(tool), props: { end: { x: point.x - origin.x, y: point.y - origin.y } }, style: baseStyle(2), type: tool, x: origin.x, y: origin.y }
  }
  if (!boxTools.has(tool)) return null
  const x = Math.min(origin.x, point.x)
  const y = Math.min(origin.y, point.y)
  const width = Math.abs(point.x - origin.x)
  const height = Math.abs(point.y - origin.y)
  return { id: createShapeId(tool), props: { height, width }, style: baseStyle(2), type: tool, x, y } as CanvasShape
}

function createTextShape(point: CanvasPoint): CanvasShape {
  return { id: createShapeId('text'), props: { height: 56, text: 'Text', width: 180 }, style: baseStyle(2), type: 'text', x: point.x, y: point.y }
}

function baseStyle(strokeWidth: number) {
  return { fill: 'rgba(255, 255, 255, 0.82)', opacity: 1, stroke: '#243142', strokeWidth }
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

function createShapeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
