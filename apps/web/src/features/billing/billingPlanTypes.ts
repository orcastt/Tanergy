export type WorkspaceKind = 'enterprise_workspace' | 'group_workspace' | 'solo_workspace' | 'team_workspace'

export type PlanKey =
  | 'collaborate_plus'
  | 'collaborate_start'
  | 'enterprise'
  | 'free_canvas'
  | 'team_growth'
  | 'team_start'

export type ChargeScope = 'actor_personal' | 'team_wallet' | 'workspace_pool'
export type BillingInterval = 'annual' | 'contract' | 'monthly' | 'none'

export type WorkspacePlanSummary = {
  annualPriceUsd?: null | number
  billingPeriod: string
  boardLimit?: null | number
  groupMemberLimit?: null | number
  groupWorkspaceLimit?: null | number
  includedCredits: number
  monthlyPriceUsd?: null | number
  name: string
  pageLimit?: null | number
  planKey: PlanKey
  registrationCredits?: number
  seatMax?: null | number
  seatMin?: null | number
  seatRange?: null | string
}

export type PlanCatalogRecord = WorkspacePlanSummary & {
  createdAt?: null | string
  metadata: Record<string, unknown>
  planFamily: string
  registrationCredits: number
  updatedAt?: null | string
}

export type PlanCatalogResponse = {
  ok: boolean
  plans: PlanCatalogRecord[]
}

export type PersonalCreditSummary = {
  includedRemaining: number
  includedTotal: number
  topUpBalance: number
  usedThisCycle: number
}

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
  billingInterval?: Extract<BillingInterval, 'annual' | 'monthly'>
  currency?: string
  metadata?: Record<string, unknown>
  planKey: Extract<PlanKey, 'collaborate_plus' | 'collaborate_start'>
}

export type BillingTeamSubscriptionCheckoutInput = {
  billingInterval?: Extract<BillingInterval, 'annual' | 'monthly'>
  currency?: string
  metadata?: Record<string, unknown>
  planKey: Extract<PlanKey, 'team_growth' | 'team_start'>
  quantity: number
  teamName: string
}
