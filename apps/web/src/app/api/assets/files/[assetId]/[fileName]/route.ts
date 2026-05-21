import { NextResponse, type NextRequest } from 'next/server'
import { assertLocalAssetBridgeAvailable } from '@/features/api/runtimeBridgePolicy'
import { buildServerClerkApiHeaders } from '@/features/auth/serverClerkAuth'
import { getApiRequestContext } from '../../../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../../../_lib/assetStorageAdapter'

export const runtime = 'nodejs'
const remoteApiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')
const assetFileSecurityHeaders = {
  'Cache-Control': 'private, max-age=3600',
  'Cross-Origin-Resource-Policy': 'same-site',
  'X-Robots-Tag': 'noindex, nofollow',
}

type AssetFileRouteContext = {
  params: Promise<{ assetId: string; fileName: string }>
}

export async function GET(request: NextRequest, context: AssetFileRouteContext) {
  try {
    if (remoteApiBaseUrl) {
      return proxyRemoteAssetFile(request, context)
    }
    assertLocalAssetBridgeAvailable()
    const { assetId, fileName } = await context.params
    const { file, mime } = await getAssetStorageAdapter().readFile(assetId, fileName, getApiRequestContext(request))
    return new NextResponse(file, {
      headers: {
        ...assetFileSecurityHeaders,
        'Content-Type': mime,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Asset file not found.' },
      { status: error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 404 }
    )
  }
}

async function proxyRemoteAssetFile(request: NextRequest, context: AssetFileRouteContext) {
  const { assetId, fileName } = await context.params
  const upstream = await fetch(
    `${remoteApiBaseUrl}/api/v1/assets/files/${encodeURIComponent(assetId)}/${encodeURIComponent(fileName)}`,
    {
      cache: 'no-store',
      headers: await buildProxyHeaders(request),
      method: 'GET',
    }
  )
  const headers = new Headers()
  copyResponseHeader(upstream, headers, 'cache-control')
  copyResponseHeader(upstream, headers, 'content-length')
  copyResponseHeader(upstream, headers, 'content-type')
  copyResponseHeader(upstream, headers, 'etag')
  copyResponseHeader(upstream, headers, 'last-modified')
  applyAssetFileSecurityHeaders(headers)
  return new NextResponse(upstream.body, {
    headers,
    status: upstream.status,
  })
}

async function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers(await buildServerClerkApiHeaders(request))
  copyRequestHeader(request, headers, 'accept')
  const queryWorkspaceId = normalizeWorkspaceId(request.nextUrl.searchParams.get('workspaceId'))
  if (queryWorkspaceId) {
    headers.set('x-tangent-workspace-id', queryWorkspaceId)
  }
  return headers
}

function copyRequestHeader(request: NextRequest, headers: Headers, name: string) {
  const value = request.headers.get(name)
  if (value) headers.set(name, value)
}

function copyResponseHeader(response: Response, headers: Headers, name: string) {
  const value = response.headers.get(name)
  if (value) headers.set(name, value)
}

function applyAssetFileSecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(assetFileSecurityHeaders)) {
    headers.set(name, value)
  }
}

function normalizeWorkspaceId(value: null | string) {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.includes('..') || !/^[a-zA-Z0-9._-]+$/.test(trimmed)) return null
  return trimmed
}
