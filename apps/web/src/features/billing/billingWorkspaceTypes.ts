import type { BillingInterval, ChargeScope, PersonalCreditSummary, PlanKey, WorkspaceKind, WorkspacePlanSummary } from './billingPlanTypes'

export type BillingWorkspaceSummary = {
  id: string
  kind: WorkspaceKind
  name: string
  role: string
}

export type AiRunChargeSummary = {
  chargedAccountId: string
  chargedScope: ChargeScope
  entitlementSource: string
  payerLabel: string
  planKey: PlanKey
  preflightStatus: string
  workspaceKind: WorkspaceKind
  workspaceSeatId?: null | string
}

export type BillingMeResponse = {
  billingInterval?: BillingInterval | null
  chargeScope: ChargeScope
  credits: PersonalCreditSummary
  currentPeriodStart?: null | string
  currentPeriodEnd?: null | string
  error?: string
  nextRefreshAt?: null | string
  ok: boolean
  payerLabel: string
  plan: WorkspacePlanSummary
  workspace: BillingWorkspaceSummary
}

export type WorkspaceDashboardMember = {
  displayName: string
  email?: null | string
  invitedBy?: null | string
  joinedAt?: null | string
  role: string
  usageThisCycle?: null | number
  userId: string
}

export type WorkspaceDashboardRecord = {
  boardCount: number
  canSeeMemberUsage: boolean
  dashboardKind: 'group_structure' | 'team_usage'
  memberCount: number
  members: WorkspaceDashboardMember[]
  totalUsageThisCycle?: null | number
  workspace: BillingWorkspaceSummary
}

export type WorkspaceDashboardResponse = {
  dashboard: WorkspaceDashboardRecord
  error?: string
  ok: boolean
}

export type WorkspaceSeatAssignmentRecord = {
  assignedBy?: null | string
  currentPeriodEnd?: null | string
  currentPeriodStart?: null | string
  id: string
  includedCredits: number
  planKey: PlanKey
  status: string
  userId: string
  workspaceId: string
}

export type WorkspaceSeatAssignmentsResponse = {
  error?: string
  ok: boolean
  seats: WorkspaceSeatAssignmentRecord[]
}

export type WorkspaceSeatUpsertInput = {
  currentPeriodEnd?: null | string
  currentPeriodStart?: null | string
  includedCredits?: null | number
  planKey: PlanKey
  userId: string
}

export type WorkspaceMemberRoleUpdateInput = {
  role: string
}

export type WorkspaceOwnerTransferInput = {
  userId: string
}

export type WorkspaceOwnerTransferResult = {
  member: WorkspaceDashboardMember
  previousOwnerUserId: string
  workspace: BillingWorkspaceSummary
}

export type WorkspaceCreateInput = {
  name: string
}

export type WorkspaceCreateResponse = {
  error?: string
  ok: boolean
  workspace: BillingWorkspaceSummary
}

export type WorkspaceUpdateInput = {
  name: string
}

export type WorkspaceUpdateResponse = {
  error?: string
  ok: boolean
  workspace: BillingWorkspaceSummary
}

export type WorkspaceDeleteInput = {
  confirmation: string
}

export type WorkspaceDeleteResult = {
  boardsRemoved: number
  invitesRevoked: number
  membersRemoved: number
  workspace: BillingWorkspaceSummary
}

export type WorkspaceDeleteResponse = {
  error?: string
  ok: boolean
  result: WorkspaceDeleteResult
}

export type WorkspaceInvitationRecord = {
  acceptedAt?: null | string
  acceptedBy?: null | string
  createdAt: string
  email?: null | string
  expiresAt: string
  id: string
  invitedBy?: null | string
  metadata: Record<string, unknown>
  revokedAt?: null | string
  role: string
  targetUserId?: null | string
  workspaceId: string
}

export type WorkspaceInvitationCreateInput = {
  email?: null | string
  expiresInDays?: number
  metadata?: Record<string, unknown>
  role: 'admin' | 'editor' | 'viewer'
  targetUserId?: null | string
}

export type WorkspaceInvitationCreateResult = {
  acceptPath: string
  invitation: WorkspaceInvitationRecord
  token: string
}

export type WorkspaceInvitationAcceptResult = {
  invitation: WorkspaceInvitationRecord
  role: string
  workspaceId: string
}

export type WorkspaceInvitationCreateResponse = {
  error?: string
  ok: boolean
  result: WorkspaceInvitationCreateResult
}

export type WorkspaceInvitationAcceptResponse = {
  error?: string
  ok: boolean
  result: WorkspaceInvitationAcceptResult
}

export type WorkspaceInvitationResponse = {
  error?: string
  invitation: WorkspaceInvitationRecord
  ok: boolean
}

export type WorkspaceInvitationsResponse = {
  error?: string
  invitations: WorkspaceInvitationRecord[]
  ok: boolean
}

export type WorkspaceOwnerTransferResponse = {
  error?: string
  ok: boolean
  result: WorkspaceOwnerTransferResult
}

export type WorkspaceEntitlementResponse = {
  charge: AiRunChargeSummary
  error?: string
  ok: boolean
  plan: WorkspacePlanSummary
  workspace: BillingWorkspaceSummary
}
