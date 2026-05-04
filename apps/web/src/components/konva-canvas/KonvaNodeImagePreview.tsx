import { useEffect, useMemo, useState } from 'react'
import { Image as KonvaImage } from 'react-konva'
import type { JsonObject } from '@/types/nodeRuntime'
import type { RuntimeGraphImageAssetRef } from '@/features/node-runtime/runtimeGraphAssets'

const loadedNodeImageCache = new Map<string, HTMLImageElement>()

export function NodeImagePreview({
  bounds,
  source,
}: {
  bounds: { height: number; width: number; x: number; y: number }
  source: string | null
}) {
  const image = useLoadedNodeImage(source)
  const fit = useMemo(() => image ? getContainRect(image, bounds) : null, [bounds, image])
  return fit && image ? <KonvaImage image={image} {...fit} /> : null
}

export function getNodeImageSource(data: JsonObject) {
  return getStringValue(data.thumbnail512Url) ?? getStringValue(data.thumbnail1024Url) ?? getStringValue(data.originalUrl) ?? null
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

function getContainRect(image: HTMLImageElement, bounds: { height: number; width: number; x: number; y: number }) {
  const scale = Math.min(bounds.width / Math.max(1, image.naturalWidth), bounds.height / Math.max(1, image.naturalHeight))
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  return { height, width, x: bounds.x + (bounds.width - width) / 2, y: bounds.y + (bounds.height - height) / 2 }
}
