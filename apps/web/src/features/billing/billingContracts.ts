import type { TangentSession } from '@/features/auth/sessionTypes'
import type {
  AiRunChargeSummary,
  ChargeScope,
  PlanKey,
  WorkspaceKind,
  WorkspacePlanSummary,
} from './billingTypes'

export const planCatalog: Record<PlanKey, WorkspacePlanSummary> = {
  collaborate_plus: {
    annualPriceUsd: 20,
    billingPeriod: 'monthly_or_annual',
    boardLimit: null,
    groupMemberLimit: 15,
    groupWorkspaceLimit: 20,
    includedCredits: 2000,
    monthlyPriceUsd: 25,
    name: 'Collaborate Plus',
    pageLimit: null,
    planKey: 'collaborate_plus',
    registrationCredits: 0,
    seatMax: 1,
    seatMin: 1,
    seatRange: '1+ users',
  },
  collaborate_start: {
    annualPriceUsd: 15,
    billingPeriod: 'monthly_or_annual',
    boardLimit: null,
    groupMemberLimit: 15,
    groupWorkspaceLimit: 10,
    includedCredits: 1500,
    monthlyPriceUsd: 18,
    name: 'Collaborate Start',
    pageLimit: null,
    planKey: 'collaborate_start',
    registrationCredits: 0,
    seatMax: 1,
    seatMin: 1,
    seatRange: '1+ users',
  },
  enterprise: {
    annualPriceUsd: null,
    billingPeriod: 'contract',
    boardLimit: null,
    groupMemberLimit: null,
    groupWorkspaceLimit: null,
    includedCredits: 0,
    monthlyPriceUsd: null,
    name: 'Enterprise',
    pageLimit: null,
    planKey: 'enterprise',
    registrationCredits: 0,
    seatMax: null,
    seatMin: null,
    seatRange: 'custom',
  },
  free_canvas: {
    annualPriceUsd: 0,
    billingPeriod: 'none',
    boardLimit: 1,
    groupMemberLimit: 0,
    groupWorkspaceLimit: 0,
    includedCredits: 0,
    monthlyPriceUsd: 0,
    name: 'Free Canvas',
    pageLimit: 3,
    planKey: 'free_canvas',
    registrationCredits: 50,
    seatMax: 1,
    seatMin: 1,
    seatRange: null,
  },
  team_growth: {
    annualPriceUsd: 40,
    billingPeriod: 'monthly_or_annual',
    boardLimit: null,
    groupMemberLimit: 0,
    groupWorkspaceLimit: 0,
    includedCredits: 5500,
    monthlyPriceUsd: 45,
    name: 'Team Growth',
    pageLimit: null,
    planKey: 'team_growth',
    registrationCredits: 0,
    seatMax: 15,
    seatMin: 1,
    seatRange: '1-15 seats',
  },
  team_start: {
    annualPriceUsd: 20,
    billingPeriod: 'monthly_or_annual',
    boardLimit: null,
    groupMemberLimit: 0,
    groupWorkspaceLimit: 0,
    includedCredits: 2500,
    monthlyPriceUsd: 25,
    name: 'Team Start',
    pageLimit: null,
    planKey: 'team_start',
    registrationCredits: 0,
    seatMax: 15,
    seatMin: 1,
    seatRange: '1-15 seats',
  },
}

export function createLocalAiChargeSummary(session: TangentSession): AiRunChargeSummary {
  const workspaceKind = session.activeWorkspace.kind ?? 'solo_workspace'
  return createAiChargeSummaryForContext({
    planKey: session.activeWorkspace.planKey,
    userId: session.user.id,
    workspaceId: session.activeWorkspace.id,
    workspaceKind,
  })
}

export function createAiChargeSummaryForContext(input: {
  planKey?: PlanKey
  userId: string
  workspaceId: string
  workspaceKind: WorkspaceKind
}): AiRunChargeSummary {
  const planKey = resolvePlanKey(input.workspaceKind, input.planKey)
  const chargedScope = resolveChargeScope(input.workspaceKind)
  return {
    chargedAccountId: chargedScope === 'actor_personal'
      ? `credit_user_${input.userId}`
      : `credit_workspace_${input.workspaceId}`,
    chargedScope,
    entitlementSource: resolveEntitlementSource(input.workspaceKind),
    payerLabel: resolvePayerLabel(chargedScope),
    planKey,
    preflightStatus: 'mock_contract_only',
    workspaceKind: input.workspaceKind,
    workspaceSeatId: input.workspaceKind === 'team_workspace' ? `seat_${input.workspaceId}_${input.userId}` : null,
  }
}

export function resolvePlanKey(workspaceKind: WorkspaceKind, explicitPlanKey?: PlanKey): PlanKey {
  if (explicitPlanKey && isPlanKeyAllowedForWorkspaceKind(explicitPlanKey, workspaceKind)) return explicitPlanKey
  if (workspaceKind === 'group_workspace') return 'collaborate_start'
  if (workspaceKind === 'team_workspace') return 'team_start'
  if (workspaceKind === 'enterprise_workspace') return 'enterprise'
  return 'free_canvas'
}

function isPlanKeyAllowedForWorkspaceKind(planKey: PlanKey, workspaceKind: WorkspaceKind) {
  if (workspaceKind === 'group_workspace') return ['collaborate_plus', 'collaborate_start'].includes(planKey)
  if (workspaceKind === 'team_workspace') return ['team_growth', 'team_start'].includes(planKey)
  if (workspaceKind === 'enterprise_workspace') return planKey === 'enterprise'
  return planKey === 'free_canvas'
}

function resolveEntitlementSource(workspaceKind: WorkspaceKind) {
  if (workspaceKind === 'team_workspace') return 'team_wallet'
  if (workspaceKind === 'group_workspace') return 'personal_collaborate_balance'
  if (workspaceKind === 'enterprise_workspace') return 'enterprise_contract'
  return 'personal_topup_or_free'
}

function resolveChargeScope(workspaceKind: WorkspaceKind): ChargeScope {
  if (workspaceKind === 'team_workspace') return 'team_wallet'
  if (workspaceKind === 'enterprise_workspace') return 'workspace_pool'
  return 'actor_personal'
}

function resolvePayerLabel(chargeScope: ChargeScope) {
  if (chargeScope === 'team_wallet') return 'Charges Team wallet'
  if (chargeScope === 'workspace_pool') return 'Charges enterprise workspace credits'
  return 'Charges your credits'
}
