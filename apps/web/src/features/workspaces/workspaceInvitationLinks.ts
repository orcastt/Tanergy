'use client'

type WorkspaceInvitationLinkInput = {
  boardId?: string
  boardTitle?: string
  role?: string
  workspaceKind?: string
  workspaceName?: string
}

export type WorkspaceInvitationBoardTarget = {
  boardId: string
  boardTitle: string | null
}

export function buildWorkspaceInvitationLink(
  token: string,
  input: WorkspaceInvitationLinkInput = {},
  baseUrl = typeof window === 'undefined' ? '' : window.location.origin,
) {
  const normalizedToken = normalizeWorkspaceInvitationToken(token)
  if (!normalizedToken) return ''
  const url = new URL(`/invite/${encodeURIComponent(normalizedToken)}`, baseUrl || 'http://localhost')
  if (input.boardId) url.searchParams.set('boardId', input.boardId)
  if (input.boardTitle) url.searchParams.set('boardTitle', input.boardTitle)
  if (input.role) url.searchParams.set('role', input.role)
  if (input.workspaceKind) url.searchParams.set('workspaceKind', input.workspaceKind)
  if (input.workspaceName) url.searchParams.set('workspaceName', input.workspaceName)
  return baseUrl ? url.toString() : `${url.pathname}${url.search}`
}

export function parseWorkspaceInvitationToken(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const candidate = safeParseUrl(trimmed)
  if (candidate) {
    const path = candidate.pathname.replace(/\/+$/, '')
    const inviteMatch = path.match(/^\/invite\/([^/]+)$/)
    if (inviteMatch) return normalizeWorkspaceInvitationToken(inviteMatch[1])
    const apiMatch = path.match(/^\/api\/v1\/workspaces\/invitations\/([^/]+)\/accept$/)
    if (apiMatch) return normalizeWorkspaceInvitationToken(apiMatch[1])
    const pathSegment = path.split('/').filter(Boolean).at(-1)
    return normalizeWorkspaceInvitationToken(pathSegment ?? '')
  }
  if (trimmed.includes('/invite/')) {
    const inviteMatch = trimmed.match(/\/invite\/([^/?#]+)/)
    if (inviteMatch) return normalizeWorkspaceInvitationToken(inviteMatch[1])
  }
  if (trimmed.includes('/api/v1/workspaces/invitations/')) {
    const apiMatch = trimmed.match(/\/api\/v1\/workspaces\/invitations\/([^/?#]+)\/accept/)
    if (apiMatch) return normalizeWorkspaceInvitationToken(apiMatch[1])
  }
  return normalizeWorkspaceInvitationToken(trimmed.split('/').filter(Boolean).at(-1) ?? trimmed)
}

export function resolveWorkspaceInvitationBoardTarget(
  input: Partial<Record<'boardId' | 'boardTitle', unknown>>,
): WorkspaceInvitationBoardTarget | null {
  const boardId = normalizeWorkspaceInvitationField(input.boardId)
  if (!boardId) return null
  return {
    boardId,
    boardTitle: normalizeWorkspaceInvitationField(input.boardTitle),
  }
}

function normalizeWorkspaceInvitationToken(value: string) {
  const trimmed = value.trim()
  return trimmed.replace(/[?#].*$/, '')
}

function normalizeWorkspaceInvitationField(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function safeParseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    try {
      return new URL(value, 'http://localhost')
    } catch {
      return null
    }
  }
}
