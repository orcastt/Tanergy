import type { TangentSession } from '@/features/auth/sessionTypes'
import type {
  AiRunChargeSummary,
  BillingMeResponse,
  CreditLedgerResponse,
  PersonalCreditSummary,
  PlanKey,
  WorkspaceDashboardRecord,
  WorkspaceSeatAssignmentsResponse,
  WorkspaceKind,
  WorkspacePlanSummary,
} from './billingTypes'

export const planCatalog: Record<PlanKey, WorkspacePlanSummary> = {
  collaborate_plus: {
    billingPeriod: 'monthly_or_annual',
    includedCredits: 2000,
    monthlyPriceUsd: 25,
    name: 'Collaborate Plus',
    planKey: 'collaborate_plus',
    seatRange: '1+ users',
  },
  collaborate_start: {
    billingPeriod: 'monthly_or_annual',
    includedCredits: 1500,
    monthlyPriceUsd: 18,
    name: 'Collaborate Start',
    planKey: 'collaborate_start',
    seatRange: '1+ users',
  },
  enterprise: {
    billingPeriod: 'contract',
    includedCredits: 0,
    monthlyPriceUsd: null,
    name: 'Enterprise',
    planKey: 'enterprise',
    seatRange: 'custom',
  },
  free_canvas: {
    billingPeriod: 'none',
    includedCredits: 0,
    monthlyPriceUsd: 0,
    name: 'Free Canvas',
    planKey: 'free_canvas',
    seatRange: null,
  },
  team_growth: {
    billingPeriod: 'monthly_or_annual',
    includedCredits: 5500,
    monthlyPriceUsd: 45,
    name: 'Team Growth',
    planKey: 'team_growth',
    seatRange: '2-15 seats',
  },
  team_start: {
    billingPeriod: 'monthly_or_annual',
    includedCredits: 2500,
    monthlyPriceUsd: 25,
    name: 'Team Start',
    planKey: 'team_start',
    seatRange: '2-15 seats',
  },
}

export function createLocalBillingMe(session: TangentSession): BillingMeResponse {
  const workspaceKind = session.activeWorkspace.kind ?? 'solo_workspace'
  const plan = planCatalog[resolvePlanKey(workspaceKind, session.activeWorkspace.planKey)]
  const credits = createCreditSummary(session.user.id, plan.includedCredits)
  return {
    chargeScope: workspaceKind === 'enterprise_workspace' ? 'workspace_pool' : 'actor_personal',
    credits,
    ok: true,
    payerLabel: workspaceKind === 'enterprise_workspace' ? 'Charges enterprise workspace credits' : 'Charges your credits',
    plan,
    workspace: {
      id: session.activeWorkspace.id,
      kind: workspaceKind,
      name: session.activeWorkspace.name,
      role: session.activeWorkspace.role,
    },
  }
}

export function createLocalWorkspaceDashboard(session: TangentSession): WorkspaceDashboardRecord {
  const workspaceKind = session.activeWorkspace.kind ?? 'solo_workspace'
  const canSeeMemberUsage = workspaceKind === 'team_workspace' && ['admin', 'owner'].includes(session.activeWorkspace.role)
  const plan = planCatalog[resolvePlanKey(workspaceKind, session.activeWorkspace.planKey)]
  const credits = createCreditSummary(session.user.id, plan.includedCredits)
  return {
    boardCount: session.activeWorkspace.boardCount,
    canSeeMemberUsage,
    dashboardKind: canSeeMemberUsage ? 'team_usage' : 'group_structure',
    memberCount: 1,
    members: [
      {
        displayName: session.user.displayName,
        email: session.user.email,
        role: session.activeWorkspace.role,
        usageThisCycle: canSeeMemberUsage ? credits.usedThisCycle : null,
        userId: session.user.id,
      },
    ],
    totalUsageThisCycle: canSeeMemberUsage ? credits.usedThisCycle : null,
    workspace: {
      id: session.activeWorkspace.id,
      kind: workspaceKind,
      name: session.activeWorkspace.name,
      role: session.activeWorkspace.role,
    },
  }
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
  const chargedScope = input.workspaceKind === 'enterprise_workspace' ? 'workspace_pool' : 'actor_personal'
  return {
    chargedAccountId: chargedScope === 'workspace_pool'
      ? `credit_workspace_${input.workspaceId}`
      : `credit_user_${input.userId}`,
    chargedScope,
    entitlementSource: resolveEntitlementSource(input.workspaceKind),
    payerLabel: chargedScope === 'workspace_pool' ? 'Charges enterprise workspace credits' : 'Charges your credits',
    planKey,
    preflightStatus: 'mock_contract_only',
    workspaceKind: input.workspaceKind,
    workspaceSeatId: input.workspaceKind === 'team_workspace' ? `seat_${input.workspaceId}_${input.userId}` : null,
  }
}

export function createLocalWorkspaceSeats(session: TangentSession): WorkspaceSeatAssignmentsResponse {
  const workspaceKind = session.activeWorkspace.kind ?? 'solo_workspace'
  if (workspaceKind !== 'team_workspace') return { ok: true, seats: [] }

  const planKey = resolvePlanKey(workspaceKind, session.activeWorkspace.planKey)
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString()
  return {
    ok: true,
    seats: [
      {
        assignedBy: session.user.id,
        currentPeriodEnd: periodEnd,
        currentPeriodStart: periodStart,
        id: `seat_${session.activeWorkspace.id}_${session.user.id}`,
        includedCredits: planCatalog[planKey].includedCredits,
        planKey,
        status: 'active',
        userId: session.user.id,
        workspaceId: session.activeWorkspace.id,
      },
    ],
  }
}

export function createLocalCreditLedger(session: TangentSession): CreditLedgerResponse {
  const workspaceKind = session.activeWorkspace.kind ?? 'solo_workspace'
  const plan = planCatalog[resolvePlanKey(workspaceKind, session.activeWorkspace.planKey)]
  const credits = createCreditSummary(session.user.id, plan.includedCredits)
  const accountId = workspaceKind === 'enterprise_workspace'
    ? `credit_workspace_${session.activeWorkspace.id}`
    : `credit_user_${session.user.id}`
  const grantCreatedAt = new Date(Date.UTC(2026, 4, 1, 9, 0, 0)).toISOString()
  const usageCreatedAt = new Date(Date.UTC(2026, 4, 6, 14, 30, 0)).toISOString()

  return {
    accountId,
    balanceCredits: credits.includedRemaining + credits.topUpBalance,
    entries: [
      {
        accountId,
        actorUserId: session.user.id,
        createdAt: usageCreatedAt,
        creditsDelta: -credits.usedThisCycle,
        id: `credit_usage_${session.user.id}`,
        metadata: {
          note: 'Mock AI usage summary',
          planKey: plan.planKey,
        },
        reason: 'usage_charge',
        sourceId: 'mock-run-batch',
        sourceType: 'ai_run',
        workspaceId: session.activeWorkspace.id,
      },
      {
        accountId,
        actorUserId: session.user.id,
        createdAt: grantCreatedAt,
        creditsDelta: credits.includedTotal,
        id: `credit_grant_${session.user.id}`,
        metadata: {
          billingPeriod: plan.billingPeriod,
          planKey: plan.planKey,
        },
        reason: 'subscription_grant',
        sourceId: `subscription_${plan.planKey}`,
        sourceType: 'subscription',
        workspaceId: session.activeWorkspace.id,
      },
    ],
    ok: true,
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

function createCreditSummary(userId: string, includedTotal: number): PersonalCreditSummary {
  const usedThisCycle = includedTotal <= 0 ? 0 : Math.min(includedTotal, 120 + checksum(userId) % 380)
  return {
    includedRemaining: Math.max(0, includedTotal - usedThisCycle),
    includedTotal,
    topUpBalance: 0,
    usedThisCycle,
  }
}

function resolveEntitlementSource(workspaceKind: WorkspaceKind) {
  if (workspaceKind === 'team_workspace') return 'team_seat_allowance'
  if (workspaceKind === 'group_workspace') return 'personal_collaborate_balance'
  if (workspaceKind === 'enterprise_workspace') return 'enterprise_contract'
  return 'personal_topup_or_free'
}

function checksum(value: string) {
  return Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0)
}
