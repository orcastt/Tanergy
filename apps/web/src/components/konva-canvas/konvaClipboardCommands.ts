import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { getShapeBounds, type CanvasDocument, type CanvasImageShape, type CanvasNodeShape, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import { setRuntimeGraphImageNodeOwnData } from '@/features/node-runtime/runtimeGraph'
import type { JsonObject } from '@/types/nodeRuntime'
import { addKonvaChatReferenceImage } from './konvaChatNodeActions'
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
  selectedIds: string[]
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

function pasteImageShape(options: PasteKonvaClipboardOptions, imageShape: CanvasImageShape) {
  const target = getNodeImagePasteTarget(options.document, options.selectedIds, options.point)
  if (target) {
    options.history.checkpoint(options.document)
    options.onDocumentChange((current) => (
      target.props.nodeType === 'chat'
        ? addKonvaChatReferenceImage(current, target.id, createChatReferenceImageData(imageShape.props))
        : setRuntimeGraphImageNodeOwnData(current, target.id, createImageNodeData(imageShape.props))
    ))
    options.onSelectionChange([target.id])
    return true
  }
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

function getNodeImagePasteTarget(document: CanvasDocument, selectedIds: string[], point: CanvasPoint): CanvasNodeShape | null {
  const selected = new Set(selectedIds)
  const nodes = document.shapes.filter((shape): shape is CanvasNodeShape => shape.type === 'node_card' && (shape.props.nodeType === 'image' || shape.props.nodeType === 'chat'))
  return nodes.find((shape) => selected.has(shape.id)) ?? nodes.find((shape) => {
    const bounds = getShapeBounds(shape)
    return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY
  }) ?? null
}

function createChatReferenceImageData(image: {
  assetId: string
  originalUrl?: string
  thumbnail256Url?: string
  title?: string
}) {
  return {
    assetId: image.assetId,
    originalUrl: image.originalUrl,
    thumbnail256Url: image.thumbnail256Url,
    title: image.title ?? 'Reference image',
  }
}

function createImageNodeData(image: {
  assetId: string
  height: number
  originalUrl?: string
  thumbnail1024Url?: string
  thumbnail256Url?: string
  thumbnail512Url?: string
  width: number
}): JsonObject {
  return pruneUndefined({
    assetId: image.assetId,
    crop: undefined,
    imageHeight: image.height,
    imageWidth: image.width,
    inputSourceEdgeId: undefined,
    originalUrl: image.originalUrl,
    thumbnail1024Url: image.thumbnail1024Url,
    thumbnail256Url: image.thumbnail256Url,
    thumbnail512Url: image.thumbnail512Url,
    title: 'Image',
  })
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject
}
