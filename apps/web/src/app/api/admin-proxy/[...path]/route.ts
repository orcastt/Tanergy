import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context)
}

type RouteContext = {
  params: Promise<{ path: string[] }>
}

async function proxyAdminRequest(request: NextRequest, context: RouteContext) {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: 'Admin API proxy requires NEXT_PUBLIC_API_BASE_URL.' },
      { status: 500 },
    )
  }

  const { path } = await context.params
  const targetPath = path.length ? `/${path.join('/')}` : ''
  const targetUrl = `${apiBaseUrl}/api/v1/admin${targetPath}${request.nextUrl.search}`
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: buildProxyHeaders(request),
    body: shouldForwardBody(request.method) ? await request.text() : undefined,
    cache: 'no-store',
    redirect: 'manual',
  })

  return new NextResponse(response.body, {
    status: response.status,
    headers: buildResponseHeaders(response),
  })
}

function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers()
  copyHeader(request, headers, 'authorization')
  copyHeader(request, headers, 'content-type')
  copyHeader(request, headers, 'cookie')
  return headers
}

function copyHeader(request: NextRequest, headers: Headers, name: string) {
  const value = request.headers.get(name)
  if (value) headers.set(name, value)
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
