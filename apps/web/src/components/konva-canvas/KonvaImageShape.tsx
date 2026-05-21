import { useEffect, useMemo, useState } from 'react'
import { Image as KonvaImage, Rect } from 'react-konva'
import type { CanvasImageShape } from '@/features/canvas-engine'
import { firstSafeImageDisplayUrl } from '@/features/security/safeUrl'
import { getImagePreviewTier } from './KonvaNodeImagePreview'

const loadedCanvasImageCache = new Map<string, HTMLImageElement>()
const maxLoadedCanvasImages = 32
const maxLoadedCanvasImagePixels = 64 * 1024 * 1024
const maxLoadedCanvasImagePixelsPerImage = 24 * 1024 * 1024
const imageLoadTimeoutMs = 15_000

type KonvaImageShapeProps = {
  opacity: number
  previewMode?: boolean
  shape: CanvasImageShape
  zoom: number
}

export function KonvaImageShape({ opacity, previewMode = false, shape, zoom }: KonvaImageShapeProps) {
  const src = useKonvaImageSource(shape, zoom, previewMode)
  const image = useLoadedImage(src)

  if (!src || !image) {
    return (
      <Rect
        fill="#eef2f7"
        height={shape.props.height}
        opacity={opacity}
        perfectDrawEnabled={false}
        stroke="rgba(100, 116, 139, 0.42)"
        strokeWidth={1}
        width={shape.props.width}
      />
    )
  }

  return (
    <KonvaImage
      crop={getImageCrop(shape, image)}
      height={shape.props.height}
      image={image}
      imageSmoothingEnabled={!previewMode && zoom > 0.5}
      opacity={opacity}
      perfectDrawEnabled={false}
      width={shape.props.width}
    />
  )
}

function getImageCrop(shape: CanvasImageShape, image: HTMLImageElement) {
  const crop = shape.props.crop
  if (!crop) return undefined
  const naturalWidth = Math.max(1, image.naturalWidth)
  const naturalHeight = Math.max(1, image.naturalHeight)
  return {
    height: clamp(crop.height, 0.01, 1) * naturalHeight,
    width: clamp(crop.width, 0.01, 1) * naturalWidth,
    x: clamp(crop.x, 0, 1) * naturalWidth,
    y: clamp(crop.y, 0, 1) * naturalHeight,
  }
}

function useLoadedImage(src: string | null) {
  const [loaded, setLoaded] = useState<{ image: HTMLImageElement; src: string } | null>(null)

  useEffect(() => {
    if (!src) return
    const cached = loadedCanvasImageCache.get(src)
    if (cached?.complete && cached.naturalWidth > 0) {
      return
    }
    let cancelled = false
    const nextImage = new window.Image()
    const timeout = window.setTimeout(() => {
      if (cancelled) return
      cancelled = true
      nextImage.onload = null
      nextImage.onerror = null
      nextImage.src = ''
      setLoaded(null)
    }, imageLoadTimeoutMs)
    nextImage.decoding = 'async'
    if (src.startsWith('/') || src.startsWith(window.location.origin)) nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => {
      if (cancelled) return
      window.clearTimeout(timeout)
      rememberLoadedCanvasImage(src, nextImage)
      setLoaded({ image: nextImage, src })
    }
    nextImage.onerror = () => {
      window.clearTimeout(timeout)
      if (!cancelled) setLoaded(null)
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

  const cached = src ? loadedCanvasImageCache.get(src) : null
  if (cached?.complete && cached.naturalWidth > 0) return cached
  return loaded?.src === src ? loaded.image : null
}

function rememberLoadedCanvasImage(src: string, image: HTMLImageElement) {
  if (isTransientImageSource(src)) return
  if (getImagePixelCount(image) > maxLoadedCanvasImagePixelsPerImage) return
  loadedCanvasImageCache.delete(src)
  loadedCanvasImageCache.set(src, image)
  while (loadedCanvasImageCache.size > maxLoadedCanvasImages || getCachedImagePixelCount() > maxLoadedCanvasImagePixels) {
    const oldest = loadedCanvasImageCache.keys().next().value
    if (!oldest) break
    loadedCanvasImageCache.delete(oldest)
  }
}

function getCachedImagePixelCount() {
  let total = 0
  for (const image of loadedCanvasImageCache.values()) total += getImagePixelCount(image)
  return total
}

function getImagePixelCount(image: HTMLImageElement) {
  return Math.max(1, image.naturalWidth) * Math.max(1, image.naturalHeight)
}

function isTransientImageSource(src: string) {
  return src.startsWith('data:') || src.startsWith('blob:')
}

function useKonvaImageSource(shape: CanvasImageShape, zoom: number, previewMode: boolean) {
  return useMemo(() => {
    const props = shape.props
    if (previewMode) {
      return firstSafeImageDisplayUrl(props.thumbnail256Url, props.thumbnail512Url, props.thumbnail1024Url, props.originalUrl)
    }
    const tier = getImagePreviewTier(zoom, props)
    if (tier === 'small') {
      return firstSafeImageDisplayUrl(props.thumbnail256Url, props.thumbnail512Url, props.thumbnail1024Url, props.originalUrl)
    }
    if (tier === 'medium') {
      return firstSafeImageDisplayUrl(props.thumbnail512Url, props.thumbnail1024Url, props.thumbnail256Url, props.originalUrl)
    }
    if (tier === 'large') {
      return firstSafeImageDisplayUrl(props.thumbnail1024Url, props.thumbnail512Url, props.originalUrl, props.thumbnail256Url)
    }
    return firstSafeImageDisplayUrl(props.originalUrl, props.thumbnail1024Url, props.thumbnail512Url, props.thumbnail256Url)
  }, [previewMode, shape.props, zoom])
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
