import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

export async function buildServerClerkApiHeaders() {
  const token = await loadServerClerkToken()
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

async function loadServerClerkToken() {
  try {
    const authState = await auth()
    if (!authState.userId) return null
    return await authState.getToken()
  } catch {
    return null
  }
}
