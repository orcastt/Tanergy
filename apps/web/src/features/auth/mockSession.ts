export type MockWorkspace = {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  boardCount: number
}

export type MockUser = {
  id: string
  displayName: string
  email: string
  emailVerified: boolean
  avatarInitials: string
}

export const mockUser: MockUser = {
  id: 'dev-user',
  displayName: 'Dev User',
  email: 'dev@tangent.local',
  emailVerified: false,
  avatarInitials: 'DU',
}

export const mockWorkspaces: MockWorkspace[] = [
  {
    id: 'dev-workspace',
    name: 'Personal workspace',
    role: 'owner',
    boardCount: 1,
  },
]

export const mockSession = {
  user: mockUser,
  activeWorkspace: mockWorkspaces[0],
  workspaces: mockWorkspaces,
}
