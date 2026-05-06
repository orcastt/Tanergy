import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { mockSession } from '@/features/auth/mockSession'
import type { TangentSession } from '@/features/auth/sessionTypes'
import { getApiRequestContext, type ApiRequestContext } from '../../_lib/apiRequestContext'

export const runtime = 'nodejs'

type ClerkCurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>

export async function GET(request: Request) {
  try {
    const clerkAuth = await auth()
    if (clerkAuth.userId) {
      const user = await currentUser()
      return NextResponse.json({ ok: true, session: createSessionFromClerk(clerkAuth.userId, user) })
    }

    if (process.env.TANGENT_REQUIRE_WEB_AUTH === '1') {
      return NextResponse.json({ error: 'Missing Clerk session.', ok: false }, { status: 401 })
    }

    const context = getApiRequestContext(request)
    return NextResponse.json({ ok: true, session: createSessionFromContext(context) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session lookup failed.'
    return NextResponse.json({ error: message, ok: false }, { status: message.includes('authenticated') ? 401 : 400 })
  }
}

function createSessionFromContext(context: ApiRequestContext): TangentSession {
  const activeWorkspace = {
    ...mockSession.activeWorkspace,
    id: context.workspaceId,
    kind: context.workspaceKind,
    planKey: context.workspacePlanKey,
  }
  return {
    ...mockSession,
    activeWorkspace,
    authMode: process.env.TANGENT_REQUIRE_API_AUTH === '1' ? 'required' : 'dev',
    isDevFallback: context.isDevFallback,
    user: {
      ...mockSession.user,
      id: context.userId,
    },
    workspaces: [activeWorkspace],
  }
}

function createSessionFromClerk(userId: string, user: ClerkCurrentUser | null): TangentSession {
  const email = getClerkEmail(user, userId)
  const displayName = getClerkDisplayName(user, email)
  const activeWorkspace = {
    ...mockSession.activeWorkspace,
    id: `workspace-${userId}`,
    name: 'Tanergy Workspace',
    role: 'owner' as const,
  }

  return {
    ...mockSession,
    activeWorkspace,
    authMode: 'required',
    isDevFallback: false,
    user: {
      avatarInitials: getInitials(displayName, email),
      displayName,
      email,
      emailVerified: isClerkEmailVerified(user),
      id: userId,
    },
    workspaces: [activeWorkspace],
  }
}

function getClerkEmail(user: ClerkCurrentUser | null, userId: string) {
  return user?.primaryEmailAddress?.emailAddress
    ?? user?.emailAddresses[0]?.emailAddress
    ?? `${userId}@clerk.local`
}

function getClerkDisplayName(user: ClerkCurrentUser | null, email: string) {
  return user?.fullName
    || [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || user?.username
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

function isClerkEmailVerified(user: ClerkCurrentUser | null) {
  return user?.primaryEmailAddress?.verification?.status === 'verified'
}
