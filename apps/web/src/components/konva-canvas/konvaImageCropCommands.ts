import type { CanvasDocument, CanvasImageShape, CanvasPoint } from '@/features/canvas-engine'

export type KonvaImageCropHandle = 'bottom' | 'left' | 'right' | 'top'

export function canCropKonvaImageSelection(document: CanvasDocument, selectedIds: string[]) {
  return getCropImageIdForSelection(document, selectedIds) !== null
}

export function getCropImageIdForSelection(document: CanvasDocument, selectedIds: string[]) {
  if (selectedIds.length !== 1) return null
  const selectedId = selectedIds[0]
  return document.shapes.some((shape) => shape.id === selectedId && shape.type === 'image') ? selectedId : null
}

export function updateKonvaImageCropFromHandle(
  originShape: CanvasImageShape,
  handle: KonvaImageCropHandle,
  worldPoint: CanvasPoint
): CanvasImageShape {
  const width = Math.max(1, originShape.props.width)
  const height = Math.max(1, originShape.props.height)
  const localPoint = worldToLocalImagePoint(originShape, worldPoint)
  const minWidth = getMinimumCropSize(width)
  const minHeight = getMinimumCropSize(height)
  let left = 0
  let top = 0
  let right = width
  let bottom = height

  if (handle === 'left') left = clamp(localPoint.x, 0, width - minWidth)
  if (handle === 'right') right = clamp(localPoint.x, minWidth, width)
  if (handle === 'top') top = clamp(localPoint.y, 0, height - minHeight)
  if (handle === 'bottom') bottom = clamp(localPoint.y, minHeight, height)

  const nextWidth = Math.max(minWidth, right - left)
  const nextHeight = Math.max(minHeight, bottom - top)
  const crop = normalizeCrop(originShape.props.crop)
  const nextCrop = {
    height: crop.height * (nextHeight / height),
    width: crop.width * (nextWidth / width),
    x: crop.x + crop.width * (left / width),
    y: crop.y + crop.height * (top / height),
  }
  const originCenter = {
    x: originShape.x + width / 2,
    y: originShape.y + height / 2,
  }
  const centerOffset = {
    x: (left + right) / 2 - width / 2,
    y: (top + bottom) / 2 - height / 2,
  }
  const nextCenter = addPoints(originCenter, rotatePoint(centerOffset, originShape.rotation ?? 0))
  return {
    ...originShape,
    props: {
      ...originShape.props,
      crop: normalizeCrop(nextCrop),
      height: nextHeight,
      width: nextWidth,
    },
    x: nextCenter.x - nextWidth / 2,
    y: nextCenter.y - nextHeight / 2,
  }
}

function worldToLocalImagePoint(shape: CanvasImageShape, worldPoint: CanvasPoint) {
  const center = {
    x: shape.x + shape.props.width / 2,
    y: shape.y + shape.props.height / 2,
  }
  const local = rotatePoint({
    x: worldPoint.x - center.x,
    y: worldPoint.y - center.y,
  }, -(shape.rotation ?? 0))
  return {
    x: local.x + shape.props.width / 2,
    y: local.y + shape.props.height / 2,
  }
}

function rotatePoint(point: CanvasPoint, rotationDegrees: number) {
  const radians = rotationDegrees * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

function addPoints(left: CanvasPoint, right: CanvasPoint) {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
  }
}

function normalizeCrop(crop: CanvasImageShape['props']['crop']) {
  const x = clamp(crop?.x ?? 0, 0, 0.99)
  const y = clamp(crop?.y ?? 0, 0, 0.99)
  return {
    height: clamp(crop?.height ?? 1, 0.01, 1 - y),
    width: clamp(crop?.width ?? 1, 0.01, 1 - x),
    x,
    y,
  }
}

function getMinimumCropSize(size: number) {
  return Math.min(Math.max(12, size * 0.04), Math.max(1, size - 1))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
