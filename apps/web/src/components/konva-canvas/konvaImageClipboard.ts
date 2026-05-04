import {
  readImageFileAsDataUrl,
  validateImageFile,
} from '@/features/assets/imageAssetInputs'
import { uploadImageDataUrlAsset } from '@/features/assets/assetUploadClient'
import type { CanvasImageShape, CanvasPoint } from '@/features/canvas-engine'

const maxPlacedImageEdge = 420

export async function readKonvaImageShapeFromClipboard(center: CanvasPoint): Promise<CanvasImageShape | null> {
  const file = await readClipboardImageFile()
  if (file) {
    try {
      return await createKonvaImageShapeFromFile(file, center)
    } catch {
      return null
    }
  }
  const url = await readClipboardImageUrl()
  if (!url) return null
  try {
    return await createKonvaImageShapeFromUrl(url, center)
  } catch {
    return null
  }
}

export async function readKonvaImageShapeFromClipboardData(data: DataTransfer, center: CanvasPoint): Promise<CanvasImageShape | null> {
  const file = getImageFileFromDataTransfer(data)
  if (file) {
    try {
      return await createKonvaImageShapeFromFile(file, center)
    } catch {
      return null
    }
  }
  const url = getImageUrlFromClipboardText(data.getData('text/html') || data.getData('text/plain'))
  if (!url) return null
  try {
    return await createKonvaImageShapeFromUrl(url, center)
  } catch {
    return null
  }
}

export async function createKonvaImageShapeFromFile(file: File, center: CanvasPoint): Promise<CanvasImageShape> {
  validateImageFile(file)
  const image = await readImageFileAsDataUrl(file)
  const asset = await uploadImageDataUrlAsset({
    dataUrl: image.url,
    fileName: file.name || getClipboardFileName(file.type),
    height: image.height,
    origin: 'paste',
    title: file.name || 'Clipboard image',
    width: image.width,
  })
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

async function createKonvaImageShapeFromUrl(url: string, center: CanvasPoint): Promise<CanvasImageShape | null> {
  if (url.startsWith('data:image/')) {
    const file = dataUrlToFile(url)
    return file ? createKonvaImageShapeFromFile(file, center) : null
  }
  const dimensions = await decodeImageDimensions(url)
  return createImageShapeFromAsset({
    assetId: `remote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    center,
    height: dimensions.height,
    originalUrl: url,
    title: 'Remote image',
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
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) return null
  const binary = atob(match[2] ?? '')
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new File([bytes], getClipboardFileName(match[1] ?? 'image/png'), { type: match[1] })
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
