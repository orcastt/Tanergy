'use client'

import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeaders,
  persistenceAuthHeadersAsync,
  persistenceJsonHeaders,
  persistenceJsonHeadersAsync,
} from '@/features/api/persistenceApi'
import { assertAiRuntimeAvailable, canUseLocalAiBridge } from '@/features/api/runtimeBridgePolicy'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { AiCapability, AiModelsResponse, AiRunRequest, AiRunResponse } from './aiTypes'
import { AiApiError, extractAiApiErrorMessage } from './aiRunErrors'
import { getAiModels } from './mockAiContracts'

export async function loadAiModels(capability: AiCapability = 'image_generation') {
  assertAiRuntimeAvailable()
  const headers = hasRemotePersistenceApi() ? await persistenceAuthHeadersAsync() : persistenceAuthHeaders()
  const response = await fetch(getAiUrl(`/models?capability=${encodeURIComponent(capability)}`), {
    headers,
  })
  const payload = await readAiJson<AiModelsResponse>(response)
  if (!response.ok || !payload.ok) {
    throw new AiApiError(extractAiApiErrorMessage(payload, 'AI model registry failed.'), response.status)
  }
  return payload.models
}

export async function createAiRun(input: AiRunRequest, options?: { signal?: AbortSignal; workspace?: TangentWorkspace }) {
  assertAiRuntimeAvailable()
  const headers = hasRemotePersistenceApi()
    ? await persistenceJsonHeadersAsync(options?.workspace)
    : persistenceJsonHeaders(options?.workspace)
  const response = await fetch(getAiUrl('/runs'), {
    body: JSON.stringify(input),
    headers,
    method: 'POST',
    signal: options?.signal,
  })
  const payload = await readAiJson<AiRunResponse>(response)
  if (!response.ok || !payload.ok || !payload.run) {
    throw new AiApiError(extractAiApiErrorMessage(payload, 'AI run failed.'), response.status)
  }
  return payload.run
}

export async function getAiRun(runId: string, options?: { signal?: AbortSignal; workspace?: TangentWorkspace }) {
  assertAiRuntimeAvailable()
  const headers = hasRemotePersistenceApi()
    ? await persistenceAuthHeadersAsync(options?.workspace)
    : persistenceAuthHeaders(options?.workspace)
  const response = await fetch(getAiUrl(`/runs/${encodeURIComponent(runId)}`), {
    headers,
    signal: options?.signal,
  })
  const payload = await readAiJson<AiRunResponse>(response)
  if (!response.ok || !payload.ok || !payload.run) {
    throw new AiApiError(extractAiApiErrorMessage(payload, 'AI run lookup failed.'), response.status)
  }
  return payload.run
}

export async function cancelAiRun(runId: string, options?: { signal?: AbortSignal; workspace?: TangentWorkspace }) {
  assertAiRuntimeAvailable()
  if (!hasRemotePersistenceApi()) return null
  const headers = await persistenceJsonHeadersAsync(options?.workspace)
  const response = await fetch(getAiUrl(`/runs/${encodeURIComponent(runId)}/cancel`), {
    headers,
    method: 'POST',
    signal: options?.signal,
  })
  const payload = await readAiJson<AiRunResponse>(response)
  if (!response.ok || !payload.ok || !payload.run) {
    throw new AiApiError(extractAiApiErrorMessage(payload, 'AI run cancel failed.'), response.status)
  }
  return payload.run
}

export function getAiModelFallback(capability: AiCapability = 'image_generation') {
  return getAiModels(capability)
}

export function canUseAiModelFallback() {
  return canUseLocalAiBridge()
}

function getAiUrl(path: string) {
  return hasRemotePersistenceApi() ? persistenceApiUrl(`/api/v1/ai${path}`) : `/api/ai${path}`
}

async function readAiJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T
  } catch {
    return {} as T
  }
}
