'use client'

import { createImageDataUrlThumbnails } from './assetClientThumbnails'
import type { TangentAssetDataUrlInput, TangentAssetOrigin, TangentAssetRecord, TangentAssetResponse } from './assetTypes'
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
  return normalizeAssetUrls(payload.asset)
}

export async function importRemoteImageAsset(input: {
  origin?: TangentAssetOrigin
  title?: string
  url: string
}) {
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/assets/from-url') : '/api/assets/from-url',
    {
      body: JSON.stringify({ origin: input.origin ?? 'remote_import', title: input.title ?? 'Image', url: input.url }),
      headers: persistenceJsonHeaders(),
      method: 'POST',
    }
  )
  const payload = await response.json() as TangentAssetResponse
  if (!response.ok || !payload.asset) {
    throw new Error(payload.error || 'Remote image import failed.')
  }
  return normalizeAssetUrls(payload.asset)
}

export function normalizeAssetUrls(asset: TangentAssetRecord): TangentAssetRecord {
  return {
    ...asset,
    originalUrl: persistenceAssetUrl(asset.originalUrl) ?? asset.originalUrl,
    thumbnail1024Url: persistenceAssetUrl(asset.thumbnail1024Url),
    thumbnail256Url: persistenceAssetUrl(asset.thumbnail256Url),
    thumbnail512Url: persistenceAssetUrl(asset.thumbnail512Url),
  }
}
