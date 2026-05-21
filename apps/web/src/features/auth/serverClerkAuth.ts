import { auth, getAuth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { type NextRequest } from 'next/server'

export async function buildServerClerkApiHeaders(request?: NextRequest) {
  const requestAuthorization = request?.headers.get('authorization')?.trim()
  if (requestAuthorization && requestAuthorization.toLowerCase().startsWith('bearer ')) {
    return { Authorization: requestAuthorization } satisfies Record<string, string>
  }

  const token = await loadServerClerkToken(request)
  if (token) {
    return { Authorization: `Bearer ${token}` } satisfies Record<string, string>
  }

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value
  if (sessionCookie) {
    return { Cookie: `__session=${sessionCookie}` } satisfies Record<string, string>
  }

  const canUseDevBypass = process.env.NODE_ENV !== 'production'
    && process.env.TANGENT_ENABLE_DEV_AUTH_BYPASS === '1'
    && cookieStore.get('tangent_dev_auth')?.value === '1'

  if (canUseDevBypass) return {} as Record<string, string>
  return {} as Record<string, string>
}

async function loadServerClerkToken(request?: NextRequest) {
  if (request) {
    try {
      const requestAuth = getAuth(request)
      if (requestAuth.userId) {
        const token = await requestAuth.getToken()
        if (token) return token
      }
    } catch {
      // Fall through to auth(), which covers server components and actions.
    }
  }

  try {
    const authState = await auth()
    if (!authState.userId) return null
    return await authState.getToken()
  } catch {
    return null
  }
}
