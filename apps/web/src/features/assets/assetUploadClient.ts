'use client'

import { createImageDataUrlThumbnails } from './assetClientThumbnails'
import type { TangentAssetDataUrlInput, TangentAssetResponse } from './assetTypes'
import { hasRemotePersistenceApi, persistenceApiUrl, persistenceAssetUrl, persistenceJsonHeaders } from '@/features/api/persistenceApi'

export async function uploadImageDataUrlAsset(input: Omit<TangentAssetDataUrlInput, 'thumbnails'>) {
  const thumbnails = await createImageDataUrlThumbnails(input.dataUrl)
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/assets/from-data-url') : '/api/assets/from-data-url',
    {
      body: JSON.stringify({ ...input, thumbnails }),
      headers: persistenceJsonHeaders(),
      method: 'POST',
    }
  )
  const payload = await response.json() as TangentAssetResponse
  if (!response.ok || !payload.asset) {
    throw new Error(payload.error || 'Asset upload failed.')
  }
  return {
    ...payload.asset,
    originalUrl: persistenceAssetUrl(payload.asset.originalUrl) ?? payload.asset.originalUrl,
    thumbnail1024Url: persistenceAssetUrl(payload.asset.thumbnail1024Url),
    thumbnail256Url: persistenceAssetUrl(payload.asset.thumbnail256Url),
    thumbnail512Url: persistenceAssetUrl(payload.asset.thumbnail512Url),
  }
}
