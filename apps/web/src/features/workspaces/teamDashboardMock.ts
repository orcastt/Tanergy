import type { PlanKey } from '@/features/billing/billingTypes'
import type { BoardCardColor } from '@/features/boards/boardTypes'
import {
  formatWorkspacePlanName,
  getWorkspaceDirectoryItems,
  type WorkspaceMembershipRole,
} from './workspaceDirectoryMock'

export type TeamDashboardBoard = {
  cardColor: BoardCardColor
  id: string
  title: string
}

export type TeamDashboardMember = {
  boardAssignments: number
  id: string
  initials: string
  role: WorkspaceMembershipRole
  usageCredits: number
}

export type TeamDashboardRecord = {
  boards: TeamDashboardBoard[]
  id: string
  inviteCode: string
  memberUsageLimit: number
  members: TeamDashboardMember[]
  name: string
  planKey: PlanKey
  seatLimit: number
  seatsUsed: number
  totalCreditsRemaining: number
}

export function getTeamDashboardRecord(teamId: string): TeamDashboardRecord | null {
  const directoryItem = getWorkspaceDirectoryItems('team_workspace').find((item) => item.id === teamId)
  if (!directoryItem) return null

  const seatsUsed = Math.max(4, Math.min(9, directoryItem.memberInitials.length + 2))
  const seatLimit = directoryItem.planKey === 'team_growth' ? 15 : 12
  const totalCreditsRemaining = directoryItem.planKey === 'team_growth' ? 5352 : 2460
  const memberUsageLimit = directoryItem.planKey === 'team_growth' ? 1400 : 900

  return {
    boards: createBoards(directoryItem.name, Math.max(6, directoryItem.boardCount)),
    id: directoryItem.id,
    inviteCode: `${directoryItem.id.replace(/[^a-z0-9]+/gi, '').slice(0, 12).toLowerCase()}-invite`,
    memberUsageLimit,
    members: createMembers(directoryItem.memberInitials, directoryItem.membershipRole),
    name: directoryItem.name,
    planKey: directoryItem.planKey,
    seatLimit,
    seatsUsed,
    totalCreditsRemaining,
  }
}

export function getTeamPlanLabel(planKey: PlanKey) {
  return formatWorkspacePlanName(planKey)
}

function createBoards(teamName: string, count: number): TeamDashboardBoard[] {
  return Array.from({ length: count }, (_, index) => ({
    cardColor: 'yellow',
    id: `${teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-board-${index + 1}`,
    title: `Board ${index + 1}`,
  }))
}

function createMembers(initials: string[], ownerRole: WorkspaceMembershipRole) {
  const roles: WorkspaceMembershipRole[] = [ownerRole, 'admin', 'editor', 'viewer', 'viewer', 'editor']
  const baseUsage = [1120, 920, 760, 640, 420, 310]
  return Array.from({ length: Math.max(5, initials.length + 1) }, (_, index) => ({
    boardAssignments: Math.max(1, 4 - Math.min(index, 3)),
    id: `member-${index + 1}`,
    initials: initials[index] ?? String.fromCharCode(65 + index),
    role: roles[index] ?? 'viewer',
    usageCredits: baseUsage[index] ?? 220,
  }))
}
