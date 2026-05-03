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
  return [
    `M ${w * 0.2} ${h * 0.62}`,
    `C ${w * 0.06} ${h * 0.62}, ${w * 0.04} ${h * 0.42}, ${w * 0.2} ${h * 0.38}`,
    `C ${w * 0.18} ${h * 0.2}, ${w * 0.38} ${h * 0.12}, ${w * 0.5} ${h * 0.25}`,
    `C ${w * 0.64} ${h * 0.08}, ${w * 0.86} ${h * 0.2}, ${w * 0.82} ${h * 0.4}`,
    `C ${w * 0.98} ${h * 0.42}, ${w * 0.94} ${h * 0.66}, ${w * 0.8} ${h * 0.64}`,
    `C ${w * 0.76} ${h * 0.82}, ${w * 0.52} ${h * 0.86}, ${w * 0.44} ${h * 0.72}`,
    `C ${w * 0.34} ${h * 0.86}, ${w * 0.16} ${h * 0.78}, ${w * 0.2} ${h * 0.62}`,
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
