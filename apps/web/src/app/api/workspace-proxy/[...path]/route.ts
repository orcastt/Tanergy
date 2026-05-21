import { NextResponse, type NextRequest } from 'next/server'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'
import { readTextRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { buildServerProxyAuthHeaders } from '../../_lib/serverProxyAuthHeaders'

export const runtime = 'nodejs'

const maxWorkspaceProxyRequestBytes = 256 * 1024
const pathSegmentPattern = /^[a-zA-Z0-9._-]+$/
const workspaceContextHeaders = [
  'x-tangent-plan-key',
  'x-tangent-user-id',
  'x-tangent-workspace-id',
  'x-tangent-workspace-kind',
  'x-tangent-workspace-name',
  'x-tangent-workspace-role',
]

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyWorkspaceRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyWorkspaceRequest(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyWorkspaceRequest(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyWorkspaceRequest(request, context)
}

type RouteContext = {
  params: Promise<{ path: string[] }>
}

async function proxyWorkspaceRequest(request: NextRequest, context: RouteContext) {
  const originRejection = rejectCrossSiteMutation(request)
  if (originRejection) return originRejection

  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: 'Workspace API proxy requires NEXT_PUBLIC_API_BASE_URL.', ok: false },
      { status: 500 },
    )
  }

  const { path } = await context.params
  const proxyPath = resolveWorkspaceProxyPath(request.method, path)
  if (!proxyPath.ok) {
    return NextResponse.json({ error: proxyPath.error, ok: false }, { status: proxyPath.status })
  }

  const targetUrl = new URL(`/api/v1/workspaces/${proxyPath.path}`, apiBaseUrl)
  targetUrl.search = request.nextUrl.search

  const contentTypeRejection = rejectUnsupportedContentType(request)
  if (contentTypeRejection) return contentTypeRejection

  let body: string | undefined
  try {
    body = shouldForwardBody(request.method)
      ? await readTextRequestWithLimit(request, maxWorkspaceProxyRequestBytes)
      : undefined
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Workspace proxy request failed.', ok: false },
      { status: requestBodyErrorStatus(error) },
    )
  }

  const response = await fetch(targetUrl, {
    body,
    cache: 'no-store',
    headers: await buildProxyHeaders(request),
    method: request.method,
    redirect: 'manual',
  })

  return new NextResponse(response.body, {
    headers: buildResponseHeaders(response),
    status: response.status,
  })
}

function resolveWorkspaceProxyPath(method: string, path: string[]) {
  const segments = path.map((segment) => segment.trim())
  if (!segments.length || segments.some((segment) => !isSafePathSegment(segment))) {
    return { error: 'Workspace proxy path is not allowed.', ok: false, status: 404 } as const
  }
  if (!isAllowedWorkspaceRoute(method.toUpperCase(), segments)) {
    return { error: 'Workspace proxy route is not allowed.', ok: false, status: 405 } as const
  }
  return { ok: true, path: segments.map(encodeURIComponent).join('/') } as const
}

function isAllowedWorkspaceRoute(method: string, segments: string[]) {
  if (segments[0] === 'current') return isAllowedCurrentWorkspaceRoute(method, segments)
  if (segments[0] === 'groups') return method === 'POST' && segments.length === 1
  return method === 'POST' && segments.length === 3 && segments[0] === 'invitations' && segments[2] === 'accept'
}

function isAllowedCurrentWorkspaceRoute(method: string, segments: string[]) {
  if (segments.length === 1) return ['DELETE', 'GET', 'PATCH'].includes(method)
  if (segments.length === 2) {
    if (segments[1] === 'dashboard') return method === 'GET'
    if (segments[1] === 'invitations' || segments[1] === 'seats') return method === 'GET' || method === 'POST'
  }
  if (segments.length === 3) {
    if (segments[1] === 'invitations' || segments[1] === 'seats') return method === 'DELETE'
    if (segments[1] === 'members') return method === 'DELETE' || method === 'PATCH'
  }
  return method === 'POST' && segments.join('/') === 'current/owner/transfer'
}

async function buildProxyHeaders(request: NextRequest) {
  const headers = await buildServerProxyAuthHeaders(request)
  copyJsonHeader(request, headers, 'content-type')
  copyHeader(request, headers, 'accept')
  copyTrustedOrigin(request, headers)
  for (const name of workspaceContextHeaders) copyHeader(request, headers, name)
  return headers
}

function isSafePathSegment(value: string) {
  return Boolean(value) && value !== '..' && !value.includes('..') && pathSegmentPattern.test(value)
}

function copyHeader(request: NextRequest, headers: Headers, name: string) {
  const value = request.headers.get(name)
  if (value) headers.set(name, value)
}

function copyJsonHeader(request: NextRequest, headers: Headers, name: string) {
  const value = request.headers.get(name)
  if (value && isJsonContentType(value)) headers.set(name, value)
}

function copyTrustedOrigin(request: NextRequest, headers: Headers) {
  const origin = request.headers.get('origin') ?? request.nextUrl.origin
  if (origin) headers.set('origin', origin)
}

function buildResponseHeaders(response: Response) {
  const headers = new Headers()
  const contentType = response.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  return headers
}

function shouldForwardBody(method: string) {
  return method !== 'GET' && method !== 'HEAD'
}

function rejectUnsupportedContentType(request: NextRequest) {
  if (!shouldForwardBody(request.method)) return null
  const contentType = request.headers.get('content-type')
  if (!contentType || isJsonContentType(contentType)) return null
  return NextResponse.json(
    { error: 'Workspace proxy only accepts JSON request bodies.', ok: false },
    { status: 415 },
  )
}

function isJsonContentType(value: string) {
  return value.toLowerCase().split(';', 1)[0]?.trim() === 'application/json'
}

function getApiBaseUrl() {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')
  if (!apiBaseUrl) return ''
  try {
    const parsed = new URL(apiBaseUrl)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString().replace(/\/+$/, '') : ''
  } catch {
    return ''
  }
}
