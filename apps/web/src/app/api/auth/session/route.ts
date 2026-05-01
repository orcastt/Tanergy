import { NextResponse } from 'next/server'
import { mockSession } from '@/features/auth/mockSession'
import type { TangentSession } from '@/features/auth/sessionTypes'
import { getApiRequestContext, type ApiRequestContext } from '../../_lib/apiRequestContext'

export const runtime = 'nodejs'

export function GET(request: Request) {
  try {
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
