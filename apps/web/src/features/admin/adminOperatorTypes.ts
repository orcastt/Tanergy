import type { WorkspaceInvitationRecord } from '@/features/billing/billingTypes'

export type AdminOperatorCreditSummary = {
  remainingCredits: number
  spentCredits: number
  totalCredits: number
}

export type AdminOperatorMemberSummary = {
  displayName: string
  email?: null | string
  role: string
  usageCredits: number
  userId: string
}

export type AdminOperatorBoardSummary = {
  id: string
  title: string
  visibility: string
}

export type AdminOperatorWorkspacePlan = {
  boardCount: number
  boards: AdminOperatorBoardSummary[]
  createdAt: string
  credit: AdminOperatorCreditSummary
  id: string
  invitations: WorkspaceInvitationRecord[]
  kind: string
  memberCount: number
  members: AdminOperatorMemberSummary[]
  ownerEmail?: null | string
  ownerId?: null | string
  periodEnd?: null | string
  periodStart?: null | string
  planKey?: null | string
  planStatus?: null | string
  role?: null | string
  seatCapacity: number
  subscriptionId?: null | string
  usageByUser: number
  workspaceName: string
}

export type AdminOperatorUserPlan = {
  periodEnd?: null | string
  periodStart?: null | string
  planKey: string
  status: string
  subscriptionId: string
}

export type AdminOperatorUserRecord = {
  createdAt: string
  displayName: string
  email: string
  groupPlansActive: AdminOperatorUserPlan[]
  groupPlansExpired: AdminOperatorUserPlan[]
  id: string
  ipAddress?: null | string
  lastLoginAt?: null | string
  ownedGroupCount: number
  ownedTeamCount: number
  personalCredit: AdminOperatorCreditSummary
  registrationState: string
  status: string
  teamPlansActive: AdminOperatorWorkspacePlan[]
  teamPlansExpired: AdminOperatorWorkspacePlan[]
  totalCreditsSpent: number
}

export type AdminOperatorBillingHistoryRow = {
  amountCents?: null | number
  createdAt: string
  id: string
  item: string
  metadata: Record<string, unknown>
  personalCreditsDelta: number
  reason?: null | string
  teamCreditsDelta: number
  workspaceId?: null | string
}

export type AdminOperatorUserDetail = {
  billingHistory: AdminOperatorBillingHistoryRow[]
  groupPlansActive: AdminOperatorUserPlan[]
  groupPlansExpired: AdminOperatorUserPlan[]
  joinedGroups: AdminOperatorWorkspacePlan[]
  joinedTeams: AdminOperatorWorkspacePlan[]
  ownedGroups: AdminOperatorWorkspacePlan[]
  ownedTeams: AdminOperatorWorkspacePlan[]
  user: AdminOperatorUserRecord
}

export type AdminOperatorUsersResource = {
  error?: string
  limit: number
  offset: number
  ok: boolean
  totalCount: number
  users: AdminOperatorUserRecord[]
}

export type AdminOperatorUserDetailResource = {
  detail?: AdminOperatorUserDetail | null
  error?: string
  ok: boolean
}

export type AdminOperatorUserMutationResource = {
  auditId?: null | string
  message: string
  ok: boolean
  status: string
  userId: string
  warning?: null | string
}

export type AdminOperatorSubscriptionMutationResource = {
  auditId?: null | string
  message: string
  ok: boolean
  status: string
  subscriptionId: string
  userId?: null | string
  workspaceId?: null | string
}

export type AdminOperatorWorkspaceMemberMutationResource = {
  auditId?: null | string
  message: string
  ok: boolean
  role?: null | string
  userId: string
  workspaceId: string
}

export type AdminOperatorWorkspaceInvitationCreateResource = {
  acceptPath: string
  auditId?: null | string
  invitation: WorkspaceInvitationRecord
  message: string
  ok: boolean
  token: string
  workspaceId: string
}

export type AdminOperatorWorkspaceInvitationResource = {
  auditId?: null | string
  invitation: WorkspaceInvitationRecord
  message: string
  ok: boolean
  workspaceId: string
}

export type AdminOperatorWorkspaceInvitationsResource = {
  invitations: WorkspaceInvitationRecord[]
  ok: boolean
  workspaceId: string
}

export type AdminOperatorBoardMutationResource = {
  auditId?: null | string
  board?: null | {
    id: string
    title: string
    visibility: string
    workspaceId: string
  }
  boardId: string
  message: string
  ok: boolean
  workspaceId: string
}
