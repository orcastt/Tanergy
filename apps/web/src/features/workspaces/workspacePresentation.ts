import type { PlanKey, WorkspaceKind } from '@/features/billing/billingTypes'
import {
  type CanonicalWorkspaceRole,
  normalizeCanonicalWorkspaceRole,
  type WorkspaceRole,
} from '@/features/auth/sessionTypes'

export type WorkspaceMembershipRole = CanonicalWorkspaceRole
export type WorkspaceRelationship = 'created' | 'joined'

export type WorkspaceDirectoryItem = {
  boardCount: number
  currentPeriodEnd?: null | string
  href?: null | string
  id: string
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>
  memberCount: number
  memberInitials: string[]
  membershipRole: WorkspaceMembershipRole
  name: string
  planKey: PlanKey
  remainingCredits?: number
  relationship: WorkspaceRelationship
  totalCredits?: number
  usedThisCycle?: number
}

export function formatWorkspaceMembershipRole(value: WorkspaceMembershipRole) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatWorkspacePlanName(planKey: PlanKey) {
  return planKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function normalizeWorkspaceMembershipRole(role: WorkspaceRole | string): WorkspaceMembershipRole {
  return normalizeCanonicalWorkspaceRole(role)
}

export function workspaceRelationshipFromRole(role: WorkspaceRole | string): WorkspaceRelationship {
  return role === 'owner' ? 'created' : 'joined'
}
