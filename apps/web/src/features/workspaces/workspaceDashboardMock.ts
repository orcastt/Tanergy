import type { BoardCardColor } from '@/features/boards/boardTypes'
import type { PlanKey } from '@/features/billing/billingTypes'
import { planCatalog } from '@/features/billing/billingContracts'
import {
  getWorkspaceDirectoryItems,
  type WorkspaceMembershipRole,
} from './workspaceDirectoryMock'

export type WorkspaceDashboardBoard = {
  cardColor: BoardCardColor
  id: string
  title: string
}

export type WorkspaceDashboardMember = {
  boardAssignments: number
  displayName?: string
  email?: null | string
  id: string
  initials: string
  role: WorkspaceMembershipRole
  usageCredits?: number
}

export type TeamWorkspaceDashboardRecord = {
  boards: WorkspaceDashboardBoard[]
  id: string
  inviteCode: string
  memberUsageLimit: number
  members: WorkspaceDashboardMember[]
  name: string
  planKey: Extract<PlanKey, 'team_growth' | 'team_start'>
  seatLimit: number
  seatsUsed: number
  totalCredits: number
  totalCreditsRemaining: number
}

export type WorkspaceDashboardAction = {
  href: string
  label: string
}

export type GroupWorkspaceDashboardRecord = {
  actions: WorkspaceDashboardAction[]
  boards: WorkspaceDashboardBoard[]
  totalCredits: number
  totalCreditsRemaining: number
  id: string
  members: WorkspaceDashboardMember[]
  name: string
  planKey: Extract<PlanKey, 'collaborate_plus' | 'collaborate_start'>
}

export function getTeamWorkspaceDashboardRecord(teamId: string): TeamWorkspaceDashboardRecord | null {
  const directoryItem = getWorkspaceDirectoryItems('team_workspace').find((item) => item.id === teamId)
  if (!directoryItem) return null

  const planKey = directoryItem.planKey as Extract<PlanKey, 'team_growth' | 'team_start'>
  const totalCredits = planKey === 'team_growth' ? 5500 : 2500
  const seatLimit = planKey === 'team_growth' ? 15 : 10
  const seatsUsed = Math.max(4, Math.min(seatLimit, directoryItem.memberInitials.length + 2))
  const totalCreditsRemaining = Math.max(380, totalCredits - 148)
  const memberUsageLimit = planKey === 'team_growth' ? 1400 : 900

  return {
    boards: createBoards(directoryItem.name, Math.max(9, directoryItem.boardCount), 'yellow'),
    id: directoryItem.id,
    inviteCode: `${directoryItem.id.replace(/[^a-z0-9]+/gi, '').slice(0, 12).toLowerCase()}-invite`,
    memberUsageLimit,
    members: createMembers(directoryItem.memberInitials, directoryItem.membershipRole, true),
    name: directoryItem.name,
    planKey,
    seatLimit,
    seatsUsed,
    totalCredits,
    totalCreditsRemaining,
  }
}

export function getGroupWorkspaceDashboardRecord(groupId: string): GroupWorkspaceDashboardRecord | null {
  const directoryItem = getWorkspaceDirectoryItems('group_workspace').find((item) => item.id === groupId)
  if (!directoryItem) return null

  const planKey = directoryItem.planKey as Extract<PlanKey, 'collaborate_plus' | 'collaborate_start'>
  const totalCredits = planCatalog[planKey].includedCredits

  return {
    actions: [
      { href: '/usage?scope=group', label: 'Open usage' },
      { href: '/billing', label: 'Subscription' },
      { href: '/group', label: 'All groups' },
      { href: '/workspaces', label: 'Boards' },
    ],
    boards: createBoards(directoryItem.name, Math.max(12, directoryItem.boardCount), 'peach'),
    totalCredits,
    totalCreditsRemaining: Math.max(280, totalCredits - 392),
    id: directoryItem.id,
    members: createMembers(directoryItem.memberInitials, directoryItem.membershipRole, false),
    name: directoryItem.name,
    planKey,
  }
}

function createBoards(name: string, count: number, cardColor: BoardCardColor): WorkspaceDashboardBoard[] {
  return Array.from({ length: count }, (_, index) => ({
    cardColor,
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-board-${index + 1}`,
    title: `Board ${index + 1}`,
  }))
}

function createMembers(
  initials: string[],
  ownerRole: WorkspaceMembershipRole,
  includeUsage: boolean,
): WorkspaceDashboardMember[] {
  const roles: WorkspaceMembershipRole[] = [ownerRole, 'admin', 'editor', 'viewer', 'viewer', 'editor']
  const baseUsage = [1120, 920, 760, 640, 420, 310]
  return Array.from({ length: Math.max(5, initials.length + 1) }, (_, index) => ({
    boardAssignments: Math.max(1, 4 - Math.min(index, 3)),
    id: `member-${index + 1}`,
    initials: initials[index] ?? String.fromCharCode(65 + index),
    role: roles[index] ?? 'viewer',
    usageCredits: includeUsage ? (baseUsage[index] ?? 220) : undefined,
  }))
}
