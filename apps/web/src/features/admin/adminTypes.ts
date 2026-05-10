export type AdminRoleRecord = {
  createdAt: string
  grantedBy?: null | string
  note?: null | string
  permissions: Record<string, unknown>
  role: string
}

export type AdminSummaryRecord = {
  adminUserCount: number
  boardsCount: number
  usersCount: number
  workspacesCount: number
}

export type AdminUserRecord = {
  createdAt: string
  displayName: string
  email: string
  id: string
  lastLoginAt?: null | string
  locale: string
  status: string
}

export type AdminWorkspaceRecord = {
  createdAt?: null | string
  id: string
  kind?: string
  name: string
  ownerId?: null | string
  status: string
}

export type AdminBoardRecord = {
  id: string
  ownerId: string
  savedAt: string
  title: string
  visibility: string
  workspaceId: string
}

export type AdminAuditLogRecord = {
  action: string
  actorUserId?: null | string
  createdAt: string
  id: string
  metadata: Record<string, unknown>
  targetUserId?: null | string
  workspaceId?: null | string
}

export type AdminAccess = {
  apiMode: 'local-unavailable' | 'remote'
  canAccessAdmin: boolean
  error?: string
  ok: boolean
  roles: AdminRoleRecord[]
  userId?: string
}

export type AdminSummaryResource = { error?: string; ok: boolean; summary?: AdminSummaryRecord }
export type AdminUsersResource = { error?: string; ok: boolean; users: AdminUserRecord[] }
export type AdminWorkspacesResource = { error?: string; ok: boolean; workspaces: AdminWorkspaceRecord[] }
export type AdminBoardsResource = { boards: AdminBoardRecord[]; error?: string; ok: boolean }
export type AdminAuditLogsResource = { error?: string; logs: AdminAuditLogRecord[]; ok: boolean }
export type AdminRoleListResource = { error?: string; ok: boolean; roles: AdminRoleRecord[]; userId: string }
export type AdminRoleMutationResource = {
  auditId?: null | string
  error?: string
  ok: boolean
  role?: AdminRoleRecord
  userId: string
}

export type AdminDirectoryUserRecord = {
  collaboratePeriodEnd?: null | string
  collaboratePlanKey?: null | string
  collaboratePlanStatus?: null | string
  collaborateSubscriptionId?: null | string
  createdAt: string
  displayName: string
  email: string
  groupCount: number
  id: string
  lastLoginAt?: null | string
  locale: string
  ownedBoardCount: number
  personalCreditsSpent: number
  personalWalletCredits: number
  status: string
  teamCount: number
  teamCreditsSpent: number
  teamPeriodEnd?: null | string
  teamPlanKey?: null | string
  teamPlanStatus?: null | string
  teamSubscriptionId?: null | string
  totalCreditsSpent: number
}

export type AdminDirectoryWorkspaceRecord = {
  boardCount: number
  createdAt: string
  id: string
  kind: string
  memberCount: number
  name: string
  ownerCollaboratePlanKey?: null | string
  ownerCollaborateSubscriptionId?: null | string
  ownerDisplayName: string
  ownerEmail: string
  ownerId?: null | string
  planKey?: null | string
  planStatus?: null | string
  seatCapacity: number
  status: string
  subscriptionPeriodEnd?: null | string
  subscriptionId?: null | string
  usageCredits: number
  walletCredits: number
}

export type AdminDirectoryWorkspaceMemberRecord = {
  chargeCount: number
  displayName: string
  email?: null | string
  joinedAt?: null | string
  lastUsageAt?: null | string
  role: string
  usageCredits: number
  userId: string
}

export type AdminDirectoryBoardRecord = {
  id: string
  ownerId: string
  savedAt: string
  title: string
  visibility: string
}

export type AdminDirectoryUsersResource = {
  error?: string
  limit: number
  offset: number
  ok: boolean
  totalCount: number
  users: AdminDirectoryUserRecord[]
}

export type AdminDirectoryUserResource = { error?: string; ok: boolean; user?: AdminDirectoryUserRecord }
export type AdminDirectoryWorkspacesResource = {
  error?: string
  limit: number
  offset: number
  ok: boolean
  totalCount: number
  workspaces: AdminDirectoryWorkspaceRecord[]
}
export type AdminDirectoryWorkspaceDetailResource = {
  boards: AdminDirectoryBoardRecord[]
  error?: string
  members: AdminDirectoryWorkspaceMemberRecord[]
  ok: boolean
  workspace?: AdminDirectoryWorkspaceRecord
}

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
import type { WorkspaceInvitationRecord } from '@/features/billing/billingTypes'
