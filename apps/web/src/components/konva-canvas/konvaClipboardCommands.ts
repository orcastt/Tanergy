import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { getShapeBounds, type CanvasDocument, type CanvasImageShape, type CanvasNodeShape, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { setRuntimeGraphImageNodeOwnData } from '@/features/node-runtime/runtimeGraph'
import type { JsonObject } from '@/types/nodeRuntime'
import { addKonvaChatReferenceImage } from './konvaChatNodeActions'
import { appendShapes, pasteKonvaShapes } from './konvaShapeCommands'
import { readKonvaImageShapeFromClipboard, readKonvaImageShapeFromClipboardData } from './konvaImageClipboard'
import type { KonvaPendingImagePaste } from './KonvaPendingImagePasteLayer'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type PasteKonvaClipboardOptions = {
  clipboardRef: MutableRefObject<CanvasShape[]>
  document: CanvasDocument
  getActivePageId?: () => string
  history: KonvaCanvasHistory
  onImagePasteComplete?: (pendingId: string) => void
  onImagePasteStateChange?: (state: KonvaPendingImagePaste) => void
  onPageDocumentChange?: (pageId: string, updater: (document: CanvasDocument) => CanvasDocument) => boolean
  pageId: string
  point: CanvasPoint
  selectedIds: string[]
  onClipboardChange?: (shapeCount: number) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
  workspace?: TangentWorkspace
}

export async function pasteKonvaClipboard(options: PasteKonvaClipboardOptions) {
  const imageTarget = getNodeImagePasteTarget(options.document, options.selectedIds, options.point)
  const imageResult = await readKonvaImageShapeFromClipboard(
    options.point,
    options.workspace,
    imageTarget ? undefined : {
      onComplete: options.onImagePasteComplete,
      onStateChange: options.onImagePasteStateChange,
      pageId: options.pageId,
    }
  )
  if (imageResult.kind === 'shape') return pasteImageShape(options, imageResult.shape, imageTarget?.id ?? null)
  if (imageResult.kind === 'error') return true

  const systemShapes = await readKonvaShapesFromSystemClipboard()
  const shapes = systemShapes && systemShapes.length > 0
    ? systemShapes
    : systemShapes === null || systemShapes.length === 0
      ? options.clipboardRef.current
      : []
  if (shapes.length === 0) return false

  options.clipboardRef.current = shapes
  options.onClipboardChange?.(shapes.length)
  return pasteShapeCopies(options, shapes)
}

export async function pasteKonvaClipboardData(options: PasteKonvaClipboardOptions, data: DataTransfer) {
  const imageTarget = getNodeImagePasteTarget(options.document, options.selectedIds, options.point)
  const imageResult = await readKonvaImageShapeFromClipboardData(
    data,
    options.point,
    options.workspace,
    imageTarget ? undefined : {
      onComplete: options.onImagePasteComplete,
      onStateChange: options.onImagePasteStateChange,
      pageId: options.pageId,
    }
  )
  if (imageResult.kind === 'shape') return pasteImageShape(options, imageResult.shape, imageTarget?.id ?? null)
  if (imageResult.kind === 'error') return true

  const shapes = readKonvaShapesFromClipboardText(data.getData('text/plain'))
  const clipboardShapes = shapes.length > 0 ? shapes : options.clipboardRef.current
  if (clipboardShapes.length === 0) return false
  options.clipboardRef.current = clipboardShapes
  options.onClipboardChange?.(clipboardShapes.length)
  return pasteShapeCopies(options, clipboardShapes)
}

async function readKonvaShapesFromSystemClipboard(): Promise<CanvasShape[] | null> {
  if (!navigator.clipboard?.readText) return null
  try {
    return readKonvaShapesFromClipboardText(await navigator.clipboard.readText())
  } catch {
    return []
  }
}

function pasteImageShape(
  options: PasteKonvaClipboardOptions,
  imageShape: CanvasImageShape,
  targetId: string | null,
) {
  options.history.checkpoint()
  options.onPageDocumentChange?.(options.pageId, (document) => {
    const target = targetId ? getNodeImageTargetById(document, targetId) : null
    if (target) {
      return target.props.nodeType === 'chat'
        ? addKonvaChatReferenceImage(document, target.id, createChatReferenceImageData(imageShape.props))
        : setRuntimeGraphImageNodeOwnData(document, target.id, createImageNodeData(imageShape.props))
    }
    return appendShapes(document, [imageShape]).document
  })
  if (options.onPageDocumentChange === undefined) {
    options.onDocumentChange((current) => {
      const target = targetId ? getNodeImageTargetById(current, targetId) : null
      if (target) {
        return target.props.nodeType === 'chat'
          ? addKonvaChatReferenceImage(current, target.id, createChatReferenceImageData(imageShape.props))
          : setRuntimeGraphImageNodeOwnData(current, target.id, createImageNodeData(imageShape.props))
      }
      return appendShapes(current, [imageShape]).document
    })
  }
  if ((options.getActivePageId?.() ?? options.pageId) === options.pageId) {
    options.onSelectionChange([targetId ?? imageShape.id])
  }
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

function getNodeImageTargetById(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => (
    shape.id === shapeId && shape.type === 'node_card' && (shape.props.nodeType === 'chat' || shape.props.nodeType === 'image')
  )) ?? null
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
