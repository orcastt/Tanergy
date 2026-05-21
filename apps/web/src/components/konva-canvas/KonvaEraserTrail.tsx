import { Circle, Line } from 'react-konva'
import type { CanvasPoint } from '@/features/canvas-engine'

type KonvaEraserTrailProps = {
  points: CanvasPoint[]
  zoom: number
}

export function KonvaEraserTrail({ points, zoom }: KonvaEraserTrailProps) {
  if (points.length === 0) return null
  const radius = 11 / zoom
  const lastPoint = points[points.length - 1]
  return (
    <>
      <Line
        lineCap="round"
        lineJoin="round"
        listening={false}
        opacity={0.3}
        points={points.flatMap((point) => [point.x, point.y])}
        stroke="#5f6f85"
        strokeWidth={radius * 1.2}
      />
      <Circle
        fill="rgba(95, 111, 133, 0.12)"
        listening={false}
        radius={radius}
        stroke="rgba(95, 111, 133, 0.78)"
        strokeWidth={1.2 / zoom}
        x={lastPoint.x}
        y={lastPoint.y}
      />
    </>
  )
}
