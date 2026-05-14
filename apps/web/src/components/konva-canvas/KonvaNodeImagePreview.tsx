import { useEffect, useMemo, useState } from 'react'
import { Image as KonvaImage } from 'react-konva'
import type { JsonObject } from '@/types/nodeRuntime'
import { getRuntimeGraphImageCrop, type RuntimeGraphImageAssetRef, type RuntimeGraphImageCrop } from '@/features/node-runtime/runtimeGraphAssets'

const loadedNodeImageCache = new Map<string, HTMLImageElement>()
const maxLoadedNodeImages = 24
const maxLoadedNodeImagePixels = 24 * 1024 * 1024
const maxLoadedNodeImagePixelsPerImage = 12 * 1024 * 1024
const nodeImageLoadTimeoutMs = 15_000

export function NodeImagePreview({
  bounds,
  crop,
  source,
}: {
  bounds: { height: number; width: number; x: number; y: number }
  crop?: RuntimeGraphImageCrop
  source: string | null
}) {
  const image = useLoadedNodeImage(source)
  const cropRect = useMemo(() => image ? getImageCropRect(image, crop) : undefined, [crop, image])
  const fit = useMemo(() => image ? getContainRect(image, bounds, cropRect) : null, [bounds, cropRect, image])
  return fit && image ? <KonvaImage crop={cropRect} image={image} {...fit} /> : null
}

export function getNodeImageSource(data: JsonObject, zoom: number) {
  const original = getStringValue(data.originalUrl)
  if (data.source === 'merge_capture' && zoom > 0.5 && original) return original
  if (zoom <= 0.25) return getStringValue(data.thumbnail256Url) ?? getStringValue(data.thumbnail512Url) ?? getStringValue(data.thumbnail1024Url) ?? null
  if (zoom <= 0.5) return getStringValue(data.thumbnail512Url) ?? getStringValue(data.thumbnail1024Url) ?? getStringValue(data.thumbnail256Url) ?? getStringValue(data.originalUrl) ?? null
  if (zoom <= 1) return getStringValue(data.thumbnail1024Url) ?? getStringValue(data.thumbnail512Url) ?? getStringValue(data.originalUrl) ?? getStringValue(data.thumbnail256Url) ?? null
  return getStringValue(data.originalUrl) ?? getStringValue(data.thumbnail1024Url) ?? getStringValue(data.thumbnail512Url) ?? getStringValue(data.thumbnail256Url) ?? null
}

export function getNodeImageCrop(data: JsonObject) {
  return getRuntimeGraphImageCrop(data.crop)
}

export function getGeneratedOutputSource(ref: RuntimeGraphImageAssetRef, zoom: number) {
  if (zoom <= 0.25) return ref.thumbnail256Url ?? ref.thumbnail512Url ?? ref.thumbnail1024Url ?? null
  if (zoom <= 0.5) return ref.thumbnail512Url ?? ref.thumbnail256Url ?? ref.thumbnail1024Url ?? ref.originalUrl ?? null
  if (zoom <= 1) return ref.thumbnail1024Url ?? ref.thumbnail512Url ?? ref.thumbnail256Url ?? ref.originalUrl ?? null
  return ref.originalUrl ?? ref.thumbnail1024Url ?? ref.thumbnail512Url ?? ref.thumbnail256Url ?? null
}

function useLoadedNodeImage(src: string | null) {
  const [loadedImage, setLoadedImage] = useState<{ image: HTMLImageElement; src: string } | null>(null)
  useEffect(() => {
    if (!src) return
    const cached = loadedNodeImageCache.get(src)
    if (cached?.complete && cached.naturalWidth > 0) return

    let cancelled = false
    const nextImage = new window.Image()
    const timeout = window.setTimeout(() => {
      if (cancelled) return
      cancelled = true
      nextImage.onload = null
      nextImage.onerror = null
      nextImage.src = ''
      setLoadedImage(null)
    }, nodeImageLoadTimeoutMs)
    nextImage.decoding = 'async'
    if (src.startsWith('/') || src.startsWith(window.location.origin)) nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => {
      if (cancelled) return
      window.clearTimeout(timeout)
      rememberLoadedNodeImage(src, nextImage)
      setLoadedImage({ image: nextImage, src })
    }
    nextImage.onerror = () => {
      window.clearTimeout(timeout)
      if (!cancelled) setLoadedImage(null)
    }
    nextImage.src = src
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      nextImage.onload = null
      nextImage.onerror = null
      nextImage.src = ''
    }
  }, [src])
  const cached = src ? loadedNodeImageCache.get(src) : null
  if (cached?.complete && cached.naturalWidth > 0) return cached
  return loadedImage?.src === src ? loadedImage.image : null
}

function rememberLoadedNodeImage(src: string, image: HTMLImageElement) {
  if (isTransientImageSource(src)) return
  if (getImagePixelCount(image) > maxLoadedNodeImagePixelsPerImage) return
  loadedNodeImageCache.delete(src)
  loadedNodeImageCache.set(src, image)
  while (loadedNodeImageCache.size > maxLoadedNodeImages || getCachedNodeImagePixelCount() > maxLoadedNodeImagePixels) {
    const oldest = loadedNodeImageCache.keys().next().value
    if (!oldest) break
    loadedNodeImageCache.delete(oldest)
  }
}

function getCachedNodeImagePixelCount() {
  let total = 0
  for (const image of loadedNodeImageCache.values()) total += getImagePixelCount(image)
  return total
}

function getImagePixelCount(image: HTMLImageElement) {
  return Math.max(1, image.naturalWidth) * Math.max(1, image.naturalHeight)
}

function isTransientImageSource(src: string) {
  return src.startsWith('data:') || src.startsWith('blob:')
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function getImageCropRect(image: HTMLImageElement, crop: RuntimeGraphImageCrop | undefined) {
  if (!crop) return undefined
  const naturalWidth = Math.max(1, image.naturalWidth)
  const naturalHeight = Math.max(1, image.naturalHeight)
  return {
    height: Math.max(1, crop.height * naturalHeight),
    width: Math.max(1, crop.width * naturalWidth),
    x: crop.x * naturalWidth,
    y: crop.y * naturalHeight,
  }
}

function getContainRect(
  image: HTMLImageElement,
  bounds: { height: number; width: number; x: number; y: number },
  cropRect: { height: number; width: number; x: number; y: number } | undefined
) {
  const sourceWidth = cropRect?.width ?? image.naturalWidth
  const sourceHeight = cropRect?.height ?? image.naturalHeight
  const scale = Math.min(bounds.width / Math.max(1, sourceWidth), bounds.height / Math.max(1, sourceHeight))
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  return { height, width, x: bounds.x + (bounds.width - width) / 2, y: bounds.y + (bounds.height - height) / 2 }
}
