import { boundsToRect, getShapeBounds, screenToWorld, type CanvasCamera, type CanvasDocument } from '@/features/canvas-engine'

type KonvaCanvasNavigatorProps = {
  camera: CanvasCamera
  document: CanvasDocument
  stageHeight: number
  stageWidth: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

export function KonvaCanvasNavigator({
  camera,
  document,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  stageHeight,
  stageWidth,
}: KonvaCanvasNavigatorProps) {
  const model = getNavigatorModel(document, camera, stageWidth, stageHeight)
  const zoom = Math.round(camera.zoom * 100)

  return (
    <div className="konva-canvas-navigator" aria-label="Canvas navigation">
      <svg className="konva-canvas-navigator__map" viewBox={`0 0 ${model.width} ${model.height}`} aria-hidden>
        {model.items.map((item) => (
          <rect
            fill="rgba(33, 50, 68, 0.14)"
            height={item.height}
            key={item.id}
            rx="2"
            stroke="rgba(33, 50, 68, 0.22)"
            strokeWidth="1"
            width={item.width}
            x={item.x}
            y={item.y}
          />
        ))}
        <rect
          fill="rgba(112, 86, 255, 0.08)"
          height={model.viewport.height}
          rx="4"
          stroke="#6b5cff"
          strokeWidth="1.5"
          width={model.viewport.width}
          x={model.viewport.x}
          y={model.viewport.y}
        />
      </svg>
      <div className="konva-canvas-navigator__controls">
        <button aria-label="Zoom out" onClick={onZoomOut} type="button">-</button>
        <button aria-label="Reset zoom to 100%" onClick={onZoomReset} type="button">{zoom}%</button>
        <button aria-label="Zoom in" onClick={onZoomIn} type="button">+</button>
      </div>
    </div>
  )
}

function getNavigatorModel(document: CanvasDocument, camera: CanvasCamera, stageWidth: number, stageHeight: number) {
  const mapWidth = 168
  const mapHeight = 104
  const bounds = document.shapes.map((shape) => getShapeBounds(shape))
  const viewportBounds = {
    maxX: screenToWorld({ x: stageWidth, y: stageHeight }, camera).x,
    maxY: screenToWorld({ x: stageWidth, y: stageHeight }, camera).y,
    minX: screenToWorld({ x: 0, y: 0 }, camera).x,
    minY: screenToWorld({ x: 0, y: 0 }, camera).y,
  }
  const allBounds = [...bounds, viewportBounds]
  const minX = Math.min(...allBounds.map((bound) => bound.minX), -200)
  const minY = Math.min(...allBounds.map((bound) => bound.minY), -160)
  const maxX = Math.max(...allBounds.map((bound) => bound.maxX), 1200)
  const maxY = Math.max(...allBounds.map((bound) => bound.maxY), 800)
  const worldWidth = Math.max(1, maxX - minX)
  const worldHeight = Math.max(1, maxY - minY)
  const scale = Math.min(mapWidth / worldWidth, mapHeight / worldHeight)
  const xOffset = (mapWidth - worldWidth * scale) / 2
  const yOffset = (mapHeight - worldHeight * scale) / 2
  const project = (rect: { height: number; width: number; x: number; y: number }) => ({
    height: Math.max(2, rect.height * scale),
    width: Math.max(2, rect.width * scale),
    x: (rect.x - minX) * scale + xOffset,
    y: (rect.y - minY) * scale + yOffset,
  })

  return {
    height: mapHeight,
    items: document.shapes.map((shape) => ({ id: shape.id, ...project(boundsToRect(getShapeBounds(shape))) })),
    viewport: project(boundsToRect(viewportBounds)),
    width: mapWidth,
  }
}
