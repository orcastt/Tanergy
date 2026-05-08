'use client'

import { useState } from 'react'
import {
  adminManualCancelSubscription,
  adminManualSetCollaboratePlan,
  adminManualSetTeamPlan,
  adminManualTopupUser,
  adminManualTopupWorkspace,
  type AdminFinanceManualMutationResource,
} from './adminFinanceClient'
import { FilterSelect, FilterTextInput, selectStyle } from './adminAiShared'

const collaboratePlans = ['collaborate_start', 'collaborate_plus']
const teamPlans = ['team_start', 'team_growth']

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
  const [amountCents, setAmountCents] = useState('0')
  const [credits, setCredits] = useState('100')
  const [grantIncluded, setGrantIncluded] = useState(true)
  const [note, setNote] = useState('')
  const [planUserId, setPlanUserId] = useState('')
  const [selectedCollaboratePlan, setSelectedCollaboratePlan] = useState('collaborate_start')
  const [selectedTeamPlan, setSelectedTeamPlan] = useState('team_start')
  const [subscriptionId, setSubscriptionId] = useState('')
  const [teamSeats, setTeamSeats] = useState('2')
  const [topupUserId, setTopupUserId] = useState('')
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId)
  const [status, setStatus] = useState('')
  const [statusKind, setStatusKind] = useState<'error' | 'ready' | 'success'>('ready')
  const [running, setRunning] = useState(false)
  const resolvedWorkspaceId = workspaceId || selectedWorkspaceId

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
        <div><h2>Manual billing ops</h2><p>Assign plans, top up credits and cancel subscriptions without Stripe.</p></div>
        <span className={`management-status ${statusKind === 'success' ? 'is-success' : ''}`}>{status || 'ready'}</span>
      </div>
      <div className="manual-finance-grid">
        <div className="manual-finance-block">
          <h3>User wallet</h3>
          <FilterTextInput label="User" onChange={setTopupUserId} placeholder="user_id" value={topupUserId} />
          <NumberInput label="Credits" onChange={setCredits} value={credits} />
          <NumberInput label="Amount cents" onChange={setAmountCents} value={amountCents} />
          <button className="product-button" disabled={!enabled || running || !topupUserId} onClick={() => runMutation('Top up user', () => adminManualTopupUser({ amountCents: toInt(amountCents), credits: toFloat(credits), note, userId: topupUserId }))} type="button">Top up user</button>
        </div>
        <div className="manual-finance-block">
          <h3>Team wallet</h3>
          <FilterSelect label="Workspace" onChange={setWorkspaceId} options={workspaces} value={resolvedWorkspaceId} />
          <NumberInput label="Credits" onChange={setCredits} value={credits} />
          <NumberInput label="Amount cents" onChange={setAmountCents} value={amountCents} />
          <button className="product-button" disabled={!enabled || running || !resolvedWorkspaceId} onClick={() => runMutation('Top up team', () => adminManualTopupWorkspace({ amountCents: toInt(amountCents), credits: toFloat(credits), note, workspaceId: resolvedWorkspaceId }))} type="button">Top up team</button>
        </div>
        <div className="manual-finance-block">
          <h3>Group plan</h3>
          <FilterTextInput label="User" onChange={setPlanUserId} placeholder="user_id" value={planUserId} />
          <StrictSelect label="Plan" onChange={setSelectedCollaboratePlan} options={collaboratePlans} value={selectedCollaboratePlan} />
          <Toggle checked={grantIncluded} label="Grant included credits" onChange={setGrantIncluded} />
          <button className="product-button" disabled={!enabled || running || !planUserId} onClick={() => runMutation('Set group plan', () => adminManualSetCollaboratePlan({ grantIncludedCredits: grantIncluded, note, planKey: selectedCollaboratePlan, userId: planUserId }))} type="button">Set group plan</button>
        </div>
        <div className="manual-finance-block">
          <h3>Team plan</h3>
          <FilterSelect label="Workspace" onChange={setWorkspaceId} options={workspaces} value={resolvedWorkspaceId} />
          <StrictSelect label="Plan" onChange={setSelectedTeamPlan} options={teamPlans} value={selectedTeamPlan} />
          <NumberInput label="Seats" onChange={setTeamSeats} value={teamSeats} />
          <Toggle checked={grantIncluded} label="Grant included credits" onChange={setGrantIncluded} />
          <button className="product-button" disabled={!enabled || running || !resolvedWorkspaceId} onClick={() => runMutation('Set team plan', () => adminManualSetTeamPlan({ grantIncludedCredits: grantIncluded, note, planKey: selectedTeamPlan, seatCapacity: toInt(teamSeats), workspaceId: resolvedWorkspaceId }))} type="button">Set team plan</button>
        </div>
      </div>
      <div className="manual-finance-cancel">
        <FilterTextInput label="Subscription" onChange={setSubscriptionId} placeholder="subscription_id" value={subscriptionId} />
        <FilterTextInput label="Note" onChange={setNote} placeholder="optional internal note" value={note} />
        <button className="product-button product-button-secondary" disabled={!enabled || running || !subscriptionId} onClick={() => runMutation('Cancel subscription', () => adminManualCancelSubscription(subscriptionId, note))} type="button">Cancel plan</button>
      </div>
    </section>
  )
}

function NumberInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <input min="0" onChange={(event) => onChange(event.target.value)} style={selectStyle} type="number" value={value} />
    </label>
  )
}

function StrictSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="manual-finance-toggle"><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>
}

function toFloat(value: string) {
  return Math.max(0, Number.parseFloat(value) || 0)
}

function toInt(value: string) {
  return Math.max(0, Math.trunc(Number.parseFloat(value) || 0))
}
