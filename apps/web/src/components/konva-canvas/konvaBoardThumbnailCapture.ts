import type Konva from 'konva'
import { uploadImageBlobAsset } from '@/features/assets/assetUploadClient'
import type { CanvasDocument } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { captureKonvaSelectionPng, getKonvaSelectionExportBounds } from './konvaSelectionExport'

const thumbnailMaxEdge = 1024

export async function captureKonvaBoardThumbnailUrl(
  stage: Konva.Stage,
  document: CanvasDocument,
  boardTitle: string,
  workspace?: TangentWorkspace,
) {
  const selectedIds = document.shapes.map((shape) => shape.id)
  const bounds = getKonvaSelectionExportBounds(document, selectedIds, 32)
  if (selectedIds.length === 0 || !bounds) return null

  const capture = await captureKonvaSelectionPng({
    document,
    options: {
      maxPixelEdge: thumbnailMaxEdge,
      padding: 32,
      pixelRatio: getThumbnailPixelRatio(bounds),
    },
    selectedIds,
    stage,
  })
  const asset = await uploadImageBlobAsset({
    blob: capture.blob,
    fileName: `${toFileStem(boardTitle)}-konva-thumbnail.png`,
    height: capture.height,
    origin: 'board_thumbnail',
    title: `${boardTitle.trim() || 'Untitled board'} thumbnail`,
    width: capture.width,
  }, workspace)
  return asset.thumbnail512Url ?? asset.thumbnail256Url ?? asset.originalUrl
}

function getThumbnailPixelRatio(bounds: { maxX: number; maxY: number; minX: number; minY: number }) {
  const longestEdge = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
  return Math.min(1, thumbnailMaxEdge / longestEdge)
}

function toFileStem(value: string) {
  const stem = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return stem.slice(0, 48) || 'board'
}
