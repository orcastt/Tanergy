const remoteApiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')

export class LocalRuntimeBridgeDisabledError extends Error {
  readonly status = 503

  constructor(message: string) {
    super(message)
    this.name = 'LocalRuntimeBridgeDisabledError'
  }
}

export function hasConfiguredRemoteApiBaseUrl() {
  return remoteApiBaseUrl.length > 0
}

export function canUseLocalAiBridge() {
  if (hasConfiguredRemoteApiBaseUrl()) return false
  return process.env.NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_AI_BRIDGE === '1' || process.env.NODE_ENV !== 'production'
}

export function canUseLocalAssetBridge() {
  if (hasConfiguredRemoteApiBaseUrl()) return false
  return process.env.NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_ASSET_BRIDGE === '1' || process.env.NODE_ENV !== 'production'
}

export function canUseLocalBoardBridge() {
  if (hasConfiguredRemoteApiBaseUrl()) return false
  return process.env.NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_BOARD_BRIDGE === '1' || process.env.NODE_ENV !== 'production'
}

export function assertAiRuntimeAvailable() {
  if (hasConfiguredRemoteApiBaseUrl() || canUseLocalAiBridge()) return
  throw new Error(
    'AI runtime requires NEXT_PUBLIC_API_BASE_URL. The local AI bridge is disabled unless explicitly enabled for local-only fallback.'
  )
}

export function assertLocalAiBridgeAvailable() {
  if (canUseLocalAiBridge()) return
  throw new LocalRuntimeBridgeDisabledError(
    hasConfiguredRemoteApiBaseUrl()
      ? 'Local AI bridge is disabled while NEXT_PUBLIC_API_BASE_URL is configured. Use the backend /api/v1/ai API.'
      : 'Local AI bridge is disabled. Configure NEXT_PUBLIC_API_BASE_URL or explicitly opt into the local-only fallback.'
  )
}

export function assertLocalAssetBridgeAvailable() {
  if (canUseLocalAssetBridge()) return
  throw new LocalRuntimeBridgeDisabledError(
    hasConfiguredRemoteApiBaseUrl()
      ? 'Local asset bridge is disabled while NEXT_PUBLIC_API_BASE_URL is configured. Use the backend /api/v1/assets API.'
      : 'Local asset bridge is disabled. Configure NEXT_PUBLIC_API_BASE_URL or explicitly opt into the local-only fallback.'
  )
}

export function assertLocalBoardBridgeAvailable() {
  if (canUseLocalBoardBridge()) return
  throw new LocalRuntimeBridgeDisabledError(
    hasConfiguredRemoteApiBaseUrl()
      ? 'Local board bridge is disabled while NEXT_PUBLIC_API_BASE_URL is configured. Use the backend /api/v1/boards API.'
      : 'Local board bridge is disabled. Configure NEXT_PUBLIC_API_BASE_URL or explicitly opt into the local-only fallback.'
  )
}
