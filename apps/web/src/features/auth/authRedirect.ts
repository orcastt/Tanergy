'use client'

type RedirectSearchParams = {
  get: (name: string) => null | string
}

export function resolveAuthRedirectPath(
  searchParams: RedirectSearchParams,
  fallback = '/workspaces',
) {
  const candidate = searchParams.get('redirect_url')
    ?? searchParams.get('redirectUrl')
    ?? searchParams.get('next')
  return sanitizeRelativeRedirectPath(candidate, fallback)
}

export function sanitizeRelativeRedirectPath(
  candidate: null | string | undefined,
  fallback = '/workspaces',
) {
  const trimmed = candidate?.trim() ?? ''
  if (!trimmed) return fallback
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback
  try {
    const resolved = new URL(trimmed, 'http://tanergy.local')
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return fallback
  }
}
