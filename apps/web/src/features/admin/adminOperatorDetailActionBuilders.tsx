'use client'

import { isCurrentPlanStatus } from './adminOperatorActionPresentation'
import type { AdminOperatorAction } from './adminOperatorActions'
import type { AdminOperatorUserPlan, AdminOperatorWorkspacePlan } from './adminTypes'

export function buildTeamPlanActions(workspace: AdminOperatorWorkspacePlan, onAction: (action: AdminOperatorAction) => void) {
  const isCurrentPlan = isCurrentPlanStatus(workspace.planStatus)
  const atSeatCap = workspace.seatCapacity >= 15
  const actions = []
  if (!isCurrentPlan) {
    actions.push({
      label: 'Renew',
      onClick: () => onAction({ mode: 'renew', title: `Renew ${workspace.workspaceName}`, type: 'team-plan', workspace }),
    })
  } else {
    if (workspace.planKey === 'team_start') {
      actions.push({
        label: 'Upgrade',
        onClick: () => onAction({ mode: 'upgrade', targetPlanKey: 'team_growth', title: `Upgrade ${workspace.workspaceName}`, type: 'team-plan', workspace }),
      })
    }
    actions.push({
      label: 'Buy seat',
      disabled: atSeatCap,
      onClick: () => onAction({ mode: 'upgrade', targetPlanKey: workspace.planKey, title: `Buy seats for ${workspace.workspaceName}`, type: 'team-plan', workspace }),
      title: atSeatCap ? 'Team seat cap is 15.' : undefined,
    })
    actions.push({
      label: workspace.planStatus === 'paused' ? 'Unfreeze' : 'Freeze',
      onClick: () => onAction({ mode: workspace.planStatus === 'paused' ? 'unfreeze' : 'freeze', title: `${workspace.planStatus === 'paused' ? 'Unfreeze' : 'Freeze'} ${workspace.workspaceName}`, type: 'team-plan', workspace }),
    })
    actions.push({ label: 'Top up', onClick: () => onAction({ title: `Top up ${workspace.workspaceName}`, type: 'workspace-topup', workspaceId: workspace.id }) })
    actions.push({ label: 'Deduct', onClick: () => onAction({ title: `Deduct ${workspace.workspaceName}`, type: 'workspace-deduct', workspaceId: workspace.id }) })
  }
  if (workspace.subscriptionId) {
    actions.push({
      label: isCurrentPlan ? 'Delete' : 'Delete history',
      onClick: () => onAction({ mode: 'delete', title: `Delete ${workspace.workspaceName}`, type: 'team-plan', workspace }),
    })
  }
  return actions
}

export function buildJoinedWorkspaceActions(
  kind: 'group' | 'team',
  onAction: (action: AdminOperatorAction) => void,
  userId: string,
  workspace: AdminOperatorWorkspacePlan,
) {
  const actions = []
  actions.push({
    label: 'Leave',
    onClick: () => onAction({
      title: kind === 'team' ? 'Remove from team' : 'Remove from group',
      type: 'workspace-member-remove',
      userId,
      workspaceId: workspace.id,
    }),
  })
  return actions
}

export function buildGroupPlanActions(
  plan: AdminOperatorUserPlan,
  userId: string,
  onAction: (action: AdminOperatorAction) => void,
  options: { includeWalletActions?: boolean } = {},
) {
  const isCurrentPlan = isCurrentPlanStatus(plan.status)
  const actions = []
  if (!isCurrentPlan) {
    actions.push({
      label: 'Renew',
      onClick: () => onAction({
        currentPlanKey: plan.planKey,
        currentStatus: plan.status,
        mode: 'renew',
        periodEnd: plan.periodEnd,
        periodStart: plan.periodStart,
        subscriptionId: plan.subscriptionId,
        title: `Renew ${plan.planKey}`,
        type: 'group-plan',
        userId,
      }),
    })
  }
  if (isCurrentPlan && plan.planKey === 'collaborate_start') {
    actions.push({
      label: 'Upgrade',
      onClick: () => onAction({
        currentPlanKey: plan.planKey,
        currentStatus: plan.status,
        mode: 'upgrade',
        periodEnd: plan.periodEnd,
        periodStart: plan.periodStart,
        subscriptionId: plan.subscriptionId,
        title: `Upgrade ${plan.planKey}`,
        type: 'group-plan',
        userId,
      }),
    })
  }
  if (plan.status === 'paused') {
    actions.push({
      label: 'Unfreeze',
      onClick: () => onAction({
        currentPlanKey: plan.planKey,
        currentStatus: plan.status,
        mode: 'unfreeze',
        periodEnd: plan.periodEnd,
        periodStart: plan.periodStart,
        subscriptionId: plan.subscriptionId,
        title: `Unfreeze ${plan.planKey}`,
        type: 'group-plan',
        userId,
      }),
    })
  }
  if (plan.status === 'active' || plan.status === 'trialing') {
    actions.push({
      label: 'Freeze',
      onClick: () => onAction({
        currentPlanKey: plan.planKey,
        currentStatus: plan.status,
        mode: 'freeze',
        periodEnd: plan.periodEnd,
        periodStart: plan.periodStart,
        subscriptionId: plan.subscriptionId,
        title: `Freeze ${plan.planKey}`,
        type: 'group-plan',
        userId,
      }),
    })
  }
  if (options.includeWalletActions && isCurrentPlan) {
    actions.push({
      label: 'Top up',
      onClick: () => onAction({ title: 'Top up personal credits', type: 'user-topup', userId }),
    })
    actions.push({
      label: 'Deduct',
      onClick: () => onAction({ title: 'Deduct personal credits', type: 'user-deduct', userId }),
    })
  }
  if (plan.status !== 'canceled') {
    actions.push({
      label: isCurrentPlan ? 'Delete' : 'Delete history',
      onClick: () => onAction({
        currentPlanKey: plan.planKey,
        currentStatus: plan.status,
        mode: 'delete',
        periodEnd: plan.periodEnd,
        periodStart: plan.periodStart,
        subscriptionId: plan.subscriptionId,
        title: `Delete ${plan.planKey}`,
        type: 'group-plan',
        userId,
      }),
    })
  }
  return actions
}
