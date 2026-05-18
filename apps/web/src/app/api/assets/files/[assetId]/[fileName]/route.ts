import { NextResponse, type NextRequest } from 'next/server'
import { assertLocalAssetBridgeAvailable } from '@/features/api/runtimeBridgePolicy'
import { buildServerClerkApiHeaders } from '@/features/auth/serverClerkAuth'
import { getApiRequestContext } from '../../../../_lib/apiRequestContext'
import { getAssetStorageAdapter } from '../../../_lib/assetStorageAdapter'

export const runtime = 'nodejs'
const remoteApiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')

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
        'Cache-Control': 'private, max-age=31536000, immutable',
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
  return new NextResponse(upstream.body, {
    headers,
    status: upstream.status,
  })
}

async function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers(await buildServerClerkApiHeaders(request))
  copyRequestHeader(request, headers, 'accept')
  copyRequestHeader(request, headers, 'authorization')
  copyRequestHeader(request, headers, 'cookie')
  copyRequestHeader(request, headers, 'x-tangent-plan-key')
  copyRequestHeader(request, headers, 'x-tangent-workspace-id')
  copyRequestHeader(request, headers, 'x-tangent-workspace-kind')
  copyRequestHeader(request, headers, 'x-tangent-workspace-name')
  copyRequestHeader(request, headers, 'x-tangent-workspace-role')
  const queryWorkspaceId = request.nextUrl.searchParams.get('workspaceId')?.trim()
  if (queryWorkspaceId && !headers.get('x-tangent-workspace-id')) {
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
