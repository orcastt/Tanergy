import {
  readImageFileMetadata,
  validateImageFile,
} from '@/features/assets/imageAssetInputs'
import { createImageFileFromDataUrlValue, parseImageDataUrl } from '@/features/assets/imageDataUrl'
import { importRemoteImageAsset, uploadImageFileAsset } from '@/features/assets/assetUploadClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { TangentAssetOrigin } from '@/features/assets/assetTypes'
import type { CanvasImageShape, CanvasPoint } from '@/features/canvas-engine'
import type { KonvaPendingImagePaste } from './KonvaPendingImagePasteLayer'

const maxPlacedImageEdge = 420
const defaultPendingImageSize = { height: 168, width: 248 }

export type KonvaClipboardImageReadResult =
  | { kind: 'error' }
  | { kind: 'none' }
  | { kind: 'shape'; shape: CanvasImageShape }

export type KonvaImagePasteLifecycle = {
  onComplete?: (pendingId: string) => void
  onStateChange?: (state: KonvaPendingImagePaste) => void
  pageId: string
}

export async function readKonvaImageShapeFromClipboard(
  center: CanvasPoint,
  workspace?: TangentWorkspace,
  lifecycle?: KonvaImagePasteLifecycle,
): Promise<KonvaClipboardImageReadResult> {
  const file = await readClipboardImageFile()
  if (file) {
    try {
      return { kind: 'shape', shape: await createKonvaImageShapeFromFile(file, center, 'paste', workspace, lifecycle) }
    } catch {
      return { kind: 'error' }
    }
  }
  const url = await readClipboardImageUrl()
  if (!url) return { kind: 'none' }
  try {
    const shape = await createKonvaImageShapeFromUrl(url, center, workspace, lifecycle)
    return shape ? { kind: 'shape', shape } : { kind: 'none' }
  } catch {
    return { kind: 'error' }
  }
}

export async function readKonvaImageShapeFromClipboardData(
  data: DataTransfer,
  center: CanvasPoint,
  workspace?: TangentWorkspace,
  lifecycle?: KonvaImagePasteLifecycle,
): Promise<KonvaClipboardImageReadResult> {
  const file = getImageFileFromDataTransfer(data)
  if (file) {
    try {
      return { kind: 'shape', shape: await createKonvaImageShapeFromFile(file, center, 'paste', workspace, lifecycle) }
    } catch {
      return { kind: 'error' }
    }
  }
  const url = getImageUrlFromClipboardText(data.getData('text/html') || data.getData('text/plain'))
  if (!url) return { kind: 'none' }
  try {
    const shape = await createKonvaImageShapeFromUrl(url, center, workspace, lifecycle)
    return shape ? { kind: 'shape', shape } : { kind: 'none' }
  } catch {
    return { kind: 'error' }
  }
}

export async function createKonvaImageShapeFromFile(
  file: File,
  center: CanvasPoint,
  origin: TangentAssetOrigin = 'upload',
  workspace?: TangentWorkspace,
  lifecycle?: KonvaImagePasteLifecycle,
): Promise<CanvasImageShape> {
  const tracker = createPendingImagePasteTracker(center, lifecycle)
  tracker.update({
    detail: 'Reading clipboard',
    progress: 0.12,
    status: 'pending',
  })
  try {
    validateImageFile(file)
    const image = await readImageFileMetadata(file)
    const size = getPlacedImageSize(image.width, image.height)
    tracker.update({
      detail: 'Uploading image',
      height: size.height,
      progress: 0.24,
      status: 'pending',
      width: size.width,
    })
    const asset = await uploadImageFileAsset({
      file,
      height: image.height,
      onProgress: (progress) => tracker.update({
        detail: 'Uploading image',
        progress: 0.24 + clamp(progress, 0, 1) * 0.66,
        status: 'pending',
      }),
      origin,
      title: file.name || (origin === 'paste' ? 'Clipboard image' : 'Image'),
      width: image.width,
    }, workspace)
    tracker.complete()
    return createImageShapeFromAsset({
      assetId: asset.id,
      center,
      height: asset.height,
      mime: asset.mime,
      originalUrl: asset.originalUrl,
      thumbnail1024Url: asset.thumbnail1024Url,
      thumbnail256Url: asset.thumbnail256Url,
      thumbnail512Url: asset.thumbnail512Url,
      title: asset.title,
      width: asset.width,
    })
  } catch (error) {
    tracker.fail(toPendingFailureDetail(error))
    throw error
  }
}

function getImageFileFromDataTransfer(data: DataTransfer) {
  const file = Array.from(data.files).find((item) => item.type.startsWith('image/'))
  if (file) return file
  for (const item of Array.from(data.items)) {
    if (!item.type.startsWith('image/')) continue
    const itemFile = item.getAsFile()
    if (itemFile) return itemFile
  }
  return null
}

async function createKonvaImageShapeFromUrl(
  url: string,
  center: CanvasPoint,
  workspace?: TangentWorkspace,
  lifecycle?: KonvaImagePasteLifecycle,
): Promise<CanvasImageShape | null> {
  if (url.startsWith('data:image/')) {
    const file = dataUrlToFile(url)
    return file ? createKonvaImageShapeFromFile(file, center, 'upload', workspace, lifecycle) : null
  }
  const tracker = createPendingImagePasteTracker(center, lifecycle)
  tracker.update({
    detail: 'Importing image',
    progress: 0.18,
    status: 'pending',
  })
  try {
    const asset = await importRemoteImageAsset({ origin: 'remote_import', title: 'Image', url }, workspace)
    tracker.update({
      detail: 'Finalizing',
      progress: 0.82,
      status: 'pending',
    })
    const dimensions = asset.width > 0 && asset.height > 0
      ? { height: asset.height, width: asset.width }
      : await decodeImageDimensions(asset.originalUrl)
    const size = getPlacedImageSize(dimensions.width, dimensions.height)
    tracker.update({
      detail: 'Finalizing',
      height: size.height,
      progress: 0.92,
      status: 'pending',
      width: size.width,
    })
    tracker.complete()
    return createImageShapeFromAsset({
      assetId: asset.id,
      center,
      height: dimensions.height,
      mime: asset.mime,
      originalUrl: asset.originalUrl,
      thumbnail1024Url: asset.thumbnail1024Url,
      thumbnail256Url: asset.thumbnail256Url,
      thumbnail512Url: asset.thumbnail512Url,
      title: asset.title,
      width: dimensions.width,
    })
  } catch (error) {
    tracker.fail(toPendingFailureDetail(error))
    throw error
  }
}

async function readClipboardImageFile(): Promise<File | null> {
  if (!navigator.clipboard?.read) return null
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'))
      if (!imageType) continue
      const blob = await item.getType(imageType)
      return new File([blob], getClipboardFileName(imageType), { type: imageType })
    }
  } catch {
    return null
  }
  return null
}

async function readClipboardImageUrl(): Promise<string | null> {
  if (!navigator.clipboard?.readText) return null
  try {
    const text = (await navigator.clipboard.readText()).trim()
    return getImageUrlFromClipboardText(text)
  } catch {
    return null
  }
}

function createImageShapeFromAsset(input: {
  assetId: string
  center: CanvasPoint
  height: number
  mime?: string
  originalUrl?: string
  thumbnail1024Url?: string
  thumbnail256Url?: string
  thumbnail512Url?: string
  title?: string
  width: number
}): CanvasImageShape {
  const size = getPlacedImageSize(input.width, input.height)
  return {
    id: `image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    props: {
      alt: input.title,
      assetId: input.assetId,
      height: size.height,
      mime: input.mime,
      originalUrl: input.originalUrl,
      thumbnail1024Url: input.thumbnail1024Url,
      thumbnail256Url: input.thumbnail256Url,
      thumbnail512Url: input.thumbnail512Url,
      title: input.title,
      width: size.width,
    },
    type: 'image',
    x: input.center.x - size.width / 2,
    y: input.center.y - size.height / 2,
  }
}

function getPlacedImageSize(width: number, height: number) {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const scale = Math.min(1, maxPlacedImageEdge / Math.max(safeWidth, safeHeight))
  return {
    height: Math.max(12, Math.round(safeHeight * scale)),
    width: Math.max(12, Math.round(safeWidth * scale)),
  }
}

function getImageUrlFromClipboardText(text: string) {
  if (!text) return null
  const htmlMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(text)
  const candidate = htmlMatch?.[1] ?? text
  if (candidate.startsWith('data:image/')) return candidate
  if (/^https?:\/\/\S+\.(png|jpe?g|webp)(\?\S*)?$/i.test(candidate)) return candidate
  return null
}

function dataUrlToFile(dataUrl: string) {
  try {
    const parsed = parseImageDataUrl(dataUrl)
    return createImageFileFromDataUrlValue(dataUrl, getClipboardFileName(parsed.mime))
  } catch {
    return null
  }
}

function decodeImageDimensions(src: string) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new window.Image()
    image.decoding = 'async'
    image.onerror = () => reject(new Error('Failed to decode image.'))
    image.onload = () => resolve({ height: image.naturalHeight || 240, width: image.naturalWidth || 320 })
    image.src = src
  })
}

function getClipboardFileName(mime: string) {
  if (mime === 'image/jpeg') return 'clipboard-image.jpg'
  if (mime === 'image/webp') return 'clipboard-image.webp'
  return 'clipboard-image.png'
}

function createPendingImagePasteTracker(
  center: CanvasPoint,
  lifecycle?: KonvaImagePasteLifecycle,
) {
  if (!lifecycle) {
    return {
      complete() {},
      fail() {},
      update() {},
    }
  }

  const state: KonvaPendingImagePaste = {
    center,
    detail: 'Preparing image',
    height: defaultPendingImageSize.height,
    id: `pending-image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    pageId: lifecycle.pageId,
    progress: 0.08,
    status: 'pending',
    width: defaultPendingImageSize.width,
  }
  let previousProgress = state.progress
  lifecycle.onStateChange?.({ ...state })

  return {
    complete() {
      lifecycle.onComplete?.(state.id)
    },
    fail(detail: string) {
      state.detail = detail
      state.progress = Math.max(state.progress, 0.98)
      state.status = 'failed'
      lifecycle.onStateChange?.({ ...state })
    },
    update(patch: Partial<Omit<KonvaPendingImagePaste, 'center' | 'id' | 'pageId'>>) {
      const previousDetail = state.detail
      const previousHeight = state.height
      const previousWidth = state.width
      if (typeof patch.detail === 'string') state.detail = patch.detail
      if (typeof patch.height === 'number') state.height = Math.max(72, Math.round(patch.height))
      if (typeof patch.width === 'number') state.width = Math.max(96, Math.round(patch.width))
      if (typeof patch.progress === 'number') state.progress = clamp(patch.progress, 0, 0.99)
      if (patch.status) state.status = patch.status
      const shouldEmit = patch.status === 'failed'
        || Math.abs(state.progress - previousProgress) >= 0.03
        || state.width !== previousWidth
        || state.height !== previousHeight
        || state.detail !== previousDetail
      if (!shouldEmit) return
      previousProgress = state.progress
      lifecycle.onStateChange?.({ ...state })
    },
  }
}

function toPendingFailureDetail(error: unknown) {
  if (!(error instanceof Error)) return 'Unable to paste image.'
  return error.message || 'Unable to paste image.'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
