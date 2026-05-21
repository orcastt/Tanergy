'use client'

import { hasRemotePersistenceApi, persistenceApiUrl, persistenceAuthHeaders, persistenceJsonHeadersAsync } from '@/features/api/persistenceApi'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { normalizeAssetUrls } from './assetUploadClient'
import type { TangentAssetResponse } from './assetTypes'

export async function removeBackgroundAsset(assetId: string, workspace?: TangentWorkspace) {
  return runImageOp('/remove-background', assetId, 'Remove background failed.', workspace)
}

async function runImageOp(path: string, assetId: string, fallbackError: string, workspace?: TangentWorkspace) {
  const headers = hasRemotePersistenceApi()
    ? await persistenceJsonHeadersAsync(workspace)
    : {
        'Content-Type': 'application/json',
        ...persistenceAuthHeaders(workspace),
      }
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl(`/api/v1/image-ops${path}`) : `/api/image-ops${path}`,
    {
      body: JSON.stringify({ assetId }),
      headers,
      method: 'POST',
    }
  )
  const payload = await response.json() as ImageOpResponsePayload
  if (!response.ok || !payload.asset) throw new Error(getImageOpErrorMessage(payload, fallbackError))
  return normalizeAssetUrls(payload.asset)
}

type ImageOpResponsePayload = TangentAssetResponse & {
  detail?: string | { msg?: string } | Array<{ msg?: string }>
}

function getImageOpErrorMessage(payload: ImageOpResponsePayload, fallbackError: string) {
  if (payload.error?.trim()) return payload.error.trim()
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim()
  if (Array.isArray(payload.detail)) {
    const firstMessage = payload.detail.find((item) => item.msg?.trim())?.msg?.trim()
    if (firstMessage) return firstMessage
  }
  if (payload.detail && typeof payload.detail === 'object' && !Array.isArray(payload.detail)) {
    const message = payload.detail.msg?.trim()
    if (message) return message
  }
  return fallbackError
}
