'use client'

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')

export function hasRemotePersistenceApi() {
  return apiBaseUrl.length > 0
}

export function persistenceApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${normalizedPath}`
}

export function persistenceAssetUrl(url: string | undefined) {
  if (!url || !apiBaseUrl || !url.startsWith('/api/v1/')) return url
  return `${apiBaseUrl}${url}`
}
