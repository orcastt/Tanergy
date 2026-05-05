import type { CanvasPoint, CanvasShape } from '@/features/canvas-engine'
import type { JsonObject, NodeType } from '@/types/nodeRuntime'

const colorMap: Record<string, string> = {
  black: '#111827',
  blue: '#2563eb',
  green: '#16a34a',
  grey: '#6b7280',
  lightBlue: '#38bdf8',
  lightGreen: '#86efac',
  lightRed: '#fca5a5',
  lightViolet: '#c4b5fd',
  orange: '#f97316',
  red: '#dc2626',
  violet: '#8b5cf6',
  yellow: '#eab308',
}

export function migrateTldrawStyle(props: Record<string, unknown>): CanvasShape['style'] {
  return {
    dash: props.dash === 'dashed' || props.dash === 'dotted' || props.dash === 'draw' ? props.dash : 'solid',
    fill: mapColor(getString(props.fill), undefined),
    fillStyle: props.fill === 'none' ? 'none' : undefined,
    stroke: mapColor(getString(props.color), undefined),
  }
}

export function collectTldrawDrawPoints(props: Record<string, unknown>) {
  const segments = Array.isArray(props.segments) ? props.segments : []
  const points = segments.flatMap((segment) => {
    const record = toRecord(segment)
    return Array.isArray(record.points) ? record.points.map((point) => getPoint(point, null)).filter(Boolean) : []
  })
  if (points.length > 0) return points as CanvasPoint[]
  return Array.isArray(props.points)
    ? props.points.map((point) => getPoint(point, null)).filter(Boolean) as CanvasPoint[]
    : []
}

export function getRichText(props: Record<string, unknown>) {
  return getString(props.text)
    ?? getString(props.plainText)
    ?? collectRichText(props.richText).trim()
}

export function collectRichText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(collectRichText).filter(Boolean).join('')
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  const ownText = typeof record.text === 'string' ? record.text : ''
  const children = Array.isArray(record.content) ? record.content.map(collectRichText).filter(Boolean).join('') : ''
  const suffix = record.type === 'paragraph' && children ? '\n' : ''
  return `${ownText}${children}${suffix}`
}

export function getPoint(value: unknown, fallback: CanvasPoint | null): CanvasPoint | null {
  const record = toRecord(value)
  const x = Number(record.x)
  const y = Number(record.y)
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }
  return fallback
}

export function getPositiveNumber(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

export function mapColor(value: string | null, fallback: string | undefined) {
  if (!value) return fallback
  return colorMap[value] ?? value
}

export function getNodeType(value: unknown): NodeType | null {
  return value === 'prompt' || value === 'image' || value === 'image_gen' || value === 'image_gen_4' || value === 'analysis'
    ? value
    : null
}

export function sanitizeJsonObject(value: unknown): JsonObject {
  const record = toRecord(value)
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, item]) => [key, sanitizeJsonValue(item)])
      .filter((entry): entry is [string, JsonObject[string]] => entry[1] !== undefined)
  ) as JsonObject
}

export function sanitizeJsonValue(value: unknown): JsonObject[string] | undefined {
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase()
    if (lower.startsWith('data:') || lower.startsWith('blob:')) return undefined
    return value.length > 2000 ? value.slice(0, 2000) : value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.map(sanitizeJsonValue).filter((item): item is JsonObject[string] => item !== undefined)
  if (value && typeof value === 'object') return sanitizeJsonObject(value)
  return undefined
}

export function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
