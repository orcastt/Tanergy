'use client'

import { useState } from 'react'
import { adminManualSetCollaboratePlan, adminManualTopupUser } from './adminFinanceClient'
import { FilterTextInput, selectStyle } from './adminAiShared'

const collaboratePlans = ['collaborate_start', 'collaborate_plus']

export function AdminUserFinanceActions({
  enabled,
  onMutated,
  title = 'User billing actions',
  userId,
}: {
  enabled: boolean
  onMutated: () => void
  title?: string
  userId: string
}) {
  const [amountCents, setAmountCents] = useState('0')
  const [credits, setCredits] = useState('100')
  const [grantIncluded, setGrantIncluded] = useState(true)
  const [note, setNote] = useState('')
  const [planKey, setPlanKey] = useState('collaborate_start')
  const [status, setStatus] = useState('ready')
  const [running, setRunning] = useState(false)

  async function run(label: string, action: () => Promise<{ message: string }>) {
    if (!enabled || running || !userId) return
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
        <div><h3>{title}</h3><p>{userId || 'Select a user first.'}</p></div>
        <span className="management-status">{status}</span>
      </div>
      <div className="management-field-grid two">
        <NumberInput label="Credits" onChange={setCredits} value={credits} />
        <NumberInput label="Amount cents" onChange={setAmountCents} value={amountCents} />
      </div>
      <FilterTextInput label="Note" onChange={setNote} placeholder="optional internal note" value={note} />
      <button
        className="product-button"
        disabled={!enabled || running || !userId}
        onClick={() => run('Top up user', () => adminManualTopupUser({
          amountCents: toInt(amountCents),
          credits: toFloat(credits),
          note,
          userId,
        }))}
        type="button"
      >
        Top up user wallet
      </button>
      <div className="management-field-grid two">
        <StrictSelect label="Plan" onChange={setPlanKey} options={collaboratePlans} value={planKey} />
        <Toggle checked={grantIncluded} label="Grant credits" onChange={setGrantIncluded} />
      </div>
      <button
        className="product-button product-button-secondary"
        disabled={!enabled || running || !userId}
        onClick={() => run('Assign collaborate plan', () => adminManualSetCollaboratePlan({
          grantIncludedCredits: grantIncluded,
          note,
          planKey,
          userId,
        }))}
        type="button"
      >
        Assign Collaborate / Group plan
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
