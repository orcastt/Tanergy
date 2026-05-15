import type { TangentSession, TangentUser, TangentWorkspace } from './sessionTypes'

export const mockUser: TangentUser = {
  id: 'dev-user',
  displayName: 'Dev User',
  email: 'dev@tangent.local',
  emailVerified: false,
  avatarInitials: 'DU',
  profileCompleted: true,
}

export const mockWorkspaces: TangentWorkspace[] = [
  {
    id: 'private-studio',
    kind: 'solo_workspace',
    name: 'Private',
    planKey: 'free_canvas',
    role: 'owner',
    boardCount: 3,
  },
  {
    id: 'atlas-team-growth',
    kind: 'team_workspace',
    name: 'Atlas Team',
    planKey: 'team_growth',
    role: 'owner',
    boardCount: 6,
  },
  {
    id: 'north-team-start',
    kind: 'team_workspace',
    name: 'North Team',
    planKey: 'team_start',
    role: 'admin',
    boardCount: 4,
  },
  {
    id: 'pixel-group-plus',
    kind: 'group_workspace',
    name: 'Pixel Group',
    planKey: 'collaborate_plus',
    role: 'owner',
    boardCount: 3,
  },
  {
    id: 'studio-group-start',
    kind: 'group_workspace',
    name: 'Studio Group',
    planKey: 'collaborate_start',
    role: 'member',
    boardCount: 2,
  },
]

export const mockSession: TangentSession = {
  authMode: 'dev',
  isDevFallback: true,
  user: mockUser,
  activeWorkspace: mockWorkspaces[1],
  workspaces: mockWorkspaces,
}

const loadingWorkspace: TangentWorkspace = {
  boardCount: 0,
  id: 'loading-workspace',
  kind: 'solo_workspace',
  name: 'Loading workspace',
  role: 'viewer',
}

export function getCurrentSessionSnapshot() {
  return mockSession
}

export function createLoadingSessionSnapshot(): TangentSession {
  return {
    activeWorkspace: loadingWorkspace,
    authMode: 'dev',
    isDevFallback: false,
    user: {
      avatarInitials: '...',
      displayName: 'Loading',
      email: '',
      emailVerified: false,
      id: 'loading-user',
      profileCompleted: true,
    },
    workspaces: [],
  }
}

export function getSessionRequestHeaders(workspace: TangentWorkspace = mockSession.activeWorkspace): Record<string, string> {
  const headers = {
    'x-tangent-user-id': mockSession.user.id,
    'x-tangent-workspace-kind': workspace.kind,
    'x-tangent-workspace-id': workspace.id,
    'x-tangent-workspace-name': workspace.name,
    'x-tangent-workspace-role': workspace.role,
  }
  if (workspace.planKey) {
    return { ...headers, 'x-tangent-plan-key': workspace.planKey }
  }
  return headers
}
