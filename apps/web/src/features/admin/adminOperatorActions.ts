import type { AdminOperatorWorkspacePlan } from './adminTypes'

export type AdminOperatorCreditTarget = {
  id: string
  kind: 'personal' | 'team_wallet'
  label: string
  workspaceId?: string
}

export type AdminOperatorPlanOperationMode =
  | 'assign'
  | 'delete'
  | 'freeze'
  | 'renew'
  | 'unfreeze'
  | 'upgrade'

export type AdminOperatorAction =
  | { boardId: string; title: string; type: 'board-copy'; workspaceId: string }
  | { boardId: string; title: string; type: 'board-delete'; workspaceId: string }
  | { type: 'cancel-subscription'; subscriptionId: string; title: string }
  | { type: 'create-group'; userId: string }
  | { type: 'create-team'; userId: string }
  | { excludedWorkspaceIds?: string[]; type: 'user-join-group'; userId: string }
  | { excludedWorkspaceIds?: string[]; type: 'user-join-team'; userId: string }
  | {
      currentPlanKey?: null | string
      periodEnd?: null | string
      periodStart?: null | string
      currentStatus?: null | string
      mode?: AdminOperatorPlanOperationMode
      subscriptionId?: null | string
      title?: string
      type: 'group-plan'
      userId: string
    }
  | { currentRole: 'admin' | 'editor' | 'viewer'; title: string; type: 'workspace-member-role'; userId: string; workspaceId: string }
  | { title: string; type: 'workspace-member-remove'; userId: string; workspaceId: string }
  | { title: string; type: 'subscription-freeze'; subscriptionId: string }
  | { title: string; type: 'subscription-unfreeze'; subscriptionId: string }
  | { title: string; type: 'user-delete'; userId: string }
  | { nextStatus: 'active' | 'suspended'; title: string; type: 'user-status'; userId: string }
  | { title: string; type: 'workspace-invite-create'; workspaceId: string }
  | { invitationId: string; title: string; type: 'workspace-invite-revoke'; workspaceId: string }
  | { title: string; type: 'workspace-member-add'; workspaceId: string }
  | { title: string; type: 'delete-workspace'; workspaceId: string }
  | {
      mode?: AdminOperatorPlanOperationMode
      targetPlanKey?: null | string
      title?: string
      type: 'team-plan'
      workspace: AdminOperatorWorkspacePlan
    }
  | { title: string; type: 'user-deduct'; userId: string }
  | { title: string; type: 'user-topup'; userId: string }
  | { title: string; type: 'workspace-deduct'; workspaceId: string }
  | { title: string; type: 'workspace-topup'; workspaceId: string }
  | { targets: AdminOperatorCreditTarget[]; title: string; type: 'billing-deduct'; userId: string }
  | { targets: AdminOperatorCreditTarget[]; title: string; type: 'billing-topup'; userId: string }

export function getAdminOperatorActionKey(action: AdminOperatorAction) {
  switch (action.type) {
    case 'team-plan':
      return `${action.type}:${action.workspace.id}:${action.workspace.subscriptionId ?? 'none'}:${action.mode ?? 'default'}:${action.targetPlanKey ?? 'none'}`
    case 'workspace-member-role':
      return `${action.type}:${action.workspaceId}:${action.userId}:${action.currentRole}`
    case 'workspace-member-remove':
    case 'workspace-member-add':
    case 'workspace-invite-create':
    case 'delete-workspace':
    case 'workspace-deduct':
    case 'workspace-topup':
      return `${action.type}:${action.workspaceId}`
    case 'workspace-invite-revoke':
      return `${action.type}:${action.workspaceId}:${action.invitationId}`
    case 'board-copy':
    case 'board-delete':
      return `${action.type}:${action.workspaceId}:${action.boardId}`
    case 'group-plan':
      return `${action.type}:${action.userId}:${action.subscriptionId ?? 'none'}:${action.mode ?? 'default'}:${action.currentPlanKey ?? 'none'}`
    case 'cancel-subscription':
    case 'subscription-freeze':
    case 'subscription-unfreeze':
      return `${action.type}:${action.subscriptionId}`
    case 'create-group':
    case 'create-team':
    case 'user-join-group':
    case 'user-join-team':
    case 'user-delete':
    case 'user-deduct':
    case 'user-topup':
    case 'user-status':
      return `${action.type}:${action.userId}`
    case 'billing-deduct':
    case 'billing-topup':
      return `${action.type}:${action.userId}:${action.targets.map((target) => target.id).join(',')}`
  }
}
