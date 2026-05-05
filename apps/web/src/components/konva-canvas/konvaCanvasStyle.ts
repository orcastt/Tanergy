import type { CanvasDocument, CanvasShape, CanvasShapeStyle } from '@/features/canvas-engine'
import { mixColorWithWhite } from './konvaPatternUtils'
import { removeKonvaRuntimeEdgesForShapes } from './konvaRuntimeEdges'
import { cloneKonvaShapes, copyKonvaShapes } from './konvaShapeCommands'
import { fitStandaloneTextShapeToContent } from './konvaTextAutoFit'

export type KonvaCanvasDashStyle = NonNullable<CanvasShapeStyle['dash']>
export type KonvaCanvasFillStyle = NonNullable<CanvasShapeStyle['fillStyle']>
export type KonvaCanvasTextAlign = NonNullable<CanvasShapeStyle['textAlign']>
export type KonvaCanvasWidthStyle = 's' | 'm' | 'l' | 'xl'

export type KonvaCanvasResolvedShapeStyle = {
  dash: KonvaCanvasDashStyle
  fill: string
  fillStyle: KonvaCanvasFillStyle
  opacity: number
  stroke: string
  strokeWidth: number
}

export type KonvaCanvasStyleSnapshot = {
  dash: CanvasShapeStyle['dash'] | 'mixed'
  fillStyle: CanvasShapeStyle['fillStyle'] | 'mixed'
  fontSize: number | 'mixed'
  opacity: number | 'mixed'
  stroke: CanvasShapeStyle['stroke'] | 'mixed'
  strokeWidth: number | 'mixed'
  textAlign: CanvasShapeStyle['textAlign'] | 'mixed'
}

export const konvaStrokeColors: Array<{ label: string; value: string; swatch: string }> = [
  { label: 'Black', swatch: '#1f1f1f', value: '#1f1f1f' },
  { label: 'Red', swatch: '#ef4444', value: '#ef4444' },
  { label: 'Green', swatch: '#22c55e', value: '#22c55e' },
  { label: 'Blue', swatch: '#2563eb', value: '#2563eb' },
  { label: 'Orange', swatch: '#f59e0b', value: '#f59e0b' },
  { label: 'Violet', swatch: '#8b5cf6', value: '#8b5cf6' },
  { label: 'Grey', swatch: '#6b7280', value: '#6b7280' },
]

export const konvaFillStyles: Array<{ label: string; value: KonvaCanvasFillStyle }> = [
  { label: 'None', value: 'none' },
  { label: 'Semi', value: 'semi' },
  { label: 'Solid', value: 'solid' },
  { label: 'Pattern', value: 'pattern' },
]

export const konvaDashStyles: Array<{ label: string; value: KonvaCanvasDashStyle }> = [
  { label: 'Draw', value: 'draw' },
  { label: 'Solid', value: 'solid' },
  { label: 'Dash', value: 'dashed' },
  { label: 'Dot', value: 'dotted' },
]

export const konvaWidthStyles: Array<{ label: string; value: KonvaCanvasWidthStyle }> = [
  { label: 'S', value: 's' },
  { label: 'M', value: 'm' },
  { label: 'L', value: 'l' },
  { label: 'XL', value: 'xl' },
]

export const konvaDefaultShapeStyle: CanvasShapeStyle = {
  dash: 'draw',
  fillStyle: 'semi',
  opacity: 1,
  stroke: '#243142',
  strokeWidth: 2,
}

export function resolveKonvaShapeStyle(style?: CanvasShapeStyle): KonvaCanvasResolvedShapeStyle {
  const stroke = style?.stroke ?? konvaDefaultShapeStyle.stroke!
  const fillStyle = style?.fillStyle ?? getFillStyleToken(style?.fill) ?? konvaDefaultShapeStyle.fillStyle!
  return {
    dash: style?.dash ?? konvaDefaultShapeStyle.dash!,
    fill: getFillColor(stroke, fillStyle),
    fillStyle,
    opacity: style?.opacity ?? konvaDefaultShapeStyle.opacity!,
    stroke,
    strokeWidth: style?.strokeWidth ?? konvaDefaultShapeStyle.strokeWidth!,
  }
}

export function getKonvaSelectionStyleSnapshot(
  shapes: CanvasShape[],
  nextStyle: CanvasShapeStyle
): KonvaCanvasStyleSnapshot {
  const fallback = resolveKonvaShapeStyle(nextStyle)
  const textShapes = shapes.filter(isKonvaTextStyleShape)
  return {
    dash: getSharedResolvedStyleValue(shapes, fallback.dash, (shape) => resolveKonvaShapeStyle(shape.style).dash),
    fillStyle: getSharedResolvedStyleValue(shapes, fallback.fillStyle, (shape) => resolveKonvaShapeStyle(shape.style).fillStyle),
    fontSize: getSharedResolvedStyleValue(textShapes, nextStyle.fontSize ?? 18, getKonvaShapeFontSize),
    opacity: getSharedResolvedStyleValue(shapes, fallback.opacity, (shape) => resolveKonvaShapeStyle(shape.style).opacity),
    stroke: getSharedResolvedStyleValue(shapes, fallback.stroke, (shape) => resolveKonvaShapeStyle(shape.style).stroke),
    strokeWidth: getSharedResolvedStyleValue(shapes, fallback.strokeWidth, (shape) => resolveKonvaShapeStyle(shape.style).strokeWidth),
    textAlign: getSharedResolvedStyleValue(textShapes, nextStyle.textAlign ?? 'left', getKonvaShapeTextAlign),
  }
}

export function getFillStyleToken(fill: CanvasShapeStyle['fill'] | undefined): KonvaCanvasFillStyle | null {
  if (fill === 'transparent' || fill === 'rgba(255, 255, 255, 0)' || fill === 'none') return 'none'
  if (!fill) return null
  if (fill === 'rgba(255, 255, 255, 0.82)') return 'semi'
  if (fill === '#ffffff' || fill === 'white' || fill === 'rgba(255, 255, 255, 1)') return 'solid'
  return null
}

export function getWidthStyleToken(width: number | undefined): KonvaCanvasWidthStyle | null {
  if (!width) return null
  if (width <= 1.5) return 's'
  if (width <= 2.5) return 'm'
  if (width <= 4) return 'l'
  return 'xl'
}

export function getFillColor(stroke: string, fillStyle: KonvaCanvasFillStyle): string {
  if (fillStyle === 'none' || fillStyle === 'pattern') return 'transparent'
  return mixColorWithWhite(stroke, fillStyle === 'solid' ? 0.72 : 0.88)
}

export function getStickyFillColor(stroke: string): string {
  return mixColorWithWhite(stroke, 0.35)
}

export function getStrokeDash(style: KonvaCanvasDashStyle, strokeWidth: number): number[] | undefined {
  if (style === 'dashed') return [strokeWidth * 4.5, strokeWidth * 3]
  if (style === 'dotted') return [0.1, strokeWidth * 3.2]
  return undefined
}

export function applyKonvaStylePatch(document: CanvasDocument, shapeIds: string[], patch: CanvasShapeStyle): CanvasDocument {
  const selected = new Set(shapeIds)
  return {
    ...document,
    metadata: { ...document.metadata, updatedAt: new Date().toISOString() },
    shapes: document.shapes.map((shape) => selected.has(shape.id) ? applyStylePatchToShape(shape, patch) : shape),
  }
}

export function duplicateKonvaShapes(document: CanvasDocument, shapeIds: string[]) {
  const copies = cloneKonvaShapes(copyKonvaShapes(document, shapeIds))
  const shapes = [...document.shapes, ...copies]
  return {
    document: {
      ...document,
      metadata: { ...document.metadata, updatedAt: new Date().toISOString() },
      shapes,
    },
    selectedIds: copies.map((shape) => shape.id),
  }
}

export function deleteKonvaShapes(document: CanvasDocument, shapeIds: string[]) {
  const selected = new Set(shapeIds)
  const documentWithoutEdges = removeKonvaRuntimeEdgesForShapes(document, shapeIds)
  return {
    document: {
      ...documentWithoutEdges,
      metadata: { ...documentWithoutEdges.metadata, updatedAt: new Date().toISOString() },
      shapes: documentWithoutEdges.shapes
        .filter((shape) => !selected.has(shape.id))
        .map((shape) => shape.parentId && selected.has(shape.parentId) ? { ...shape, parentId: null } : shape),
    },
    selectedIds: [] as string[],
  }
}

export function reorderKonvaShapes(document: CanvasDocument, shapeIds: string[], action: 'back' | 'backward' | 'forward' | 'front') {
  const selected = new Set(shapeIds)
  const shapes = [...document.shapes]

  if (action === 'front') {
    return updateDocumentShapes(document, [...shapes.filter((shape) => !selected.has(shape.id)), ...shapes.filter((shape) => selected.has(shape.id))])
  }

  if (action === 'back') {
    return updateDocumentShapes(document, [...shapes.filter((shape) => selected.has(shape.id)), ...shapes.filter((shape) => !selected.has(shape.id))])
  }

  if (action === 'forward') {
    for (let index = shapes.length - 2; index >= 0; index -= 1) {
      if (selected.has(shapes[index].id) && !selected.has(shapes[index + 1].id)) {
        swapShapes(shapes, index, index + 1)
      }
    }
  } else {
    for (let index = 1; index < shapes.length; index += 1) {
      if (selected.has(shapes[index].id) && !selected.has(shapes[index - 1].id)) {
        swapShapes(shapes, index - 1, index)
      }
    }
  }

  return updateDocumentShapes(document, shapes)
}

export function isKonvaFillShape(shape: CanvasShape) {
  return shape.type === 'rect' || shape.type === 'diamond' || shape.type === 'ellipse' || shape.type === 'triangle' || shape.type === 'cloud'
}

export function isKonvaStrokeShape(shape: CanvasShape) {
  return shape.type === 'rect' || shape.type === 'diamond' || shape.type === 'ellipse' || shape.type === 'triangle' || shape.type === 'cloud' || shape.type === 'frame' || shape.type === 'sticky' || shape.type === 'line' || shape.type === 'arrow' || shape.type === 'stroke' || shape.type === 'image' || shape.type === 'text'
}

export function isKonvaDashShape(shape: CanvasShape) {
  return isKonvaStrokeShape(shape) && shape.type !== 'stroke' && shape.type !== 'sticky' && shape.type !== 'text'
}

export function isKonvaWidthShape(shape: CanvasShape) {
  return isKonvaStrokeShape(shape) && shape.type !== 'sticky' && shape.type !== 'text'
}

export function isKonvaTextStyleShape(shape: CanvasShape) {
  return shape.type === 'text' || shape.type === 'sticky' || isKonvaTextContainerShape(shape)
}

export function getKonvaShapeFontSize(shape: CanvasShape) {
  return isKonvaTextStyleShape(shape) ? shape.style?.fontSize ?? 18 : 18
}

export function getKonvaShapeTextAlign(shape: CanvasShape): KonvaCanvasTextAlign {
  if (!isKonvaTextStyleShape(shape)) return 'left'
  return shape.style?.textAlign ?? (shape.type === 'text' ? 'left' : 'center')
}

function applyStylePatchToShape(shape: CanvasShape, patch: CanvasShapeStyle): CanvasShape {
  const nextStyle = { ...shape.style }
  if (patch.stroke !== undefined && isKonvaStrokeShape(shape)) nextStyle.stroke = patch.stroke
  if (patch.fillStyle !== undefined && isKonvaFillShape(shape)) nextStyle.fillStyle = patch.fillStyle
  if (patch.dash !== undefined && isKonvaStrokeShape(shape)) nextStyle.dash = patch.dash
  if (patch.fontSize !== undefined && isKonvaTextStyleShape(shape)) nextStyle.fontSize = patch.fontSize
  if (patch.strokeWidth !== undefined && isKonvaWidthShape(shape)) nextStyle.strokeWidth = patch.strokeWidth
  if (patch.textAlign !== undefined && isKonvaTextStyleShape(shape)) nextStyle.textAlign = patch.textAlign
  if (patch.opacity !== undefined) nextStyle.opacity = patch.opacity
  const nextShape = { ...shape, style: nextStyle }
  return patch.fontSize !== undefined && nextShape.type === 'text'
    ? fitStandaloneTextShapeToContent(nextShape)
    : nextShape
}

function getSharedResolvedStyleValue<T>(
  shapes: CanvasShape[],
  fallback: T,
  getValue: (shape: CanvasShape) => T
): T | 'mixed' {
  const values = shapes.map(getValue)
  if (values.length === 0) return fallback
  const first = values[0]
  if (values.every((value) => value === first)) return first
  return 'mixed'
}

function updateDocumentShapes(document: CanvasDocument, shapes: CanvasShape[]): CanvasDocument {
  return {
    ...document,
    metadata: { ...document.metadata, updatedAt: new Date().toISOString() },
    shapes,
  }
}

function swapShapes(shapes: CanvasShape[], a: number, b: number) {
  const previous = shapes[a]
  shapes[a] = shapes[b]
  shapes[b] = previous
}

function isKonvaTextContainerShape(shape: CanvasShape) {
  return shape.type === 'rect' || shape.type === 'diamond' || shape.type === 'ellipse' || shape.type === 'triangle' || shape.type === 'cloud'
}
