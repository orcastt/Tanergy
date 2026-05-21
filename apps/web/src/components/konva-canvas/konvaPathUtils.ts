import getStroke from 'perfect-freehand'
import type { CanvasPoint, StrokePoint } from '@/features/canvas-engine'

export function getFreehandPath(points: StrokePoint[], width = 4): string {
  if (points.length < 2) return ''

  const outline = getStroke(points.map((point) => [point.x, point.y, point.pressure ?? 0.5]), {
    easing: (value) => value,
    last: true,
    simulatePressure: false,
    size: width,
    smoothing: 0.26,
    streamline: 0.1,
    thinning: 0.62,
  })

  if (outline.length < 2) return ''

  const [first, ...rest] = outline
  const commands = rest.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`)
  return `M${first[0].toFixed(1)} ${first[1].toFixed(1)} ${commands.join(' ')} Z`
}

export function getCloudPath(width: number, height: number): string {
  const w = Math.max(32, width)
  const h = Math.max(24, height)
  const inset = clamp(Math.min(w, h) * 0.18, 5, 22)
  const left = inset
  const right = w - inset
  const top = inset
  const bottom = h - inset
  const arcSpan = clamp(Math.min(w, h) * 0.46, 22, 54)
  const commands = [
    ...createCloudSide({ fixed: top, from: left, length: right - left, outward: 0, side: 'top' }, arcSpan),
    ...createCloudSide({ fixed: right, from: top, length: bottom - top, outward: w, side: 'right' }, arcSpan),
    ...createCloudSide({ fixed: bottom, from: right, length: left - right, outward: h, side: 'bottom' }, arcSpan),
    ...createCloudSide({ fixed: left, from: bottom, length: top - bottom, outward: 0, side: 'left' }, arcSpan),
  ]

  return [`M ${left.toFixed(1)} ${top.toFixed(1)}`, ...commands, 'Z'].join(' ')
}

type CloudSide = {
  fixed: number
  from: number
  length: number
  outward: number
  side: 'bottom' | 'left' | 'right' | 'top'
}

function createCloudSide(side: CloudSide, arcSpan: number): string[] {
  const count = Math.max(1, Math.round(Math.abs(side.length) / arcSpan))
  const step = side.length / count
  return Array.from({ length: count }, (_, index) => {
    const start = side.from + step * index
    const end = index === count - 1 ? side.from + side.length : start + step
    const mid = (start + end) / 2
    const drift = Math.sin((index + 1) * 1.7) * Math.min(Math.abs(step) * 0.09, 7)

    if (side.side === 'top' || side.side === 'bottom') {
      const control = { x: mid + drift, y: side.outward }
      const point = { x: end, y: side.fixed }
      return formatQuadratic(control, point)
    }

    const control = { x: side.outward, y: mid + drift }
    const point = { x: side.fixed, y: end }
    return formatQuadratic(control, point)
  })
}

function formatQuadratic(control: CanvasPoint, point: CanvasPoint): string {
  return `Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getArrowHeadPoints(end: CanvasPoint, start: CanvasPoint, size = 16): number[] {
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const left = {
    x: end.x - size * Math.cos(angle - Math.PI / 6),
    y: end.y - size * Math.sin(angle - Math.PI / 6),
  }
  const right = {
    x: end.x - size * Math.cos(angle + Math.PI / 6),
    y: end.y - size * Math.sin(angle + Math.PI / 6),
  }
  return [end.x, end.y, left.x, left.y, right.x, right.y]
}
