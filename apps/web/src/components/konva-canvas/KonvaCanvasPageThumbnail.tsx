'use client'

import { useMemo } from 'react'
import { boundsToRect, getShapeBounds, type CanvasBounds, type CanvasDocument, type CanvasShape } from '@/features/canvas-engine'

export function KonvaCanvasPageThumbnail({
  document,
  fallbackIndex,
}: {
  document: CanvasDocument
  fallbackIndex: number
}) {
  const preview = useMemo(() => getPagePreview(document.shapes), [document.shapes])
  if (!preview) return <span>{fallbackIndex}</span>
  return (
    <svg aria-hidden className="konva-canvas-pages__thumb-svg" viewBox="0 0 84 63">
      <rect fill="#ffffff" height="63" width="84" x="0" y="0" />
      {preview.items.map((item) => (
        <rect
          fill={item.fill}
          height={item.height}
          key={item.id}
          rx={item.rx}
          stroke={item.stroke}
          strokeWidth={item.strokeWidth}
          width={item.width}
          x={item.x}
          y={item.y}
        />
      ))}
    </svg>
  )
}

function getPagePreview(shapes: CanvasShape[]) {
  if (shapes.length === 0) return null
  const bounds = getShapesBounds(shapes)
  if (!bounds) return null
  const rect = boundsToRect(bounds)
  const safeWidth = Math.max(1, rect.width)
  const safeHeight = Math.max(1, rect.height)
  const scale = Math.min(68 / safeWidth, 47 / safeHeight)
  const offsetX = (84 - safeWidth * scale) / 2
  const offsetY = (63 - safeHeight * scale) / 2
  const visibleShapes = shapes.slice(-36)
  return {
    items: visibleShapes.map((shape) => {
      const shapeBounds = getShapeBounds(shape)
      const shapeRect = boundsToRect(shapeBounds)
      const width = Math.max(1.5, shapeRect.width * scale)
      const height = Math.max(1.5, shapeRect.height * scale)
      return {
        fill: getPreviewFill(shape),
        height,
        id: shape.id,
        rx: getPreviewRadius(shape),
        stroke: shape.style?.stroke ?? '#5b4bdb',
        strokeWidth: shape.type === 'stroke' || shape.type === 'line' || shape.type === 'arrow' ? 1.8 : 1,
        width,
        x: offsetX + (shapeRect.x - rect.x) * scale,
        y: offsetY + (shapeRect.y - rect.y) * scale,
      }
    }),
  }
}

function getShapesBounds(shapes: CanvasShape[]) {
  return shapes.map(getShapeBounds).reduce<CanvasBounds | null>((current, bounds) => {
    if (!current) return bounds
    return {
      maxX: Math.max(current.maxX, bounds.maxX),
      maxY: Math.max(current.maxY, bounds.maxY),
      minX: Math.min(current.minX, bounds.minX),
      minY: Math.min(current.minY, bounds.minY),
    }
  }, null)
}

function getPreviewFill(shape: CanvasShape) {
  if (shape.type === 'image') return '#dbeafe'
  if (shape.type === 'node_card') return '#f5f3ff'
  if (shape.type === 'sticky') return '#fef3c7'
  if (shape.type === 'stroke' || shape.type === 'line' || shape.type === 'arrow') return shape.style?.stroke ?? '#5b4bdb'
  return shape.style?.fill ?? '#eef2ff'
}

function getPreviewRadius(shape: CanvasShape) {
  if (shape.type === 'ellipse') return 999
  if (shape.type === 'sticky' || shape.type === 'node_card') return 4
  return 2
}
