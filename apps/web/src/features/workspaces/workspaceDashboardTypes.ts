import type { BoardCardColor } from '@/features/boards/boardTypes'
import type { PlanKey } from '@/features/billing/billingTypes'
import type { WorkspaceMembershipRole } from './workspacePresentation'

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
