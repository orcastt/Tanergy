'use client'

import { useState } from 'react'
import {
  collaboratePlans,
  NumberInput,
  PlanScheduleFields,
  StrictSelect,
  TeamMonthlyScheduleFields,
  teamPlans,
  Toggle,
  toFloat,
  toInt,
} from './AdminFinanceFields'
import {
  adminManualCancelSubscription,
  adminManualSetCollaboratePlan,
  adminManualSetTeamPlan,
  adminManualTopupUser,
  adminManualTopupWorkspace,
  type AdminFinanceManualMutationResource,
} from './adminFinanceClient'
import { FilterSelect, FilterTextInput } from './adminAiShared'

type WorkspaceOption = { label: string; value: string }

export function AdminFinanceManualControls({
  enabled,
  onMutated,
  selectedWorkspaceId,
  workspaces,
}: {
  enabled: boolean
  onMutated: () => void
  selectedWorkspaceId: string
  workspaces: WorkspaceOption[]
}) {
  const [credits, setCredits] = useState('100')
  const [groupGrantIncluded, setGroupGrantIncluded] = useState(true)
  const [note, setNote] = useState('')
  const [groupDurationCount, setGroupDurationCount] = useState('1')
  const [groupEffectMode, setGroupEffectMode] = useState('immediate')
  const [planUserId, setPlanUserId] = useState('')
  const [selectedCollaboratePlan, setSelectedCollaboratePlan] = useState('collaborate_start')
  const [selectedTeamPlan, setSelectedTeamPlan] = useState('team_start')
  const [teamGrantIncluded, setTeamGrantIncluded] = useState(true)
  const [teamDurationCount, setTeamDurationCount] = useState('1')
  const [teamEffectMode, setTeamEffectMode] = useState('immediate')
  const [subscriptionId, setSubscriptionId] = useState('')
  const [teamSeats, setTeamSeats] = useState('2')
  const [topupUserId, setTopupUserId] = useState('')
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId)
  const [status, setStatus] = useState('')
  const [statusKind, setStatusKind] = useState<'error' | 'ready' | 'success'>('ready')
  const [running, setRunning] = useState(false)
  const resolvedWorkspaceId = workspaceId || selectedWorkspaceId
  const hasReason = Boolean(note.trim())

  async function runMutation(label: string, mutation: () => Promise<AdminFinanceManualMutationResource>) {
    if (!enabled || running) return
    setRunning(true)
    setStatus(`${label}...`)
    setStatusKind('ready')
    try {
      const result = await mutation()
      setStatus(result.message || `${label} done.`)
      setStatusKind('success')
      onMutated()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} failed.`)
      setStatusKind('error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="management-panel management-panel-wide" aria-label="Manual finance operations">
      <div className="management-panel-heading">
        <div><h2>Manual billing ops</h2></div>
        <span className={`management-status ${statusKind === 'success' ? 'is-success' : ''}`}>{status || 'ready'}</span>
      </div>
      <FilterTextInput label="Operation reason" onChange={setNote} placeholder="required audit reason" value={note} />
      <div className="manual-finance-grid">
        <div className="manual-finance-block">
          <h3>User wallet</h3>
          <FilterTextInput label="User" leadingIcon="search" onChange={setTopupUserId} placeholder="user_id" value={topupUserId} />
          <NumberInput label="Credits" onChange={setCredits} value={credits} />
          <button className="product-button" disabled={!enabled || running || !topupUserId || !hasReason} onClick={() => runMutation('Top up user', () => adminManualTopupUser({ credits: toFloat(credits), note, userId: topupUserId }))} type="button">Top up user</button>
        </div>
        <div className="manual-finance-block">
          <h3>Team wallet</h3>
          <FilterSelect label="Workspace" onChange={setWorkspaceId} options={workspaces} value={resolvedWorkspaceId} />
          <NumberInput label="Credits" onChange={setCredits} value={credits} />
          <button className="product-button" disabled={!enabled || running || !resolvedWorkspaceId || !hasReason} onClick={() => runMutation('Top up team', () => adminManualTopupWorkspace({ credits: toFloat(credits), note, workspaceId: resolvedWorkspaceId }))} type="button">Top up team</button>
        </div>
        <div className="manual-finance-block">
          <h3>Group plan</h3>
          <FilterTextInput label="User" leadingIcon="search" onChange={setPlanUserId} placeholder="user_id" value={planUserId} />
          <StrictSelect label="Plan" onChange={setSelectedCollaboratePlan} options={collaboratePlans} value={selectedCollaboratePlan} />
          <PlanScheduleFields
            durationCount={groupDurationCount}
            effectMode={groupEffectMode}
            onDurationCountChange={setGroupDurationCount}
            onEffectModeChange={setGroupEffectMode}
          />
          <Toggle checked={groupGrantIncluded} label="Grant included credits" onChange={setGroupGrantIncluded} />
          <button className="product-button" disabled={!enabled || running || !planUserId || !hasReason} onClick={() => runMutation('Set group plan', () => adminManualSetCollaboratePlan({ durationCount: toInt(groupDurationCount), durationUnitDays: 30, effectMode: groupEffectMode, grantIncludedCredits: groupGrantIncluded, note, planKey: selectedCollaboratePlan, userId: planUserId }))} type="button">Set group plan</button>
        </div>
        <div className="manual-finance-block">
          <h3>Team plan</h3>
          <FilterSelect label="Workspace" onChange={setWorkspaceId} options={workspaces} value={resolvedWorkspaceId} />
          <StrictSelect label="Plan" onChange={setSelectedTeamPlan} options={teamPlans} value={selectedTeamPlan} />
          <NumberInput label="Seats" onChange={setTeamSeats} value={teamSeats} />
          <TeamMonthlyScheduleFields
            durationCount={teamDurationCount}
            effectMode={teamEffectMode}
            onDurationCountChange={setTeamDurationCount}
            onEffectModeChange={setTeamEffectMode}
          />
          <Toggle checked={teamGrantIncluded} label="Grant included credits" onChange={setTeamGrantIncluded} />
          <button className="product-button" disabled={!enabled || running || !resolvedWorkspaceId || !hasReason} onClick={() => runMutation('Set team plan', () => adminManualSetTeamPlan({ durationCount: toInt(teamDurationCount), durationUnitDays: 30, effectMode: teamEffectMode, grantIncludedCredits: teamGrantIncluded, note, planKey: selectedTeamPlan, seatCapacity: toInt(teamSeats), workspaceId: resolvedWorkspaceId }))} type="button">Set team plan</button>
        </div>
      </div>
      <div className="manual-finance-cancel">
        <FilterTextInput label="Subscription" onChange={setSubscriptionId} placeholder="subscription_id" value={subscriptionId} />
        <button className="product-button product-button-secondary" disabled={!enabled || running || !subscriptionId || !hasReason} onClick={() => runMutation('Cancel subscription', () => adminManualCancelSubscription(subscriptionId, note))} type="button">Cancel plan</button>
      </div>
    </section>
  )
}
