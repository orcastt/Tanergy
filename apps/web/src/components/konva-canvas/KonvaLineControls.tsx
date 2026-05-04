import type { KonvaEventObject } from 'konva/lib/Node'
import { Fragment } from 'react'
import { Circle } from 'react-konva'
import type { CanvasShape } from '@/features/canvas-engine'
import type { KonvaLineEndpointHandle, KonvaLineRouteHandle } from './konvaCanvasTypes'
import { getLineCurveHandlePoint, getLineRoute, getOrthogonalBends } from './konvaLineRouteUtils'

type KonvaLineShape = Extract<CanvasShape, { type: 'arrow' | 'line' }>

type KonvaLineControlsProps = {
  shape: KonvaLineShape
  zoom: number
  onEndpointStart: (endpoint: KonvaLineEndpointHandle, event: KonvaEventObject<PointerEvent>) => void
  onRouteHandleStart: (handle: KonvaLineRouteHandle, event: KonvaEventObject<PointerEvent>) => void
}

export function KonvaLineControls({ onEndpointStart, onRouteHandleStart, shape, zoom }: KonvaLineControlsProps) {
  const points = [
    { endpoint: 'start' as const, x: shape.x, y: shape.y },
    { endpoint: 'end' as const, x: shape.x + shape.props.end.x, y: shape.y + shape.props.end.y },
  ]
  const visibleRadius = Math.max(4.8, 5.8 / zoom)
  const hitRadius = Math.max(12, 14 / zoom)
  return (
    <>
      <LineRouteHandles onRouteHandleStart={onRouteHandleStart} shape={shape} zoom={zoom} />
      {points.map((point) => (
        <Fragment key={point.endpoint}>
          <Circle fill="rgba(107, 92, 255, 0.001)" onPointerDown={(event) => onEndpointStart(point.endpoint, event)} radius={hitRadius} x={point.x} y={point.y} />
          <Circle fill="#ffffff" listening={false} radius={visibleRadius} stroke="#6b5cff" strokeWidth={1.3 / zoom} x={point.x} y={point.y} />
        </Fragment>
      ))}
    </>
  )
}

function LineRouteHandles({
  onRouteHandleStart,
  shape,
  zoom,
}: {
  shape: KonvaLineShape
  onRouteHandleStart: (handle: KonvaLineRouteHandle, event: KonvaEventObject<PointerEvent>) => void
  zoom: number
}) {
  const route = getLineRoute(shape)
  const curveHandlePoint = getLineCurveHandlePoint(shape)
  const handles = route === 'orthogonal'
    ? getOrthogonalBends(shape).map((bend, index) => ({ handle: `bend-${index}` as KonvaLineRouteHandle, x: shape.x + bend.x, y: shape.y + bend.y }))
    : [{ handle: 'control' as const, x: shape.x + curveHandlePoint.x, y: shape.y + curveHandlePoint.y }]
  const visibleRadius = Math.max(4.2, 5 / zoom)
  const hitRadius = Math.max(12, 14 / zoom)
  return (
    <>
      {handles.map((point) => (
        <Fragment key={point.handle}>
          <Circle fill="rgba(14, 165, 233, 0.001)" onPointerDown={(event) => onRouteHandleStart(point.handle, event)} radius={hitRadius} x={point.x} y={point.y} />
          <Circle fill="#ffffff" listening={false} radius={visibleRadius} stroke={route === 'orthogonal' ? '#0ea5e9' : '#6b5cff'} strokeWidth={1.2 / zoom} x={point.x} y={point.y} />
        </Fragment>
      ))}
    </>
  )
}
