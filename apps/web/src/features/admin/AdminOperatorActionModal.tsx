'use client'

import { useMemo, useState } from 'react'
import { selectStyle } from './adminAiShared'
import { AdminOperatorWorkspacePicker } from './AdminOperatorWorkspacePicker'
import {
  calculatePlanPreview,
  canSubmitAction,
  getPlanOperationOptions,
  memberRoles,
  resolveActionTitle,
  resolveInitialPlanKey,
  resolveInitialPlanOperation,
  resolveInitialRole,
  resolveSubmitLabel,
  runAdminOperatorActionMutation,
  shouldShowGrantToggle,
  shouldShowPlanKeyField,
  shouldShowPlanOperationPicker,
  shouldShowScheduleFields,
  shouldShowSeatCapacityField,
  toMemberRole,
} from './adminOperatorActionMutations'
import { collaboratePlans, NumberInput, PlanScheduleFields, StrictSelect, TeamMonthlyScheduleFields, teamPlans, TextInput, Toggle, toFloat, toInt } from './AdminFinanceFields'
import type { AdminOperatorAction, AdminOperatorCreditTarget } from './adminOperatorActions'
import { GroupPlanActionMatrix, PlanActionChoices, PlanModalSummary, PlanPreviewPill } from './adminOperatorPlanModalSections'
import type { AdminOperatorMutationResult } from './adminOperatorActionMutations'

const TEAM_SEAT_MAX = 15
const TEAM_DURATION_UNIT_DAYS = 30

export function AdminOperatorActionModal({
  action,
  enabled,
  onClose,
  onDone,
}: {
  action: AdminOperatorAction | null
  enabled: boolean
  onClose: () => void
  onDone: (result: AdminOperatorMutationResult) => void
}) {
  const [note, setNote] = useState('')
  const [creditTargetId, setCreditTargetId] = useState(resolveInitialCreditTargetId(action))
  const [credits, setCredits] = useState('100')
  const [durationCount, setDurationCount] = useState('1')
  const [effectMode, setEffectMode] = useState('immediate')
  const [expiresInDays, setExpiresInDays] = useState('7')
  const [grantIncluded, setGrantIncluded] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [planKey, setPlanKey] = useState(resolveInitialPlanKey(action))
  const [planOperation, setPlanOperation] = useState(resolveInitialPlanOperation(action))
  const [role, setRole] = useState(resolveInitialRole(action))
  const [seatCapacity, setSeatCapacity] = useState(action?.type === 'team-plan' ? String(action.workspace.seatCapacity || 2) : '2')
  const [targetUserId, setTargetUserId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [status, setStatus] = useState('ready')
  const [running, setRunning] = useState(false)

  const title = useMemo(() => resolveActionTitle(action, planOperation), [action, planOperation])

  if (!action) return null
  const currentAction = action

  const planOperationOptions = getPlanOperationOptions(currentAction, planOperation)
  const showOperationPicker = shouldShowPlanOperationPicker(currentAction, planOperation)
  const showPlanKey = shouldShowPlanKeyField(currentAction, planOperation)
  const showSeatCapacity = shouldShowSeatCapacityField(currentAction, planOperation)
  const showSchedule = shouldShowScheduleFields(currentAction, planOperation)
  const showGrantToggle = shouldShowGrantToggle(currentAction, planOperation)
  const planPreview = calculatePlanPreview(currentAction, planOperation, planKey, toInt(seatCapacity), toInt(durationCount))
  const planOptions = currentAction.type === 'group-plan'
    ? (planOperation === 'upgrade' ? ['collaborate_plus'] : collaboratePlans)
    : (currentAction.type === 'team-plan' && currentAction.targetPlanKey ? [currentAction.targetPlanKey] : teamPlans)
  const saveLabel = resolveSubmitLabel(currentAction, planOperation)
  const invalidSeatCapacity = showSeatCapacity && (toInt(seatCapacity) <= 0 || toInt(seatCapacity) > TEAM_SEAT_MAX)
  const isBillingCreditAction = action.type === 'billing-topup' || action.type === 'billing-deduct'

  async function submit() {
    if (!enabled || running) return
    setRunning(true)
    setStatus('saving...')
    try {
      const result = await runAdminOperatorActionMutation(currentAction, {
        amountCents: 0,
        creditTargetId,
        credits: toFloat(credits),
        durationCount: toInt(durationCount),
        durationUnitDays: TEAM_DURATION_UNIT_DAYS,
        effectMode,
        expiresInDays: toInt(expiresInDays),
        grantIncluded,
        inviteEmail,
        note,
        planKey,
        planOperation,
        role,
        seatCapacity: toInt(seatCapacity),
        targetUserId,
        workspaceId,
        workspaceName,
      })
      if ('acceptPath' in result && typeof window !== 'undefined') {
        const inviteUrl = `${window.location.origin}${result.acceptPath}`
        void navigator.clipboard?.writeText(inviteUrl).catch(() => undefined)
      }
      setStatus(result.message || 'saved')
      onDone(result)
      onClose()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'save failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="admin-modal" aria-modal="true" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="management-panel-heading compact">
          <h2>{title}</h2>
          <span className="management-status">{status}</span>
        </div>

        {(currentAction.type === 'group-plan' || currentAction.type === 'team-plan') ? (
          <PlanModalSummary action={currentAction} />
        ) : null}

        <div className="admin-modal-grid">
          {isBillingCreditAction ? (
            <>
              <CreditTargetSelect
                label={action.type === 'billing-topup' ? 'Top to' : 'From'}
                onChange={setCreditTargetId}
                targets={action.targets}
                value={creditTargetId}
              />
              <NumberInput label="Credits" onChange={setCredits} value={credits} />
            </>
          ) : null}

          {action.type === 'user-topup' || action.type === 'workspace-topup' ? (
            <>
              <NumberInput label="Credits" onChange={setCredits} value={credits} />
            </>
          ) : null}

          {action.type === 'user-deduct' || action.type === 'workspace-deduct' ? (
            <NumberInput label="Credits" onChange={setCredits} value={credits} />
          ) : null}

          {action.type === 'create-group' ? (
            <TextInput label="Workspace name" onChange={setWorkspaceName} placeholder="Group workspace" value={workspaceName} />
          ) : null}

          {action.type === 'create-team' ? (
            <TextInput label="Workspace name" onChange={setWorkspaceName} placeholder="Team workspace" value={workspaceName} />
          ) : null}

          {action.type === 'workspace-member-add' ? (
            <>
              <TextInput label="User ID" onChange={setTargetUserId} placeholder="user_xxx" value={targetUserId} />
              <StrictSelect label="Role" onChange={(value) => setRole(toMemberRole(value))} options={memberRoles} value={role} />
            </>
          ) : null}

          {action.type === 'user-join-team' || action.type === 'user-join-group' ? (
            <>
              <AdminOperatorWorkspacePicker
                excludedWorkspaceIds={action.excludedWorkspaceIds ?? []}
                kind={action.type === 'user-join-team' ? 'team_workspace' : 'group_workspace'}
                onChange={setWorkspaceId}
                value={workspaceId}
              />
              <StrictSelect label="Role" onChange={(value) => setRole(toMemberRole(value))} options={memberRoles} value={role} />
            </>
          ) : null}

          {action.type === 'workspace-invite-create' ? (
            <>
              <TextInput label="Invite email" onChange={setInviteEmail} placeholder="name@example.com" value={inviteEmail} />
              <TextInput label="Target user ID" onChange={setTargetUserId} placeholder="user_xxx" value={targetUserId} />
              <StrictSelect label="Role" onChange={(value) => setRole(toMemberRole(value))} options={memberRoles} value={role} />
              <NumberInput label="Expires days" min="1" onChange={setExpiresInDays} value={expiresInDays} />
            </>
          ) : null}

          {showOperationPicker ? (
            <div className="admin-modal-grid-span">
              {currentAction.type === 'group-plan' ? (
                <GroupPlanActionMatrix
                  currentPlanKey={currentAction.currentPlanKey}
                  onChange={setPlanOperation}
                  options={planOperationOptions}
                  selected={planOperation}
                />
              ) : (
                <PlanActionChoices onChange={setPlanOperation} options={planOperationOptions} value={planOperation} />
              )}
            </div>
          ) : null}

          {(action.type === 'create-team' || action.type === 'group-plan' || action.type === 'team-plan') && showPlanKey ? (
            <StrictSelect label="Plan" onChange={setPlanKey} options={planOptions} value={planKey} />
          ) : null}

          {(action.type === 'create-team' || action.type === 'team-plan') && showSeatCapacity ? (
            <NumberInput label="Seats" max={String(TEAM_SEAT_MAX)} min="1" onChange={setSeatCapacity} value={seatCapacity} />
          ) : null}

          {(action.type === 'create-team' || action.type === 'group-plan' || action.type === 'team-plan') && showSchedule ? (
            currentAction.type === 'create-team' || currentAction.type === 'team-plan' ? (
              <TeamMonthlyScheduleFields
                durationCount={durationCount}
                effectMode={effectMode}
                onDurationCountChange={setDurationCount}
                onEffectModeChange={setEffectMode}
              />
            ) : (
              <PlanScheduleFields
                durationCount={durationCount}
                effectMode={effectMode}
                onDurationCountChange={setDurationCount}
                onEffectModeChange={setEffectMode}
              />
            )
          ) : null}

          {(action.type === 'create-team' || action.type === 'group-plan' || action.type === 'team-plan') && showGrantToggle ? (
            <div className="admin-modal-grid-span admin-modal-inline-row">
              <Toggle checked={grantIncluded} label="Grant with credits" onChange={setGrantIncluded} />
              <PlanPreviewPill value={planPreview} />
            </div>
          ) : null}

          {action.type === 'workspace-member-role' ? (
            <StrictSelect label="Role" onChange={(value) => setRole(toMemberRole(value))} options={memberRoles} value={role} />
          ) : null}

          <TextInput label="Reason" onChange={setNote} placeholder="manual correction / support request / plan migration" value={note} />
        </div>

        <div className="admin-modal-actions">
          <button className="product-button product-button-secondary" onClick={onClose} type="button">Cancel</button>
          <button
            className="product-button"
            disabled={!enabled || running || !note.trim() || !canSubmitAction(currentAction, { creditTargetId, inviteEmail, targetUserId, workspaceId, workspaceName }) || invalidSeatCapacity}
            onClick={submit}
            type="button"
          >
            {saveLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function CreditTargetSelect({
  label,
  onChange,
  targets,
  value,
}: {
  label: string
  onChange: (value: string) => void
  targets: AdminOperatorCreditTarget[]
  value: string
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="management-field-label">{label}</span>
      <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
        {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
      </select>
    </label>
  )
}

function resolveInitialCreditTargetId(action: AdminOperatorAction | null) {
  if (action?.type === 'billing-topup' || action?.type === 'billing-deduct') {
    return action.targets[0]?.id ?? 'personal'
  }
  return 'personal'
}
