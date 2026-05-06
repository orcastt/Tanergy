export type WorkspaceKind = 'enterprise_workspace' | 'group_workspace' | 'solo_workspace' | 'team_workspace'

export type PlanKey =
  | 'collaborate_plus'
  | 'collaborate_start'
  | 'enterprise'
  | 'free_canvas'
  | 'team_growth'
  | 'team_start'

export type ChargeScope = 'actor_personal' | 'workspace_pool'

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

export type WorkspaceEntitlementResponse = {
  charge: AiRunChargeSummary
  error?: string
  ok: boolean
  plan: WorkspacePlanSummary
  workspace: BillingWorkspaceSummary
}
