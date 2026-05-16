const defaultProviderBaseUrls: Record<string, string> = {
  geekai: 'https://geekai.co/api/v1',
}

const nanoBananaModelId = 'nano-banana-2'

export class ProviderCredentialMissingError extends Error {
  readonly status = 503

  constructor(message: string) {
    super(message)
    this.name = 'ProviderCredentialMissingError'
  }
}

export function getProviderApiKey(provider: string, scope: 'image' | 'text' | 'video', modelId?: string) {
  const normalizedProvider = normalize(provider)
  const normalizedScope = scope.toUpperCase()
  const legacyNanoKey = normalizedProvider === 'geekai' && modelId === nanoBananaModelId
    ? process.env.GEEKAI_NANO_BANANA_API_KEY?.trim()
    : ''
  if (legacyNanoKey) return legacyNanoKey
  const value = firstDefined(
    process.env[`TANGENT_AI_PROVIDER_${normalizedProvider.toUpperCase()}_${normalizedScope}_API_KEY`]?.trim(),
    process.env[`TANGENT_AI_PROVIDER_${normalizedProvider.toUpperCase()}_${normalizedScope}_KEY`]?.trim(),
    process.env[`${normalizedProvider.toUpperCase()}_${normalizedScope}_API_KEY`]?.trim(),
    process.env[`${normalizedProvider.toUpperCase()}_${normalizedScope}_KEY`]?.trim(),
    process.env[`TANGENT_AI_PROVIDER_${normalizedProvider.toUpperCase()}_API_KEY`]?.trim(),
    process.env[`TANGENT_AI_PROVIDER_${normalizedProvider.toUpperCase()}_KEY`]?.trim(),
    process.env[`${normalizedProvider.toUpperCase()}_API_KEY`]?.trim(),
    process.env[`${normalizedProvider.toUpperCase()}_KEY`]?.trim(),
  )
  if (!value) {
    throw new ProviderCredentialMissingError(`Missing ${normalizedProvider.toUpperCase()} ${scope} API key.`)
  }
  return value
}

export function getProviderBaseUrl(provider: string, scope: 'image' | 'text' | 'video', modelId?: string) {
  const normalizedProvider = normalize(provider)
  const normalizedScope = scope.toUpperCase()
  const legacyNanoBaseUrl = normalizedProvider === 'geekai' && modelId === nanoBananaModelId
    ? process.env.GEEKAI_NANO_BANANA_BASE_URL?.trim()
    : ''
  return (
    legacyNanoBaseUrl
    || firstDefined(
      process.env[`TANGENT_AI_PROVIDER_${normalizedProvider.toUpperCase()}_${normalizedScope}_BASE_URL`]?.trim(),
      process.env[`${normalizedProvider.toUpperCase()}_${normalizedScope}_BASE_URL`]?.trim(),
      process.env[`TANGENT_AI_PROVIDER_${normalizedProvider.toUpperCase()}_BASE_URL`]?.trim(),
      process.env[`${normalizedProvider.toUpperCase()}_BASE_URL`]?.trim(),
    )
    || getDefaultProviderBaseUrl(normalizedProvider, scope)
  ).replace(/\/+$/, '')
}

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => Boolean(value))
}

function normalize(value: string) {
  return value.trim().toLowerCase() || 'geekai'
}

function getDefaultProviderBaseUrl(provider: string, scope: 'image' | 'text' | 'video') {
  if (provider === 'jiekou') {
    if (scope === 'text') return 'https://api.jiekou.ai/openai/v1'
    return 'https://api.jiekou.ai/v3'
  }
  return defaultProviderBaseUrls[provider] || defaultProviderBaseUrls.geekai
}
