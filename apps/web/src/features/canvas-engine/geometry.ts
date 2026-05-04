import type { CanvasBounds, CanvasCamera, CanvasPoint, CanvasPointer, CanvasRect, CanvasShape } from './types'

export const defaultCanvasCamera: CanvasCamera = {
  x: 0,
  y: 0,
  zoom: 1,
}

export function createPoint(x = 0, y = 0): CanvasPoint {
  return { x, y }
}

export function addPoints(a: CanvasPoint, b: CanvasPoint): CanvasPoint {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function subtractPoints(a: CanvasPoint, b: CanvasPoint): CanvasPoint {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scalePoint(point: CanvasPoint, scale: number): CanvasPoint {
  return { x: point.x * scale, y: point.y * scale }
}

export function distanceBetweenPoints(a: CanvasPoint, b: CanvasPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: CanvasPoint, b: CanvasPoint): CanvasPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function screenToWorld(point: CanvasPoint, camera: CanvasCamera): CanvasPoint {
  const zoom = normalizeZoom(camera.zoom)
  return {
    x: (point.x - camera.x) / zoom,
    y: (point.y - camera.y) / zoom,
  }
}

export function worldToScreen(point: CanvasPoint, camera: CanvasCamera): CanvasPoint {
  const zoom = normalizeZoom(camera.zoom)
  return {
    x: point.x * zoom + camera.x,
    y: point.y * zoom + camera.y,
  }
}

export function screenDeltaToWorld(delta: CanvasPoint, camera: CanvasCamera): CanvasPoint {
  const zoom = normalizeZoom(camera.zoom)
  return {
    x: delta.x / zoom,
    y: delta.y / zoom,
  }
}

export function pointerToWorld(pointer: CanvasPointer, camera: CanvasCamera): CanvasPointer {
  return {
    ...pointer,
    ...screenToWorld(pointer, camera),
  }
}

export function clampCameraZoom(camera: CanvasCamera, minZoom = 0.1, maxZoom = 8): CanvasCamera {
  return {
    ...camera,
    zoom: clamp(camera.zoom, minZoom, maxZoom),
  }
}

export function panCamera(camera: CanvasCamera, delta: CanvasPoint): CanvasCamera {
  return {
    ...camera,
    x: camera.x + delta.x,
    y: camera.y + delta.y,
  }
}

export function zoomCameraAtScreenPoint(
  camera: CanvasCamera,
  screenPoint: CanvasPoint,
  nextZoom: number,
  minZoom = 0.1,
  maxZoom = 8
): CanvasCamera {
  const worldPoint = screenToWorld(screenPoint, camera)
  const zoom = clamp(nextZoom, minZoom, maxZoom)
  return {
    x: screenPoint.x - worldPoint.x * zoom,
    y: screenPoint.y - worldPoint.y * zoom,
    zoom,
  }
}

export function getRectBounds(rect: CanvasRect): CanvasBounds {
  return {
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height,
    minX: rect.x,
    minY: rect.y,
  }
}

export function getShapeBounds(shape: CanvasShape): CanvasBounds {
  if (shape.type === 'stroke') return getPointsBounds(shape.props.points, { x: shape.x, y: shape.y })
  if (shape.type === 'line' || shape.type === 'arrow') {
    const points = [createPoint(), shape.props.end]
    if (shape.props.control) points.push(shape.props.control)
    if (shape.props.bends) points.push(...shape.props.bends)
    return getPointsBounds(points, { x: shape.x, y: shape.y })
  }

  if (shape.rotation) {
    const center = { x: shape.x + shape.props.width / 2, y: shape.y + shape.props.height / 2 }
    return getPointsBounds([
      rotatePoint({ x: shape.x, y: shape.y }, center, shape.rotation),
      rotatePoint({ x: shape.x + shape.props.width, y: shape.y }, center, shape.rotation),
      rotatePoint({ x: shape.x + shape.props.width, y: shape.y + shape.props.height }, center, shape.rotation),
      rotatePoint({ x: shape.x, y: shape.y + shape.props.height }, center, shape.rotation),
    ])
  }

  return getRectBounds({
    height: shape.props.height,
    width: shape.props.width,
    x: shape.x,
    y: shape.y,
  })
}

export function getPointsBounds(points: CanvasPoint[], offset: CanvasPoint = createPoint()): CanvasBounds {
  if (points.length === 0) {
    return {
      maxX: offset.x,
      maxY: offset.y,
      minX: offset.x,
      minY: offset.y,
    }
  }

  return points.reduce<CanvasBounds>((bounds, point) => {
    const x = point.x + offset.x
    const y = point.y + offset.y
    return {
      maxX: Math.max(bounds.maxX, x),
      maxY: Math.max(bounds.maxY, y),
      minX: Math.min(bounds.minX, x),
      minY: Math.min(bounds.minY, y),
    }
  }, {
    maxX: -Infinity,
    maxY: -Infinity,
    minX: Infinity,
    minY: Infinity,
  })
}

export function expandBounds(bounds: CanvasBounds, padding: number): CanvasBounds {
  return {
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
  }
}

export function boundsToRect(bounds: CanvasBounds): CanvasRect {
  return {
    height: bounds.maxY - bounds.minY,
    width: bounds.maxX - bounds.minX,
    x: bounds.minX,
    y: bounds.minY,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

function rotatePoint(point: CanvasPoint, center: CanvasPoint, rotation: number): CanvasPoint {
  const radians = rotation * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}
