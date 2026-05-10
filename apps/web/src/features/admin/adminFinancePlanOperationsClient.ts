'use client'

import { loadAdminJson } from './adminClient'
import type { AdminFinanceManualMutationResource } from './adminFinanceClient'
import type { AdminOperatorPlanOperationMode } from './adminOperatorActions'

export type AdminManualGroupPlanOperationInput = {
  action: AdminOperatorPlanOperationMode
  durationCount?: number
  durationUnitDays?: number
  effectMode?: string
  grantIncludedCredits?: boolean
  note: string
  planKey?: null | string
  status?: string
  subscriptionId?: null | string
  userId: string
}

export type AdminManualTeamPlanOperationInput = {
  action: AdminOperatorPlanOperationMode
  durationCount?: number
  durationUnitDays?: number
  effectMode?: string
  grantIncludedCredits?: boolean
  note: string
  planKey?: null | string
  seatCapacity?: null | number
  status?: string
  subscriptionId?: null | string
  workspaceId: string
}

export function adminManualOperateGroupPlan(input: AdminManualGroupPlanOperationInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/group-plan-operation', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function adminManualOperateTeamPlan(input: AdminManualTeamPlanOperationInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/team-plan-operation', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}
