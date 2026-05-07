'use client'

import { hasRemotePersistenceApi, persistenceApiUrl, persistenceAuthHeadersAsync } from '@/features/api/persistenceApi'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { normalizeAssetUrls } from './assetUploadClient'
import type { TangentAssetRecord, TangentAssetResponse } from './assetTypes'

export async function loadAssetRecord(assetId: string, workspace?: TangentWorkspace) {
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl(`/api/v1/assets/${encodeURIComponent(assetId)}`) : `/api/assets/${encodeURIComponent(assetId)}`,
    {
      headers: await persistenceAuthHeadersAsync(workspace),
    }
  )
  const payload = await response.json() as TangentAssetResponse
  if (!response.ok || !payload.asset) {
    throw new Error(payload.error || `Asset ${assetId} failed to load.`)
  }
  return normalizeAssetUrls(payload.asset)
}

export async function loadAssetRecords(assetIds: string[], workspace?: TangentWorkspace) {
  const orderedIds = assetIds.filter((assetId) => typeof assetId === 'string' && assetId.trim())
  if (orderedIds.length === 0) return [] satisfies TangentAssetRecord[]

  const uniqueIds = [...new Set(orderedIds)]
  const records = await Promise.all(uniqueIds.map((assetId) => loadAssetRecord(assetId, workspace)))
  const recordMap = new Map(records.map((asset) => [asset.id, asset]))

  return orderedIds.flatMap((assetId) => {
    const asset = recordMap.get(assetId)
    return asset ? [asset] : []
  })
}
