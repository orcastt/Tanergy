import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CanvasDocument, CanvasPoint, CanvasShape } from '@/features/canvas-engine'
import { appendShapes, pasteKonvaShapes } from './konvaShapeCommands'
import { readKonvaImageShapeFromClipboard, readKonvaImageShapeFromClipboardData } from './konvaImageClipboard'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type PasteKonvaClipboardOptions = {
  clipboardRef: MutableRefObject<CanvasShape[]>
  document: CanvasDocument
  history: KonvaCanvasHistory
  point: CanvasPoint
  onClipboardChange?: (shapeCount: number) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
}

export async function pasteKonvaClipboard(options: PasteKonvaClipboardOptions) {
  const imageShape = await readKonvaImageShapeFromClipboard(options.point)
  if (imageShape) return pasteImageShape(options, imageShape)

  const systemShapes = await readKonvaShapesFromSystemClipboard()
  const shapes = systemShapes && systemShapes.length > 0
    ? systemShapes
    : systemShapes === null
      ? options.clipboardRef.current
      : []
  if (shapes.length === 0) return false

  options.clipboardRef.current = shapes
  options.onClipboardChange?.(shapes.length)
  return pasteShapeCopies(options, shapes)
}

export async function pasteKonvaClipboardData(options: PasteKonvaClipboardOptions, data: DataTransfer) {
  const imageShape = await readKonvaImageShapeFromClipboardData(data, options.point)
  if (imageShape) return pasteImageShape(options, imageShape)

  const shapes = readKonvaShapesFromClipboardText(data.getData('text/plain'))
  if (shapes.length === 0) return false
  options.clipboardRef.current = shapes
  options.onClipboardChange?.(shapes.length)
  return pasteShapeCopies(options, shapes)
}

export async function writeKonvaShapesToSystemClipboard(shapes: CanvasShape[]) {
  if (shapes.length === 0 || !navigator.clipboard?.writeText) return
  try {
    await navigator.clipboard.writeText(JSON.stringify({ shapes, type: 'tangent/konva-shapes' }))
  } catch {
    // Internal clipboardRef still supports same-session paste when browser clipboard write is blocked.
  }
}

async function readKonvaShapesFromSystemClipboard(): Promise<CanvasShape[] | null> {
  if (!navigator.clipboard?.readText) return null
  try {
    return readKonvaShapesFromClipboardText(await navigator.clipboard.readText())
  } catch {
    return []
  }
}

function pasteImageShape(options: PasteKonvaClipboardOptions, imageShape: CanvasShape) {
  options.history.checkpoint(options.document)
  const result = appendShapes(options.document, [imageShape])
  options.onDocumentChange(result.document)
  options.onSelectionChange(result.selectedIds)
  return true
}

function pasteShapeCopies(options: PasteKonvaClipboardOptions, shapes: CanvasShape[]) {
  options.history.checkpoint(options.document)
  const result = pasteKonvaShapes(options.document, shapes, options.point)
  options.onDocumentChange(result.document)
  options.onSelectionChange(result.selectedIds)
  return true
}

function readKonvaShapesFromClipboardText(text: string): CanvasShape[] {
  try {
    const parsed = JSON.parse(text) as { shapes?: CanvasShape[]; type?: string }
    return parsed.type === 'tangent/konva-shapes' && Array.isArray(parsed.shapes) ? parsed.shapes : []
  } catch {
    return []
  }
}
