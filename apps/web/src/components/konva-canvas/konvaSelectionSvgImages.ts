import type { CanvasShape } from '@/features/canvas-engine'
import type { JsonObject } from '@/types/nodeRuntime'
import { safeImageDisplayUrl } from '@/features/security/safeUrl'
import type { KonvaSelectionSvgExportDiagnostic } from './konvaSelectionSvgExport'

const FONT_FAMILY = 'Inter, system-ui, sans-serif'

export function renderSvgImageShape(
  shape: Extract<CanvasShape, { type: 'image' }>,
  diagnostics: KonvaSelectionSvgExportDiagnostic[]
): string {
  const href = getSvgImageHref(shape.props.originalUrl ?? shape.props.thumbnail1024Url ?? shape.props.thumbnail512Url ?? shape.props.thumbnail256Url)
  if (!href) return renderMissingImageShape(shape, diagnostics, 'Image asset URL missing from SVG export.')
  return wrapShape(shape, `<image href="${escapeAttribute(href)}" width="${format(shape.props.width)}" height="${format(shape.props.height)}" preserveAspectRatio="none" />`)
}

export function renderSvgNodeCardShape(
  shape: Extract<CanvasShape, { type: 'node_card' }>,
  diagnostics: KonvaSelectionSvgExportDiagnostic[]
): string {
  if (shape.props.nodeType !== 'image') return renderNodeCardPlaceholder(shape, diagnostics)
  const title = getStringValue(shape.props.data.title) ?? 'Image'
  const bounds = { height: shape.props.height - 88, width: shape.props.width - 28, x: 14, y: 54 }
  const href = getSvgImageHref(getImageNodeSource(shape.props.data))
  const image = href
    ? `<image href="${escapeAttribute(href)}" x="${format(bounds.x)}" y="${format(bounds.y)}" width="${format(bounds.width)}" height="${format(bounds.height)}" preserveAspectRatio="xMidYMid meet" />`
    : `<text x="${format(shape.props.width / 2)}" y="${format(bounds.y + bounds.height / 2)}" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="12" font-weight="700" text-anchor="middle" dominant-baseline="middle">Image</text>`
  if (!href) diagnostics.push({ code: 'placeholder', message: 'Image node asset URL missing from SVG export.', shapeId: shape.id, shapeType: shape.type })
  const body = [
    `<rect width="${format(shape.props.width)}" height="${format(shape.props.height)}" rx="12" fill="#ffffff" stroke="rgba(15, 23, 42, 0.14)" stroke-width="1" />`,
    renderText(title, 14, 28, shape.props.width - 116, 15, '#0f172a'),
    `<rect x="${format(bounds.x)}" y="${format(bounds.y)}" width="${format(bounds.width)}" height="${format(bounds.height)}" rx="12" fill="#eef4fb" />`,
    image,
  ].join('\n    ')
  return wrapShape(shape, body)
}

function renderMissingImageShape(shape: Extract<CanvasShape, { type: 'image' }>, diagnostics: KonvaSelectionSvgExportDiagnostic[], message: string): string {
  diagnostics.push({ code: 'placeholder', message, shapeId: shape.id, shapeType: shape.type })
  return renderPlaceholderRect(shape, shape.props.title ?? shape.props.alt ?? 'Image')
}

function renderNodeCardPlaceholder(shape: Extract<CanvasShape, { type: 'node_card' }>, diagnostics: KonvaSelectionSvgExportDiagnostic[]): string {
  diagnostics.push({ code: 'placeholder', message: 'Node card represented as a simplified SVG card.', shapeId: shape.id, shapeType: shape.type })
  return renderPlaceholderRect(shape, shape.props.nodeType)
}

function renderPlaceholderRect(shape: Extract<CanvasShape, { props: { height: number; width: number } }>, title: string): string {
  const body = [
    `<rect width="${format(shape.props.width)}" height="${format(shape.props.height)}" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />`,
    `<title>${escapeText(title)}</title>`,
    renderText(title, 12, 24, Math.max(1, shape.props.width - 24), 13, '#475569'),
  ].join('\n    ')
  return wrapShape(shape, body)
}

function getImageNodeSource(data: JsonObject) {
  return getStringValue(data.thumbnail512Url) ?? getStringValue(data.thumbnail1024Url) ?? getStringValue(data.originalUrl)
}

function getSvgImageHref(value: string | undefined) {
  const safeValue = safeImageDisplayUrl(value)
  if (!safeValue) return null
  if (/^https?:/i.test(safeValue)) return safeValue
  if (typeof window !== 'undefined' && safeValue.startsWith('/')) return `${window.location.origin}${safeValue}`
  return null
}

function renderText(text: string, x: number, y: number, width: number, fontSize: number, fill: string): string {
  return `<text x="${format(x)}" y="${format(y)}" fill="${escapeAttribute(fill)}" font-family="${FONT_FAMILY}" font-size="${format(fontSize)}">${escapeText(text)}</text>`
}

function wrapShape(shape: Extract<CanvasShape, { props: { height: number; width: number } }>, body: string): string {
  return `<g transform="${getBoxTransform(shape)}">\n    ${body}\n  </g>`
}

function getBoxTransform(shape: Extract<CanvasShape, { props: { height: number; width: number } }>): string {
  const centerX = shape.x + shape.props.width / 2
  const centerY = shape.y + shape.props.height / 2
  const scaleX = shape.flipX ? -1 : 1
  const scaleY = shape.flipY ? -1 : 1
  return [
    `translate(${format(centerX)} ${format(centerY)})`,
    shape.rotation ? `rotate(${format(shape.rotation)})` : '',
    scaleX !== 1 || scaleY !== 1 ? `scale(${scaleX} ${scaleY})` : '',
    `translate(${format(-shape.props.width / 2)} ${format(-shape.props.height / 2)})`,
  ].filter(Boolean).join(' ')
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}

function escapeText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function format(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(2)).toString() : '0'
}
