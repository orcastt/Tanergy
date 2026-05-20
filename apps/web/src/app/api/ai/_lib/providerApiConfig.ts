const defaultProviderBaseUrls: Record<string, string> = {
  geekai: 'https://geekai.co/api/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  jiekou: 'https://api.jiekou.ai/v3',
  openai: 'https://api.openai.com/v1',
}

export type ProviderTextApiMode = 'chat_completions' | 'openai_compatible' | 'responses'

export class ProviderCredentialMissingError extends Error {
  readonly status = 503

  constructor(message: string) {
    super(message)
    this.name = 'ProviderCredentialMissingError'
  }
}

export function getProviderApiKey(provider: string, scope: 'image' | 'text' | 'video') {
  const normalizedProvider = normalizeProvider(provider)
  const normalizedScope = scope.toUpperCase()
  const value = firstDefined(
    ...getProviderKeyAliases(normalizedProvider, scope),
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

export function getProviderBaseUrl(provider: string, scope: 'image' | 'text' | 'video') {
  const normalizedProvider = normalizeProvider(provider)
  const normalizedScope = scope.toUpperCase()
  const resolved = (
    firstDefined(
      ...getProviderBaseUrlAliases(normalizedProvider, scope),
      process.env[`TANGENT_AI_PROVIDER_${normalizedProvider.toUpperCase()}_${normalizedScope}_BASE_URL`]?.trim(),
      process.env[`${normalizedProvider.toUpperCase()}_${normalizedScope}_BASE_URL`]?.trim(),
      process.env[`TANGENT_AI_PROVIDER_${normalizedProvider.toUpperCase()}_BASE_URL`]?.trim(),
      process.env[`${normalizedProvider.toUpperCase()}_BASE_URL`]?.trim(),
    )
    || getDefaultProviderBaseUrl(normalizedProvider, scope)
  )
  if (!resolved) {
    throw new ProviderCredentialMissingError(`Missing ${normalizedProvider.toUpperCase()} ${scope} base URL.`)
  }
  return resolved.replace(/\/+$/, '')
}

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => Boolean(value))
}

export function getProviderDisplayLabel(provider: string) {
  const normalizedProvider = normalizeProvider(provider)
  if (normalizedProvider === 'geekai') return 'GeekAI'
  if (normalizedProvider === 'jiekou') return 'Jiekou AI'
  if (normalizedProvider === 'openai') return 'OpenAI'
  if (normalizedProvider === 'google') return 'Google AI'
  return 'AI provider'
}

export function getProviderTextApiMode(provider: string): ProviderTextApiMode {
  const normalizedProvider = normalizeProvider(provider)
  if (normalizedProvider === 'geekai' || normalizedProvider === 'jiekou') return 'openai_compatible'
  if (normalizedProvider === 'google') return 'chat_completions'
  return 'responses'
}

export function normalizeProvider(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    throw new ProviderCredentialMissingError('Missing AI provider key.')
  }
  return normalized
}

function getDefaultProviderBaseUrl(provider: string, scope: 'image' | 'text' | 'video') {
  if (provider === 'geekai') return 'https://geekai.co/api/v1'
  if (provider === 'jiekou') {
    if (scope === 'text') return 'https://api.jiekou.ai/openai/v1'
    return 'https://api.jiekou.ai/v3'
  }
  return defaultProviderBaseUrls[provider]
}

function getProviderKeyAliases(provider: string, scope: 'image' | 'text' | 'video') {
  if (provider !== 'geekai') return []
  if (scope === 'image') {
    return [
      process.env.GEEKAI_BALANCE_IMAGE_API_KEY?.trim(),
      process.env.GEEKAI_IMAGE_API_KEY?.trim(),
      process.env.GEEKAI_OFFICIAL_IMAGE_API_KEY?.trim(),
      // Legacy typo alias kept so older server envs survive one rollout.
      process.env.GEEKAI_OFFCIAL_IMAGE_API_KEY?.trim(),
    ]
  }
  if (scope === 'text') return [process.env.GEEKAI_TEXT_API_KEY?.trim()]
  if (scope === 'video') return [process.env.GEEKAI_VIDEO_API_KEY?.trim()]
  return []
}

function getProviderBaseUrlAliases(provider: string, scope: 'image' | 'text' | 'video') {
  if (provider !== 'geekai') return []
  if (scope === 'image') {
    return [
      process.env.GEEKAI_BALANCE_IMAGE_API_KEY_BASE_URL?.trim(),
      process.env.GEEKAI_IMAGE_BASE_URL?.trim(),
      process.env.GEEKAI_OFFICIAL_IMAGE_API_KEY_BASE_URL?.trim(),
      // Legacy typo alias kept so older server envs survive one rollout.
      process.env.GEEKAI_OFFCIAL_IMAGE_API_KEY_BASE_URL?.trim(),
    ]
  }
  if (scope === 'text') return [process.env.GEEKAI_TEXT_BASE_URL?.trim()]
  if (scope === 'video') return [process.env.GEEKAI_VIDEO_BASE_URL?.trim()]
  return []
}
