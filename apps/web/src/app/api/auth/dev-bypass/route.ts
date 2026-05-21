import { NextResponse, type NextRequest } from 'next/server'
import { rejectCrossSiteMutation } from '../../_lib/csrfGuard'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return createLocalDevBypassResponse(request, 'redirect')
}

export async function POST(request: NextRequest) {
  const originRejection = rejectCrossSiteMutation(request)
  if (originRejection) return originRejection
  return createLocalDevBypassResponse(request, 'json')
}

function createLocalDevBypassResponse(request: NextRequest, mode: 'json' | 'redirect') {
  if (process.env.NODE_ENV === 'production' || process.env.TANGENT_ENABLE_DEV_AUTH_BYPASS !== '1') {
    return NextResponse.json({ error: 'Local dev auth bypass is disabled.', ok: false }, { status: 404 })
  }

  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get('next')) ?? '/admin'
  const response = mode === 'redirect'
    ? new NextResponse(null, { headers: { Location: nextPath }, status: 307 })
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
