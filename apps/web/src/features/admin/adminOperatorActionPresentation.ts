'use client'

import type { AdminOperatorAction, AdminOperatorPlanOperationMode } from './adminOperatorActions'
import { planCatalog } from '@/features/billing/billingContracts'

export function resolveInitialPlanKey(action: AdminOperatorAction | null) {
  if (action?.type === 'group-plan') {
    return action.currentPlanKey === 'collaborate_plus' ? 'collaborate_plus' : 'collaborate_start'
  }
  if (action?.type === 'team-plan') {
    if (action.targetPlanKey === 'team_growth') return 'team_growth'
    return action.workspace.planKey === 'team_growth' ? 'team_growth' : 'team_start'
  }
  return 'team_start'
}

export function resolveInitialPlanOperation(action: AdminOperatorAction | null): AdminOperatorPlanOperationMode {
  if (!action || (action.type !== 'group-plan' && action.type !== 'team-plan')) return 'assign'
  if (action.mode) return action.mode
  if (action.type === 'group-plan') return action.subscriptionId ? 'renew' : 'assign'
  if (!action.workspace.subscriptionId) return 'assign'
  if (!isCurrentPlanStatus(action.workspace.planStatus)) return 'renew'
  return 'upgrade'
}

export function resolveActionTitle(action: AdminOperatorAction | null, planOperation: AdminOperatorPlanOperationMode) {
  if (!action) return ''
  if ('title' in action && action.title) return action.title
  if (action.type === 'group-plan' || action.type === 'team-plan') return humanizePlanOperation(planOperation)
  if (action.type === 'create-group') return 'Create Group'
  if (action.type === 'create-team') return 'Create Team'
  if (action.type === 'user-join-team') return 'Join Team'
  if (action.type === 'user-join-group') return 'Join Group'
  return 'Action'
}

export function resolveSubmitLabel(action: AdminOperatorAction, planOperation: AdminOperatorPlanOperationMode) {
  switch (action.type) {
    case 'board-copy':
      return 'Copy'
    case 'board-delete':
    case 'delete-workspace':
      return 'Delete'
    case 'cancel-subscription':
      return 'Delete plan'
    case 'group-plan':
    case 'team-plan':
      if (planOperation === 'delete') return 'Delete'
      if (planOperation === 'freeze') return 'Freeze'
      if (planOperation === 'unfreeze') return 'Unfreeze'
      if (planOperation === 'renew') return 'Renew'
      if (planOperation === 'assign') return 'Assign'
      if (action.type === 'team-plan' && action.workspace.planKey === action.targetPlanKey && planOperation === 'upgrade') return 'Buy seats'
      return 'Upgrade'
    case 'subscription-freeze':
      return 'Freeze'
    case 'subscription-unfreeze':
      return 'Unfreeze'
    case 'user-delete':
      return 'Delete'
    case 'user-status':
      return action.nextStatus === 'active' ? 'Unblock' : 'Block'
    case 'workspace-invite-create':
      return 'Invite'
    case 'workspace-invite-revoke':
      return 'Revoke'
    case 'workspace-member-add':
      return 'Add member'
    case 'user-join-team':
      return 'Join Team'
    case 'user-join-group':
      return 'Join Group'
    case 'workspace-member-remove':
      return 'Remove'
    case 'workspace-member-role':
      return 'Change role'
    default:
      return 'Save'
  }
}

export function canSubmitAction(
  action: AdminOperatorAction,
  fields: {
    inviteEmail: string
    targetUserId: string
    workspaceId: string
    workspaceName: string
  },
) {
  if (action.type === 'create-group' || action.type === 'create-team') return Boolean(fields.workspaceName.trim())
  if (action.type === 'workspace-member-add') return Boolean(fields.targetUserId.trim())
  if (action.type === 'user-join-team' || action.type === 'user-join-group') return Boolean(fields.workspaceId.trim())
  if (action.type === 'workspace-invite-create') return Boolean(fields.inviteEmail.trim() || fields.targetUserId.trim())
  return true
}

export function shouldShowPlanOperationPicker(action: AdminOperatorAction, planOperation: AdminOperatorPlanOperationMode) {
  return action.type === 'group-plan' && !action.mode && getPlanOperationOptions(action, planOperation).length > 1
}

export function getPlanOperationOptions(action: AdminOperatorAction, planOperation: AdminOperatorPlanOperationMode): AdminOperatorPlanOperationMode[] {
  if (action.type === 'group-plan') {
    if (action.mode) return [action.mode]
    if (!action.subscriptionId) return ['assign']
    const options: AdminOperatorPlanOperationMode[] = ['renew']
    if (action.currentPlanKey !== 'collaborate_plus') options.push('upgrade')
    options.push('delete')
    return options
  }
  if (action.type === 'team-plan') return action.mode ? [action.mode] : [planOperation]
  return [planOperation]
}

export function shouldShowPlanKeyField(action: AdminOperatorAction, planOperation: AdminOperatorPlanOperationMode) {
  if (action.type === 'create-team') return true
  if (action.type === 'group-plan') return planOperation === 'assign' || planOperation === 'upgrade'
  if (action.type === 'team-plan') return planOperation === 'assign' || planOperation === 'upgrade'
  return false
}

export function shouldShowSeatCapacityField(action: AdminOperatorAction, planOperation: AdminOperatorPlanOperationMode) {
  if (action.type === 'create-team') return true
  return action.type === 'team-plan' && ['assign', 'renew', 'upgrade'].includes(planOperation)
}

export function shouldShowScheduleFields(action: AdminOperatorAction, planOperation: AdminOperatorPlanOperationMode) {
  if (action.type === 'create-team') return true
  return (action.type === 'group-plan' || action.type === 'team-plan') && ['assign', 'renew', 'upgrade'].includes(planOperation)
}

export function shouldShowGrantToggle(action: AdminOperatorAction, planOperation: AdminOperatorPlanOperationMode) {
  if (action.type === 'create-team') return true
  return (action.type === 'group-plan' || action.type === 'team-plan') && ['assign', 'renew', 'upgrade'].includes(planOperation)
}

export function calculatePlanPreview(action: AdminOperatorAction, planOperation: AdminOperatorPlanOperationMode, planKey: string, seatCapacity: number) {
  const included = planCatalog[planKey as keyof typeof planCatalog]?.includedCredits ?? 0
  if (action.type === 'create-team') return included * Math.max(1, seatCapacity)
  if (action.type === 'group-plan') {
    if (planOperation === 'upgrade') {
      const currentIncluded = planCatalog[(action.currentPlanKey || 'collaborate_start') as keyof typeof planCatalog]?.includedCredits ?? 0
      return Math.max(0, included - currentIncluded)
    }
    if (planOperation === 'assign' || planOperation === 'renew') return included
    return 0
  }
  if (action.type === 'team-plan') {
    if (planOperation === 'upgrade') {
      const currentIncluded = planCatalog[(action.workspace.planKey || 'team_start') as keyof typeof planCatalog]?.includedCredits ?? 0
      const currentSeats = Math.max(1, action.workspace.seatCapacity || 1)
      return Math.max(0, included * Math.max(1, seatCapacity) - currentIncluded * currentSeats)
    }
    if (planOperation === 'assign' || planOperation === 'renew') return included * Math.max(1, seatCapacity)
  }
  return 0
}

export function isCurrentPlanStatus(status?: null | string) {
  return status === 'active' || status === 'trialing' || status === 'paused'
}

function humanizePlanOperation(planOperation: AdminOperatorPlanOperationMode) {
  return planOperation.charAt(0).toUpperCase() + planOperation.slice(1)
}
