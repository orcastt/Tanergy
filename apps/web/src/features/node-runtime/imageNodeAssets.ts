import { AssetRecordType, createShapeId, type Editor, type TLAssetId, type TLShapeId } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { primeAssetPreviewThumbnails } from '@/features/assets/assetPreviewResolver'
import { createNodeCard } from './createNodeCard'

type ImageAssetRecord = {
  props?: {
    h?: number
    mimeType?: string
    name?: string
    src?: string
    w?: number
  }
}

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

export const spikeAcceptedNodeImageMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
export const spikeNodeImageMaxBytes = 3 * 1024 * 1024

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
  const assetId = createLocalAsset(editor, {
    height: input.height,
    mimeType: 'image/png',
    name: `${slugify(input.title)}.png`,
    src: input.url,
    width: input.width,
  })

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

export function getImageAsset(editor: Editor, assetId?: string | null) {
  if (!assetId) return null
  const asset = editor.getAsset(assetId as TLAssetId) as ImageAssetRecord | undefined
  const src = asset?.props?.src
  if (!src) return null
  return {
    assetId,
    height: asset.props?.h,
    mimeType: asset.props?.mimeType,
    src,
    title: asset.props?.name || 'Image',
    width: asset.props?.w,
  }
}

export async function importFileToImageNode(
  editor: Editor,
  shape: NodeCardShape,
  file: File
) {
  validateImageFile(file)
  const preview = await readFileAsDataUrl(file)
  const assetId = createLocalAsset(editor, {
    height: preview.height,
    mimeType: file.type,
    name: file.name,
    src: preview.url,
    width: preview.width,
  })

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

function createLocalAsset(
  editor: Editor,
  input: {
    height: number
    mimeType: string
    name: string
    src: string
    width: number
  }
) {
  const assetId = AssetRecordType.createId(`${slugify(input.name)}-${Date.now()}`) as TLAssetId
  editor.createAssets([
    {
      id: assetId,
      meta: {},
      props: {
        h: input.height,
        isAnimated: false,
        mimeType: input.mimeType,
        name: input.name,
        src: input.src,
        w: input.width,
      },
      type: 'image',
      typeName: 'asset',
    },
  ])
  primeAssetPreviewThumbnails({
    assetId: String(assetId),
    height: input.height,
    src: input.src,
    width: input.width,
  })
  return assetId
}

async function readFileAsDataUrl(file: File) {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })

  const dimensions = await new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new window.Image()
    image.onerror = () => reject(new Error('Failed to decode image.'))
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth })
    image.src = url
  })

  return { ...dimensions, url }
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

function validateImageFile(file: File) {
  if (!spikeAcceptedNodeImageMimeTypes.includes(file.type)) {
    throw new Error('Use PNG, JPEG, or WebP.')
  }
  if (file.size > spikeNodeImageMaxBytes) {
    throw new Error('Image must be 3MB or smaller.')
  }
}
