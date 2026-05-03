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
  const dents = [
    { x: 0.14, y: 0.2 },
    { x: 0.28, y: 0.04 },
    { x: 0.42, y: 0.11 },
    { x: 0.55, y: 0.03 },
    { x: 0.69, y: 0.12 },
    { x: 0.84, y: 0.18 },
    { x: 0.98, y: 0.38 },
    { x: 0.91, y: 0.62 },
    { x: 0.79, y: 0.82 },
    { x: 0.62, y: 0.86 },
    { x: 0.49, y: 0.8 },
    { x: 0.36, y: 0.9 },
    { x: 0.2, y: 0.82 },
    { x: 0.04, y: 0.62 },
    { x: 0.03, y: 0.36 },
  ].map((point) => ({ x: point.x * w, y: point.y * h }))

  const commands = dents.map((point, index) => {
    const nextPoint = dents[(index + 1) % dents.length]
    const controlPoint = {
      x: ((point.x + nextPoint.x) / 2) + (w / 2 - (point.x + nextPoint.x) / 2) * -0.08,
      y: ((point.y + nextPoint.y) / 2) + (h / 2 - (point.y + nextPoint.y) / 2) * -0.18,
    }
    return `Q ${controlPoint.x.toFixed(1)} ${controlPoint.y.toFixed(1)} ${nextPoint.x.toFixed(1)} ${nextPoint.y.toFixed(1)}`
  })

  return [
    `M ${dents[0].x.toFixed(1)} ${dents[0].y.toFixed(1)}`,
    ...commands,
    'Z',
  ].join(' ')
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
