import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { isProtectedProductPath, shouldRequireWebAuth } from '@/features/auth/routeGuard'

const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/account(.*)',
  '/boards(.*)',
  '/settings(.*)',
  '/workspaces(.*)',
])

const clerkProxy = clerkMiddleware(async (auth, request) => {
  if (shouldRequireWebAuth() && isProtectedRoute(request)) {
    await auth.protect({
      unauthenticatedUrl: new URL('/sign-in', request.url).toString(),
    })
  }
})

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!shouldRunClerkProxy(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  return clerkProxy(request, event)
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/api/auth/session', '/boards/:path*', '/settings/:path*', '/workspaces/:path*'],
}

function shouldRunClerkProxy(pathname: string) {
  return pathname === '/api/auth/session' || isProtectedProductPath(pathname)
}
