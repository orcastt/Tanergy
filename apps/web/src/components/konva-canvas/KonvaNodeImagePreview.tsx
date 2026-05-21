import { useEffect, useMemo, useState } from 'react'
import { Group, Image as KonvaImage, Rect } from 'react-konva'
import type { JsonObject } from '@/types/nodeRuntime'
import { getRuntimeGraphImageCrop, type RuntimeGraphImageAssetRef, type RuntimeGraphImageCrop } from '@/features/node-runtime/runtimeGraphAssets'
import { firstSafeImageDisplayUrl, safeImageDisplayUrl } from '@/features/security/safeUrl'

const loadedNodeImageCache = new Map<string, HTMLImageElement>()
const maxLoadedNodeImages = 24
const maxLoadedNodeImagePixels = 24 * 1024 * 1024
const maxLoadedNodeImagePixelsPerImage = 12 * 1024 * 1024
const nodeImageLoadTimeoutMs = 15_000
const smallPreviewEdgePx = 160
const mediumPreviewEdgePx = 420
const fullPreviewEdgePx = 900

type ImagePreviewSize = {
  height: number
  width: number
}

export function NodeImagePreview({
  bounds,
  crop,
  onDoubleClick,
  source,
}: {
  bounds: { height: number; width: number; x: number; y: number }
  crop?: RuntimeGraphImageCrop
  onDoubleClick?: () => void
  source: string | null
}) {
  const image = useLoadedNodeImage(source)
  const cropRect = useMemo(() => image ? getImageCropRect(image, crop) : undefined, [crop, image])
  const fit = useMemo(() => image ? getContainRect(image, bounds, cropRect) : null, [bounds, cropRect, image])
  return fit && image ? (
    <Group>
      <KonvaImage crop={cropRect} image={image} {...fit} />
      {onDoubleClick ? (
        <Rect
          fill="rgba(255,255,255,0.001)"
          height={fit.height}
          onDblClick={(event) => {
            event.cancelBubble = true
            onDoubleClick()
          }}
          width={fit.width}
          x={fit.x}
          y={fit.y}
        />
      ) : null}
    </Group>
  ) : null
}

export function getNodeImageSource(data: JsonObject, zoom: number, size?: ImagePreviewSize) {
  const original = safeImageDisplayUrl(getStringValue(data.originalUrl))
  const tier = getImagePreviewTier(zoom, size)
  if (data.source === 'merge_capture' && tier === 'full' && original) return original
  if (tier === 'small') return firstSafeImageDisplayUrl(getStringValue(data.thumbnail256Url), getStringValue(data.thumbnail512Url), getStringValue(data.thumbnail1024Url), getStringValue(data.originalUrl))
  if (tier === 'medium') return firstSafeImageDisplayUrl(getStringValue(data.thumbnail512Url), getStringValue(data.thumbnail1024Url), getStringValue(data.thumbnail256Url), getStringValue(data.originalUrl))
  if (tier === 'large') return firstSafeImageDisplayUrl(getStringValue(data.thumbnail1024Url), getStringValue(data.thumbnail512Url), getStringValue(data.originalUrl), getStringValue(data.thumbnail256Url))
  return firstSafeImageDisplayUrl(getStringValue(data.originalUrl), getStringValue(data.thumbnail1024Url), getStringValue(data.thumbnail512Url), getStringValue(data.thumbnail256Url))
}

export function getNodeImageCrop(data: JsonObject) {
  return getRuntimeGraphImageCrop(data.crop)
}

export function getGeneratedOutputSource(ref: RuntimeGraphImageAssetRef, zoom: number, size?: ImagePreviewSize) {
  const tier = getImagePreviewTier(zoom, size)
  if (tier === 'small') return firstSafeImageDisplayUrl(ref.thumbnail256Url, ref.thumbnail512Url, ref.thumbnail1024Url, ref.originalUrl)
  if (tier === 'medium') return firstSafeImageDisplayUrl(ref.thumbnail512Url, ref.thumbnail256Url, ref.thumbnail1024Url, ref.originalUrl)
  if (tier === 'large') return firstSafeImageDisplayUrl(ref.thumbnail1024Url, ref.thumbnail512Url, ref.thumbnail256Url, ref.originalUrl)
  return firstSafeImageDisplayUrl(ref.originalUrl, ref.thumbnail1024Url, ref.thumbnail512Url, ref.thumbnail256Url)
}

export function getImagePreviewTier(zoom: number, size?: ImagePreviewSize) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  const screenEdge = getScreenPreviewEdge(size, safeZoom)
  if (screenEdge <= smallPreviewEdgePx) return 'small'
  if (screenEdge <= mediumPreviewEdgePx) return 'medium'
  if (screenEdge <= fullPreviewEdgePx) return 'large'
  return 'full'
}

function getScreenPreviewEdge(size: ImagePreviewSize | undefined, zoom: number) {
  const width = typeof size?.width === 'number' && Number.isFinite(size.width) ? size.width : 0
  const height = typeof size?.height === 'number' && Number.isFinite(size.height) ? size.height : 0
  const worldEdge = Math.max(width, height)
  if (worldEdge > 0) return worldEdge * zoom
  if (zoom <= 0.25) return smallPreviewEdgePx
  if (zoom <= 0.5) return mediumPreviewEdgePx
  if (zoom <= 1) return fullPreviewEdgePx
  return fullPreviewEdgePx + 1
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
