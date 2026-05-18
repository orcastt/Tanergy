import { normalizeAiInlineBase64DataUrl, readJsonResponseWithLimit } from './aiInlineImageGuards'
import { getProviderApiKey, getProviderBaseUrl } from './providerApiConfig'
import {
  defaultGeneratedMime,
  pollIntervalMs,
  pollTimeoutMs,
  type ProviderClientConfig,
  type ProviderImageResponse,
} from './localProviderImageRunSupport'

export function getProviderClientConfig(provider: string): ProviderClientConfig {
  return {
    apiKey: getProviderApiKey(provider, 'image'),
    baseUrl: getProviderBaseUrl(provider, 'image'),
    provider,
  }
}

export async function postProviderJson<T extends { error?: { message?: string }; message?: string }>(
  path: string,
  body: Record<string, unknown>,
  clientConfig: ProviderClientConfig,
) {
  const response = await fetch(`${clientConfig.baseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${clientConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const payload = await readJsonResponseWithLimit<T>(response)
  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? 'AI provider request failed.')
  }
  return payload
}

export async function getProviderJson<T extends { error?: { message?: string }; message?: string }>(
  path: string,
  clientConfig: ProviderClientConfig,
) {
  const response = await fetch(`${clientConfig.baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${clientConfig.apiKey}`,
    },
  })
  const payload = await readJsonResponseWithLimit<T>(response)
  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? 'AI provider request failed.')
  }
  return payload
}

export async function settleImageTask(payload: ProviderImageResponse, clientConfig: ProviderClientConfig) {
  if (payload.task_status === 'succeed') return payload
  if (payload.task_status === 'failed') {
    throw new Error(payload.error?.message ?? payload.message ?? 'Image generation failed.')
  }
  if (!payload.task_id) return payload

  const startedAt = Date.now()
  while (Date.now() - startedAt < pollTimeoutMs) {
    await wait(pollIntervalMs)
    const next = await getProviderJson<ProviderImageResponse>(`/images/${encodeURIComponent(payload.task_id)}`, clientConfig)
    if (next.task_status === 'succeed') return next
    if (next.task_status === 'failed') {
      throw new Error(next.error?.message ?? next.message ?? 'Image generation failed.')
    }
  }
  throw new Error('Image generation timed out.')
}

export function extractImageSources(payload: ProviderImageResponse) {
  const items = payload.image_urls ?? payload.images ?? payload.data ?? []
  return items.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) {
      if (item.startsWith('data:')) return [item.trim()]
      if (item.startsWith('http://') || item.startsWith('https://')) return [item.trim()]
      return [normalizeAiInlineBase64DataUrl(item.trim(), defaultGeneratedMime)]
    }
    if (!item || typeof item !== 'object') return []
    if (typeof item.url === 'string' && item.url.trim()) return [item.url.trim()]
    if (typeof item.image_url === 'string' && item.image_url.trim()) return [item.image_url.trim()]
    const b64Image = item.b64_json ?? item.base64 ?? item.image_base64
    if (typeof b64Image === 'string' && b64Image.trim()) {
      return [normalizeAiInlineBase64DataUrl(b64Image, defaultGeneratedMime)]
    }
    return []
  })
}

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}
