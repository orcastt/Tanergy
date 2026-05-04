'use client'

import { hasRemotePersistenceApi, persistenceApiUrl, persistenceAuthHeaders } from '@/features/api/persistenceApi'
import { normalizeAssetUrls } from './assetUploadClient'
import type { TangentAssetResponse } from './assetTypes'

export async function removeBackgroundAsset(assetId: string) {
  return runImageOp('/remove-background', assetId, 'Remove background failed.')
}

async function runImageOp(path: string, assetId: string, fallbackError: string) {
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl(`/api/v1/image-ops${path}`) : `/api/image-ops${path}`,
    {
      body: JSON.stringify({ assetId }),
      headers: {
        'Content-Type': 'application/json',
        ...persistenceAuthHeaders(),
      },
      method: 'POST',
    }
  )
  const payload = await response.json() as TangentAssetResponse
  if (!response.ok || !payload.asset) throw new Error(payload.error || fallbackError)
  return normalizeAssetUrls(payload.asset)
}
