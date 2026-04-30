export type ApiRequestContext = {
  isDevFallback: boolean
  userId: string
  workspaceId: string
}

const idPattern = /^[a-zA-Z0-9._-]+$/

export function getApiRequestContext(request: Request): ApiRequestContext {
  const explicitUserId = request.headers.get('x-tangent-user-id')
  const explicitWorkspaceId = request.headers.get('x-tangent-workspace-id')
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
  }
}

function normalizeContextId(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed || !idPattern.test(trimmed) || trimmed.includes('..')) {
    throw new Error(`Invalid ${label}.`)
  }
  return trimmed
}
