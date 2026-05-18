import type Konva from 'konva'
import { useCallback, useRef } from 'react'
import { Layer, Group, Stage } from 'react-konva'
import type { CanvasCamera, CanvasDocument, CanvasNodeShape, CanvasPoint, CanvasShape } from '@/features/canvas-engine'
import type { BoardCollaborationSessionRecord } from '@/features/boards/boardCollaborationTypes'
import { KonvaCanvasBackground } from './KonvaCanvasBackground'
import { KonvaCanvasShape } from './KonvaCanvasShape'
import { KonvaFrameChrome } from './KonvaFrameChrome'
import { KonvaNodeEdgeLayer } from './KonvaNodeEdgeLayer'
import { KonvaRemoteDraftLayer } from './KonvaRemoteDraftLayer'
import { konvaCaptureExcludeName } from './konvaSelectionExport'
import { getVisibleKonvaShapes } from './konvaViewportCulling'
import { getStagePointer } from './konvaStageHelpers'
import { useKonvaStageCamera } from './useKonvaStageCamera'
import { useKonvaWheelHandler } from './useKonvaWheelHandler'

type KonvaCanvasViewerStageProps = {
  activePageId?: string | null
  camera: CanvasCamera
  collaborationPresenceSessions?: readonly BoardCollaborationSessionRecord[]
  document: CanvasDocument
  height: number
  width: number
  onCameraCommit: (camera: CanvasCamera) => void
  onCameraPreview: (camera: CanvasCamera) => void
  onStageReady?: (stage: Konva.Stage | null) => void
}

export function KonvaCanvasViewerStage({
  activePageId = null,
  camera,
  collaborationPresenceSessions,
  document,
  height,
  width,
  onCameraCommit,
  onCameraPreview,
  onStageReady,
}: KonvaCanvasViewerStageProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const panOriginRef = useRef<CanvasPoint | null>(null)
  const { applyCamera, cameraRef, scheduleCameraCommit } = useKonvaStageCamera({
    camera,
    onCameraCommit,
    onCameraPreview,
    stageRef,
  })
  const handleWheel = useKonvaWheelHandler({
    applyCamera,
    cameraRef,
    scheduleCameraCommit,
    stageRef,
  })
  const renderShapes = getVisibleKonvaShapes({
    camera,
    draggingShapeIds: [],
    height,
    selectedIds: [],
    shapes: document.shapes,
    width,
  })
  const frameIds = new Set(renderShapes.filter((shape) => shape.type === 'frame').map((shape) => shape.id))
  const frameChildren = getFrameChildren(renderShapes, frameIds)
  const nodeShapes = renderShapes.filter((shape): shape is CanvasNodeShape => shape.type === 'node_card')

  const handlePointerDown = useCallback((event: Konva.KonvaEventObject<PointerEvent>) => {
    if (event.evt.button !== 0 && event.evt.button !== 1) return
    const point = getStagePointer(stageRef.current)
    if (!point) return
    event.evt.preventDefault()
    panOriginRef.current = point
  }, [])

  const handlePointerMove = useCallback((event: Konva.KonvaEventObject<PointerEvent>) => {
    const origin = panOriginRef.current
    const point = getStagePointer(stageRef.current)
    if (!origin || !point) return
    event.evt.preventDefault()
    const currentCamera = cameraRef.current
    applyCamera({
      ...currentCamera,
      x: currentCamera.x + point.x - origin.x,
      y: currentCamera.y + point.y - origin.y,
    })
    scheduleCameraCommit()
    panOriginRef.current = point
  }, [applyCamera, cameraRef, scheduleCameraCommit])

  const handlePointerUp = useCallback(() => {
    if (!panOriginRef.current) return
    panOriginRef.current = null
    scheduleCameraCommit(0)
  }, [scheduleCameraCommit])

  const handleStageRef = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage
    onStageReady?.(stage)
  }, [onStageReady])

  return (
    <Stage
      height={height}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      ref={handleStageRef}
      width={width}
    >
      <Layer listening={false}>
        <KonvaCanvasBackground camera={camera} height={height} width={width} />
      </Layer>

      <Layer listening={false}>
        <KonvaNodeEdgeLayer
          edges={document.runtimeEdges}
          shapes={nodeShapes}
          zoom={camera.zoom}
        />
      </Layer>

      <Layer listening={false}>
        {renderShapes.map((shape) => {
          if (shape.parentId && frameIds.has(shape.parentId)) return null
          if (shape.type !== 'frame') return renderShapeNode(shape, document, camera.zoom, false)
          return (
            <Group key={shape.id}>
              {renderShapeNode(shape, document, camera.zoom, false)}
              <Group clipFunc={(context) => {
                context.rect(shape.x, shape.y, shape.props.width, shape.props.height)
              }}>
                {(frameChildren.get(shape.id) ?? []).map((child) => renderShapeNode(child, document, camera.zoom, false))}
              </Group>
              <KonvaFrameChrome frame={shape} />
            </Group>
          )
        })}
      </Layer>

      {!collaborationPresenceSessions || collaborationPresenceSessions.length === 0 ? null : (
        <Layer listening={false} name={konvaCaptureExcludeName}>
          <KonvaRemoteDraftLayer
            activePageId={activePageId}
            document={document}
            sessions={collaborationPresenceSessions}
            zoom={camera.zoom}
          />
        </Layer>
      )}
    </Stage>
  )
}

function renderShapeNode(
  shape: CanvasShape,
  document: CanvasDocument,
  zoom: number,
  previewMode: boolean
) {
  return (
    <KonvaCanvasShape
      document={document}
      interactive={false}
      isSelected={false}
      onDragEnd={() => undefined}
      onDragMove={() => undefined}
      onDragStart={() => undefined}
      onDoubleClick={() => undefined}
      onSelect={() => undefined}
      panMode={false}
      previewMode={previewMode}
      selectable={false}
      key={shape.id}
      shape={shape}
      toolAllowsDrag={false}
      zoom={zoom}
    />
  )
}

function getFrameChildren(shapes: CanvasShape[], frameIds: Set<string>) {
  const children = new Map<string, CanvasShape[]>()
  for (const shape of shapes) {
    if (!shape.parentId || !frameIds.has(shape.parentId)) continue
    const current = children.get(shape.parentId) ?? []
    current.push(shape)
    children.set(shape.parentId, current)
  }
  return children
}
