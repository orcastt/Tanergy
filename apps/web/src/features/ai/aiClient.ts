'use client'

import {
  hasRemotePersistenceApi,
  persistenceApiUrl,
  persistenceAuthHeaders,
  persistenceJsonHeaders,
} from '@/features/api/persistenceApi'
import type { AiCapability, AiModelsResponse, AiRunRequest, AiRunResponse } from './aiTypes'
import { getAiModels } from './mockAiContracts'

export async function loadAiModels(capability: AiCapability = 'image_generation') {
  const response = await fetch(getAiUrl(`/models?capability=${encodeURIComponent(capability)}`), {
    headers: persistenceAuthHeaders(),
  })
  const payload = await response.json() as AiModelsResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'AI model registry failed.')
  }
  return payload.models
}

export async function createAiRun(input: AiRunRequest) {
  const response = await fetch(getAiUrl('/runs'), {
    body: JSON.stringify(input),
    headers: persistenceJsonHeaders(),
    method: 'POST',
  })
  const payload = await response.json() as AiRunResponse
  if (!response.ok || !payload.ok || !payload.run) {
    throw new Error(payload.error || 'AI run failed.')
  }
  return payload.run
}

export function getAiModelFallback(capability: AiCapability = 'image_generation') {
  return getAiModels(capability)
}

function getAiUrl(path: string) {
  return hasRemotePersistenceApi() ? persistenceApiUrl(`/api/v1/ai${path}`) : `/api/ai${path}`
}
