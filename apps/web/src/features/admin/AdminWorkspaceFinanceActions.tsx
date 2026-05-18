'use client'

import { useState } from 'react'
import {
  getTeamPlanOptions,
  NumberInput,
  StrictSelect,
  TeamMonthlyScheduleFields,
  Toggle,
  TextInput,
  toFloat,
  toInt,
} from './AdminFinanceFields'
import {
  adminManualAdjustWorkspaceCredits,
  adminManualCancelSubscription,
  adminManualDeleteWorkspace,
  adminManualSetTeamPlan,
  adminManualTopupWorkspace,
} from './adminFinanceClient'
import { adminManualOperateGroupPlan } from './adminFinancePlanOperationsClient'

type WorkspaceKind = 'group' | 'team'

export function AdminWorkspaceFinanceActions({
  enabled,
  onMutated,
  workspaceId,
  ownerUserId,
  subscriptionId,
  workspaceKind = 'team',
}: {
  enabled: boolean
  onMutated: () => void
  ownerUserId?: null | string
  workspaceId: string
  subscriptionId?: null | string
  workspaceKind?: WorkspaceKind
}) {
  const [credits, setCredits] = useState('100')
  const [grantIncluded, setGrantIncluded] = useState(true)
  const [note, setNote] = useState('')
  const [planKey, setPlanKey] = useState('team_start')
  const [durationCount, setDurationCount] = useState('1')
  const [effectMode, setEffectMode] = useState('immediate')
  const [seatCapacity, setSeatCapacity] = useState('2')
  const [status, setStatus] = useState('ready')
  const [running, setRunning] = useState(false)
  const hasReason = Boolean(note.trim())

  async function run(label: string, action: () => Promise<{ message: string }>) {
    if (!enabled || running || !workspaceId) return
    setRunning(true)
    setStatus(`${label}...`)
    try {
      const result = await action()
      setStatus(result.message || `${label} done.`)
      onMutated()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} failed.`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="admin-detail-finance-shell">
      <div className="management-panel-heading compact">
        <div><h3>{workspaceKind === 'team' ? 'Team billing actions' : 'Group actions'}</h3></div>
        <span className="management-status">{status}</span>
      </div>

      <TextInput label="Operation reason" onChange={setNote} placeholder="manual correction / support request / plan migration" value={note} />

      {workspaceKind === 'team' ? (
        <div className="manual-finance-block">
          <div className="management-field-grid two">
            <NumberInput label="Credits" onChange={setCredits} value={credits} />
          </div>
          <div className="management-actions is-start">
            <button
              className="product-button"
              disabled={!enabled || running || !workspaceId || !hasReason}
              onClick={() => run('Top up team', () => adminManualTopupWorkspace({
                credits: toFloat(credits),
                note,
                workspaceId,
              }))}
              type="button"
            >
              Top up Team wallet
            </button>
            <button
              className="product-button product-button-secondary"
              disabled={!enabled || running || !workspaceId || !hasReason}
              onClick={() => run('Deduct team', () => adminManualAdjustWorkspaceCredits({
                creditsDelta: -toFloat(credits),
                note,
                workspaceId,
              }))}
              type="button"
            >
              Deduct credits
            </button>
          </div>
          <div className="management-field-grid two">
            <StrictSelect label="Plan" onChange={setPlanKey} options={getTeamPlanOptions()} value={planKey} />
            <NumberInput label="Seats" onChange={setSeatCapacity} value={seatCapacity} />
            <TeamMonthlyScheduleFields
              durationCount={durationCount}
              effectMode={effectMode}
              onDurationCountChange={setDurationCount}
              onEffectModeChange={setEffectMode}
            />
            <Toggle checked={grantIncluded} label="Grant included credits" onChange={setGrantIncluded} />
          </div>
          <div className="management-actions is-start">
            <button
              className="product-button product-button-secondary"
              disabled={!enabled || running || !workspaceId || !hasReason}
              onClick={() => run('Assign team plan', () => adminManualSetTeamPlan({
                durationCount: toInt(durationCount),
                durationUnitDays: 30,
                effectMode,
                grantIncludedCredits: grantIncluded,
                note,
                planKey,
                seatCapacity: toInt(seatCapacity),
                workspaceId,
              }))}
              type="button"
            >
              Change Team plan
            </button>
            <button
              className="product-button product-button-secondary"
              disabled={!enabled || running || !subscriptionId || !hasReason}
              onClick={() => run('Delete team plan', () => adminManualCancelSubscription(subscriptionId ?? '', note))}
              type="button"
            >
              Delete plan
            </button>
          </div>
        </div>
      ) : null}

      <div className="manual-finance-block">
        {workspaceKind === 'group' ? (
          <button
            className="product-button product-button-secondary"
            disabled={!enabled || running || !subscriptionId || !ownerUserId || !hasReason}
            onClick={() => run('Delete group plan', () => adminManualOperateGroupPlan({
              action: 'delete',
              note,
              subscriptionId: subscriptionId ?? undefined,
              userId: ownerUserId ?? '',
            }))}
            type="button"
          >
            Delete Group plan
          </button>
        ) : null}
        <button
          className="product-button product-button-secondary"
          disabled={!enabled || running || !workspaceId || !hasReason}
          onClick={() => run('Delete workspace', () => adminManualDeleteWorkspace(workspaceId, note))}
          type="button"
        >
          Delete {workspaceKind === 'team' ? 'Team' : 'Group'}
        </button>
      </div>
    </section>
  )
}
