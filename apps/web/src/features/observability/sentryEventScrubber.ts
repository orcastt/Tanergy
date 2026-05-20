import type { ErrorEvent, EventHint } from '@sentry/core'

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-clerk-auth-reason',
  'x-tangent-share-password',
])

const REDACTED_PATHS = [
  /^\/share\/[^/]+/,
  /^\/api\/assets\/files\/[^/]+\/[^/]+/,
  /^\/api\/v1\/assets\/files\/[^/]+\/[^/]+/,
]

export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  void _hint
  scrubRequest(event)
  scrubUser(event)
  return event
}

export function getSentryEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ENV
    ?? process.env.APP_ENV
    ?? process.env.NODE_ENV
    ?? 'development'
  )
}

export function getSentryRelease(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    ?? process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.SENTRY_RELEASE
  )
}

export function parseSentrySampleRate(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

function scrubRequest(event: ErrorEvent) {
  const request = event.request
  if (!request) return

  if (request.url) request.url = scrubUrl(request.url)
  delete request.cookies
  delete request.query_string

  if (!request.headers) return
  const headers = request.headers as Record<string, unknown>
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) delete headers[key]
  }
}

function scrubUser(event: ErrorEvent) {
  if (!event.user) return
  event.user = event.user.id ? { id: String(event.user.id) } : undefined
}

function scrubUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    url.search = ''
    url.hash = ''
    url.pathname = redactSensitivePath(url.pathname)
    return url.toString()
  } catch {
    return redactSensitivePath(rawUrl.split('?')[0] ?? rawUrl)
  }
}

function redactSensitivePath(path: string): string {
  for (const pattern of REDACTED_PATHS) {
    if (pattern.test(path)) {
      const prefix = path.split('/').slice(0, 2).join('/')
      return path.replace(pattern, `${prefix}/[redacted]`)
    }
  }
  return path
}
