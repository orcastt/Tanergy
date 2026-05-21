'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import {
  loadBillingMe,
  loadBillingPlans,
  loadWorkspaceDashboard,
} from './billingClient'
import { resolveCreditWalletMetrics } from './billingCreditUsage'
import { subscribeToBillingInvalidation } from './billingResourceCache'
import type { BillingInterval, PlanCatalogRecord, PlanKey } from './billingTypes'
import {
  normalizeWorkspaceMembershipRole,
  workspaceRelationshipFromRole,
  type WorkspaceRelationship,
} from '@/features/workspaces/workspacePresentation'
import { mapWithConcurrency } from '@/features/shared/asyncConcurrency'

export type CommercePlanMap = Partial<Record<PlanKey, PlanCatalogRecord>>

export type CommerceTeamCard = {
  billingInterval: BillingInterval
  boardCount: number
  canManageBilling: boolean
  currentPeriodStart?: null | string
  currentPeriodEnd?: null | string
  id: string
  includedCredits: number
  memberCount: number
  membershipRole: ReturnType<typeof normalizeWorkspaceMembershipRole>
  name: string
  nextRefreshAt?: null | string
  pageLimit?: null | number
  planKey: Extract<PlanKey, 'team_growth' | 'team_start'>
  planName: string
  seatMax?: null | number
  seatMin?: null | number
  relationship: WorkspaceRelationship
  remainingCredits: number
  seatLimit: number
  seatsUsed: number
  topUpBalance: number
  totalCredits: number
  usedThisCycle: number
  workspace: TangentWorkspace
}

export type CommerceGroupSummary = {
  billingInterval: BillingInterval
  boardLimit?: null | number
  currentPeriodStart?: null | string
  currentPeriodEnd?: null | string
  groupLimit: number
  groupMemberLimit?: null | number
  groupsCreated: number
  includedCredits: number
  joinedGroups: number
  name: string
  nextRefreshAt?: null | string
  pageLimit?: null | number
  planKey: Extract<PlanKey, 'collaborate_plus' | 'collaborate_start' | 'free_canvas'>
  planName: string
  remainingCredits: number
  topUpBalance: number
  totalCredits: number
  usedThisCycle: number
  workspace: TangentWorkspace
}

export type WorkspaceCommerceOverview = {
  groupSummary: CommerceGroupSummary
  planMap: CommercePlanMap
  plans: PlanCatalogRecord[]
  teamCards: CommerceTeamCard[]
  totalIncludedCredits: number
  totalSeatLimit: number
  totalSeatsUsed: number
}

type WorkspaceCommerceOverviewLoadResult = {
  overview: WorkspaceCommerceOverview
  warning: string | null
}

type TeamCardsLoadResult = {
  cards: CommerceTeamCard[]
  warning: string | null
}

type Status = 'loading' | 'ready' | 'error'
const maxConcurrentCommerceWorkspaceLoads = 4

export function useWorkspaceCommerceOverview() {
  const { error: sessionError, session, status: sessionStatus } = useTangentSession()
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<WorkspaceCommerceOverview | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const workspaceSignature = useMemo(
    () => session.workspaces.map((workspace) => `${workspace.id}:${workspace.kind}:${workspace.planKey ?? ''}:${workspace.role}:${workspace.boardCount}`).join('|'),
    [session.workspaces],
  )
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (sessionStatus !== 'ready') return

    let cancelled = false

    loadWorkspaceCommerceOverview(session.workspaces, reloadToken > 0)
      .then(({ overview: nextOverview, warning }) => {
        if (cancelled) return
        setOverview(nextOverview)
        setError(warning)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setOverview(null)
        setError(nextError instanceof Error ? nextError.message : 'Workspace billing failed to load.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken, session.workspaces, sessionStatus, workspaceSignature])

  useEffect(() => (
    subscribeToBillingInvalidation(() => {
      setStatus('loading')
      setReloadToken((value) => value + 1)
    })
  ), [])

  return {
    error: sessionStatus === 'error' ? (sessionError ?? 'Session lookup failed.') : error,
    overview,
    reload: useCallback(() => {
      setStatus('loading')
      setReloadToken((value) => value + 1)
    }, []),
    status: sessionStatus === 'error' ? 'error' : sessionStatus !== 'ready' ? 'loading' : status,
  }
}

async function loadWorkspaceCommerceOverview(
  workspaces: TangentWorkspace[],
  force = false,
): Promise<WorkspaceCommerceOverviewLoadResult> {
  const planResponse = await loadBillingPlans({ force: true })
  const planMap = Object.fromEntries(planResponse.plans.map((plan) => [plan.planKey, plan])) as CommercePlanMap
  const personalWorkspace = selectPersonalWorkspace(workspaces)
  const [groupSummary, teamCardResult] = await Promise.all([
    loadGroupSummary(personalWorkspace, workspaces, planMap, force),
    loadTeamCards(workspaces.filter((workspace) => workspace.kind === 'team_workspace'), force),
  ])
  const teamCards = teamCardResult.cards
  const ownedTeams = teamCards.filter((card) => card.relationship === 'created')

  return {
    overview: {
      groupSummary,
      planMap,
      plans: planResponse.plans,
      teamCards,
      totalIncludedCredits: groupSummary.totalCredits + ownedTeams.reduce((total, card) => total + card.totalCredits, 0),
      totalSeatLimit: ownedTeams.reduce((total, card) => total + card.seatLimit, 0),
      totalSeatsUsed: ownedTeams.reduce((total, card) => total + card.seatsUsed, 0),
    },
    warning: teamCardResult.warning,
  }
}

async function loadGroupSummary(
  personalWorkspace: TangentWorkspace,
  workspaces: TangentWorkspace[],
  planMap: CommercePlanMap,
  force = false,
): Promise<CommerceGroupSummary> {
  const createdGroups = workspaces.filter((workspace) => workspace.kind === 'group_workspace' && workspace.role === 'owner')
  const joinedGroups = workspaces.filter((workspace) => workspace.kind === 'group_workspace' && workspace.role !== 'owner')
  const billing = await loadBillingMe({ force, workspace: personalWorkspace })
  const planKey = normalizeGroupPlanKey(billing.plan.planKey)
  const plan = planMap[planKey]
  const creditMetrics = resolveCreditWalletMetrics(billing.credits)

  return {
    groupLimit: plan?.groupWorkspaceLimit ?? 0,
    groupMemberLimit: plan?.groupMemberLimit ?? 0,
    groupsCreated: createdGroups.length,
    billingInterval: normalizeBillingInterval(billing.billingInterval, plan?.billingPeriod),
    joinedGroups: joinedGroups.length,
    boardLimit: plan?.boardLimit ?? null,
    currentPeriodStart: billing.currentPeriodStart,
    name: personalWorkspace.kind === 'solo_workspace' ? 'Personal collaboration' : personalWorkspace.name,
    includedCredits: billing.credits.includedTotal,
    nextRefreshAt: billing.nextRefreshAt,
    pageLimit: plan?.pageLimit ?? null,
    planKey,
    planName: billing.plan.name || plan?.name || 'Personal plan',
    currentPeriodEnd: billing.currentPeriodEnd,
    remainingCredits: creditMetrics.remainingCredits,
    topUpBalance: billing.credits.topUpBalance,
    totalCredits: creditMetrics.totalCredits,
    usedThisCycle: creditMetrics.usedCredits,
    workspace: personalWorkspace,
  }
}

async function loadTeamCards(
  teamWorkspaces: TangentWorkspace[],
  force = false,
): Promise<TeamCardsLoadResult> {
  const warnings: string[] = []
  const cards = (await mapWithConcurrency<TangentWorkspace, CommerceTeamCard | null>(
    teamWorkspaces,
    maxConcurrentCommerceWorkspaceLoads,
    async (workspace) => {
    try {
      const relationship = workspaceRelationshipFromRole(workspace.role)
      const [billing, dashboard] = await Promise.all([
        loadBillingMe({ force, workspace }),
        loadWorkspaceDashboard({ force, workspace }),
      ])
      const planKey = normalizeTeamPlanKey(billing.plan.planKey)
      const creditMetrics = resolveCreditWalletMetrics(billing.credits)
      const card: CommerceTeamCard = {
        billingInterval: normalizeBillingInterval(billing.billingInterval, billing.plan.billingPeriod),
        boardCount: dashboard.dashboard.boardCount,
        canManageBilling: relationship === 'created' && (workspace.role === 'owner' || workspace.role === 'admin'),
        currentPeriodStart: billing.currentPeriodStart,
        currentPeriodEnd: billing.currentPeriodEnd,
        id: workspace.id,
        includedCredits: billing.credits.includedTotal,
        memberCount: dashboard.dashboard.memberCount,
        membershipRole: normalizeWorkspaceMembershipRole(workspace.role),
        name: workspace.name,
        nextRefreshAt: billing.nextRefreshAt,
        pageLimit: billing.plan.pageLimit ?? null,
        planKey,
        planName: billing.plan.name || workspace.name,
        relationship,
        remainingCredits: creditMetrics.remainingCredits,
        seatMax: billing.plan.seatMax ?? null,
        seatMin: billing.plan.seatMin ?? null,
        seatLimit: dashboard.dashboard.seatCapacity ?? billing.plan.seatMax ?? Math.max(dashboard.dashboard.memberCount, 1),
        seatsUsed: dashboard.dashboard.memberCount,
        topUpBalance: billing.credits.topUpBalance,
        totalCredits: creditMetrics.totalCredits,
        usedThisCycle: creditMetrics.usedCredits,
        workspace: {
          ...workspace,
          boardCount: dashboard.dashboard.boardCount,
          planKey,
        },
      }
      return card
    } catch (error) {
      warnings.push(formatTeamCardLoadWarning(workspace.name, error))
      return null
    }
  },
  )).filter((card): card is CommerceTeamCard => card !== null)

  return {
    cards,
    warning: warnings.length ? warnings.join(' ') : null,
  }
}

function selectPersonalWorkspace(workspaces: TangentWorkspace[]) {
  return workspaces.find((workspace) => workspace.kind === 'solo_workspace')
    ?? workspaces.find((workspace) => workspace.kind === 'group_workspace' && workspace.role === 'owner')
    ?? workspaces.find((workspace) => workspace.kind === 'group_workspace')
    ?? workspaces[0]!
}

function normalizeGroupPlanKey(value: string): Extract<PlanKey, 'collaborate_plus' | 'collaborate_start' | 'free_canvas'> {
  if (value === 'collaborate_plus' || value === 'collaborate_start' || value === 'free_canvas') return value
  return 'free_canvas'
}

function normalizeTeamPlanKey(value: string): Extract<PlanKey, 'team_growth' | 'team_start'> {
  return value === 'team_growth' ? 'team_growth' : 'team_start'
}

function normalizeBillingInterval(
  value: BillingInterval | null | undefined,
  billingPeriod?: null | string,
): BillingInterval {
  if (value === 'annual' || value === 'contract' || value === 'monthly' || value === 'none') return value
  if (billingPeriod === 'contract') return 'contract'
  if (billingPeriod === 'none') return 'none'
  return 'monthly'
}

function formatTeamCardLoadWarning(workspaceName: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Team billing failed to load.'
  return `${workspaceName}: ${detail}`
}
