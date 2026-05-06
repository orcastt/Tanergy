import type { WorkspaceKind } from '@/features/billing/billingTypes'

export type ApiRequestContext = {
  isDevFallback: boolean
  userId: string
  workspaceId: string
  workspaceKind: WorkspaceKind
}

const idPattern = /^[a-zA-Z0-9._-]+$/

export function getApiRequestContext(request: Request): ApiRequestContext {
  const explicitUserId = request.headers.get('x-tangent-user-id')
  const explicitWorkspaceId = request.headers.get('x-tangent-workspace-id')
  const explicitWorkspaceKind = request.headers.get('x-tangent-workspace-kind')
  const hasExplicitContext = Boolean(explicitUserId && explicitWorkspaceId)

  if (process.env.TANGENT_REQUIRE_API_AUTH === '1' && !hasExplicitContext) {
    throw new Error('Missing authenticated API context.')
  }

  return {
    isDevFallback: !hasExplicitContext,
    userId: normalizeContextId(explicitUserId ?? process.env.TANGENT_DEV_USER_ID ?? 'dev-user', 'user id'),
    workspaceId: normalizeContextId(
      explicitWorkspaceId ?? process.env.TANGENT_DEV_WORKSPACE_ID ?? 'dev-workspace',
      'workspace id'
    ),
    workspaceKind: normalizeWorkspaceKind(explicitWorkspaceKind ?? process.env.TANGENT_DEV_WORKSPACE_KIND ?? 'solo_workspace'),
  }
}

function normalizeContextId(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed || !idPattern.test(trimmed) || trimmed.includes('..')) {
    throw new Error(`Invalid ${label}.`)
  }
  return trimmed
}

function normalizeWorkspaceKind(value: string): WorkspaceKind {
  const trimmed = value.trim()
  if (!['enterprise_workspace', 'group_workspace', 'solo_workspace', 'team_workspace'].includes(trimmed)) {
    throw new Error('Invalid workspace kind.')
  }
  return trimmed as WorkspaceKind
}
