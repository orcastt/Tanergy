import { NextResponse, type NextRequest } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { mockSession } from '@/features/auth/mockSession'
import type { TangentSession } from '@/features/auth/sessionTypes'
import { buildServerClerkApiHeaders } from '@/features/auth/serverClerkAuth'
import { getApiRequestContext, type ApiRequestContext } from '../../_lib/apiRequestContext'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    if (isLocalDevAuthBypass(request)) {
      const context = getApiRequestContext(request)
      return NextResponse.json({ ok: true, session: createSessionFromContext(context) })
    }

    const remoteResponse = await loadRemoteSession(request)
    if (remoteResponse) return remoteResponse

    const clerkAuth = getOptionalClerkAuth(request)
    if (clerkAuth.userId) {
      return NextResponse.json({ ok: true, session: createSessionFromClerk(clerkAuth.userId, clerkAuth.sessionClaims) })
    }

    if (process.env.NODE_ENV === 'production' || process.env.TANGENT_REQUIRE_WEB_AUTH === '1') {
      return NextResponse.json({ error: 'Missing Clerk session.', ok: false }, { status: 401 })
    }

    const context = getApiRequestContext(request)
    return NextResponse.json({ ok: true, session: createSessionFromContext(context) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session lookup failed.'
    return NextResponse.json({ error: message, ok: false }, { status: message.includes('authenticated') ? 401 : 400 })
  }
}

async function loadRemoteSession(request: NextRequest) {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')
  if (!apiBaseUrl) return null

  const response = await fetch(`${apiBaseUrl}/api/v1/auth/session${request.nextUrl.search}`, {
    cache: 'no-store',
    headers: await buildProxyHeaders(request),
    method: 'GET',
  })

  const payload = await readJson(response)
  if (response.ok && isDisallowedRemoteFallbackSession(payload, request)) {
    return NextResponse.json(
      { error: 'Remote auth fallback is disabled for this environment.', ok: false },
      { status: 503 },
    )
  }
  if (!response.ok) {
    const error = payload?.error
    const detail = payload?.detail
    return NextResponse.json(
      { error: getResponseErrorMessage(error, detail, 'Session lookup failed.'), ok: false },
      { status: response.status },
    )
  }

  return NextResponse.json(payload, { status: response.status })
}

function getOptionalClerkAuth(request: NextRequest) {
  try {
    const auth = getAuth(request)
    return { didRun: true, sessionClaims: auth.sessionClaims, userId: auth.userId }
  } catch {
    return { didRun: false, sessionClaims: null, userId: null }
  }
}

function isLocalDevAuthBypass(request: NextRequest) {
  return process.env.NODE_ENV !== 'production'
    && process.env.TANGENT_ENABLE_DEV_AUTH_BYPASS === '1'
    && request.cookies.get('tangent_dev_auth')?.value === '1'
}

function createSessionFromContext(context: ApiRequestContext): TangentSession {
  const activeWorkspace = {
    ...mockSession.activeWorkspace,
    id: context.workspaceId,
    kind: context.workspaceKind,
    planKey: context.workspacePlanKey,
  }
  const workspaces = buildMockWorkspaceCollection(activeWorkspace)
  return {
    ...mockSession,
    activeWorkspace,
    authMode: process.env.TANGENT_REQUIRE_API_AUTH === '1' ? 'required' : 'dev',
    isDevFallback: context.isDevFallback,
    user: {
      ...mockSession.user,
      id: context.userId,
      profileCompleted: context.userProfileCompleted,
    },
    workspaces,
  }
}

function createSessionFromClerk(userId: string, claims: Record<string, unknown> | null): TangentSession {
  const email = getClerkEmail(claims, userId)
  const displayName = getClerkDisplayName(claims, email)
  const activeWorkspace = {
    ...mockSession.activeWorkspace,
    id: `workspace-${userId}`,
    name: 'Tanergy Workspace',
    role: 'owner' as const,
  }
  const workspaces = buildMockWorkspaceCollection(activeWorkspace)

  return {
    ...mockSession,
    activeWorkspace,
    authMode: 'required',
    isDevFallback: false,
    user: {
      avatarInitials: getInitials(displayName, email),
      displayName,
      email,
      emailVerified: isClerkEmailVerified(claims),
      id: userId,
      profileCompleted: true,
    },
    workspaces,
  }
}

function buildMockWorkspaceCollection(activeWorkspace: TangentSession['activeWorkspace']) {
  return [
    activeWorkspace,
    ...mockSession.workspaces
      .filter((workspace) => workspace.id !== activeWorkspace.id)
      .map((workspace) => ({ ...workspace })),
  ]
}

function getClerkEmail(claims: Record<string, unknown> | null, userId: string) {
  return getStringClaim(claims, 'email')
    ?? getStringClaim(claims, 'email_address')
    ?? getStringClaim(claims, 'primary_email_address')
    ?? `${userId}@clerk.local`
}

function getClerkDisplayName(claims: Record<string, unknown> | null, email: string) {
  return getStringClaim(claims, 'name')
    || [getStringClaim(claims, 'given_name'), getStringClaim(claims, 'family_name')].filter(Boolean).join(' ')
    || getStringClaim(claims, 'username')
    || email.split('@')[0]
    || 'Tanergy user'
}

function getInitials(displayName: string, email: string) {
  const source = displayName || email
  const initials = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return initials || 'T'
}

function getStringClaim(claims: Record<string, unknown> | null, key: string) {
  const value = claims?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isClerkEmailVerified(claims: Record<string, unknown> | null) {
  return claims?.email_verified === true || claims?.email_verified === 'true'
}

async function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers(await buildServerClerkApiHeaders(request))

  copyHeader(request, headers, 'authorization')
  copyHeader(request, headers, 'content-type')
  copyHeader(request, headers, 'cookie')
  copyHeader(request, headers, 'x-tangent-user-id')
  copyHeader(request, headers, 'x-tangent-workspace-id')
  copyHeader(request, headers, 'x-tangent-workspace-kind')
  copyHeader(request, headers, 'x-tangent-workspace-name')
  copyHeader(request, headers, 'x-tangent-workspace-role')
  copyHeader(request, headers, 'x-tangent-plan-key')

  return headers
}

function getResponseErrorMessage(error: unknown, detail: unknown, fallback: string) {
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  return fallback
}

function copyHeader(request: NextRequest, headers: Headers, name: string) {
  const value = request.headers.get(name)
  if (value) headers.set(name, value)
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { error: text }
  }
}

function isDisallowedRemoteFallbackSession(payload: Record<string, unknown>, request: NextRequest) {
  const session = payload.session
  if (!session || typeof session !== 'object') return false
  const isDevFallback = (session as { isDevFallback?: unknown }).isDevFallback === true
  if (!isDevFallback) return false
  if (process.env.TANGENT_REQUIRE_WEB_AUTH === '1') return true
  if (process.env.NODE_ENV === 'production') return true
  return !['127.0.0.1', 'localhost'].includes(request.nextUrl.hostname)
}
