import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { getShapeBounds, type CanvasDocument, type CanvasNodeShape, type CanvasPoint } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { setRuntimeGraphImageNodeOwnData } from '@/features/node-runtime/runtimeGraph'
import type { JsonObject } from '@/types/nodeRuntime'
import { addKonvaChatReferenceFile, addKonvaChatReferenceImage } from './konvaChatNodeActions'
import { createKonvaImageShapeFromFile } from './konvaImageClipboard'
import { appendShapes } from './konvaShapeCommands'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type UseKonvaImageNodeUploadOptions = {
  document: CanvasDocument
  history: KonvaCanvasHistory
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
  workspace?: TangentWorkspace
}

export function useKonvaImageNodeUpload({
  document,
  history,
  onDocumentChange,
  onSelectionChange,
  workspace,
}: UseKonvaImageNodeUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const uploadImageNodeFile = useCallback(async (shapeId: string, file: File) => {
    const target = getImageNode(document, shapeId)
    if (!target || isImageNodeLockedToUpstream(target)) return
    const imageShape = await createKonvaImageShapeFromFile(file, {
      x: target.x + target.props.width / 2,
      y: target.y + target.props.height / 2,
    }, 'upload', workspace)
    history.checkpoint(document)
    onDocumentChange((current) => setRuntimeGraphImageNodeOwnData(
      current,
      shapeId,
      createImageNodeData(imageShape.props)
    ))
    onSelectionChange([shapeId])
  }, [document, history, onDocumentChange, onSelectionChange, workspace])

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
    }, 'upload', workspace)
    onDocumentChange((current) => addKonvaChatReferenceImage(current, shapeId, {
      assetId: imageShape.props.assetId,
      originalUrl: imageShape.props.originalUrl,
      thumbnail256Url: imageShape.props.thumbnail256Url,
      title: imageShape.props.title ?? 'Reference image',
    }))
    onSelectionChange([shapeId])
  }, [document, history, onDocumentChange, onSelectionChange, workspace])

  const uploadCanvasImageFile = useCallback(async (file: File, center: CanvasPoint) => {
    const imageShape = await createKonvaImageShapeFromFile(file, center, 'upload', workspace)
    history.checkpoint(document)
    const result = appendShapes(document, [imageShape])
    onDocumentChange(result.document)
    onSelectionChange(result.selectedIds)
  }, [document, history, onDocumentChange, onSelectionChange, workspace])

  const promptImageNodeUpload = useCallback((shapeId: string) => {
    if (!canReplaceImageNode(document, shapeId)) return
    uploadTargetRef.current = shapeId
    fileInputRef.current?.click()
  }, [document])

  const uploadDropFileAtPoint = useCallback((file: File, point: CanvasPoint, fallbackCenterPoint: CanvasPoint = point) => {
    const target = getNodeFileDropTarget(document, point)
    if (target) {
      if (target.props.nodeType === 'chat') {
        void uploadChatNodeFile(target.id, file)
        return
      }
      if (isImageNodeLockedToUpstream(target)) return
      if (file.type.startsWith('image/')) void uploadImageNodeFile(target.id, file)
      return
    }
    if (!file.type.startsWith('image/')) return
    void uploadCanvasImageFile(file, fallbackCenterPoint)
  }, [document, uploadCanvasImageFile, uploadChatNodeFile, uploadImageNodeFile])

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
          if (node?.props.nodeType === 'chat') {
            void uploadChatNodeFile(target, file)
            return
          }
          if (node?.props.nodeType === 'image' && isImageNodeLockedToUpstream(node)) return
          if (file.type.startsWith('image/')) void uploadImageNodeFile(target, file)
        }
      }}
      ref={fileInputRef}
      type="file"
    />
  )

  return { fileInput, promptImageNodeUpload, uploadDropFileAtPoint }
}

export function canReplaceImageNode(document: CanvasDocument, shapeId: string) {
  const node = getImageNode(document, shapeId)
  return Boolean(node && !isImageNodeLockedToUpstream(node))
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

function isImageNodeLockedToUpstream(shape: CanvasNodeShape) {
  return typeof shape.props.data.inputSourceEdgeId === 'string' && shape.props.data.inputSourceEdgeId.length > 0
}

function getUploadNode(document: CanvasDocument, shapeId: string): CanvasNodeShape | null {
  return document.shapes.find((shape): shape is CanvasNodeShape => (
    shape.id === shapeId && shape.type === 'node_card' && (shape.props.nodeType === 'image' || shape.props.nodeType === 'chat')
  )) ?? null
}

function getNodeFileDropTarget(document: CanvasDocument, point: CanvasPoint): CanvasNodeShape | null {
  const nodes = document.shapes.filter((shape): shape is CanvasNodeShape => shape.type === 'node_card' && (shape.props.nodeType === 'image' || shape.props.nodeType === 'chat'))
  return nodes.find((shape) => {
    const bounds = getShapeBounds(shape)
    return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY
  }) ?? null
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject
}
