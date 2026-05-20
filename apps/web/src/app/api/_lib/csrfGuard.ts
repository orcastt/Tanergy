import { NextResponse } from 'next/server'

const unsafeMethods = new Set(['DELETE', 'PATCH', 'POST', 'PUT'])

export function rejectCrossSiteMutation(request: Request): NextResponse | null {
  if (!unsafeMethods.has(request.method.toUpperCase())) return null
  if (isCrossSiteFetch(request)) return forbiddenResponse()

  const origin = getHeaderOrigin(request.headers.get('origin'))
  if (origin) return isAllowedOrigin(request, origin) ? null : forbiddenResponse()

  const referer = getHeaderOrigin(request.headers.get('referer'))
  if (referer) return isAllowedOrigin(request, referer) ? null : forbiddenResponse()

  return shouldRequireBrowserOrigin(request) ? forbiddenResponse() : null
}

function shouldRequireBrowserOrigin(request: Request) {
  const cookie = request.headers.get('cookie')
  if (cookie) return true
  const authorization = request.headers.get('authorization') ?? ''
  return !authorization.trim().toLowerCase().startsWith('bearer ')
}

function isCrossSiteFetch(request: Request) {
  return request.headers.get('sec-fetch-site')?.trim().toLowerCase() === 'cross-site'
}

function isAllowedOrigin(request: Request, origin: string) {
  return getAllowedOrigins(request).has(origin)
}

function getAllowedOrigins(request: Request) {
  const origins = new Set<string>()
  const requestOrigin = getRequestOrigin(request)
  if (requestOrigin) origins.add(requestOrigin)
  addOrigin(origins, process.env.NEXT_PUBLIC_APP_URL)
  addOrigin(origins, process.env.NEXT_PUBLIC_SITE_URL)
  addOrigin(origins, process.env.NEXT_PUBLIC_WEB_URL)
  addVercelOrigin(origins, process.env.VERCEL_URL)
  for (const origin of (process.env.TANGENT_ALLOWED_ORIGINS ?? '').split(',')) {
    addOrigin(origins, origin)
  }
  return origins
}

function addVercelOrigin(origins: Set<string>, value: null | string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return
  addOrigin(origins, trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
}

function addOrigin(origins: Set<string>, value: null | string | undefined) {
  const origin = getHeaderOrigin(value)
  if (origin) origins.add(origin)
}

function getRequestOrigin(request: Request) {
  try {
    return new URL(request.url).origin
  } catch {
    return null
  }
}

function getHeaderOrigin(value: null | string | undefined) {
  if (!value?.trim()) return null
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

function forbiddenResponse() {
  return NextResponse.json(
    { error: 'Cross-site mutation rejected.', ok: false },
    { status: 403 },
  )
}
