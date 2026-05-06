import type { WorkspaceKind } from '@/features/billing/billingTypes'

export type WorkspaceRole = 'admin' | 'guest' | 'member' | 'owner'

export type TangentUser = {
  avatarInitials: string
  displayName: string
  email: string
  emailVerified: boolean
  id: string
}

export type TangentWorkspace = {
  boardCount: number
  id: string
  kind: WorkspaceKind
  name: string
  role: WorkspaceRole
}

export type TangentSession = {
  activeWorkspace: TangentWorkspace
  authMode: 'dev' | 'required'
  isDevFallback: boolean
  user: TangentUser
  workspaces: TangentWorkspace[]
}

export type AuthSessionResponse = {
  error?: string
  ok: boolean
  session?: TangentSession
}
