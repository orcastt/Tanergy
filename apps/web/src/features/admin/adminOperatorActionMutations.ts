'use client'

import { adminManualOperateGroupPlan, adminManualOperateTeamPlan } from './adminFinancePlanOperationsClient'
import {
  adminManualAdjustUserCredits,
  adminManualAdjustWorkspaceCredits,
  adminManualCancelSubscription,
  adminManualCreateGroupWorkspace,
  adminManualCreateTeamWorkspace,
  adminManualDeleteWorkspace,
  adminManualTopupUser,
  adminManualTopupWorkspace,
  type AdminFinanceManualMutationResource,
} from './adminFinanceClient'
import {
  adminOperatorAddWorkspaceMember,
  adminOperatorCopyBoard,
  adminOperatorCreateWorkspaceInvitation,
  adminOperatorDeleteBoard,
  adminOperatorDeleteUser,
  adminOperatorFreezeSubscription,
  adminOperatorRemoveWorkspaceMember,
  adminOperatorRevokeWorkspaceInvitation,
  adminOperatorSetUserStatus,
  adminOperatorUnfreezeSubscription,
  adminOperatorUpdateWorkspaceMemberRole,
} from './adminOperatorClient'
import type { AdminOperatorAction, AdminOperatorPlanOperationMode } from './adminOperatorActions'
import {
  calculatePlanPreview,
  canSubmitAction,
  getPlanOperationOptions,
  isCurrentPlanStatus,
  resolveActionTitle,
  resolveInitialPlanKey,
  resolveInitialPlanOperation,
  resolveSubmitLabel,
  shouldShowGrantToggle,
  shouldShowPlanKeyField,
  shouldShowPlanOperationPicker,
  shouldShowScheduleFields,
  shouldShowSeatCapacityField,
} from './adminOperatorActionPresentation'
import type {
  AdminOperatorBoardMutationResource,
  AdminOperatorSubscriptionMutationResource,
  AdminOperatorUserMutationResource,
  AdminOperatorWorkspaceInvitationCreateResource,
  AdminOperatorWorkspaceInvitationResource,
  AdminOperatorWorkspaceMemberMutationResource,
} from './adminTypes'

export type MemberRole = 'admin' | 'editor' | 'viewer'

export type AdminOperatorActionFormValues = {
  amountCents: number
  creditTargetId: string
  credits: number
  durationCount: number
  durationUnitDays: number
  effectMode: string
  expiresInDays: number
  grantIncluded: boolean
  inviteEmail: string
  note: string
  planKey: string
  planOperation: AdminOperatorPlanOperationMode
  role: string
  seatCapacity: number
  targetUserId: string
  workspaceId: string
  workspaceName: string
}

export type AdminOperatorMutationResult =
  | AdminFinanceManualMutationResource
  | AdminOperatorBoardMutationResource
  | AdminOperatorSubscriptionMutationResource
  | AdminOperatorUserMutationResource
  | AdminOperatorWorkspaceInvitationCreateResource
  | AdminOperatorWorkspaceInvitationResource
  | AdminOperatorWorkspaceMemberMutationResource

export const memberRoles: readonly MemberRole[] = ['admin', 'editor', 'viewer']

export {
  calculatePlanPreview,
  canSubmitAction,
  getPlanOperationOptions,
  isCurrentPlanStatus,
  resolveActionTitle,
  resolveInitialPlanKey,
  resolveInitialPlanOperation,
  resolveSubmitLabel,
  shouldShowGrantToggle,
  shouldShowPlanKeyField,
  shouldShowPlanOperationPicker,
  shouldShowScheduleFields,
  shouldShowSeatCapacityField,
}

export function resolveInitialRole(action: AdminOperatorAction | null): MemberRole {
  if (action?.type === 'workspace-member-role') return action.currentRole
  return 'viewer'
}

export function runAdminOperatorActionMutation(
  action: AdminOperatorAction,
  form: AdminOperatorActionFormValues,
): Promise<AdminOperatorMutationResult> {
  switch (action.type) {
    case 'billing-topup':
      {
        const target = resolveCreditTarget(action, form.creditTargetId)
        if (target.kind === 'team_wallet') {
          return adminManualTopupWorkspace({
            amountCents: form.amountCents,
            credits: form.credits,
            note: form.note,
            workspaceId: requireWorkspaceTarget(target),
          })
        }
        return adminManualTopupUser({ amountCents: form.amountCents, credits: form.credits, note: form.note, userId: action.userId })
      }
    case 'billing-deduct':
      {
        const target = resolveCreditTarget(action, form.creditTargetId)
        if (target.kind === 'team_wallet') {
          return adminManualAdjustWorkspaceCredits({
            creditsDelta: -form.credits,
            note: form.note,
            workspaceId: requireWorkspaceTarget(target),
          })
        }
        return adminManualAdjustUserCredits({ creditsDelta: -form.credits, note: form.note, userId: action.userId })
      }
    case 'user-topup':
      return adminManualTopupUser({ amountCents: form.amountCents, credits: form.credits, note: form.note, userId: action.userId })
    case 'user-deduct':
      return adminManualAdjustUserCredits({ creditsDelta: -form.credits, note: form.note, userId: action.userId })
    case 'workspace-topup':
      return adminManualTopupWorkspace({ amountCents: form.amountCents, credits: form.credits, note: form.note, workspaceId: action.workspaceId })
    case 'workspace-deduct':
      return adminManualAdjustWorkspaceCredits({ creditsDelta: -form.credits, note: form.note, workspaceId: action.workspaceId })
    case 'create-group':
      return adminManualCreateGroupWorkspace({ note: form.note, userId: action.userId, workspaceName: form.workspaceName.trim() })
    case 'create-team':
      return adminManualCreateTeamWorkspace({
        durationCount: form.durationCount,
        durationUnitDays: form.durationUnitDays,
        effectMode: form.effectMode,
        grantIncludedCredits: form.grantIncluded,
        note: form.note,
        planKey: form.planKey,
        seatCapacity: form.seatCapacity,
        userId: action.userId,
        workspaceName: form.workspaceName.trim(),
      })
    case 'group-plan':
      return adminManualOperateGroupPlan({
        action: form.planOperation,
        durationCount: form.durationCount,
        durationUnitDays: form.durationUnitDays,
        effectMode: form.effectMode,
        grantIncludedCredits: form.grantIncluded,
        note: form.note,
        planKey: shouldSendPlanKey(form.planOperation) ? form.planKey : undefined,
        subscriptionId: action.subscriptionId ?? undefined,
        userId: action.userId,
      })
    case 'team-plan':
      return adminManualOperateTeamPlan({
        action: form.planOperation,
        durationCount: form.durationCount,
        durationUnitDays: form.durationUnitDays,
        effectMode: form.effectMode,
        grantIncludedCredits: form.grantIncluded,
        note: form.note,
        planKey: shouldSendPlanKey(form.planOperation) ? form.planKey : undefined,
        seatCapacity: shouldSendSeatCapacity(form.planOperation) ? form.seatCapacity : undefined,
        subscriptionId: action.workspace.subscriptionId ?? undefined,
        workspaceId: action.workspace.id,
      })
    case 'user-delete':
      return adminOperatorDeleteUser({ reason: form.note, userId: action.userId })
    case 'subscription-freeze':
      return adminOperatorFreezeSubscription({ reason: form.note, subscriptionId: action.subscriptionId })
    case 'subscription-unfreeze':
      return adminOperatorUnfreezeSubscription({ reason: form.note, subscriptionId: action.subscriptionId })
    case 'user-status':
      return adminOperatorSetUserStatus({ reason: form.note, status: action.nextStatus, userId: action.userId })
    case 'cancel-subscription':
      return adminManualCancelSubscription(action.subscriptionId, form.note)
    case 'delete-workspace':
      return adminManualDeleteWorkspace(action.workspaceId, form.note)
    case 'workspace-member-role':
      return adminOperatorUpdateWorkspaceMemberRole({ reason: form.note, role: toMemberRole(form.role), userId: action.userId, workspaceId: action.workspaceId })
    case 'workspace-member-remove':
      return adminOperatorRemoveWorkspaceMember({ reason: form.note, userId: action.userId, workspaceId: action.workspaceId })
    case 'workspace-member-add':
      return adminOperatorAddWorkspaceMember({ reason: form.note, role: toMemberRole(form.role), userId: form.targetUserId.trim(), workspaceId: action.workspaceId })
    case 'user-join-team':
    case 'user-join-group':
      return adminOperatorAddWorkspaceMember({ reason: form.note, role: toMemberRole(form.role), userId: action.userId, workspaceId: form.workspaceId.trim() })
    case 'workspace-invite-create':
      return adminOperatorCreateWorkspaceInvitation({
        email: form.inviteEmail.trim() || undefined,
        expiresInDays: Math.max(1, form.expiresInDays),
        reason: form.note,
        role: toMemberRole(form.role),
        targetUserId: form.targetUserId.trim() || undefined,
        workspaceId: action.workspaceId,
      })
    case 'workspace-invite-revoke':
      return adminOperatorRevokeWorkspaceInvitation({ invitationId: action.invitationId, reason: form.note, workspaceId: action.workspaceId })
    case 'board-copy':
      return adminOperatorCopyBoard({ boardId: action.boardId, reason: form.note, workspaceId: action.workspaceId })
    case 'board-delete':
      return adminOperatorDeleteBoard({ boardId: action.boardId, reason: form.note, workspaceId: action.workspaceId })
  }
}

export function toMemberRole(value: string): MemberRole {
  if (value === 'admin' || value === 'editor') return value
  return 'viewer'
}

function shouldSendPlanKey(planOperation: AdminOperatorPlanOperationMode) {
  return planOperation === 'assign' || planOperation === 'upgrade'
}

function shouldSendSeatCapacity(planOperation: AdminOperatorPlanOperationMode) {
  return planOperation === 'assign' || planOperation === 'renew' || planOperation === 'upgrade'
}

function resolveCreditTarget(
  action: Extract<AdminOperatorAction, { type: 'billing-deduct' | 'billing-topup' }>,
  creditTargetId: string,
) {
  return action.targets.find((target) => target.id === creditTargetId) ?? action.targets[0] ?? {
    id: 'personal',
    kind: 'personal' as const,
    label: 'Personal credits',
  }
}

function requireWorkspaceTarget(target: { label: string; workspaceId?: string }) {
  if (!target.workspaceId) {
    throw new Error(`${target.label} is missing a Team workspace id.`)
  }
  return target.workspaceId
}
