'use client'

import { useEffect, useState } from 'react'
import type { AiCapability, AiModelOption } from './aiTypes'
import { canUseAiModelFallback, getAiModelFallback, loadAiModels } from './aiClient'

const modelCache = new Map<AiCapability, AiModelOption[]>()
const pendingModelLoads = new Map<AiCapability, Promise<AiModelOption[]>>()

export function useAiModels(capability: AiCapability = 'image_generation') {
  const [models, setModels] = useState(() => modelCache.get(capability) ?? getAllowedModelFallback(capability))

  useEffect(() => {
    let isMounted = true
    void loadCachedAiModels(capability)
      .then((nextModels) => {
        if (isMounted) setModels(nextModels)
      })
      .catch(() => {
        if (isMounted) setModels(modelCache.get(capability) ?? getAllowedModelFallback(capability))
      })
    return () => {
      isMounted = false
    }
  }, [capability])

  return models
}

function getAllowedModelFallback(capability: AiCapability) {
  return canUseAiModelFallback() ? getAiModelFallback(capability) : []
}

function loadCachedAiModels(capability: AiCapability) {
  const cached = modelCache.get(capability)
  if (cached) return Promise.resolve(cached)

  const pending = pendingModelLoads.get(capability)
  if (pending) return pending

  const request = loadAiModels(capability)
    .then((nextModels) => {
      modelCache.set(capability, nextModels)
      return nextModels
    })
    .finally(() => pendingModelLoads.delete(capability))
  pendingModelLoads.set(capability, request)
  return request
}
