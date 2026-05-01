import { NextResponse, type NextRequest } from 'next/server'
import { isProtectedProductPath, shouldRequireWebAuth } from '@/features/auth/routeGuard'

const sessionCookieName = 'tangent_session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!shouldRequireWebAuth() || !isProtectedProductPath(pathname)) {
    return NextResponse.next()
  }
  if (request.cookies.has(sessionCookieName)) {
    return NextResponse.next()
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/account/:path*', '/boards/:path*', '/settings/:path*', '/workspaces/:path*'],
}
