import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return createLocalDevBypassResponse(request, 'redirect')
}

export async function POST(request: NextRequest) {
  return createLocalDevBypassResponse(request, 'json')
}

function createLocalDevBypassResponse(request: NextRequest, mode: 'json' | 'redirect') {
  if (process.env.NODE_ENV === 'production' || process.env.TANGENT_ENABLE_DEV_AUTH_BYPASS !== '1') {
    return NextResponse.json({ error: 'Local dev auth bypass is disabled.', ok: false }, { status: 404 })
  }

  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get('next')) ?? '/admin'
  const redirectUrl = new URL(nextPath, getRequestOrigin(request))
  const response = mode === 'redirect'
    ? new NextResponse(null, { headers: { Location: redirectUrl.toString() }, status: 307 })
    : NextResponse.json({ next: nextPath, ok: true })

  response.cookies.set('tangent_dev_auth', '1', {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: '/',
    sameSite: 'lax',
    secure: false,
  })

  return response
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function getRequestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host')
  if (!host) return request.nextUrl.origin
  return `${forwardedProto || request.nextUrl.protocol.replace(':', '')}://${host}`
}
