const adminId = '[A-Za-z0-9._~-]+'

const adminProxyRoutes: Record<string, RegExp[]> = {
  DELETE: [
    new RegExp(`^roles/${adminId}/${adminId}$`),
    new RegExp(`^operator/workspaces/${adminId}/boards/${adminId}$`),
    new RegExp(`^operator/workspaces/${adminId}/invitations/${adminId}$`),
    new RegExp(`^operator/workspaces/${adminId}/members/${adminId}$`),
  ],
  GET: [
    /^ai\/api-calls$/,
    /^ai\/models$/,
    /^ai\/pricing-rules$/,
    /^ai\/provider-routes$/,
    /^ai\/route-metrics$/,
    /^ai\/runs$/,
    /^ai\/versions$/,
    /^audit-logs$/,
    /^boards$/,
    /^directory\/users$/,
    new RegExp(`^directory/users/${adminId}$`),
    /^directory\/workspaces$/,
    new RegExp(`^directory/workspaces/${adminId}$`),
    /^finance\/credit-ledger$/,
    /^finance\/member-usage$/,
    /^finance\/payments$/,
    /^finance\/plan-catalog$/,
    /^finance\/subscriptions$/,
    /^finance\/summary$/,
    /^finance\/wallets$/,
    /^me$/,
    /^operator\/users$/,
    new RegExp(`^operator/users/${adminId}$`),
    new RegExp(`^operator/workspaces/${adminId}/invitations$`),
    /^roles$/,
    /^summary$/,
    /^users$/,
    new RegExp(`^users/${adminId}$`),
    /^workspaces$/,
  ],
  PATCH: [
    new RegExp(`^ai/models/${adminId}$`),
    new RegExp(`^ai/pricing-rules/${adminId}$`),
    new RegExp(`^ai/provider-routes/${adminId}$`),
    new RegExp(`^operator/workspaces/${adminId}/members/${adminId}$`),
  ],
  POST: [
    new RegExp(`^ai/models/${adminId}/publish$`),
    new RegExp(`^ai/models/${adminId}/rollback/${adminId}$`),
    new RegExp(`^ai/pricing-rules/${adminId}/publish$`),
    new RegExp(`^ai/pricing-rules/${adminId}/rollback/${adminId}$`),
    new RegExp(`^ai/provider-routes/${adminId}/publish$`),
    new RegExp(`^ai/provider-routes/${adminId}/rollback/${adminId}$`),
    /^finance\/manual\/collaborate-plan$/,
    /^finance\/manual\/group-plan-operation$/,
    /^finance\/manual\/group-workspace$/,
    /^finance\/manual\/subscription-cancel$/,
    /^finance\/manual\/team-plan$/,
    /^finance\/manual\/team-plan-operation$/,
    /^finance\/manual\/team-workspace$/,
    /^finance\/manual\/user-credit-adjust$/,
    /^finance\/manual\/user-topup$/,
    /^finance\/manual\/workspace-credit-adjust$/,
    /^finance\/manual\/workspace-delete$/,
    /^finance\/manual\/workspace-topup$/,
    new RegExp(`^operator/subscriptions/${adminId}/freeze$`),
    new RegExp(`^operator/subscriptions/${adminId}/unfreeze$`),
    new RegExp(`^operator/users/${adminId}/delete$`),
    new RegExp(`^operator/users/${adminId}/status$`),
    new RegExp(`^operator/workspaces/${adminId}/boards/${adminId}/copy$`),
    new RegExp(`^operator/workspaces/${adminId}/invitations$`),
    new RegExp(`^operator/workspaces/${adminId}/members$`),
    /^roles$/,
  ],
  PUT: [
    new RegExp(`^finance/plan-catalog/${adminId}$`),
  ],
}

const safeSegment = /^[A-Za-z0-9._~-]+$/

export type AdminProxyPathResult =
  | { ok: true; path: string }
  | { error: string; ok: false; status: number }

export function resolveAdminProxyPath(method: string, path: string[]): AdminProxyPathResult {
  const normalizedMethod = method.toUpperCase()
  const routePatterns = adminProxyRoutes[normalizedMethod]
  if (!routePatterns) return { error: 'Admin proxy method is not allowed.', ok: false, status: 405 }
  if (!path.length || !path.every(isSafeSegment)) {
    return { error: 'Admin proxy path is not allowed.', ok: false, status: 404 }
  }

  const normalizedPath = path.join('/')
  if (!routePatterns.some((pattern) => pattern.test(normalizedPath))) {
    return { error: 'Admin proxy path is not allowed.', ok: false, status: 404 }
  }

  return {
    ok: true,
    path: `/${path.map((segment) => encodeURIComponent(segment)).join('/')}`,
  }
}

function isSafeSegment(segment: string) {
  if (!segment || segment === '.' || segment === '..') return false
  return safeSegment.test(segment)
}
