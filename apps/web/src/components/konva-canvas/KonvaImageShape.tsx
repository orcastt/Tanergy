import { useEffect, useMemo, useState } from 'react'
import { Image as KonvaImage, Rect } from 'react-konva'
import type { CanvasImageShape } from '@/features/canvas-engine'

const loadedCanvasImageCache = new Map<string, HTMLImageElement>()
const maxLoadedCanvasImages = 160

type KonvaImageShapeProps = {
  opacity: number
  shape: CanvasImageShape
  zoom: number
}

export function KonvaImageShape({ opacity, shape, zoom }: KonvaImageShapeProps) {
  const src = useKonvaImageSource(shape, zoom)
  const image = useLoadedImage(src)

  if (!src || !image) {
    return (
      <Rect
        fill="#eef2f7"
        height={shape.props.height}
        opacity={opacity}
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
      imageSmoothingEnabled={zoom > 0.5}
      opacity={opacity}
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
    nextImage.decoding = 'async'
    if (src.startsWith('/') || src.startsWith(window.location.origin)) nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => {
      if (cancelled) return
      rememberLoadedCanvasImage(src, nextImage)
      setLoaded({ image: nextImage, src })
    }
    nextImage.onerror = () => {
      if (!cancelled) setLoaded(null)
    }
    nextImage.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  const cached = src ? loadedCanvasImageCache.get(src) : null
  if (cached?.complete && cached.naturalWidth > 0) return cached
  return loaded?.src === src ? loaded.image : null
}

function rememberLoadedCanvasImage(src: string, image: HTMLImageElement) {
  loadedCanvasImageCache.delete(src)
  loadedCanvasImageCache.set(src, image)
  while (loadedCanvasImageCache.size > maxLoadedCanvasImages) {
    const oldest = loadedCanvasImageCache.keys().next().value
    if (!oldest) break
    loadedCanvasImageCache.delete(oldest)
  }
}

function useKonvaImageSource(shape: CanvasImageShape, zoom: number) {
  return useMemo(() => {
    const props = shape.props
    if (zoom <= 0.25) {
      return props.thumbnail256Url ?? props.thumbnail512Url ?? props.thumbnail1024Url ?? null
    }
    if (zoom <= 0.5) {
      return props.thumbnail512Url ?? props.thumbnail1024Url ?? props.thumbnail256Url ?? props.originalUrl ?? null
    }
    if (zoom <= 1) {
      return props.thumbnail1024Url ?? props.thumbnail512Url ?? props.originalUrl ?? props.thumbnail256Url ?? null
    }
    return props.originalUrl ?? props.thumbnail1024Url ?? props.thumbnail512Url ?? props.thumbnail256Url ?? null
  }, [shape.props, zoom])
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
