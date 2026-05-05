import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { getShapeBounds, type CanvasDocument, type CanvasNodeShape, type CanvasPoint } from '@/features/canvas-engine'
import { setRuntimeGraphImageNodeOwnData } from '@/features/node-runtime/runtimeGraph'
import type { JsonObject } from '@/types/nodeRuntime'
import { addKonvaChatReferenceFile, addKonvaChatReferenceImage } from './konvaChatNodeActions'
import { createKonvaImageShapeFromFile } from './konvaImageClipboard'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type UseKonvaImageNodeUploadOptions = {
  document: CanvasDocument
  history: KonvaCanvasHistory
  selectedIds: string[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaImageNodeUpload({
  document,
  history,
  onDocumentChange,
  onSelectionChange,
  selectedIds,
}: UseKonvaImageNodeUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const uploadImageNodeFile = useCallback(async (shapeId: string, file: File) => {
    const target = getImageNode(document, shapeId)
    if (!target) return
    const imageShape = await createKonvaImageShapeFromFile(file, {
      x: target.x + target.props.width / 2,
      y: target.y + target.props.height / 2,
    })
    history.checkpoint(document)
    onDocumentChange((current) => setRuntimeGraphImageNodeOwnData(
      current,
      shapeId,
      createImageNodeData(imageShape.props)
    ))
    onSelectionChange([shapeId])
  }, [document, history, onDocumentChange, onSelectionChange])

  const uploadChatNodeFile = useCallback(async (shapeId: string, file: File) => {
    const target = getChatNode(document, shapeId)
    if (!target) return
    history.checkpoint(document)
    if (file.type === 'application/pdf') {
      onDocumentChange((current) => addKonvaChatReferenceFile(current, shapeId, {
        mime: file.type,
        name: file.name || 'Reference.pdf',
        size: file.size,
      }))
      onSelectionChange([shapeId])
      return
    }
    const imageShape = await createKonvaImageShapeFromFile(file, {
      x: target.x + target.props.width / 2,
      y: target.y + target.props.height / 2,
    })
    onDocumentChange((current) => addKonvaChatReferenceImage(current, shapeId, {
      assetId: imageShape.props.assetId,
      originalUrl: imageShape.props.originalUrl,
      thumbnail256Url: imageShape.props.thumbnail256Url,
      title: imageShape.props.title ?? 'Reference image',
    }))
    onSelectionChange([shapeId])
  }, [document, history, onDocumentChange, onSelectionChange])

  const promptImageNodeUpload = useCallback((shapeId: string) => {
    uploadTargetRef.current = shapeId
    fileInputRef.current?.click()
  }, [])

  const uploadDropFileAtPoint = useCallback((file: File, point: CanvasPoint) => {
    const target = getNodeFileDropTarget(document, selectedIds, point)
    if (!target) return
    if (target.props.nodeType === 'chat') void uploadChatNodeFile(target.id, file)
    else if (file.type.startsWith('image/')) void uploadImageNodeFile(target.id, file)
  }, [document, selectedIds, uploadChatNodeFile, uploadImageNodeFile])

  const fileInput = (
    <input
      accept="image/*,application/pdf"
      className="konva-canvas-file-input"
      onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        const target = uploadTargetRef.current
        event.currentTarget.value = ''
        uploadTargetRef.current = null
        if (file && target) {
          const node = getUploadNode(document, target)
          if (node?.props.nodeType === 'chat') void uploadChatNodeFile(target, file)
          else if (file.type.startsWith('image/')) void uploadImageNodeFile(target, file)
        }
      }}
      ref={fileInputRef}
      type="file"
    />
  )

  return { fileInput, promptImageNodeUpload, uploadDropFileAtPoint }
}

function createImageNodeData(image: {
  alt?: string
  assetId: string
  height: number
  originalUrl?: string
  thumbnail1024Url?: string
  thumbnail256Url?: string
  thumbnail512Url?: string
  title?: string
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

function getImageNode(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => (
    shape.id === shapeId && shape.type === 'node_card' && shape.props.nodeType === 'image'
  )) ?? null
}

function getChatNode(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => (
    shape.id === shapeId && shape.type === 'node_card' && shape.props.nodeType === 'chat'
  )) ?? null
}

function getUploadNode(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => (
    shape.id === shapeId && shape.type === 'node_card' && (shape.props.nodeType === 'image' || shape.props.nodeType === 'chat')
  )) ?? null
}

function getNodeFileDropTarget(document: CanvasDocument, selectedIds: string[], point: CanvasPoint): CanvasNodeShape | null {
  const selected = new Set(selectedIds)
  const nodes = document.shapes.filter((shape): shape is CanvasNodeShape => shape.type === 'node_card' && (shape.props.nodeType === 'image' || shape.props.nodeType === 'chat'))
  return nodes.find((shape) => selected.has(shape.id)) ?? nodes.find((shape) => {
    const bounds = getShapeBounds(shape)
    return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY
  }) ?? null
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject
}
