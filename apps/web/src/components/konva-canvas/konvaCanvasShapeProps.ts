import type { CanvasDocument, CanvasShape } from '@/features/canvas-engine'

export type KonvaCanvasShapePropPatch = {
  cornerRadius?: number
}

const defaultRectCornerRadius = 10

export function isKonvaCornerRadiusShape(shape: CanvasShape) {
  return shape.type === 'rect' || shape.type === 'triangle' || shape.type === 'diamond'
}

export function getKonvaShapeCornerRadius(shape: CanvasShape) {
  if (!isKonvaCornerRadiusShape(shape)) return 0
  const fallback = shape.type === 'rect' ? defaultRectCornerRadius : 0
  return clampCornerRadius(shape.props.cornerRadius, getKonvaShapeCornerRadiusLimit(shape), fallback)
}

export function getKonvaShapeCornerRadiusLimit(shape: CanvasShape) {
  if (!isKonvaCornerRadiusShape(shape)) return 0
  return Math.max(0, Math.min(shape.props.width, shape.props.height) / 2)
}

export function getKonvaSelectionCornerRadiusSnapshot(shapes: CanvasShape[]) {
  const eligible = shapes.filter(isKonvaCornerRadiusShape)
  if (eligible.length === 0) return null
  const [first, ...rest] = eligible
  const firstRadius = getKonvaShapeCornerRadius(first)
  return rest.every((shape) => getKonvaShapeCornerRadius(shape) === firstRadius)
    ? firstRadius
    : 'mixed'
}

export function getKonvaSelectionCornerRadiusLimit(shapes: CanvasShape[]) {
  const eligible = shapes.filter(isKonvaCornerRadiusShape)
  if (eligible.length === 0) return 0
  return Math.max(0, Math.min(...eligible.map(getKonvaShapeCornerRadiusLimit)))
}

export function applyKonvaShapePropPatch(
  document: CanvasDocument,
  shapeIds: string[],
  patch: KonvaCanvasShapePropPatch
) {
  if (shapeIds.length === 0) return document
  const selected = new Set(shapeIds)
  return {
    ...document,
    metadata: { ...document.metadata, updatedAt: new Date().toISOString() },
    shapes: document.shapes.map((shape) => {
      if (!selected.has(shape.id) || !isKonvaCornerRadiusShape(shape)) return shape
      return {
        ...shape,
        props: {
          ...shape.props,
          ...(patch.cornerRadius !== undefined
            ? {
                cornerRadius: clampCornerRadius(
                  patch.cornerRadius,
                  getKonvaShapeCornerRadiusLimit(shape),
                  getKonvaShapeCornerRadius(shape),
                ),
              }
            : null),
        },
      }
    }),
  }
}

function clampCornerRadius(value: unknown, limit: number, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(limit, Math.round(value)))
}
