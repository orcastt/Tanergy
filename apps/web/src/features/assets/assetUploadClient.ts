'use client'

import { createImageDataUrlThumbnails } from './assetClientThumbnails'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { TangentAssetDataUrlInput, TangentAssetOrigin, TangentAssetRecord, TangentAssetResponse } from './assetTypes'
import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeadersAsync,
  persistenceAssetProxyUrl,
  persistenceJsonHeadersAsync,
} from '@/features/api/persistenceApi'
import { assertLocalAssetBridgeAvailable } from '@/features/api/runtimeBridgePolicy'
import { validateImageFile } from './imageAssetInputs'
import { createImageFileFromDataUrlValue, parseImageDataUrl } from './imageDataUrl'

const maxDataUrlFallbackUploadBytes = 4 * 1024 * 1024

export async function uploadImageDataUrlAsset(
  input: Omit<TangentAssetDataUrlInput, 'thumbnails'>,
  workspace?: TangentWorkspace
) {
  const selectedWorkspace = requireRemoteWorkspaceSelection(workspace)
  if (estimateDataUrlByteLength(input.dataUrl) > maxDataUrlFallbackUploadBytes) {
    return uploadImageDataUrlFileAsset(input, selectedWorkspace)
  }
  if (!hasRemotePersistenceApi()) assertLocalAssetBridgeAvailable()
  const thumbnails = await createImageDataUrlThumbnails(input.dataUrl)
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/assets/from-data-url') : '/api/assets/from-data-url',
    {
      body: JSON.stringify({ ...input, thumbnails }),
      headers: await persistenceJsonHeadersAsync(selectedWorkspace),
      method: 'POST',
    }
  )
  const payload = await response.json() as TangentAssetResponse
  if (!response.ok || !payload.asset) {
    throw new Error(payload.error || 'Asset upload failed.')
  }
  return normalizeAssetUrls(payload.asset)
}

export async function uploadImageDataUrlFileAsset(
  input: Omit<TangentAssetDataUrlInput, 'thumbnails'>,
  workspace?: TangentWorkspace
) {
  const file = createImageFileFromDataUrlValue(input.dataUrl, input.fileName)
  return uploadImageFileAsset({
    file,
    height: input.height,
    origin: input.origin,
    title: input.title,
    width: input.width,
  }, workspace)
}

export async function uploadImageBlobAsset(input: {
  blob: Blob
  fileName?: string
  height: number
  origin?: TangentAssetOrigin
  title?: string
  width: number
}, workspace?: TangentWorkspace) {
  const file = new File([input.blob], ensureImageFileName(input.fileName, input.blob.type || 'image/png'), {
    type: input.blob.type || 'image/png',
  })
  validateImageFile(file)
  return uploadImageFileAsset({
    file,
    height: input.height,
    origin: input.origin,
    title: input.title,
    width: input.width,
  }, workspace)
}

export async function importRemoteImageAsset(input: {
  origin?: TangentAssetOrigin
  title?: string
  url: string
}, workspace?: TangentWorkspace) {
  const selectedWorkspace = requireRemoteWorkspaceSelection(workspace)
  if (!hasRemotePersistenceApi()) assertLocalAssetBridgeAvailable()
  const response = await fetch(
    hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/assets/from-url') : '/api/assets/from-url',
    {
      body: JSON.stringify({ origin: input.origin ?? 'remote_import', title: input.title ?? 'Image', url: input.url }),
      headers: await persistenceJsonHeadersAsync(selectedWorkspace),
      method: 'POST',
    }
  )
  const payload = await response.json() as TangentAssetResponse
  if (!response.ok || !payload.asset) {
    throw new Error(payload.error || 'Remote image import failed.')
  }
  return normalizeAssetUrls(payload.asset)
}

export async function uploadImageFileAsset(input: {
  file: File
  height: number
  onProgress?: (progress: number) => void
  origin?: TangentAssetOrigin
  title?: string
  width: number
}, workspace?: TangentWorkspace) {
  const selectedWorkspace = requireRemoteWorkspaceSelection(workspace)
  if (!hasRemotePersistenceApi()) assertLocalAssetBridgeAvailable()
  const form = new FormData()
  form.set('file', input.file)
  form.set('height', String(input.height))
  form.set('origin', input.origin ?? 'upload')
  form.set('title', input.title ?? input.file.name ?? 'Image')
  form.set('width', String(input.width))

  const url = hasRemotePersistenceApi() ? persistenceApiUrl('/api/v1/assets/upload') : '/api/assets/upload'
  const headers = await persistenceAuthHeadersAsync(selectedWorkspace)
  const uploadResponse = input.onProgress
    ? await uploadImageAssetWithProgress({
        body: form,
        headers,
        onProgress: input.onProgress,
        url,
      })
    : await fetch(url, {
        body: form,
        headers,
        method: 'POST',
      }).then(async (response) => ({
        ok: response.ok,
        payload: await response.json() as TangentAssetResponse,
      }))
  if (!uploadResponse.ok || !uploadResponse.payload.asset) {
    const payload = uploadResponse.payload
    throw new Error(payload.error || 'Asset upload failed.')
  }
  return normalizeAssetUrls(uploadResponse.payload.asset)
}

export async function createImageFileFromDataUrl(dataUrl: string, fileName?: string) {
  const file = createImageFileFromDataUrlValue(dataUrl, fileName)
  validateImageFile(file)
  return file
}

export function normalizeAssetUrls(asset: TangentAssetRecord): TangentAssetRecord {
  return {
    ...asset,
    originalUrl: persistenceAssetProxyUrl(asset.originalUrl, asset.workspaceId) ?? asset.originalUrl,
    thumbnail1024Url: persistenceAssetProxyUrl(asset.thumbnail1024Url, asset.workspaceId),
    thumbnail256Url: persistenceAssetProxyUrl(asset.thumbnail256Url, asset.workspaceId),
    thumbnail512Url: persistenceAssetProxyUrl(asset.thumbnail512Url, asset.workspaceId),
  }
}

function ensureImageFileName(fileName: string | undefined, mime: string) {
  const trimmed = fileName?.trim()
  if (trimmed) return trimmed
  return `image.${mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'}`
}

function estimateDataUrlByteLength(dataUrl: string) {
  return parseImageDataUrl(dataUrl).byteLength
}

function requireRemoteWorkspaceSelection(workspace?: TangentWorkspace) {
  if (hasRemotePersistenceApi() && !workspace) {
    throw new Error('Workspace context is required for remote asset uploads.')
  }
  return workspace
}

async function uploadImageAssetWithProgress(input: {
  body: FormData
  headers: HeadersInit
  onProgress: (progress: number) => void
  url: string
}) {
  return new Promise<{ ok: boolean; payload: TangentAssetResponse }>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', input.url)
    applyXhrHeaders(request, input.headers)
    request.responseType = 'text'
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return
      input.onProgress(event.loaded / event.total)
    }
    request.onerror = () => reject(new Error('Asset upload failed.'))
    request.onload = () => {
      try {
        const payload = JSON.parse(request.responseText || '{}') as TangentAssetResponse
        resolve({
          ok: request.status >= 200 && request.status < 300,
          payload,
        })
      } catch {
        reject(new Error('Asset upload failed.'))
      }
    }
    request.send(input.body)
  })
}

function applyXhrHeaders(request: XMLHttpRequest, headers: HeadersInit) {
  new Headers(headers).forEach((value, key) => {
    request.setRequestHeader(key, value)
  })
}
