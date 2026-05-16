const defaultProviderBaseUrls: Record<string, string> = {
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
  if (normalizedProvider === 'jiekou') return 'Jiekou AI'
  if (normalizedProvider === 'openai') return 'OpenAI'
  if (normalizedProvider === 'google') return 'Google AI'
  return 'AI provider'
}

export function getProviderTextApiMode(provider: string): ProviderTextApiMode {
  const normalizedProvider = normalizeProvider(provider)
  if (normalizedProvider === 'jiekou') return 'openai_compatible'
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
  if (provider === 'jiekou') {
    if (scope === 'text') return 'https://api.jiekou.ai/openai/v1'
    return 'https://api.jiekou.ai/v3'
  }
  return defaultProviderBaseUrls[provider]
}
