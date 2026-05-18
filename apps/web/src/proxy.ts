import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { isProtectedProductPath, shouldRequireWebAuth } from '@/features/auth/routeGuard'

const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/account(.*)',
  '/billing(.*)',
  '/boards(.*)',
  '/collections(.*)',
  '/team(.*)',
  '/settings(.*)',
  '/usage(.*)',
  '/workspaces(.*)',
])

const clerkProxy = clerkMiddleware(async (auth, request) => {
  if (shouldRequireWebAuth() && isProtectedRoute(request)) {
    if (isLocalDevAuthBypass(request)) return NextResponse.next()
    await auth.protect({
      unauthenticatedUrl: new URL('/sign-in', request.url).toString(),
    })
  }
})

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!shouldRunClerkProxy(request.nextUrl.pathname)) {
    return NextResponse.next()
  }
  if (
    shouldRequireWebAuth()
    && isProtectedRoute(request)
    && isLocalDevAuthBypass(request)
  ) {
    return NextResponse.next()
  }

  return clerkProxy(request, event)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/account/:path*',
    '/billing/:path*',
    '/boards/:path*',
    '/collections/:path*',
    '/settings/:path*',
    '/team/:path*',
    '/usage/:path*',
    '/workspaces/:path*',
  ],
}

function shouldRunClerkProxy(pathname: string) {
  return isProtectedProductPath(pathname)
}

function isLocalDevAuthBypass(request: NextRequest) {
  return process.env.NODE_ENV !== 'production'
    && process.env.TANGENT_ENABLE_DEV_AUTH_BYPASS === '1'
    && request.cookies.get('tangent_dev_auth')?.value === '1'
}
