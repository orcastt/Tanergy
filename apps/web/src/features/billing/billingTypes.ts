export type WorkspaceKind = 'enterprise_workspace' | 'group_workspace' | 'solo_workspace' | 'team_workspace'

export type PlanKey =
  | 'collaborate_plus'
  | 'collaborate_start'
  | 'enterprise'
  | 'free_canvas'
  | 'team_growth'
  | 'team_start'

export type ChargeScope = 'actor_personal' | 'team_wallet' | 'workspace_pool'

export type WorkspacePlanSummary = {
  billingPeriod: string
  includedCredits: number
  monthlyPriceUsd?: null | number
  name: string
  planKey: PlanKey
  seatRange?: null | string
}

export type PersonalCreditSummary = {
  includedRemaining: number
  includedTotal: number
  topUpBalance: number
  usedThisCycle: number
}

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
  chargeScope: ChargeScope
  credits: PersonalCreditSummary
  error?: string
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

export type WorkspaceCreateInput = {
  name: string
}

export type WorkspaceCreateResponse = {
  error?: string
  ok: boolean
  workspace: BillingWorkspaceSummary
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

export type CreditLedgerEntryRecord = {
  accountId: string
  actorUserId?: null | string
  createdAt: string
  creditsDelta: number
  id: string
  metadata: Record<string, unknown>
  reason: string
  sourceId?: null | string
  sourceType: string
  workspaceId?: null | string
}

export type CreditLedgerResponse = {
  accountId: string
  balanceCredits: number
  entries: CreditLedgerEntryRecord[]
  error?: string
  ok: boolean
}

export type CreditLedgerMutationResponse = {
  accountId: string
  balanceCredits: number
  entry: CreditLedgerEntryRecord
  error?: string
  ok: boolean
}

export type CreditLedgerQuery = {
  actorUserId?: null | string
  limit?: number
  reason?: null | string
  sourceId?: null | string
  sourceType?: null | string
  workspaceId?: null | string
}

export type CreditTopupInput = {
  credits: number
  metadata?: Record<string, unknown>
  sourceId?: null | string
}

export type WorkspaceEntitlementResponse = {
  charge: AiRunChargeSummary
  error?: string
  ok: boolean
  plan: WorkspacePlanSummary
  workspace: BillingWorkspaceSummary
}

export type {
  BillingCheckoutSessionRecord,
  BillingPaymentMutationResponse,
  BillingPaymentQuery,
  BillingPaymentRecord,
  BillingPaymentsResponse,
} from './billingPaymentTypes'

export type BillingTopupCheckoutInput = {
  credits: number
  currency?: string
  metadata?: Record<string, unknown>
}

export type BillingSeatPurchaseCheckoutInput = {
  currency?: string
  metadata?: Record<string, unknown>
  planKey: Extract<PlanKey, 'team_growth' | 'team_start'>
  quantity: number
}

export type BillingCollaborateSubscriptionCheckoutInput = {
  currency?: string
  metadata?: Record<string, unknown>
  planKey: Extract<PlanKey, 'collaborate_plus' | 'collaborate_start'>
}

export type BillingTeamSubscriptionCheckoutInput = {
  currency?: string
  metadata?: Record<string, unknown>
  planKey: Extract<PlanKey, 'team_growth' | 'team_start'>
  quantity: number
  teamName: string
}
