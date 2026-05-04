import type { CanvasBounds, CanvasDocument, CanvasPoint, CanvasShape } from '@/features/canvas-engine'
import { boundsToRect, expandBounds, getShapeBounds } from '@/features/canvas-engine'
import { getArrowHeadPoints, getCloudPath, getFreehandPath } from './konvaPathUtils'
import { getLineArrowHeadAnchor, getLineHead, getLinePathData, getLineStartHeadAnchor, type KonvaLineShape } from './konvaLineRouteUtils'
import { getKonvaShapeFontSize, getKonvaShapeTextAlign, getStickyFillColor, getStrokeDash, resolveKonvaShapeStyle } from './konvaCanvasStyle'

export type KonvaSelectionSvgExportDiagnosticCode =
  | 'empty_selection'
  | 'placeholder'
  | 'unsupported_style'

export type KonvaSelectionSvgExportDiagnostic = {
  code: KonvaSelectionSvgExportDiagnosticCode
  message: string
  shapeId?: string
  shapeType?: CanvasShape['type']
}

export type KonvaSelectionSvgExportResult = {
  bounds: CanvasBounds | null
  diagnostics: KonvaSelectionSvgExportDiagnostic[]
  exportedShapeIds: string[]
  skippedShapeIds: string[]
  svg: string
}

export type KonvaSelectionSvgExportOptions = {
  padding?: number
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const DEFAULT_PADDING = 24
const FONT_FAMILY = 'Inter, system-ui, sans-serif'

export function exportKonvaSelectionToSvg(
  document: CanvasDocument,
  selectedIds: readonly string[],
  options: KonvaSelectionSvgExportOptions = {}
): KonvaSelectionSvgExportResult {
  const selected = new Set(selectedIds)
  const shapes = document.shapes.filter((shape) => selected.has(shape.id))
  const diagnostics: KonvaSelectionSvgExportDiagnostic[] = []

  if (shapes.length === 0) {
    diagnostics.push({ code: 'empty_selection', message: 'No selected shapes were available for SVG export.' })
    return {
      bounds: null,
      diagnostics,
      exportedShapeIds: [],
      skippedShapeIds: [],
      svg: createEmptySvg(),
    }
  }

  const bounds = getSelectionBounds(shapes, options.padding ?? DEFAULT_PADDING)
  const rect = boundsToRect(bounds)
  const exportedShapeIds: string[] = []
  const skippedShapeIds: string[] = []
  const body = shapes.flatMap((shape) => {
    const exported = renderShapeSvg(shape, diagnostics)
    if (exported) {
      exportedShapeIds.push(shape.id)
      return [exported]
    }
    skippedShapeIds.push(shape.id)
    return []
  }).join('\n  ')

  const svgOpen = `<svg xmlns="${SVG_NAMESPACE}" viewBox="${format(rect.x)} ${format(rect.y)} ${format(rect.width)} ${format(rect.height)}" width="${format(rect.width)}" height="${format(rect.height)}" role="img">`
  return { bounds, diagnostics, exportedShapeIds, skippedShapeIds, svg: [svgOpen, body ? `  ${body}` : '', '</svg>'].filter(Boolean).join('\n') }
}

export function createKonvaSelectionSvgBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
}

export function createKonvaSelectionSvgClipboardPayload(svg: string): { text: string; blob: Blob } {
  return {
    blob: createKonvaSelectionSvgBlob(svg),
    text: svg,
  }
}

function renderShapeSvg(shape: CanvasShape, diagnostics: KonvaSelectionSvgExportDiagnostic[]): string | null {
  if (shape.type === 'image') return renderPlaceholder(shape, diagnostics, 'Image asset omitted from SVG export.')
  if (shape.type === 'node_card') return renderPlaceholder(shape, diagnostics, 'Node card represented as an SVG placeholder.')
  if (shape.type === 'line' || shape.type === 'arrow') return renderLineLikeShape(shape)
  if (shape.type === 'stroke') return renderStrokeShape(shape)
  if (shape.type === 'text') return renderTextShape(shape)
  if (shape.type === 'sticky') return renderStickyShape(shape)
  if (shape.type === 'frame') return renderFrameShape(shape)
  if (isTextContainerShape(shape)) return renderTextContainerShape(shape, diagnostics)
  return null
}

function renderTextContainerShape(
  shape: Extract<CanvasShape, { type: 'cloud' | 'diamond' | 'ellipse' | 'rect' | 'triangle' }>,
  diagnostics: KonvaSelectionSvgExportDiagnostic[]
): string {
  const { fill, opacity, stroke, strokeWidth } = resolveKonvaShapeStyle(shape.style)
  const dash = renderDash(shape, diagnostics)
  const style = resolveKonvaShapeStyle(shape.style)
  const label = shape.props.text
    ? renderText(shape.props.text, 0, shape.props.height / 2, shape.props.width, getKonvaShapeFontSize(shape), style.stroke, getKonvaShapeTextAlign(shape), style.opacity, 'middle')
    : ''
  const attrs = `fill="${escapeAttribute(fill)}" stroke="${escapeAttribute(stroke)}" stroke-width="${format(strokeWidth)}"${dash} opacity="${format(opacity)}"`
  let body: string

  if (shape.type === 'rect') {
    body = `<rect width="${format(shape.props.width)}" height="${format(shape.props.height)}" rx="10" ${attrs} />`
  } else if (shape.type === 'ellipse') {
    body = `<ellipse cx="${format(shape.props.width / 2)}" cy="${format(shape.props.height / 2)}" rx="${format(shape.props.width / 2)}" ry="${format(shape.props.height / 2)}" ${attrs} />`
  } else if (shape.type === 'diamond') {
    body = `<polygon points="${pointsToString([{ x: shape.props.width / 2, y: 0 }, { x: shape.props.width, y: shape.props.height / 2 }, { x: shape.props.width / 2, y: shape.props.height }, { x: 0, y: shape.props.height / 2 }])}" ${attrs} />`
  } else if (shape.type === 'triangle') {
    body = `<polygon points="${pointsToString([{ x: shape.props.width / 2, y: 0 }, { x: shape.props.width, y: shape.props.height }, { x: 0, y: shape.props.height }])}" ${attrs} />`
  } else {
    body = `<path d="${escapeAttribute(getCloudPath(shape.props.width, shape.props.height))}" ${attrs} />`
  }

  return wrapShape(shape, [body, label].filter(Boolean).join('\n    '))
}

function renderFrameShape(shape: Extract<CanvasShape, { type: 'frame' }>): string {
  const { opacity, stroke, strokeWidth } = resolveKonvaShapeStyle(shape.style)
  const body = [
    `<rect width="${format(shape.props.width)}" height="${format(shape.props.height)}" fill="#ffffff" stroke="${escapeAttribute(stroke)}" stroke-width="${format(strokeWidth)}" opacity="${format(opacity)}" />`,
    renderText(shape.props.title ?? 'Frame', 0, -8, shape.props.width, 14, '#111827', 'left'),
  ].join('\n    ')
  return wrapShape(shape, body)
}

function renderStickyShape(shape: Extract<CanvasShape, { type: 'sticky' }>): string {
  const { opacity, stroke } = resolveKonvaShapeStyle(shape.style)
  const body = [
    shape.props.authorName ? renderText(shape.props.authorName, 0, -8, shape.props.width, 12, '#6b7280', 'left') : '',
    `<rect width="${format(shape.props.width)}" height="${format(shape.props.height)}" rx="2" fill="${escapeAttribute(getStickyFillColor(stroke))}" stroke="rgba(31, 42, 55, 0.12)" stroke-width="1" opacity="${format(opacity)}" />`,
    renderText(shape.props.text, 14, 24, Math.max(1, shape.props.width - 28), getKonvaShapeFontSize(shape), '#2f2a1f', getKonvaShapeTextAlign(shape)),
  ].filter(Boolean).join('\n    ')
  return wrapShape(shape, body)
}

function renderTextShape(shape: Extract<CanvasShape, { type: 'text' }>): string {
  const { opacity, stroke } = resolveKonvaShapeStyle(shape.style)
  return wrapShape(shape, renderText(shape.props.text, 0, getKonvaShapeFontSize(shape), shape.props.width, getKonvaShapeFontSize(shape), stroke, getKonvaShapeTextAlign(shape), opacity))
}

function renderLineLikeShape(shape: KonvaLineShape): string {
  const { dash, opacity, stroke, strokeWidth } = resolveKonvaShapeStyle(shape.style)
  const dashAttr = getStrokeDash(dash, strokeWidth)?.map(format).join(' ')
  const pieces = [
    `<path d="${escapeAttribute(getLinePathData(shape))}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${format(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${dashAttr ? ` stroke-dasharray="${dashAttr}"` : ''} opacity="${format(opacity)}" />`,
    renderLineHead(shape, 'start', stroke, strokeWidth, opacity),
    renderLineHead(shape, 'end', stroke, strokeWidth, opacity),
  ].filter(Boolean).join('\n    ')
  return `<g transform="translate(${format(shape.x)} ${format(shape.y)})">\n    ${pieces}\n  </g>`
}

function renderStrokeShape(shape: Extract<CanvasShape, { type: 'stroke' }>): string | null {
  const { opacity, stroke, strokeWidth } = resolveKonvaShapeStyle(shape.style)
  const path = getFreehandPath(shape.props.points, strokeWidth * 2.2)
  if (!path) return null
  return `<path d="${escapeAttribute(path)}" fill="${escapeAttribute(stroke)}" opacity="${format(opacity)}" transform="translate(${format(shape.x)} ${format(shape.y)})" />`
}

function renderLineHead(
  shape: KonvaLineShape,
  position: 'end' | 'start',
  stroke: string,
  strokeWidth: number,
  opacity: number
): string {
  const head = getLineHead(shape, position)
  const point = position === 'start' ? { x: 0, y: 0 } : shape.props.end
  if (head === 'dot') {
    return `<circle cx="${format(point.x)}" cy="${format(point.y)}" r="${format(Math.max(4, strokeWidth * 2.1))}" fill="${escapeAttribute(stroke)}" opacity="${format(opacity)}" />`
  }
  if (head !== 'arrow') return ''
  const anchor = position === 'start' ? getLineStartHeadAnchor(shape) : getLineArrowHeadAnchor(shape)
  const points = getArrowHeadPoints(point, anchor, Math.max(12, strokeWidth * 5))
  return `<polygon points="${numberPointsToString(points)}" fill="${escapeAttribute(stroke)}" opacity="${format(opacity)}" />`
}

function renderPlaceholder(shape: Extract<CanvasShape, { type: 'image' | 'node_card' }>, diagnostics: KonvaSelectionSvgExportDiagnostic[], message: string): string {
  diagnostics.push({ code: 'placeholder', message, shapeId: shape.id, shapeType: shape.type })
  return renderPlaceholderRect(shape, shape.type === 'image' ? shape.props.title ?? shape.props.alt ?? 'Image' : shape.props.nodeType)
}

function renderPlaceholderRect(shape: Extract<CanvasShape, { props: { height: number; width: number } }>, title: string): string {
  const body = [
    `<rect width="${format(shape.props.width)}" height="${format(shape.props.height)}" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-dasharray="6 4" />`,
    `<title>${escapeText(title)}</title>`,
    renderText(title, 12, 24, Math.max(1, shape.props.width - 24), 13, '#475569', 'left'),
  ].join('\n    ')
  return wrapShape(shape, body)
}

function renderText(
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  fill: string,
  align: 'center' | 'left' | 'right',
  opacity = 1,
  dominantBaseline: 'middle' | 'text-before-edge' = 'text-before-edge'
): string {
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
  const textX = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x
  const lines = text.split('\n')
  const tspans = lines.map((line, index) => (
    `<tspan x="${format(textX)}"${index > 0 ? ` dy="${format(fontSize * 1.25)}"` : ''}>${escapeText(line)}</tspan>`
  )).join('')
  return `<text x="${format(textX)}" y="${format(y)}" fill="${escapeAttribute(fill)}" font-family="${FONT_FAMILY}" font-size="${format(fontSize)}" text-anchor="${anchor}" dominant-baseline="${dominantBaseline}" opacity="${format(opacity)}">${tspans}</text>`
}

function renderDash(shape: CanvasShape, diagnostics: KonvaSelectionSvgExportDiagnostic[]): string {
  const style = resolveKonvaShapeStyle(shape.style)
  if (style.fillStyle === 'pattern') {
    diagnostics.push({
      code: 'unsupported_style',
      message: 'Pattern fill downgraded to transparent in SVG export.',
      shapeId: shape.id,
      shapeType: shape.type,
    })
  }
  const dash = getStrokeDash(style.dash, style.strokeWidth)
  return dash ? ` stroke-dasharray="${dash.map(format).join(' ')}"` : ''
}

function wrapShape(shape: Extract<CanvasShape, { props: { height: number; width: number } }>, body: string): string {
  const transform = getBoxTransform(shape)
  return `<g transform="${transform}">\n    ${body}\n  </g>`
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

function getSelectionBounds(shapes: CanvasShape[], padding: number): CanvasBounds {
  const bounds = shapes.map(getShapeBounds).reduce<CanvasBounds>((next, bounds) => ({
    maxX: Math.max(next.maxX, bounds.maxX),
    maxY: Math.max(next.maxY, bounds.maxY),
    minX: Math.min(next.minX, bounds.minX),
    minY: Math.min(next.minY, bounds.minY),
  }), {
    maxX: -Infinity,
    maxY: -Infinity,
    minX: Infinity,
    minY: Infinity,
  })
  return expandBounds(bounds, padding)
}

function isTextContainerShape(shape: CanvasShape): shape is Extract<CanvasShape, { type: 'cloud' | 'diamond' | 'ellipse' | 'rect' | 'triangle' }> {
  return shape.type === 'cloud' || shape.type === 'diamond' || shape.type === 'ellipse' || shape.type === 'rect' || shape.type === 'triangle'
}

function pointsToString(points: CanvasPoint[]): string {
  return points.map((point) => `${format(point.x)},${format(point.y)}`).join(' ')
}

function numberPointsToString(points: number[]): string {
  const pairs: string[] = []
  for (let index = 0; index < points.length; index += 2) {
    pairs.push(`${format(points[index])},${format(points[index + 1])}`)
  }
  return pairs.join(' ')
}

function createEmptySvg(): string {
  return `<svg xmlns="${SVG_NAMESPACE}" viewBox="0 0 1 1" width="1" height="1" role="img"></svg>`
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function format(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(2)).toString() : '0'
}
