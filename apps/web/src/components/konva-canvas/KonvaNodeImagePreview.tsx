import { useEffect, useMemo, useState } from 'react'
import { Image as KonvaImage } from 'react-konva'
import type { JsonObject } from '@/types/nodeRuntime'
import { getRuntimeGraphImageCrop, type RuntimeGraphImageAssetRef, type RuntimeGraphImageCrop } from '@/features/node-runtime/runtimeGraphAssets'

const loadedNodeImageCache = new Map<string, HTMLImageElement>()

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

export function getNodeImageSource(data: JsonObject) {
  return getStringValue(data.thumbnail512Url) ?? getStringValue(data.thumbnail1024Url) ?? getStringValue(data.originalUrl) ?? null
}

export function getNodeImageCrop(data: JsonObject) {
  return getRuntimeGraphImageCrop(data.crop)
}

export function getGeneratedOutputSource(ref: RuntimeGraphImageAssetRef) {
  return ref.thumbnail256Url ?? ref.thumbnail512Url ?? ref.thumbnail1024Url ?? ref.originalUrl ?? null
}

function useLoadedNodeImage(src: string | null) {
  const [loadedImage, setLoadedImage] = useState<{ image: HTMLImageElement; src: string } | null>(null)
  useEffect(() => {
    if (!src) return
    const cached = loadedNodeImageCache.get(src)
    if (cached?.complete && cached.naturalWidth > 0) return

    let cancelled = false
    const nextImage = new window.Image()
    nextImage.decoding = 'async'
    if (src.startsWith('/') || src.startsWith(window.location.origin)) nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => {
      if (cancelled) return
      loadedNodeImageCache.set(src, nextImage)
      setLoadedImage({ image: nextImage, src })
    }
    nextImage.onerror = () => { if (!cancelled) setLoadedImage(null) }
    nextImage.src = src
    return () => { cancelled = true }
  }, [src])
  const cached = src ? loadedNodeImageCache.get(src) : null
  if (cached?.complete && cached.naturalWidth > 0) return cached
  return loadedImage?.src === src ? loadedImage.image : null
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
