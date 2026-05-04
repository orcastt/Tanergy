'use client'

import type { Editor } from 'tldraw'
import { uploadImageDataUrlAsset } from '@/features/assets/assetUploadClient'

const thumbnailMaxEdge = 1024

export async function captureBoardThumbnailUrl(editor: Editor, boardTitle: string) {
  const shapeIds = editor.getCurrentPageShapesSorted().map((shape) => shape.id)
  const bounds = editor.getCurrentPageBounds()
  if (shapeIds.length === 0 || !bounds) return null

  const result = await editor.toImageDataUrl(shapeIds, {
    background: true,
    bounds,
    format: 'webp',
    padding: 32,
    pixelRatio: getThumbnailPixelRatio(bounds),
    quality: 0.78,
  })
  const asset = await uploadImageDataUrlAsset({
    dataUrl: result.url,
    fileName: `${toFileStem(boardTitle)}-thumbnail.webp`,
    height: result.height,
    origin: 'board_thumbnail',
    title: `${boardTitle.trim() || 'Untitled board'} thumbnail`,
    width: result.width,
  })
  return asset.thumbnail512Url ?? asset.thumbnail256Url ?? asset.originalUrl
}

function getThumbnailPixelRatio(bounds: { height: number; width: number }) {
  const longestEdge = Math.max(bounds.width, bounds.height, 1)
  return Math.min(1, thumbnailMaxEdge / longestEdge)
}

function toFileStem(value: string) {
  const stem = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return stem.slice(0, 48) || 'board'
}
