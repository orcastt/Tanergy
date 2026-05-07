import { planCatalog } from './billingContracts'
import type { PlanKey } from './billingTypes'
import {
  getWorkspaceDirectoryItems,
  type WorkspaceMembershipRole,
  type WorkspaceRelationship,
} from '@/features/workspaces/workspaceDirectoryMock'

export type PricingCycle = 'annual' | 'monthly'

export type TeamBillingCard = {
  canManageBilling: boolean
  id: string
  membershipRole: WorkspaceMembershipRole
  name: string
  planKey: Extract<PlanKey, 'team_growth' | 'team_start'>
  relationship: WorkspaceRelationship
  remainingCredits: number
  seatLimit: number
  seatsUsed: number
  totalCredits: number
}

export type GroupBillingSummary = {
  groupLimit: number
  groupsCreated: number
  id: string
  joinedGroups: number
  name: string
  planKey: Extract<PlanKey, 'collaborate_plus' | 'collaborate_start'>
  remainingCredits: number
  totalCredits: number
}

export type SubscriptionPlanCard = {
  audience: string
  buttonLabel: string
  features: string[]
  isEnterprise?: boolean
  key: PlanKey
  name: string
  tier: 'primary' | 'secondary'
}

export type WorkspaceCommerceActivity = {
  actionLabel: string
  amountLabel: string
  happenedAt: string
  id: string
  scope: 'group' | 'team'
  scopeLabel: string
  workspaceId?: null | string
}

export type SubscriptionOverview = {
  groupSummary: GroupBillingSummary
  joinedTeams: TeamBillingCard[]
  ownedTeams: TeamBillingCard[]
  totalIncludedCredits: number
  totalSeatLimit: number
  totalSeatsUsed: number
}

const annualMonthlyPriceByPlan: Partial<Record<PlanKey, number>> = {
  collaborate_plus: 20,
  collaborate_start: 15,
  free_canvas: 0,
  team_growth: 40,
  team_start: 20,
}

const monthlyPriceByPlan: Partial<Record<PlanKey, number>> = {
  collaborate_plus: 25,
  collaborate_start: 18,
  free_canvas: 0,
  team_growth: 45,
  team_start: 25,
}

const subscriptionPlanCards: SubscriptionPlanCard[] = [
  {
    audience: 'Solo boards',
    buttonLabel: 'Current Plan',
    features: ['1 active board', '3 pages', 'Top-up only'],
    key: 'free_canvas',
    name: 'Free Canvas',
    tier: 'primary',
  },
  {
    audience: 'Light collaboration',
    buttonLabel: 'Upgrade',
    features: ['1,500 credits', 'Free editors', 'Unlimited boards'],
    key: 'collaborate_start',
    name: 'Collaborate Start',
    tier: 'primary',
  },
  {
    audience: 'Heavier AI creation',
    buttonLabel: 'Upgrade',
    features: ['2,000 credits', 'Unlimited boards', 'Private usage'],
    key: 'collaborate_plus',
    name: 'Collaborate Plus',
    tier: 'secondary',
  },
  {
    audience: 'Moderate AI teams',
    buttonLabel: 'Manage',
    features: ['2,500 credits / seat', '2-15 seats', 'Admin usage view'],
    key: 'team_start',
    name: 'Team Start',
    tier: 'primary',
  },
  {
    audience: 'AI-heavy teams',
    buttonLabel: 'Upgrade',
    features: ['5,500 credits / seat', '2-15 seats', 'Higher governance'],
    key: 'team_growth',
    name: 'Team Growth',
    tier: 'secondary',
  },
  {
    audience: 'Procurement and security',
    buttonLabel: 'Contact',
    features: ['Custom billing', 'SSO and policy', 'Contract credits'],
    isEnterprise: true,
    key: 'enterprise',
    name: 'Enterprise',
    tier: 'secondary',
  },
]

export function getTeamBillingCards(options: { includeJoined?: boolean } = {}) {
  return getWorkspaceDirectoryItems('team_workspace')
    .filter((item) => options.includeJoined || item.relationship === 'created')
    .map((item, index) => {
      const planKey = item.planKey as Extract<PlanKey, 'team_growth' | 'team_start'>
      const totalCredits = planCatalog[planKey].includedCredits
      const seatLimit = planKey === 'team_growth' ? 15 : 10
      const seatsUsed = Math.max(
        item.relationship === 'created' ? 2 : 1,
        Math.min(item.memberInitials.length + 1, seatLimit - (item.relationship === 'joined' ? 2 : 0)),
      )
      const remainingCredits = Math.max(320, totalCredits - (index * 560 + (item.relationship === 'created' ? 188 : 392)))
      return {
        canManageBilling: item.relationship === 'created' && ['admin', 'owner'].includes(item.membershipRole),
        id: item.id,
        membershipRole: item.membershipRole,
        name: item.name,
        planKey,
        relationship: item.relationship,
        remainingCredits,
        seatLimit,
        seatsUsed,
        totalCredits,
      }
    })
}

export function getGroupBillingSummary(): GroupBillingSummary {
  const groupItems = getWorkspaceDirectoryItems('group_workspace')
  const createdGroups = groupItems.filter((item) => item.relationship === 'created')
  const joinedGroups = groupItems.filter((item) => item.relationship === 'joined')
  const activePlanKey = createdGroups.some((item) => item.planKey === 'collaborate_plus')
    ? 'collaborate_plus'
    : 'collaborate_start'
  const totalCredits = planCatalog[activePlanKey].includedCredits

  return {
    groupLimit: 10,
    groupsCreated: createdGroups.length,
    id: 'group-subscription',
    joinedGroups: joinedGroups.length,
    name: 'Group subscription',
    planKey: activePlanKey,
    remainingCredits: Math.max(260, totalCredits - 428),
    totalCredits,
  }
}

export function getSubscriptionOverview(): SubscriptionOverview {
  const allTeams = getTeamBillingCards({ includeJoined: true })
  const ownedTeams = allTeams.filter((card) => card.relationship === 'created')
  const joinedTeams = allTeams.filter((card) => card.relationship === 'joined')
  const groupSummary = getGroupBillingSummary()

  return {
    groupSummary,
    joinedTeams,
    ownedTeams,
    totalIncludedCredits: groupSummary.totalCredits + ownedTeams.reduce((total, card) => total + card.totalCredits, 0),
    totalSeatLimit: ownedTeams.reduce((total, card) => total + card.seatLimit, 0),
    totalSeatsUsed: ownedTeams.reduce((total, card) => total + card.seatsUsed, 0),
  }
}

export function getSubscriptionPlanCards() {
  return {
    enterprise: subscriptionPlanCards.find((plan) => plan.key === 'enterprise') ?? null,
    primary: subscriptionPlanCards.filter((plan) => plan.tier === 'primary'),
    secondary: subscriptionPlanCards.filter((plan) => plan.tier === 'secondary' && !plan.isEnterprise),
  }
}

export function getBillingActivitySeed(): WorkspaceCommerceActivity[] {
  const overview = getSubscriptionOverview()
  const primaryTeam = overview.ownedTeams[0]
  const secondaryTeam = overview.ownedTeams[1]

  return [
    {
      actionLabel: 'Allowance',
      amountLabel: `+${formatCreditsLabel(overview.groupSummary.totalCredits)} credits`,
      happenedAt: '2026-05-07T09:20:00.000Z',
      id: 'activity-group-allowance',
      scope: 'group',
      scopeLabel: formatPlanBadge(overview.groupSummary.planKey),
      workspaceId: overview.groupSummary.id,
    },
    ...(primaryTeam ? [{
          actionLabel: 'Top-up',
          amountLabel: '+800 credits',
          happenedAt: '2026-05-06T18:40:00.000Z',
          id: `activity-${primaryTeam.id}-topup`,
          scope: 'team' as const,
          scopeLabel: primaryTeam.name,
          workspaceId: primaryTeam.id,
        }] : []),
    ...(secondaryTeam ? [{
          actionLabel: 'Seat added',
          amountLabel: '+1 seat',
          happenedAt: '2026-05-05T14:05:00.000Z',
          id: `activity-${secondaryTeam.id}-seat`,
          scope: 'team' as const,
          scopeLabel: secondaryTeam.name,
          workspaceId: secondaryTeam.id,
        }] : []),
    ...(primaryTeam ? [{
          actionLabel: 'Allowance',
          amountLabel: `+${formatCreditsLabel(primaryTeam.totalCredits)} credits`,
          happenedAt: '2026-05-04T08:15:00.000Z',
          id: `activity-${primaryTeam.id}-allowance`,
          scope: 'team' as const,
          scopeLabel: primaryTeam.name,
          workspaceId: primaryTeam.id,
        }] : []),
    {
      actionLabel: 'Group created',
      amountLabel: '+1 group',
      happenedAt: '2026-05-03T11:10:00.000Z',
      id: 'activity-group-created',
      scope: 'group',
      scopeLabel: 'Personal group',
      workspaceId: overview.groupSummary.id,
    },
  ]
}

export function formatPlanBadge(planKey: PlanKey) {
  return planCatalog[planKey].name
}

export function formatPlanPrice(planKey: PlanKey, cycle: PricingCycle) {
  if (planKey === 'enterprise') return 'Custom'
  const amount = cycle === 'annual'
    ? annualMonthlyPriceByPlan[planKey]
    : monthlyPriceByPlan[planKey]
  if (amount === undefined) return 'Custom'
  if (amount === 0) return '$0'
  const suffix = planKey.startsWith('team_') ? '/seat/mo' : '/mo'
  return `$${amount}${suffix}`
}

export function formatRenewLabel(index: number) {
  const day = 14 + index * 3
  return `Renews ${day} May 2026`
}

function formatCreditsLabel(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}
