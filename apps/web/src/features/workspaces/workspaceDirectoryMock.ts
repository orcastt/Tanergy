import type { PlanKey, WorkspaceKind } from '@/features/billing/billingTypes'

export type WorkspaceMembershipRole = 'admin' | 'editor' | 'owner' | 'viewer'
export type WorkspaceRelationship = 'created' | 'joined'

export type WorkspaceDirectoryItem = {
  boardCount: number
  href?: string | null
  id: string
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>
  memberInitials: string[]
  membershipRole: WorkspaceMembershipRole
  name: string
  planKey: PlanKey
  relationship: WorkspaceRelationship
}

const teamDirectoryItems: WorkspaceDirectoryItem[] = [
  {
    boardCount: 14,
    id: 'atlas-team-growth',
    kind: 'team_workspace',
    memberInitials: ['B', 'A', 'J', 'T'],
    membershipRole: 'owner',
    name: 'Atlas Team',
    planKey: 'team_growth',
    relationship: 'created',
  },
  {
    boardCount: 9,
    id: 'north-team-start',
    kind: 'team_workspace',
    memberInitials: ['N', 'R', 'L', 'T'],
    membershipRole: 'owner',
    name: 'North Team',
    planKey: 'team_start',
    relationship: 'created',
  },
  {
    boardCount: 12,
    id: 'tt-team-growth',
    kind: 'team_workspace',
    memberInitials: ['T', 'A', 'J', 'T'],
    membershipRole: 'admin',
    name: 'TT Team',
    planKey: 'team_growth',
    relationship: 'joined',
  },
  {
    boardCount: 8,
    id: 'bani-team-start',
    kind: 'team_workspace',
    memberInitials: ['B', 'A', 'J', 'T'],
    membershipRole: 'admin',
    name: 'Bani Team',
    planKey: 'team_start',
    relationship: 'joined',
  },
  {
    boardCount: 6,
    id: 'jony-team-start',
    kind: 'team_workspace',
    memberInitials: ['J', 'A', 'T', 'L'],
    membershipRole: 'editor',
    name: "Jony's Team",
    planKey: 'team_start',
    relationship: 'joined',
  },
  {
    boardCount: 5,
    id: 'noah-team-growth',
    kind: 'team_workspace',
    memberInitials: ['N', 'A', 'T', 'R'],
    membershipRole: 'viewer',
    name: 'Noah Team',
    planKey: 'team_growth',
    relationship: 'joined',
  },
  {
    boardCount: 4,
    id: 'ddd-team-start',
    kind: 'team_workspace',
    memberInitials: ['D', 'A', 'J', 'T'],
    membershipRole: 'viewer',
    name: 'DDD Team',
    planKey: 'team_start',
    relationship: 'joined',
  },
]

const groupDirectoryItems: WorkspaceDirectoryItem[] = [
  {
    boardCount: 10,
    id: 'pixel-group-plus',
    kind: 'group_workspace',
    memberInitials: ['B', 'A', 'J', 'T'],
    membershipRole: 'owner',
    name: 'Pixel Group',
    planKey: 'collaborate_plus',
    relationship: 'created',
  },
  {
    boardCount: 7,
    id: 'studio-group-start',
    kind: 'group_workspace',
    memberInitials: ['S', 'A', 'J', 'T'],
    membershipRole: 'owner',
    name: 'Studio Group',
    planKey: 'collaborate_start',
    relationship: 'created',
  },
  {
    boardCount: 9,
    id: 'bb-group-start',
    kind: 'group_workspace',
    memberInitials: ['B', 'A', 'J', 'T'],
    membershipRole: 'admin',
    name: 'BB Group',
    planKey: 'collaborate_start',
    relationship: 'joined',
  },
  {
    boardCount: 8,
    id: 'barry-group-plus',
    kind: 'group_workspace',
    memberInitials: ['B', 'A', 'J', 'T'],
    membershipRole: 'admin',
    name: 'Barry Group',
    planKey: 'collaborate_plus',
    relationship: 'joined',
  },
  {
    boardCount: 6,
    id: 'jenny-group-start',
    kind: 'group_workspace',
    memberInitials: ['J', 'A', 'T', 'L'],
    membershipRole: 'editor',
    name: 'Jenny Group',
    planKey: 'collaborate_start',
    relationship: 'joined',
  },
  {
    boardCount: 5,
    id: 'rc1-group-plus',
    kind: 'group_workspace',
    memberInitials: ['R', 'A', 'J', 'T'],
    membershipRole: 'viewer',
    name: 'RC1 Group',
    planKey: 'collaborate_plus',
    relationship: 'joined',
  },
  {
    boardCount: 4,
    id: 'rc2-group-start',
    kind: 'group_workspace',
    memberInitials: ['R', 'A', 'J', 'T'],
    membershipRole: 'viewer',
    name: 'RC2 Group',
    planKey: 'collaborate_start',
    relationship: 'joined',
  },
]

export function getWorkspaceDirectoryItems(kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>) {
  return kind === 'team_workspace' ? teamDirectoryItems : groupDirectoryItems
}

export function formatWorkspaceMembershipRole(value: WorkspaceMembershipRole) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatWorkspacePlanName(planKey: PlanKey) {
  return planKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
