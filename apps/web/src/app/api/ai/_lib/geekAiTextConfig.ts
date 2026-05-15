const defaultGeekAiBaseUrl = 'https://geekai.co/api/v1'

export class GeekAiCredentialMissingError extends Error {
  readonly status = 503

  constructor(message: string) {
    super(message)
    this.name = 'GeekAiCredentialMissingError'
  }
}

export function getGeekAiTextApiKey() {
  const value = process.env.GEEKAI_TEXT_API_KEY?.trim() || process.env.GEEKAI_API_KEY?.trim()
  if (!value) throw new GeekAiCredentialMissingError('Missing GEEKAI_TEXT_API_KEY or GEEKAI_API_KEY.')
  return value
}

export function getGeekAiTextBaseUrl() {
  return (process.env.GEEKAI_TEXT_BASE_URL || process.env.GEEKAI_BASE_URL || defaultGeekAiBaseUrl).replace(/\/+$/, '')
}
