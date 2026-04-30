'use client'

import { createImageDataUrlThumbnails } from './assetClientThumbnails'
import type { TangentAssetDataUrlInput, TangentAssetRecord } from './assetTypes'

type AssetResponse = {
  asset?: TangentAssetRecord
  error?: string
}

export async function uploadImageDataUrlAsset(input: Omit<TangentAssetDataUrlInput, 'thumbnails'>) {
  const thumbnails = await createImageDataUrlThumbnails(input.dataUrl)
  const response = await fetch('/api/assets/from-data-url', {
    body: JSON.stringify({ ...input, thumbnails }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const payload = await response.json() as AssetResponse
  if (!response.ok || !payload.asset) {
    throw new Error(payload.error || 'Asset upload failed.')
  }
  return payload.asset
}
