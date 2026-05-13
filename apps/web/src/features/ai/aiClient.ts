'use client'

import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeaders,
  persistenceAuthHeadersAsync,
  persistenceJsonHeaders,
  persistenceJsonHeadersAsync,
} from '@/features/api/persistenceApi'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { AiCapability, AiModelsResponse, AiRunRequest, AiRunResponse } from './aiTypes'
import { getAiModels } from './mockAiContracts'

export async function loadAiModels(capability: AiCapability = 'image_generation') {
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync() : persistenceAuthHeaders()
  const response = await fetch(getAiUrl(`/models?capability=${encodeURIComponent(capability)}`), {
    headers,
  })
  const payload = await response.json() as AiModelsResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'AI model registry failed.')
  }
  return payload.models
}

export async function createAiRun(input: AiRunRequest, options?: { signal?: AbortSignal; workspace?: TangentWorkspace }) {
  const headers = hasRemotePersistenceApi()
    ? await persistenceJsonHeadersAsync(options?.workspace)
    : persistenceJsonHeaders(options?.workspace)
  const response = await fetch(getAiUrl('/runs'), {
    body: JSON.stringify(input),
    headers,
    method: 'POST',
    signal: options?.signal,
  })
  const payload = await response.json() as AiRunResponse
  if (!response.ok || !payload.ok || !payload.run) {
    throw new Error(payload.error || 'AI run failed.')
  }
  return payload.run
}

export async function getAiRun(runId: string, options?: { signal?: AbortSignal; workspace?: TangentWorkspace }) {
  const headers = hasRemotePersistenceApi()
    ? await persistenceAuthHeadersAsync(options?.workspace)
    : persistenceAuthHeaders(options?.workspace)
  const response = await fetch(getAiUrl(`/runs/${encodeURIComponent(runId)}`), {
    headers,
    signal: options?.signal,
  })
  const payload = await response.json() as AiRunResponse
  if (!response.ok || !payload.ok || !payload.run) {
    throw new Error(payload.error || 'AI run lookup failed.')
  }
  return payload.run
}

export async function cancelAiRun(runId: string, options?: { signal?: AbortSignal; workspace?: TangentWorkspace }) {
  if (!hasRemotePersistenceApi()) return null
  const headers = await persistenceJsonHeadersAsync(options?.workspace)
  const response = await fetch(getAiUrl(`/runs/${encodeURIComponent(runId)}/cancel`), {
    headers,
    method: 'POST',
    signal: options?.signal,
  })
  const payload = await response.json() as AiRunResponse
  if (!response.ok || !payload.ok || !payload.run) {
    throw new Error(payload.error || 'AI run cancel failed.')
  }
  return payload.run
}

export function getAiModelFallback(capability: AiCapability = 'image_generation') {
  return getAiModels(capability)
}

export function canUseAiModelFallback() {
  return process.env.NODE_ENV !== 'production' && !hasRemotePersistenceApi()
}

function getAiUrl(path: string) {
  return hasRemotePersistenceApi() ? persistenceApiUrl(`/api/v1/ai${path}`) : `/api/ai${path}`
}
