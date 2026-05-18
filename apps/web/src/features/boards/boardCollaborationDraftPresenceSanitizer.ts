import type { CanvasPoint, CanvasShape, CanvasShapeStyle, StrokePoint } from '@/features/canvas-engine'
import type { BoardCollaborationPresence } from './boardCollaborationTypes'

const maxPresenceDraftPoints = 120
const maxPresenceDraftTextLength = 80
const maxPresenceIdLength = 120
const maxPresenceStyleStringLength = 80
const activeDraftShapeTypes = new Set([
  'arrow',
  'cloud',
  'diamond',
  'ellipse',
  'frame',
  'line',
  'rect',
  'sticky',
  'stroke',
  'triangle',
])
const activeDraftBoxShapeTypes = new Set(['cloud', 'diamond', 'ellipse', 'frame', 'rect', 'sticky', 'triangle'])

export function normalizeBoardCollaborationDraftPreview(
  value: BoardCollaborationPresence['draftPreview'],
) {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<CanvasShape>
  const id = normalizeId(candidate.id)
  const type = typeof candidate.type === 'string' ? candidate.type : null
  const x = normalizeFiniteDraftNumber(candidate.x)
  const y = normalizeFiniteDraftNumber(candidate.y)
  if (!id || !type || !activeDraftShapeTypes.has(type) || x === null || y === null) return null
  const base = {
    id,
    style: normalizeDraftStyle(candidate.style),
    type,
    x,
    y,
  }
  if (type === 'stroke') {
    const props = normalizeRecord(candidate.props)
    const points = Array.isArray(props?.points)
      ? props.points.map(normalizeDraftStrokePoint).filter((point): point is StrokePoint => Boolean(point)).slice(0, maxPresenceDraftPoints)
      : []
    if (points.length === 0) return null
    return { ...base, props: { points }, type: 'stroke' } satisfies CanvasShape
  }
  if (type === 'line' || type === 'arrow') {
    const props = normalizeRecord(candidate.props)
    const end = normalizeDraftPoint(props?.end)
    if (!end) return null
    const control = normalizeDraftPoint(props?.control)
    const bends = Array.isArray(props?.bends)
      ? props.bends.map(normalizeDraftPoint).filter((point): point is CanvasPoint => Boolean(point)).slice(0, 12)
      : undefined
    return {
      ...base,
      props: {
        bends,
        control,
        end,
        endHead: normalizeLineHead(props?.endHead),
        route: normalizeLineRoute(props?.route),
        startHead: normalizeLineHead(props?.startHead),
      },
      type,
    } as CanvasShape
  }
  if (!activeDraftBoxShapeTypes.has(type)) return null
  const props = normalizeRecord(candidate.props)
  const width = normalizeFiniteDraftNumber(props?.width)
  const height = normalizeFiniteDraftNumber(props?.height)
  if (width === null || height === null || width < 0 || height < 0) return null
  return {
    ...base,
    props: {
      authorName: type === 'sticky' ? normalizeDraftText(props?.authorName) : undefined,
      cornerRadius: normalizeFiniteDraftNumber(props?.cornerRadius),
      height,
      text: type === 'sticky' || typeof props?.text === 'string' ? normalizeDraftText(props?.text) : undefined,
      title: type === 'frame' ? normalizeDraftText(props?.title) : undefined,
      width,
    },
  } as CanvasShape
}

function normalizeDraftPoint(value: unknown): CanvasPoint | null {
  const point = normalizeRecord(value)
  const x = normalizeFiniteDraftNumber(point?.x)
  const y = normalizeFiniteDraftNumber(point?.y)
  return x === null || y === null ? null : { x, y }
}

function normalizeDraftStrokePoint(value: unknown): StrokePoint | null {
  const point = normalizeDraftPoint(value)
  if (!point) return null
  const record = normalizeRecord(value)
  const pressure = normalizeFiniteDraftNumber(record?.pressure, 100)
  return pressure === null ? point : { ...point, pressure }
}

function normalizeDraftStyle(value: unknown): CanvasShapeStyle | undefined {
  const style = normalizeRecord(value)
  if (!style) return undefined
  return {
    dash: normalizeDash(style.dash),
    fill: normalizeStyleString(style.fill),
    fillStyle: normalizeFillStyle(style.fillStyle),
    fontSize: normalizeFiniteDraftNumber(style.fontSize, 10) ?? undefined,
    opacity: normalizeFiniteDraftNumber(style.opacity, 100) ?? undefined,
    stroke: normalizeStyleString(style.stroke),
    strokeWidth: normalizeFiniteDraftNumber(style.strokeWidth, 100) ?? undefined,
    textAlign: normalizeTextAlign(style.textAlign),
  }
}

function normalizeRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeId(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxPresenceIdLength) : null
}

function normalizeFiniteDraftNumber(value: unknown, multiplier = 10) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value * multiplier) / multiplier
}

function normalizeDraftText(value: unknown) {
  return typeof value === 'string'
    ? value.slice(0, maxPresenceDraftTextLength)
    : undefined
}

function normalizeStyleString(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxPresenceStyleStringLength)
    : undefined
}

function normalizeDash(value: unknown) {
  return value === 'draw' || value === 'solid' || value === 'dashed' || value === 'dotted'
    ? value
    : undefined
}

function normalizeFillStyle(value: unknown) {
  return value === 'none' || value === 'semi' || value === 'solid' || value === 'pattern'
    ? value
    : undefined
}

function normalizeTextAlign(value: unknown) {
  return value === 'center' || value === 'left' || value === 'right'
    ? value
    : undefined
}

function normalizeLineHead(value: unknown) {
  return value === 'arrow' || value === 'dot' || value === 'none'
    ? value
    : undefined
}

function normalizeLineRoute(value: unknown) {
  return value === 'curve' || value === 'orthogonal' || value === 'straight'
    ? value
    : undefined
}
