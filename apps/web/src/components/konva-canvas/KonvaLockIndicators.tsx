import { Group, Path, Rect } from 'react-konva'
import { getShapeBounds, type CanvasBounds, type CanvasShape } from '@/features/canvas-engine'

type KonvaLockIndicatorsProps = {
  shapes: CanvasShape[]
  zoom: number
}

export function KonvaLockIndicators({ shapes, zoom }: KonvaLockIndicatorsProps) {
  return (
    <>
      {getLockedIndicators(shapes).map((indicator) => <LockIndicator bounds={indicator.bounds} key={indicator.id} zoom={zoom} />)}
    </>
  )
}

function getLockedIndicators(shapes: CanvasShape[]) {
  const groupIndicators = new Map<string, { bounds: CanvasBounds; id: string }>()
  const indicators: { bounds: CanvasBounds; id: string }[] = []

  for (const shape of shapes) {
    if (!shape.isLocked) continue
    if (!shape.groupId) {
      indicators.push({ bounds: getShapeBounds(shape), id: `lock-${shape.id}` })
      continue
    }

    const groupShapes = shapes.filter((item) => item.groupId === shape.groupId)
    groupIndicators.set(shape.groupId, {
      bounds: mergeBounds(groupShapes.map(getShapeBounds)),
      id: `lock-group-${shape.groupId}`,
    })
  }

  return [...indicators, ...groupIndicators.values()]
}

function LockIndicator({ bounds, zoom }: { bounds: CanvasBounds; zoom: number }) {
  const size = 18 / zoom
  const strokeWidth = 1.8 / zoom
  return (
    <Group listening={false} x={bounds.minX + 8 / zoom} y={bounds.minY - 26 / zoom}>
      <Rect
        cornerRadius={3 / zoom}
        fill="#ffffff"
        height={size}
        shadowBlur={4 / zoom}
        shadowColor="rgba(36, 49, 66, 0.16)"
        shadowOffsetY={1 / zoom}
        stroke="rgba(36, 49, 66, 0.18)"
        strokeWidth={1 / zoom}
        width={size}
      />
      <Path
        data={`M ${5 / zoom} ${8.4 / zoom} L ${5 / zoom} ${14 / zoom} L ${13 / zoom} ${14 / zoom} L ${13 / zoom} ${8.4 / zoom} Z M ${6.6 / zoom} ${8.2 / zoom} L ${6.6 / zoom} ${6.7 / zoom} C ${6.6 / zoom} ${3.7 / zoom} ${11.4 / zoom} ${3.7 / zoom} ${11.4 / zoom} ${6.7 / zoom} L ${11.4 / zoom} ${8.2 / zoom}`}
        lineCap="round"
        lineJoin="round"
        stroke="#243142"
        strokeWidth={strokeWidth}
      />
    </Group>
  )
}

function mergeBounds(bounds: CanvasBounds[]) {
  return bounds.reduce((merged, item) => ({
    maxX: Math.max(merged.maxX, item.maxX),
    maxY: Math.max(merged.maxY, item.maxY),
    minX: Math.min(merged.minX, item.minX),
    minY: Math.min(merged.minY, item.minY),
  }))
}
