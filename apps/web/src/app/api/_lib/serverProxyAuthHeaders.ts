import type { NextRequest } from 'next/server'
import { buildServerClerkApiHeaders } from '@/features/auth/serverClerkAuth'

export async function buildServerProxyAuthHeaders(request: NextRequest) {
  const headers = new Headers(await buildServerClerkApiHeaders(request))
  if (headers.has('authorization')) return headers

  const sessionCookie = extractSessionCookie(headers.get('cookie'))
  if (!sessionCookie) return headers
  headers.delete('cookie')
  headers.set('authorization', `Bearer ${sessionCookie}`)
  return headers
}

function extractSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null
  for (const segment of cookieHeader.split(';')) {
    const [rawName, ...valueParts] = segment.trim().split('=')
    if (rawName !== '__session') continue
    const value = valueParts.join('=').trim()
    return value || null
  }
  return null
}
