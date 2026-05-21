'use client'

import { loadAdminJson } from './adminClient'
import type {
  AdminFinanceManualMutationResource,
  AdminManualCollaboratePlanInput,
  AdminManualCreateGroupWorkspaceInput,
  AdminManualCreateTeamWorkspaceInput,
  AdminManualCreditAdjustmentInput,
  AdminManualTeamPlanInput,
  AdminManualUserTopupInput,
  AdminManualWorkspaceTopupInput,
} from './adminFinanceTypes'

export function adminManualTopupUser(input: AdminManualUserTopupInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/user-topup', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function adminManualTopupWorkspace(input: AdminManualWorkspaceTopupInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/workspace-topup', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function adminManualAdjustUserCredits(input: AdminManualCreditAdjustmentInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/user-credit-adjust', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function adminManualAdjustWorkspaceCredits(input: AdminManualCreditAdjustmentInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/workspace-credit-adjust', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function adminManualSetCollaboratePlan(input: AdminManualCollaboratePlanInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/collaborate-plan', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function adminManualSetTeamPlan(input: AdminManualTeamPlanInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/team-plan', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function adminManualCreateGroupWorkspace(input: AdminManualCreateGroupWorkspaceInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/group-workspace', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function adminManualCreateTeamWorkspace(input: AdminManualCreateTeamWorkspaceInput) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/team-workspace', {
    body: JSON.stringify(input),
    method: 'POST',
  })
}

export function adminManualCancelSubscription(subscriptionId: string, note: string) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/subscription-cancel', {
    body: JSON.stringify({ note, subscriptionId }),
    method: 'POST',
  })
}

export function adminManualDeleteWorkspace(workspaceId: string, note: string) {
  return loadAdminJson<AdminFinanceManualMutationResource>('/api/v1/admin/finance/manual/workspace-delete', {
    body: JSON.stringify({ note, workspaceId }),
    method: 'POST',
  })
}
