import type { TangentSession, TangentUser, TangentWorkspace } from './sessionTypes'

export const mockUser: TangentUser = {
  id: 'dev-user',
  displayName: 'Dev User',
  email: 'dev@tangent.local',
  emailVerified: false,
  avatarInitials: 'DU',
}

export const mockWorkspaces: TangentWorkspace[] = [
  {
    id: 'dev-workspace',
    kind: 'team_workspace',
    name: 'Tanergy Team',
    planKey: 'team_start',
    role: 'owner',
    boardCount: 1,
  },
]

export const mockSession: TangentSession = {
  authMode: 'dev',
  isDevFallback: true,
  user: mockUser,
  activeWorkspace: mockWorkspaces[0],
  workspaces: mockWorkspaces,
}

export function getCurrentSessionSnapshot() {
  return mockSession
}

export function getSessionRequestHeaders(): Record<string, string> {
  const headers = {
    'x-tangent-user-id': mockSession.user.id,
    'x-tangent-workspace-kind': mockSession.activeWorkspace.kind,
    'x-tangent-workspace-id': mockSession.activeWorkspace.id,
  }
  if (mockSession.activeWorkspace.planKey) {
    return { ...headers, 'x-tangent-plan-key': mockSession.activeWorkspace.planKey }
  }
  return headers
}
