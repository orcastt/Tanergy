import { NextResponse, type NextRequest } from 'next/server'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'
import { readTextRequestWithLimit, requestBodyErrorStatus } from '../../_lib/requestBodyLimits'
import { buildServerProxyAuthHeaders } from '../../_lib/serverProxyAuthHeaders'
import { resolveAdminProxyPath } from '../_lib/adminProxyPolicy'

export const runtime = 'nodejs'

const maxAdminProxyRequestBytes = 256 * 1024

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

type RouteContext = {
  params: Promise<{ path: string[] }>
}

async function proxyAdminRequest(request: NextRequest, context: RouteContext) {
  const originRejection = rejectCrossSiteMutation(request)
  if (originRejection) return originRejection

  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: 'Admin API proxy requires NEXT_PUBLIC_API_BASE_URL.' },
      { status: 500 },
    )
  }

  const { path } = await context.params
  const proxyPath = resolveAdminProxyPath(request.method, path)
  if (!proxyPath.ok) {
    return NextResponse.json({ error: proxyPath.error, ok: false }, { status: proxyPath.status })
  }
  const targetUrl = new URL(`/api/v1/admin${proxyPath.path}`, apiBaseUrl)
  targetUrl.search = request.nextUrl.search

  const contentTypeRejection = rejectUnsupportedContentType(request)
  if (contentTypeRejection) return contentTypeRejection

  let body: string | undefined
  try {
    body = shouldForwardBody(request.method)
      ? await readTextRequestWithLimit(request, maxAdminProxyRequestBytes)
      : undefined
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admin proxy request failed.', ok: false },
      { status: requestBodyErrorStatus(error) },
    )
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: await buildProxyHeaders(request),
    body,
    cache: 'no-store',
    redirect: 'manual',
  })

  return new NextResponse(response.body, {
    status: response.status,
    headers: buildResponseHeaders(response),
  })
}

async function buildProxyHeaders(request: NextRequest) {
  const headers = await buildServerProxyAuthHeaders(request)
  copyJsonHeader(request, headers, 'content-type')
  copyHeader(request, headers, 'accept')
  copyTrustedOrigin(request, headers)
  copyWorkspaceContextHeaders(request, headers)
  return headers
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

function copyWorkspaceContextHeaders(request: NextRequest, headers: Headers) {
  for (const name of ['x-tangent-workspace-id']) {
    copyHeader(request, headers, name)
  }
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
    { error: 'Admin proxy only accepts JSON request bodies.', ok: false },
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
