import {
  acceptedImageMimeTypes,
  imageMaxBytes,
  readImageFileMetadata,
  validateImageFile,
} from '@/features/assets/imageAssetInputs'
import { importRemoteImageAsset, uploadImageFileAsset } from '@/features/assets/assetUploadClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { TangentAssetOrigin } from '@/features/assets/assetTypes'
import type { CanvasImageShape, CanvasPoint } from '@/features/canvas-engine'

const maxPlacedImageEdge = 420

export async function readKonvaImageShapeFromClipboard(
  center: CanvasPoint,
  workspace?: TangentWorkspace
): Promise<CanvasImageShape | null> {
  const file = await readClipboardImageFile()
  if (file) {
    try {
      return await createKonvaImageShapeFromFile(file, center, 'paste', workspace)
    } catch {
      return null
    }
  }
  const url = await readClipboardImageUrl()
  if (!url) return null
  try {
    return await createKonvaImageShapeFromUrl(url, center, workspace)
  } catch {
    return null
  }
}

export async function readKonvaImageShapeFromClipboardData(
  data: DataTransfer,
  center: CanvasPoint,
  workspace?: TangentWorkspace
): Promise<CanvasImageShape | null> {
  const file = getImageFileFromDataTransfer(data)
  if (file) {
    try {
      return await createKonvaImageShapeFromFile(file, center, 'paste', workspace)
    } catch {
      return null
    }
  }
  const url = getImageUrlFromClipboardText(data.getData('text/html') || data.getData('text/plain'))
  if (!url) return null
  try {
    return await createKonvaImageShapeFromUrl(url, center, workspace)
  } catch {
    return null
  }
}

export async function createKonvaImageShapeFromFile(
  file: File,
  center: CanvasPoint,
  origin: TangentAssetOrigin = 'upload',
  workspace?: TangentWorkspace,
): Promise<CanvasImageShape> {
  validateImageFile(file)
  const image = await readImageFileMetadata(file)
  const asset = await uploadImageFileAsset({
    file,
    height: image.height,
    origin,
    title: file.name || (origin === 'paste' ? 'Clipboard image' : 'Image'),
    width: image.width,
  }, workspace)
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
  workspace?: TangentWorkspace
): Promise<CanvasImageShape | null> {
  if (url.startsWith('data:image/')) {
    const file = dataUrlToFile(url)
    return file ? createKonvaImageShapeFromFile(file, center, 'upload', workspace) : null
  }
  const asset = await importRemoteImageAsset({ origin: 'remote_import', title: 'Image', url }, workspace)
  const dimensions = asset.width > 0 && asset.height > 0
    ? { height: asset.height, width: asset.width }
    : await decodeImageDimensions(asset.originalUrl)
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
  const match = /^data:([^;,]+);base64,([a-zA-Z0-9+/=\s]+)$/s.exec(dataUrl)
  if (!match) return null
  const mime = (match[1] ?? '').toLowerCase()
  if (!acceptedImageMimeTypes.includes(mime)) return null
  const base64 = (match[2] ?? '').replace(/\s+/g, '')
  if (getBase64ByteLength(base64) > imageMaxBytes) return null
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  if (bytes.byteLength > imageMaxBytes) return null
  return new File([bytes], getClipboardFileName(mime), { type: mime })
}

function getBase64ByteLength(base64: string) {
  if (!base64 || base64.length % 4 !== 0) return Number.POSITIVE_INFINITY
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
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
