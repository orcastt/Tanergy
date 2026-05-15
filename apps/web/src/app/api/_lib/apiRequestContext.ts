import type { PlanKey, WorkspaceKind } from '@/features/billing/billingTypes'

export type ApiRequestContext = {
  isDevFallback: boolean
  userGender?: null | string
  userId: string
  userProfileCompleted: boolean
  workspaceId: string
  workspaceKind: WorkspaceKind
  workspacePlanKey?: PlanKey
}

const idPattern = /^[a-zA-Z0-9._-]+$/

export function getApiRequestContext(request: Request): ApiRequestContext {
  const explicitUserId = request.headers.get('x-tangent-user-id')
  const explicitWorkspaceId = request.headers.get('x-tangent-workspace-id')
  const explicitWorkspaceKind = request.headers.get('x-tangent-workspace-kind')
  const explicitPlanKey = request.headers.get('x-tangent-plan-key')
  const hasExplicitContext = Boolean(explicitUserId && explicitWorkspaceId)

  if (requiresApiContext() && !hasExplicitContext) {
    throw new Error('Missing authenticated API context.')
  }

  const workspaceKind = normalizeWorkspaceKind(explicitWorkspaceKind ?? process.env.TANGENT_DEV_WORKSPACE_KIND ?? 'solo_workspace')
  return {
    isDevFallback: !hasExplicitContext,
    userGender: null,
    userId: normalizeContextId(explicitUserId ?? process.env.TANGENT_DEV_USER_ID ?? 'dev-user', 'user id'),
    userProfileCompleted: true,
    workspaceId: normalizeContextId(
      explicitWorkspaceId ?? process.env.TANGENT_DEV_WORKSPACE_ID ?? 'dev-workspace',
      'workspace id'
    ),
    workspaceKind,
    workspacePlanKey: normalizePlanKey(explicitPlanKey ?? process.env.TANGENT_DEV_WORKSPACE_PLAN_KEY, workspaceKind),
  }
}

function requiresApiContext() {
  return process.env.NODE_ENV === 'production' || process.env.TANGENT_REQUIRE_API_AUTH === '1'
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

function normalizePlanKey(value: null | string | undefined, workspaceKind: WorkspaceKind): PlanKey | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const allowedByKind: Record<WorkspaceKind, PlanKey[]> = {
    enterprise_workspace: ['enterprise'],
    group_workspace: ['collaborate_plus', 'collaborate_start'],
    solo_workspace: ['free_canvas'],
    team_workspace: ['team_growth', 'team_start'],
  }
  if (!allowedByKind[workspaceKind].includes(trimmed as PlanKey)) {
    throw new Error('Invalid workspace plan key.')
  }
  return trimmed as PlanKey
}
