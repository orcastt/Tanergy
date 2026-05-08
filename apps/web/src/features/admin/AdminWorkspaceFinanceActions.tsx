'use client'

import { useState } from 'react'
import { adminManualSetTeamPlan, adminManualTopupWorkspace } from './adminFinanceClient'
import { FilterTextInput, selectStyle } from './adminAiShared'

const teamPlans = ['team_start', 'team_growth']

export function AdminWorkspaceFinanceActions({
  enabled,
  onMutated,
  workspaceId,
}: {
  enabled: boolean
  onMutated: () => void
  workspaceId: string
}) {
  const [amountCents, setAmountCents] = useState('0')
  const [credits, setCredits] = useState('100')
  const [grantIncluded, setGrantIncluded] = useState(true)
  const [note, setNote] = useState('')
  const [planKey, setPlanKey] = useState('team_start')
  const [seatCapacity, setSeatCapacity] = useState('2')
  const [status, setStatus] = useState('ready')
  const [running, setRunning] = useState(false)

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
    <article className="manual-finance-block">
      <div className="management-panel-heading compact">
        <div><h3>Team billing actions</h3><p>{workspaceId || 'Select a Team first.'}</p></div>
        <span className="management-status">{status}</span>
      </div>
      <div className="management-field-grid two">
        <NumberInput label="Credits" onChange={setCredits} value={credits} />
        <NumberInput label="Amount cents" onChange={setAmountCents} value={amountCents} />
      </div>
      <FilterTextInput label="Note" onChange={setNote} placeholder="optional internal note" value={note} />
      <button
        className="product-button"
        disabled={!enabled || running || !workspaceId}
        onClick={() => run('Top up team', () => adminManualTopupWorkspace({
          amountCents: toInt(amountCents),
          credits: toFloat(credits),
          note,
          workspaceId,
        }))}
        type="button"
      >
        Top up Team wallet
      </button>
      <div className="management-field-grid two">
        <StrictSelect label="Plan" onChange={setPlanKey} options={teamPlans} value={planKey} />
        <NumberInput label="Seats" onChange={setSeatCapacity} value={seatCapacity} />
      </div>
      <Toggle checked={grantIncluded} label="Grant included credits" onChange={setGrantIncluded} />
      <button
        className="product-button product-button-secondary"
        disabled={!enabled || running || !workspaceId}
        onClick={() => run('Assign team plan', () => adminManualSetTeamPlan({
          grantIncludedCredits: grantIncluded,
          note,
          planKey,
          seatCapacity: toInt(seatCapacity),
          workspaceId,
        }))}
        type="button"
      >
        Assign Team plan
      </button>
    </article>
  )
}

function NumberInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="management-field-label">{label}</span>
      <input min="0" onChange={(event) => onChange(event.target.value)} style={selectStyle} type="number" value={value} />
    </label>
  )
}

function StrictSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="management-field-label">{label}</span>
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
