'use client'

import type { TangentAssetDataUrlInput, TangentAssetThumbnailInput } from './assetTypes'

type ThumbnailSize = 256 | 512 | 1024

export async function createImageDataUrlThumbnails(dataUrl: string) {
  const image = await decodeImage(dataUrl)
  const thumbnails: NonNullable<TangentAssetDataUrlInput['thumbnails']> = {}
  for (const size of [256, 512, 1024] satisfies ThumbnailSize[]) {
    const thumbnail = await createImageDataUrlThumbnail(image, size)
    if (thumbnail) thumbnails[size] = thumbnail
  }
  return thumbnails
}

async function createImageDataUrlThumbnail(
  image: HTMLImageElement,
  maxSize: ThumbnailSize
): Promise<TangentAssetThumbnailInput | null> {
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight, 1)
  const scale = Math.min(1, maxSize / longestEdge)
  if (scale >= 0.92) return null

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) return null

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'medium'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return {
    dataUrl: canvas.toDataURL('image/webp', 0.76),
    height: canvas.height,
    width: canvas.width,
  }
}

function decodeImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.decoding = 'async'
    image.onerror = () => reject(new Error('Failed to decode image.'))
    image.onload = () => resolve(image)
    image.src = src
  })
}
