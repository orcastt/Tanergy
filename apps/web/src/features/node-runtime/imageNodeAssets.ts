import { createShapeId, type Editor, type TLAssetId, type TLShapeId } from 'tldraw'
import { createEditorImageAsset, getImageAsset } from '@/features/assets/editorImageAssets'
import { imageMaxBytes, acceptedImageMimeTypes, readImageFileAsDataUrl, validateImageFile } from '@/features/assets/imageAssetInputs'
import { uploadImageDataUrlAsset } from '@/features/assets/assetUploadClient'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { createNodeCard } from './createNodeCard'

type CanvasImageShape = {
  id: TLShapeId
  props?: {
    assetId?: TLAssetId
    h?: number
    w?: number
  }
  type: 'image'
  x: number
  y: number
}

type ImageNodeDataPatch = {
  assetId: string
  imageHeight?: number
  imageWidth?: number
  source: 'editor_export' | 'generated' | 'merge_capture' | 'upload'
  title: string
}

export const spikeAcceptedNodeImageMimeTypes = acceptedImageMimeTypes
export const spikeNodeImageMaxBytes = imageMaxBytes

export async function createImageNodeFromCanvasImage(editor: Editor, shapeId: TLShapeId) {
  const shape = editor.getShape(shapeId)
  if (!isCanvasImageShape(shape)) return null

  const asset = getImageAsset(editor, shape.props?.assetId)
  if (!asset) return null

  return createImageNode(editor, {
    assetId: shape.props?.assetId ?? asset.assetId,
    imageHeight: asset.height ?? shape.props?.h,
    imageWidth: asset.width ?? shape.props?.w,
    source: 'upload',
    title: asset.title,
    x: shape.x + (shape.props?.w ?? asset.width ?? 320) + 40,
    y: shape.y,
  })
}

export function createCanvasImageFromNode(
  editor: Editor,
  input: {
    assetId: string
    imageHeight?: number
    imageWidth?: number
    x: number
    y: number
  }
) {
  const asset = getImageAsset(editor, input.assetId)
  if (!asset) return null

  const naturalWidth = input.imageWidth ?? asset.width ?? 320
  const naturalHeight = input.imageHeight ?? asset.height ?? 240
  const { height, width } = fitCanvasImageSize(naturalWidth, naturalHeight)
  const shapeId = createShapeId(`canvas-image-${Date.now()}-${Math.round(Math.random() * 1000)}`)

  editor.createShape({
    id: shapeId,
    type: 'image',
    x: input.x,
    y: input.y,
    props: {
      assetId: input.assetId as TLAssetId,
      h: height,
      w: width,
    },
  })

  requestAnimationFrame(() => editor.select(shapeId))

  return shapeId
}

export async function createImageNodeFromDataUrl(
  editor: Editor,
  input: {
    height: number
    source: 'editor_export' | 'merge_capture'
    title: string
    url: string
    width: number
    x: number
    y: number
  }
) {
  const assetRecord = await uploadImageDataUrlAsset({
    dataUrl: input.url,
    fileName: `${slugify(input.title)}.png`,
    height: input.height,
    origin: input.source,
    title: input.title,
    width: input.width,
  })
  const assetId = createEditorImageAsset(editor, assetRecord)

  return createImageNode(editor, {
    assetId,
    imageHeight: input.height,
    imageWidth: input.width,
    source: input.source,
    title: input.title,
    x: input.x,
    y: input.y,
  })
}

export async function importFileToImageNode(
  editor: Editor,
  shape: NodeCardShape,
  file: File
) {
  validateImageFile(file)
  const preview = await readImageFileAsDataUrl(file)
  const assetRecord = await uploadImageDataUrlAsset({
    dataUrl: preview.url,
    fileName: file.name,
    height: preview.height,
    origin: 'upload',
    title: file.name,
    width: preview.width,
  })
  const assetId = createEditorImageAsset(editor, assetRecord)

  const nextData = {
    ...(asJsonObject(shape.props.data)),
    assetId,
    imageHeight: preview.height,
    imageWidth: preview.width,
    source: 'upload',
    title: file.name,
  }

  editor.updateShape<NodeCardShape>({
    id: shape.id,
    props: { data: nextData },
    type: 'node_card',
  })
}

export function isCanvasImageShape(shape: unknown): shape is CanvasImageShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'image')
}

function asJsonObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function createImageNode(
  editor: Editor,
  input: ImageNodeDataPatch & { x: number; y: number }
) {
  return createNodeCard(editor, {
    data: {
      assetId: input.assetId,
      ...(typeof input.imageHeight === 'number' ? { imageHeight: input.imageHeight } : {}),
      ...(typeof input.imageWidth === 'number' ? { imageWidth: input.imageWidth } : {}),
      source: input.source,
      title: input.title,
    },
    type: 'image',
    x: input.x,
    y: input.y,
  })
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32) || 'image'
}

function fitCanvasImageSize(width: number, height: number) {
  const maxEdge = 360
  const longestEdge = Math.max(width, height, 1)
  const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1
  return {
    height: Math.max(96, Math.round(height * scale)),
    width: Math.max(96, Math.round(width * scale)),
  }
}
