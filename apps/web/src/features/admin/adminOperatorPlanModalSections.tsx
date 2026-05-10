'use client'

import { formatPlanKey, periodText } from './AdminOperatorDetailTables'
import type { AdminOperatorPlanOperationMode } from './adminOperatorActions'
import type { AdminOperatorAction } from './adminOperatorActions'

export function PlanActionChoices({
  onChange,
  options,
  value,
}: {
  onChange: (value: AdminOperatorPlanOperationMode) => void
  options: AdminOperatorPlanOperationMode[]
  value: AdminOperatorPlanOperationMode
}) {
  return (
    <div className="admin-plan-choice-list" role="radiogroup" aria-label="Plan action">
      {options.map((option) => (
        <button
          aria-pressed={value === option}
          className={value === option ? 'is-selected' : undefined}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {labelForPlanOperation(option)}
        </button>
      ))}
    </div>
  )
}

export function GroupPlanActionMatrix({
  currentPlanKey,
  onChange,
  options,
  selected,
}: {
  currentPlanKey?: null | string
  onChange: (value: AdminOperatorPlanOperationMode) => void
  options: AdminOperatorPlanOperationMode[]
  selected: AdminOperatorPlanOperationMode
}) {
  return (
    <div className="admin-group-plan-matrix">
      {options.map((option) => (
        <button
          aria-pressed={selected === option}
          className={selected === option ? 'is-selected' : undefined}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          <span className="admin-group-plan-matrix-check" aria-hidden="true" />
          <div className="admin-group-plan-matrix-copy">
            <strong>{labelForPlanOperation(option)}</strong>
            <small>{descriptionForGroupPlanOption(option, currentPlanKey)}</small>
          </div>
        </button>
      ))}
    </div>
  )
}

export function PlanModalSummary({ action }: { action: AdminOperatorAction }) {
  if (action.type === 'group-plan') {
    return (
      <div className="admin-modal-plan-summary">
        <span className="management-field-label">Current plan</span>
        <div className="admin-modal-plan-summary-card">
          <div className="admin-modal-plan-summary-main">
            <strong>{formatPlanKey(action.currentPlanKey)}</strong>
            <small className={action.currentStatus === 'canceled' ? 'is-muted' : 'is-active'}>
              {periodText(action.periodStart, action.periodEnd)}
            </small>
          </div>
          <span className="management-badge">{action.currentStatus ?? '-'}</span>
        </div>
      </div>
    )
  }

  if (action.type === 'team-plan') {
    return (
      <div className="admin-modal-plan-summary">
        <span className="management-field-label">Current plan</span>
        <div className="admin-modal-plan-summary-card">
          <div className="admin-modal-plan-summary-main">
            <strong>{formatPlanKey(action.workspace.planKey)}</strong>
            <small className={action.workspace.planStatus === 'canceled' ? 'is-muted' : 'is-active'}>{periodText(action.workspace.periodStart, action.workspace.periodEnd)}</small>
          </div>
          <span className="management-badge">{action.workspace.planStatus ?? '-'}</span>
        </div>
      </div>
    )
  }

  return null
}

export function PlanPreviewPill({ value }: { value: number }) {
  return <span className="admin-plan-preview-pill">{value.toLocaleString('en-US')}</span>
}

function labelForPlanOperation(value: AdminOperatorPlanOperationMode) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function descriptionForGroupPlanOption(
  option: AdminOperatorPlanOperationMode,
  currentPlanKey?: null | string,
) {
  if (option === 'renew') return currentPlanKey ? `Keep ${formatPlanKey(currentPlanKey)}` : 'Keep current plan'
  if (option === 'upgrade') return currentPlanKey === 'collaborate_plus' ? 'Current top tier' : 'Move to Collaborate Plus'
  if (option === 'delete') return 'Remove current plan'
  if (option === 'freeze') return 'Pause current plan'
  if (option === 'unfreeze') return 'Resume current plan'
  return currentPlanKey ? formatPlanKey(currentPlanKey) : 'Current plan'
}
