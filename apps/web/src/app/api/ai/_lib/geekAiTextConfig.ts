import { ProviderCredentialMissingError, getProviderApiKey, getProviderBaseUrl } from './providerApiConfig'

export class GeekAiCredentialMissingError extends ProviderCredentialMissingError {
  readonly status = 503

  constructor(message: string) {
    super(message)
    this.name = 'GeekAiCredentialMissingError'
  }
}

export function getGeekAiTextApiKey() {
  return getProviderApiKey('geekai', 'text')
}

export function getGeekAiTextBaseUrl() {
  return getProviderBaseUrl('geekai', 'text')
}
