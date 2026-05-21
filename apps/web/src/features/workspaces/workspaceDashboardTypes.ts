import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import type { PlanKey } from '@/features/billing/billingTypes'
import type { GroupPersonalPlanKey } from './groupPersonalPlanSupport'
import type { WorkspaceMembershipRole } from './workspacePresentation'

export type WorkspaceDashboardBoard = BoardPersistenceSummary

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
  currentPeriodStart?: null | string
  currentPeriodEnd?: null | string
  id: string
  includedCredits: number
  inviteCode: string
  memberUsageLimit: number
  memberCount: number
  members: WorkspaceDashboardMember[]
  name: string
  nextRefreshAt?: null | string
  planKey: Extract<PlanKey, 'team_growth' | 'team_start'>
  planName: string
  seatLimit: number
  seatMax?: null | number
  seatMin?: null | number
  seatsUsed: number
  topUpBalance: number
  totalCredits: number
  totalCreditsRemaining: number
}

export type GroupWorkspaceDashboardRecord = {
  boards: WorkspaceDashboardBoard[]
  boardLimit?: null | number
  currentPeriodStart?: null | string
  currentPeriodEnd?: null | string
  id: string
  includedCredits: number
  memberCount: number
  members: WorkspaceDashboardMember[]
  name: string
  nextRefreshAt?: null | string
  pageLimit?: null | number
  planKey: GroupPersonalPlanKey
  planName: string
  topUpBalance: number
  totalCredits: number
  totalCreditsRemaining: number
}
