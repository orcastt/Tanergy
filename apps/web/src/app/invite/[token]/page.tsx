'use client'

import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import { sanitizeRelativeRedirectPath } from '@/features/auth/authRedirect'
import { acceptWorkspaceInvitation } from '@/features/billing/billingClient'
import type { WorkspaceKind } from '@/features/billing/billingTypes'
import {
  parseWorkspaceInvitationToken,
  resolveWorkspaceInvitationBoardTarget,
} from '@/features/workspaces/workspaceInvitationLinks'

export default function WorkspaceInvitePage() {
  const params = useParams<{ token?: string | string[] }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoaded, userId } = useAuth()
  const [isPending, setIsPending] = useState(false)
  const [status, setStatus] = useState<null | { message: string; tone: 'error' | 'info' }>(null)
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token
  const token = parseWorkspaceInvitationToken(rawToken ?? '')
  const workspaceKind = normalizeWorkspaceKind(searchParams.get('workspaceKind'))
  const workspaceName = normalizeDisplayValue(searchParams.get('workspaceName'))
  const role = normalizeRole(searchParams.get('role'))
  const inviteBoardTarget = resolveWorkspaceInvitationBoardTarget({
    boardId: searchParams.get('boardId'),
    boardTitle: searchParams.get('boardTitle'),
  })
  const invitePath = useMemo(() => {
    if (!token) return '/workspaces'
    const query = searchParams.toString()
    return sanitizeRelativeRedirectPath(
      `/invite/${encodeURIComponent(token)}${query ? `?${query}` : ''}`,
      '/workspaces',
    )
  }, [searchParams, token])
  const signInHref = buildAuthHref('/sign-in', invitePath)
  const signUpHref = buildAuthHref('/sign-up', invitePath)
  const isSignedIn = Boolean(userId)
  const heading = workspaceName
    ? `Join ${workspaceName}`
    : `Join this ${workspaceKind === 'team_workspace' ? 'team' : 'group'} workspace`
  const copy = workspaceName
    ? `This invite will add you to ${workspaceName} with ${formatRole(role)} access.`
    : `This invite will add you to a shared workspace with ${formatRole(role)} access.`

  return (
    <main className="workspace-invite-page">
      <section className="workspace-invite-card">
        <Link className="workspace-invite-brand" href="/">
          TANGENT
        </Link>
        <span className="workspace-invite-eyebrow">Workspace invite</span>
        <h1 className="workspace-invite-title">{heading}</h1>
        <p className="workspace-invite-copy">{copy}</p>

        <dl className="workspace-invite-meta">
          <div className="workspace-invite-meta-row">
            <dt>Access</dt>
            <dd>{formatRole(role)}</dd>
          </div>
          <div className="workspace-invite-meta-row">
            <dt>Workspace</dt>
            <dd>{formatWorkspaceKind(workspaceKind)}</dd>
          </div>
        {workspaceName ? (
          <div className="workspace-invite-meta-row">
            <dt>Name</dt>
            <dd>{workspaceName}</dd>
          </div>
        ) : null}
        {inviteBoardTarget ? (
          <div className="workspace-invite-meta-row">
            <dt>Board</dt>
            <dd>{inviteBoardTarget.boardTitle ?? inviteBoardTarget.boardId}</dd>
          </div>
        ) : null}
      </dl>

        {!token ? (
          <div className="workspace-invite-actions">
            <Link className="product-button product-button-primary" href="/workspaces">
              Open workspace
            </Link>
          </div>
        ) : !isLoaded ? (
          <p className="workspace-invite-status" role="status">Loading invite...</p>
        ) : isSignedIn ? (
          <div className="workspace-invite-actions">
            <button
              className="product-button product-button-primary"
              disabled={isPending}
              onClick={acceptInvite}
              type="button"
            >
              {isPending ? 'Joining...' : 'Accept invite'}
            </button>
            <Link className="product-button product-button-secondary" href="/workspaces">
              Not now
            </Link>
          </div>
        ) : (
          <div className="workspace-invite-actions">
            <Link className="product-button product-button-primary" href={signInHref}>
              Sign in to join
            </Link>
            <Link className="product-button product-button-secondary" href={signUpHref}>
              Create account
            </Link>
          </div>
        )}

        {status ? (
          <p
            className={`workspace-invite-status${status.tone === 'error' ? ' is-error' : ''}`}
            role="status"
          >
            {status.message}
          </p>
        ) : null}
      </section>
    </main>
  )

  async function acceptInvite() {
    if (!token || isPending) return
    setIsPending(true)
    setStatus(null)
    try {
      const response = await acceptWorkspaceInvitation(token)
      requestCurrentSessionRefresh()
      const acceptedKind = normalizeWorkspaceKind(
        readMetadataValue(response.result.invitation.metadata, 'workspaceKind') ?? workspaceKind,
      )
      const acceptedBoardTarget = resolveWorkspaceInvitationBoardTarget({
        boardId: readMetadataValue(response.result.invitation.metadata, 'boardId') ?? inviteBoardTarget?.boardId,
        boardTitle: readMetadataValue(response.result.invitation.metadata, 'boardTitle') ?? inviteBoardTarget?.boardTitle,
      })
      const destination = acceptedBoardTarget
        ? `/boards/${encodeURIComponent(acceptedBoardTarget.boardId)}?workspace=${encodeURIComponent(response.result.workspaceId)}`
        : acceptedKind === 'team_workspace'
        ? `/team/${encodeURIComponent(response.result.workspaceId)}`
        : `/group/${encodeURIComponent(response.result.workspaceId)}`
      setStatus({ message: 'Invite accepted. Opening workspace...', tone: 'info' })
      router.replace(destination)
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : 'Invite accept failed.',
        tone: 'error',
      })
    } finally {
      setIsPending(false)
    }
  }
}

function buildAuthHref(path: '/sign-in' | '/sign-up', redirectPath: string) {
  const search = new URLSearchParams({ redirect_url: redirectPath })
  return `${path}?${search.toString()}`
}

function formatRole(role: 'admin' | 'editor' | 'viewer') {
  if (role === 'admin') return 'Admin'
  if (role === 'viewer') return 'Viewer'
  return 'Editor'
}

function formatWorkspaceKind(kind: WorkspaceKind) {
  if (kind === 'team_workspace') return 'Team workspace'
  if (kind === 'group_workspace') return 'Group workspace'
  if (kind === 'enterprise_workspace') return 'Enterprise workspace'
  return 'Solo workspace'
}

function normalizeDisplayValue(value: null | string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeRole(value: null | string): 'admin' | 'editor' | 'viewer' {
  if (value === 'admin' || value === 'viewer') return value
  return 'editor'
}

function normalizeWorkspaceKind(value: null | string): WorkspaceKind {
  if (
    value === 'enterprise_workspace'
    || value === 'group_workspace'
    || value === 'solo_workspace'
    || value === 'team_workspace'
  ) {
    return value
  }
  return 'group_workspace'
}

function readMetadataValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' ? value : null
}
