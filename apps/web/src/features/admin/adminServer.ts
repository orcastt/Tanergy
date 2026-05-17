import type { AdminConsoleTab } from './AdminConsoleTabs'
import type {
  AdminAccess,
  AdminDirectoryUserRecord,
  AdminDirectoryUsersResource,
  AdminDirectoryWorkspacesResource,
  AdminDirectoryWorkspaceRecord,
  AdminOperatorUserDetail,
  AdminOperatorUsersResource,
  AdminSummaryResource,
} from './adminTypes'
import { buildServerClerkApiHeaders } from '@/features/auth/serverClerkAuth'

type AdminMeResponse = {
  canAccessAdmin: boolean
  error?: string
  ok: boolean
  roles?: AdminAccess['roles']
  userId?: string
}

type AdminPageBootstrap = {
  access: AdminAccess
  groups: AdminDirectoryWorkspacesResource
  operatorUsers: AdminOperatorUsersResource
  summary: AdminSummaryResource
  teams: AdminDirectoryWorkspacesResource
  users: AdminDirectoryUsersResource
}

type AdminUserDetailBootstrap = {
  access: AdminAccess
  error: null | string
  groups: AdminDirectoryWorkspaceRecord[]
  teams: AdminDirectoryWorkspaceRecord[]
  user: AdminDirectoryUserRecord | null
}

type AdminOperatorUserDetailBootstrap = {
  access: AdminAccess
  detail: AdminOperatorUserDetail | null
  error: null | string
}

const emptyAccess: AdminAccess = {
  apiMode: 'local-unavailable',
  canAccessAdmin: false,
  ok: false,
  roles: [],
}

const emptySummary: AdminSummaryResource = { ok: false }
const emptyWorkspaces: AdminDirectoryWorkspacesResource = { limit: 100, offset: 0, ok: false, totalCount: 0, workspaces: [] }
const emptyUsers: AdminDirectoryUsersResource = { limit: 100, offset: 0, ok: false, totalCount: 0, users: [] }
const emptyOperatorUsers: AdminOperatorUsersResource = { limit: 100, offset: 0, ok: false, totalCount: 0, users: [] }

export async function loadAdminAccessBootstrap(): Promise<AdminAccess> {
  if (!getApiBaseUrl()) {
    return {
      ...emptyAccess,
      error: 'Admin access requires NEXT_PUBLIC_API_BASE_URL so the web app can reach the server admin contract.',
    }
  }

  try {
    const payload = await loadServerAdminJson<AdminMeResponse>('/api/v1/admin/me')
    return resolveServerAdminAccess(payload)
  } catch (error) {
    return {
      apiMode: 'remote',
      canAccessAdmin: false,
      error: getErrorMessage(error),
      ok: false,
      roles: [],
    }
  }
}

export async function loadAdminPageBootstrap(activeTab: AdminConsoleTab): Promise<AdminPageBootstrap> {
  if (!getApiBaseUrl()) {
    return {
      access: {
        ...emptyAccess,
        error: 'Admin access requires NEXT_PUBLIC_API_BASE_URL so the web app can reach the server admin contract.',
      },
      groups: emptyWorkspaces,
      operatorUsers: emptyOperatorUsers,
      summary: emptySummary,
      teams: emptyWorkspaces,
      users: emptyUsers,
    }
  }

  const needsSummary = activeTab === 'overview'
  const needsUsers = activeTab === 'overview' || activeTab === 'access'
  const needsOperatorUsers = activeTab === 'users'
  const needsTeams = activeTab === 'overview' || activeTab === 'teams' || activeTab === 'finance'
  const needsGroups = activeTab === 'overview' || activeTab === 'groups' || activeTab === 'finance'

  try {
    const payload = await loadServerAdminJson<{
      access: AdminMeResponse
      groups: AdminDirectoryWorkspacesResource
      ok: boolean
      operatorUsers: AdminOperatorUsersResource
      summary: AdminSummaryResource
      teams: AdminDirectoryWorkspacesResource
      users: AdminDirectoryUsersResource
    }>(
      `/api/v1/admin/bootstrap?includeSummary=${needsSummary ? '1' : '0'}&includeUsers=${needsUsers ? '1' : '0'}&includeOperatorUsers=${needsOperatorUsers ? '1' : '0'}&includeTeams=${needsTeams ? '1' : '0'}&includeGroups=${needsGroups ? '1' : '0'}&limit=100`,
    )

    return {
      access: resolveServerAdminAccess(payload.access),
      groups: payload.groups,
      operatorUsers: payload.operatorUsers,
      summary: payload.summary,
      teams: payload.teams,
      users: payload.users,
    }
  } catch (error) {
    return {
      access: {
        apiMode: 'remote',
        canAccessAdmin: false,
        error: getErrorMessage(error),
        ok: false,
        roles: [],
      },
      groups: emptyWorkspaces,
      operatorUsers: emptyOperatorUsers,
      summary: emptySummary,
      teams: emptyWorkspaces,
      users: emptyUsers,
    }
  }
}

export async function loadAdminUserDetailBootstrap(userId: string): Promise<AdminUserDetailBootstrap> {
  if (!getApiBaseUrl()) {
    return {
      access: {
        ...emptyAccess,
        error: 'Admin access requires NEXT_PUBLIC_API_BASE_URL so the web app can reach the server admin contract.',
      },
      error: 'Admin access requires NEXT_PUBLIC_API_BASE_URL so the web app can reach the server admin contract.',
      groups: [],
      teams: [],
      user: null,
    }
  }

  try {
    const payload = await loadServerAdminJson<{
      access: AdminMeResponse
      error?: null | string
      groups: AdminDirectoryWorkspacesResource
      ok: boolean
      teams: AdminDirectoryWorkspacesResource
      user: { ok: boolean; user?: AdminDirectoryUserRecord }
    }>(`/api/v1/admin/bootstrap/users/${encodeURIComponent(userId)}?limit=100`)

    return {
      access: resolveServerAdminAccess(payload.access),
      error: payload.error ?? null,
      groups: payload.groups.workspaces,
      teams: payload.teams.workspaces,
      user: payload.user.user ?? null,
    }
  } catch (error) {
    return {
      access: {
        apiMode: 'remote',
        canAccessAdmin: false,
        error: getErrorMessage(error),
        ok: false,
        roles: [],
      },
      error: getErrorMessage(error),
      groups: [],
      teams: [],
      user: null,
    }
  }
}

export async function loadAdminOperatorUserDetailBootstrap(userId: string): Promise<AdminOperatorUserDetailBootstrap> {
  if (!getApiBaseUrl()) {
    const error = 'Admin access requires NEXT_PUBLIC_API_BASE_URL so the web app can reach the server admin contract.'
    return { access: { ...emptyAccess, error }, detail: null, error }
  }

  try {
    const payload = await loadServerAdminJson<{
      detail?: AdminOperatorUserDetail | null
      error?: null | string
      ok: boolean
    }>(`/api/v1/admin/operator/users/${encodeURIComponent(userId)}`)

    return {
      access: { apiMode: 'remote', canAccessAdmin: payload.ok, ok: payload.ok, roles: [] },
      detail: payload.detail ?? null,
      error: payload.error ?? null,
    }
  } catch (error) {
    return {
      access: {
        apiMode: 'remote',
        canAccessAdmin: false,
        error: getErrorMessage(error),
        ok: false,
        roles: [],
      },
      detail: null,
      error: getErrorMessage(error),
    }
  }
}

function resolveServerAdminAccess(payload: AdminMeResponse): AdminAccess {
  return {
    apiMode: 'remote',
    canAccessAdmin: payload.canAccessAdmin,
    error: payload.error,
    ok: payload.ok,
    roles: payload.roles ?? [],
    userId: payload.userId,
  }
}

async function loadServerAdminJson<T>(path: string): Promise<T> {
  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) throw new Error('Admin API is not configured.')
  const headers = await buildServerAdminHeaders()
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: 'no-store',
    headers,
  })
  const payload = await readServerAdminPayload<T>(response)
  if (!response.ok) throw new Error(payload.error || formatServerAdminErrorDetail(payload.detail) || 'Admin resource lookup failed.')
  return payload
}

async function buildServerAdminHeaders() {
  return buildServerClerkApiHeaders()
}

function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Admin resource lookup failed.'
}

async function readServerAdminPayload<T>(response: Response): Promise<T & { detail?: unknown; error?: string }> {
  const text = await response.text()
  if (!text) return {} as T & { detail?: unknown; error?: string }
  try {
    return JSON.parse(text) as T & { detail?: unknown; error?: string }
  } catch {
    return { error: text } as T & { detail?: unknown; error?: string }
  }
}

function formatServerAdminErrorDetail(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim()
  }
  if (!detail || typeof detail !== 'object') {
    return null
  }
  const record = detail as { blockers?: Array<{ code?: string; message?: string; workspaceName?: string }>; message?: string }
  const message = typeof record.message === 'string' && record.message.trim() ? record.message.trim() : null
  const blockerLabels = Array.isArray(record.blockers)
    ? record.blockers
      .map((blocker) => {
        if (typeof blocker?.message === 'string' && blocker.message.trim()) return blocker.message.trim()
        if (typeof blocker?.workspaceName === 'string' && blocker.workspaceName.trim()) return blocker.workspaceName.trim()
        if (typeof blocker?.code === 'string' && blocker.code.trim()) return blocker.code.trim().replaceAll('_', ' ')
        return null
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 3)
    : []
  if (!message && blockerLabels.length === 0) {
    return null
  }
  if (blockerLabels.length === 0) {
    return message
  }
  return `${message ?? 'Action is blocked.'} ${blockerLabels.join(' · ')}`
}
